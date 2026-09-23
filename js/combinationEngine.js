// combinationEngine.js - Logic for antibody combinations and channel multiplexing with wavelength matching

const CombinationEngine = {
    
    hasApplication(appString, app) {
        if (!appString) return false;
        return appString.split(',').map(a => a.trim().toLowerCase()).includes(app.toLowerCase());
    },

    generateCombinations(config) {
        try {
            // config: { application, mode, allowedChannels, configuredChannels, reporters, targets, dyes, lockedTargets, lockedDyes, lockedReporters, scoringWeights }
            const application = config.application || 'ICC';
            const targets = config.targets || [];
            const lockedTargets = config.lockedTargets || [];
            const reporters = config.reporters || [];
            const dyes = config.dyes || [];
            const lockedDyes = config.lockedDyes || [];
            const lockedReporters = config.lockedReporters || [];
            const allowedChannels = (config.allowedChannels && config.allowedChannels.length > 0)
                ? config.allowedChannels
                : ['Blue', 'Green', 'Red', 'Far-Red'];
            const configuredChannels = config.configuredChannels || [];
            const excludedReagents = [];

            // 1. Map all dyes and reporters to their detection channels
            const dyeChannelMap = new Map();
            for (let d of dyes) {
                const ch = this.matchChannelForReagent(d, configuredChannels, allowedChannels);
                dyeChannelMap.set(d, ch);
            }

            const repChannelMap = new Map();
            for (let r of reporters) {
                const ch = this.matchChannelForReagent(r, configuredChannels, allowedChannels);
                repChannelMap.set(r, ch);
            }

            // 2. Direct Locked-on-Locked Check:
            // Check if two or more locked reagents claim the same detection channel
            const lockedByChannel = {};
            for (let d of dyes) {
                if (lockedDyes.includes(d.id)) {
                    const ch = dyeChannelMap.get(d);
                    if (ch) {
                        if (!lockedByChannel[ch]) lockedByChannel[ch] = [];
                        lockedByChannel[ch].push({ name: d.name, type: 'Dye', item: d });
                    }
                }
            }
            for (let r of reporters) {
                const rId = r.id || r.reporter || r.reporter_name;
                if (lockedReporters.includes(rId) || lockedReporters.includes(r.reporter) || lockedReporters.includes(r.target)) {
                    const ch = repChannelMap.get(r);
                    if (ch) {
                        const repTitle = r.target ? `${r.target} (${r.reporter || r.reporter_name})` : (r.reporter || r.reporter_name || 'Reporter');
                        if (!lockedByChannel[ch]) lockedByChannel[ch] = [];
                        lockedByChannel[ch].push({ name: repTitle, type: 'Reporter', item: r });
                    }
                }
            }

            for (let ch in lockedByChannel) {
                if (lockedByChannel[ch].length > 1) {
                    const names = lockedByChannel[ch].map(x => `"${x.name}"`).join(' and ');
                    return {
                        combinations: [],
                        excludedReagents: [],
                        error: `Direct Conflict: Both ${names} are locked into the ${ch} channel. Two locked reagents cannot share the same detection channel. Please unlock one of them to generate valid combinations.`
                    };
                }
            }

            // 3. Channel Reservation & Exclusion of Unlocked Reagents in Locked Channels
            const reservedChannels = new Set(Object.keys(lockedByChannel)); // e.g. Set(['Blue'])

            const activeDyes = [];
            for (let d of dyes) {
                const isLocked = lockedDyes.includes(d.id);
                const ch = dyeChannelMap.get(d);
                if (isLocked) {
                    activeDyes.push(d);
                } else {
                    if (ch && reservedChannels.has(ch)) {
                        const lockerName = lockedByChannel[ch][0].name;
                        excludedReagents.push({
                            name: d.name,
                            channel: ch,
                            reason: `The ${ch} channel is reserved by locked "${lockerName}".`
                        });
                    } else if (ch) {
                        activeDyes.push(d);
                    }
                }
            }

            const activeReporters = [];
            for (let r of reporters) {
                const rId = r.id || r.reporter || r.reporter_name;
                const isLocked = lockedReporters.includes(rId) || lockedReporters.includes(r.reporter) || lockedReporters.includes(r.target);
                const ch = repChannelMap.get(r);
                const repTitle = r.target ? `${r.target} (${r.reporter || r.reporter_name})` : (r.reporter || r.reporter_name || 'Reporter');
                if (isLocked) {
                    activeReporters.push(r);
                } else {
                    if (ch && reservedChannels.has(ch)) {
                        const lockerName = lockedByChannel[ch][0].name;
                        excludedReagents.push({
                            name: repTitle,
                            channel: ch,
                            reason: `The ${ch} channel is reserved by locked "${lockerName}".`
                        });
                    } else if (ch) {
                        activeReporters.push(r);
                    }
                }
            }

            // 4. Group Direct Reagents (Dyes and Reporters) by Channel for Conflict-Free Branching
            const directByChannel = {};
            for (let ch of allowedChannels) {
                directByChannel[ch] = [];
            }

            for (let d of activeDyes) {
                const ch = dyeChannelMap.get(d);
                if (ch && directByChannel[ch]) {
                    directByChannel[ch].push({ type: 'Dye', item: d, channel: ch, locked: lockedDyes.includes(d.id) });
                }
            }

            for (let r of activeReporters) {
                const ch = repChannelMap.get(r);
                const rId = r.id || r.reporter || r.reporter_name;
                const isLocked = lockedReporters.includes(rId) || lockedReporters.includes(r.reporter) || lockedReporters.includes(r.target);
                if (ch && directByChannel[ch]) {
                    directByChannel[ch].push({ type: 'Reporter', item: r, channel: ch, locked: isLocked });
                }
            }

            // Build direct reagent combinations across channels (at most one reagent per channel)
            let directBranches = [ { channels: {}, assignedDyes: [], reporters: [] } ];

            for (let ch of allowedChannels) {
                const items = directByChannel[ch] || [];
                if (items.length === 0) continue; // Free channel

                const lockedItem = items.find(i => i.locked);
                if (lockedItem) {
                    // Locked item must be in all branches
                    for (let branch of directBranches) {
                        branch.channels[ch] = lockedItem;
                        if (lockedItem.type === 'Dye') {
                            branch.assignedDyes.push({ dye: lockedItem.item, channel: ch });
                        } else {
                            branch.reporters.push(lockedItem.item);
                        }
                    }
                } else {
                    // Competing or optional unlocked items:
                    // Branch for each candidate reagent, plus an open branch if antibody targets need channels
                    const newBranches = [];
                    for (let branch of directBranches) {
                        for (let cand of items) {
                            const bCopy = {
                                channels: { ...branch.channels, [ch]: cand },
                                assignedDyes: cand.type === 'Dye' ? [...branch.assignedDyes, { dye: cand.item, channel: ch }] : [...branch.assignedDyes],
                                reporters: cand.type === 'Reporter' ? [...branch.reporters, cand.item] : [...branch.reporters]
                            };
                            newBranches.push(bCopy);
                        }
                        if (targets.length > 0) {
                            newBranches.push({
                                channels: { ...branch.channels },
                                assignedDyes: [...branch.assignedDyes],
                                reporters: [...branch.reporters]
                            });
                        }
                    }
                    directBranches = newBranches;
                }
            }

            // 5. Filter Primaries validated for this application & mode
            const allPrimaries = (window.db && Array.isArray(window.db.primaries)) ? window.db.primaries : [];
            let validPrimaries = allPrimaries.filter(p => this.hasApplication(p.applications, application));
            if (config.mode === 'Live') {
                validPrimaries = validPrimaries.filter(p => p.live_cell_compatible === 'Yes');
            }

            let fullCombos = [];
            const seenComboSignatures = new Set();

            // 6. For each directBranch, assign primary/secondary antibody combinations into available channels
            for (let branch of directBranches) {
                const usedChannels = Object.keys(branch.channels);
                const channelsAvailableForAntibodies = allowedChannels.filter(c => !usedChannels.includes(c));

                // Targets covered by reporters in this branch
                const coveredByRep = branch.reporters.map(r => r.target).filter(Boolean);
                const targetsToStain = targets.filter(t => !coveredByRep.some(ct => ct.toLowerCase() === t.toLowerCase()));
                const lockedTargetsToStain = lockedTargets.filter(t => !coveredByRep.some(ct => ct.toLowerCase() === t.toLowerCase()));

                if (targetsToStain.length === 0) {
                    // No antibodies needed! This branch is complete
                    const coveredList = Array.from(new Set([...coveredByRep]));
                    const panel = {
                        primaries: [],
                        reporters: branch.reporters,
                        assignedDyes: branch.assignedDyes,
                        channels_used: usedChannels,
                        targets_requested: targets,
                        targets_covered: coveredList,
                        conflicts: []
                    };
                    panel.fixation = this.checkFixationCompatibility(panel);
                    panel.score = this.scoreCombination(panel, application, config.scoringWeights);

                    const sig = this.getComboSignature(panel);
                    if (!seenComboSignatures.has(sig)) {
                        seenComboSignatures.add(sig);
                        fullCombos.push(panel);
                    }
                    continue;
                }

                if (channelsAvailableForAntibodies.length === 0) {
                    continue;
                }

                const maxChannels = channelsAvailableForAntibodies.length;
                const targetSubsets = this.generateSubsets(targetsToStain, lockedTargetsToStain, maxChannels);

                for (let subset of targetSubsets) {
                    let targetPrimariesList = [];
                    let subsetValid = true;
                    for (let target of subset) {
                        let matches = validPrimaries.filter(p => p.target && p.target.toLowerCase() === target.toLowerCase());
                        if (matches.length === 0) {
                            subsetValid = false;
                            break;
                        }
                        targetPrimariesList.push(matches);
                    }
                    if (!subsetValid || targetPrimariesList.length === 0) continue;

                    let primaryCombos = this.cartesianProduct(targetPrimariesList).filter(combo => this.checkPrimaryConflict(combo, application));

                    for (let pCombo of primaryCombos) {
                        const assignments = this.assignSecondariesToPrimaries(pCombo, application, usedChannels, allowedChannels, configuredChannels);

                        for (let assignment of assignments) {
                            const assignedChannels = assignment.map(a => a.channel);
                            const totalChannelsUsed = [...usedChannels, ...assignedChannels];
                            const coveredTargetsList = [
                                ...subset,
                                ...coveredByRep
                            ];

                            const panel = {
                                primaries: assignment,
                                reporters: branch.reporters,
                                assignedDyes: branch.assignedDyes,
                                channels_used: totalChannelsUsed,
                                targets_requested: targets,
                                targets_covered: Array.from(new Set(coveredTargetsList)),
                                conflicts: []
                            };

                            panel.fixation = this.checkFixationCompatibility(panel);
                            panel.score = this.scoreCombination(panel, application, config.scoringWeights);

                            const sig = this.getComboSignature(panel);
                            if (!seenComboSignatures.has(sig)) {
                                seenComboSignatures.add(sig);
                                fullCombos.push(panel);
                            }
                        }
                    }
                }
            }

            // Sort: Targets covered (desc) -> Score (desc)
            fullCombos.sort((a, b) => {
                const aCov = (a.targets_covered || []).length;
                const bCov = (b.targets_covered || []).length;
                if (bCov !== aCov) return bCov - aCov;
                return (b.score || 0) - (a.score || 0);
            });

            if (fullCombos.length > 50) {
                fullCombos = fullCombos.slice(0, 50);
            }

            return {
                combinations: fullCombos,
                excludedReagents: excludedReagents,
                error: null
            };
        } catch (err) {
            console.error("[SpectraPanel CombinationEngine] Error:", err);
            return { error: err.message, combinations: [], excludedReagents: [] };
        }
    },

    assignSecondariesToPrimaries(pCombo, application, usedChannels, allowedChannels, configuredChannels) {
        const availableChannels = allowedChannels.filter(c => !usedChannels.includes(c));
        if (pCombo.length > availableChannels.length) return [];

        const primaryOptions = [];

        for (let p of pCombo) {
            if (p.conjugated_fluorophore) {
                const c = this.matchChannelForReagent({ color: p.conjugated_color, name: p.conjugated_fluorophore }, configuredChannels, allowedChannels);
                if (!c || !availableChannels.includes(c)) {
                    return [];
                }
                primaryOptions.push([{
                    primary: p,
                    secondary: null,
                    channel: c,
                    is_direct: true
                }]);
            } else {
                const validSecs = this.findCompatibleSecondaries(p, application, usedChannels, pCombo, allowedChannels, configuredChannels);
                if (validSecs.length === 0) {
                    return [];
                }
                const options = validSecs.map(s => ({
                    primary: p,
                    secondary: s,
                    channel: s.channel_assigned,
                    is_direct: false
                }));
                primaryOptions.push(options);
            }
        }

        const assignments = [];

        function backtrack(pIdx, currentAssignment, channelsUsed) {
            if (pIdx === primaryOptions.length) {
                assignments.push([...currentAssignment]);
                return;
            }

            const options = primaryOptions[pIdx];
            for (let opt of options) {
                if (!channelsUsed.has(opt.channel)) {
                    let hasCrossConflict = false;
                    if (!opt.is_direct && opt.secondary) {
                        const secHost = (opt.secondary.host || '').toLowerCase();
                        for (let otherP of pCombo) {
                            if (otherP !== opt.primary && (otherP.host || '').toLowerCase() === secHost) {
                                hasCrossConflict = true;
                                break;
                            }
                        }
                    }

                    if (!hasCrossConflict) {
                        channelsUsed.add(opt.channel);
                        currentAssignment.push(opt);
                        backtrack(pIdx + 1, currentAssignment, channelsUsed);
                        currentAssignment.pop();
                        channelsUsed.delete(opt.channel);
                    }
                }
            }
        }

        backtrack(0, [], new Set());
        return assignments;
    },

    getComboSignature(panel) {
        const parts = [];
        (panel.primaries || []).forEach(p => {
            const sec = p.is_direct ? `Direct-${p.primary.conjugated_color}` : (p.secondary ? p.secondary.id || p.secondary.conjugate : '');
            parts.push(`${p.channel}:${p.primary.id || p.primary.target}:${sec}`);
        });
        (panel.assignedDyes || []).forEach(d => {
            parts.push(`${d.channel}:${d.dye.id || d.dye.name}`);
        });
        (panel.reporters || []).forEach(r => {
            parts.push(`Reporter:${r.id || r.reporter || r.target}`);
        });
        return parts.sort().join('|');
    },

    generateSubsets(targets, lockedTargets, maxChannels) {
        let unlockedTargets = targets.filter(t => !lockedTargets.includes(t));
        let subsets = [];
        
        if (lockedTargets.length > maxChannels) return [];

        const getSubsets = (array) => array.reduce(
            (subsets, value) => subsets.concat(
             subsets.map(set => [value, ...set])
            ),
            [[]]
        );

        let unlockedSubsets = getSubsets(unlockedTargets);
        
        for (let sub of unlockedSubsets) {
            let combined = [...lockedTargets, ...sub];
            if (combined.length <= maxChannels && combined.length > 0) {
                subsets.push(combined);
            }
        }
        
        subsets.sort((a, b) => b.length - a.length);
        
        const uniqueSubsets = [];
        const seen = new Set();
        for (let sub of subsets) {
            let key = [...sub].sort().join(',');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueSubsets.push(sub);
            }
        }
        
        return uniqueSubsets;
    },

    cartesianProduct(arr) {
        if (arr.length === 0) return [];
        if (arr.length === 1) return arr[0].map(item => [item]);
        return arr.reduce((a, b) => 
            a.flatMap(d => b.map(e => [...(Array.isArray(d) ? d : [d]), e]))
        );
    },

    checkPrimaryConflict(combo, application) {
        let hostMap = {};
        for (let p of combo) {
            if (p.conjugated_fluorophore) continue; 
            let host = p.host;
            if (!hostMap[host]) hostMap[host] = [];
            hostMap[host].push(p);
        }

        for (let host in hostMap) {
            if (hostMap[host].length > 1) {
                let isotypes = new Set();
                for (let p of hostMap[host]) {
                    if (!p.isotype || isotypes.has(p.isotype)) return false; 
                    isotypes.add(p.isotype);
                }
            }
        }
        return true;
    },

    findCompatibleSecondaries(primary, application, usedChannels, allPrimaries, allowedChannels, configuredChannels) {
        const secDb = (window.db && Array.isArray(window.db.secondaries)) ? window.db.secondaries : [];
        let validSecs = secDb.filter(s => this.hasApplication(s.applications, application));
        const priHost = (primary.host || '').toLowerCase();
        validSecs = validSecs.filter(s => s.anti_host && s.anti_host.toLowerCase() === priHost);
        
        let sameHostCount = allPrimaries.filter(p => !p.conjugated_fluorophore && p.host === primary.host).length;
        if (sameHostCount > 1) {
            validSecs = validSecs.filter(s => s.anti_isotype === primary.isotype);
        } else {
            validSecs = validSecs.filter(s => s.anti_isotype === primary.isotype || (s.anti_isotype && s.anti_isotype.includes("H+L")) || s.anti_isotype === "IgG");
        }

        if (application === 'WB') {
            let hrpSecs = validSecs.filter(s => s.conjugate_type === 'HRP');
            if (hrpSecs.length > 0 && allowedChannels.includes('HRP')) {
                hrpSecs.forEach(s => s.channel_assigned = 'HRP');
                return hrpSecs;
            }
        }

        let compatible = [];
        for (let s of validSecs) {
            if (s.conjugate_type === 'HRP') continue;
            let assignedChannel = this.matchChannelForReagent(s, configuredChannels, allowedChannels);
            if (assignedChannel && this.isChannelAvailable(usedChannels, assignedChannel, application, allowedChannels)) {
                let secCopy = { ...s, channel_assigned: assignedChannel };
                compatible.push(secCopy);
            }
        }

        return compatible;
    },

    getInferredChannelColor(ch) {
        if (!ch) return '';
        if (ch.color) return String(ch.color).toLowerCase();
        const name = (ch.name || '').toLowerCase();
        if (name.includes('blue') || name.includes('dapi') || name.includes('uv') || name.includes('hoechst') || name.includes('405')) return 'blue';
        if (name.includes('green') || name.includes('fitc') || name.includes('gfp') || name.includes('488')) return 'green';
        if (name.includes('orange') || name.includes('594') || name.includes('texas')) return 'orange';
        if (name.includes('far') || name.includes('cy5') || name.includes('647') || name.includes('deep')) return 'far-red';
        if (name.includes('near') || name.includes('nir') || name.includes('cy7') || name.includes('750') || name.includes('800')) return 'near-ir';
        if (name.includes('red') || name.includes('555') || name.includes('568') || name.includes('tritc') || name.includes('mcherry') || name.includes('cy3')) return 'red';

        // Optical fallback based on emission midpoint
        const emMid = ((parseFloat(ch.em_min) || 0) + (parseFloat(ch.em_max) || 0)) / 2;
        if (emMid > 0) {
            if (emMid < 490) return 'blue';
            if (emMid < 550) return 'green';
            if (emMid < 605) return 'red';
            if (emMid < 640) return 'orange';
            if (emMid < 730) return 'far-red';
            return 'near-ir';
        }
        return name;
    },

    matchChannelForReagent(reagent, configuredChannels, allowedChannels) {
        if (!reagent || !allowedChannels || allowedChannels.length === 0) return null;
        
        // HRP Check
        if (reagent.conjugate_type === 'HRP' || reagent.conjugate === 'HRP') {
            return allowedChannels.includes('HRP') ? 'HRP' : null;
        }

        const ex = parseFloat(reagent.excitation_nm);
        const em = parseFloat(reagent.emission_nm);
        const rFluor = (reagent.reporter || reagent.reporter_name || reagent.fluorophore || reagent.conjugate || reagent.name || '').toLowerCase();
        const rColor = (reagent.color || rFluor).toLowerCase();

        // 1. Primary rule: match by emission max (and excitation if present) against configured channels
        if (!isNaN(em) && Array.isArray(configuredChannels) && configuredChannels.length > 0) {
            // First check if both ex and em match a channel
            if (!isNaN(ex)) {
                for (let ch of configuredChannels) {
                    if (!ch || !allowedChannels.includes(ch.name)) continue;
                    if (ex >= ch.ex_min && ex <= ch.ex_max && em >= ch.em_min && em <= ch.em_max) {
                        return ch.name;
                    }
                }
            }
            // Next: emission peak alone determines the channel in the custom channel builder
            for (let ch of configuredChannels) {
                if (!ch || !allowedChannels.includes(ch.name)) continue;
                if (em >= ch.em_min && em <= ch.em_max) {
                    return ch.name;
                }
            }
        }

        // 2. Fallback: match by color name / keyword against configuredChannels
        if (Array.isArray(configuredChannels) && configuredChannels.length > 0) {
            for (let ch of configuredChannels) {
                if (!ch || !allowedChannels.includes(ch.name)) continue;
                const chName = (ch.name || '').toLowerCase();
                const chColor = this.getInferredChannelColor(ch);
                
                // Exact or substring match of channel name / color in reagent descriptor
                if (rColor && (rColor.includes(chName) || (chColor && rColor.includes(chColor)))) return ch.name;
                if (rFluor && (rFluor.includes(chName) || (chColor && rFluor.includes(chColor)))) return ch.name;

                // Color family keyword matches
                if (chColor === 'blue' && (rColor.includes('blue') || rFluor.includes('dapi') || rFluor.includes('bfp') || rFluor.includes('hoechst') || rFluor.includes('405'))) return ch.name;
                if (chColor === 'green' && (rColor.includes('green') || rFluor.includes('fitc') || rFluor.includes('gfp') || rFluor.includes('egfp') || rFluor.includes('488') || rFluor.includes('af488'))) return ch.name;
                if (chColor === 'orange' && (rColor.includes('orange') || rFluor.includes('594') || rFluor.includes('texas') || rFluor.includes('568'))) return ch.name;
                if (chColor === 'red' && (rColor.includes('red') || rFluor.includes('tritc') || rFluor.includes('555') || rFluor.includes('568') || rFluor.includes('594') || rFluor.includes('mcherry') || rFluor.includes('cy3') || rFluor.includes('mitotracker'))) return ch.name;
                if (chColor === 'far-red' && (rColor.includes('far-red') || rColor.includes('far red') || rFluor.includes('cy5') || rFluor.includes('647') || rFluor.includes('alexa 647') || rFluor.includes('sir') || rFluor.includes('irfp'))) return ch.name;
                if (chColor === 'near-ir' && (rColor.includes('near-ir') || rColor.includes('near ir') || rFluor.includes('750') || rFluor.includes('cy7') || rFluor.includes('800'))) return ch.name;
            }
        }

        // 3. Fallback: standard color name matching directly in allowedChannels
        for (let chName of allowedChannels) {
            const chLower = (chName || '').toLowerCase();
            if (rColor && chLower && (rColor.includes(chLower) || chLower.includes(rColor))) return chName;
            if (rFluor && chLower && (rFluor.includes(chLower) || chLower.includes(rFluor))) return chName;
            if (chLower.includes('blue') && (rFluor.includes('dapi') || rFluor.includes('bfp') || rFluor.includes('hoechst'))) return chName;
            if (chLower.includes('green') && (rFluor.includes('fitc') || rFluor.includes('gfp') || rFluor.includes('egfp') || rFluor.includes('488'))) return chName;
            if (chLower.includes('orange') && (rFluor.includes('594') || rFluor.includes('texas'))) return chName;
            if (chLower.includes('red') && (rFluor.includes('tritc') || rFluor.includes('555') || rFluor.includes('568') || rFluor.includes('594') || rFluor.includes('mcherry'))) return chName;
            if (chLower.includes('far') && (rFluor.includes('cy5') || rFluor.includes('647') || rFluor.includes('sir') || rFluor.includes('irfp'))) return chName;
            if (chLower.includes('near') && (rFluor.includes('750') || rFluor.includes('cy7') || rFluor.includes('800'))) return chName;
        }

        return null;
    },

    isChannelAvailable(used, color, application, allowedChannels) {
        if (!allowedChannels.includes(color)) return false;
        return !used.includes(color);
    },

    checkFixationCompatibility(panelConfig) {
        let reqs = [];
        (panelConfig.primaries || []).forEach(p => {
            if (p && p.primary) reqs.push({ name: p.primary.target || 'Target', compat: p.primary.fixation_compatible || "" });
        });
        (panelConfig.reporters || []).forEach(r => {
            if (r) {
                const repTitle = r.target ? `${r.target} (${r.reporter || r.reporter_name})` : (r.reporter || r.reporter_name || 'Reporter');
                reqs.push({ name: repTitle, compat: r.recommended_fixation || "" });
            }
        });
        (panelConfig.assignedDyes || []).forEach(d => {
            if (d && d.dye) reqs.push({ name: d.dye.name || 'Dye', compat: d.dye.notes || d.dye.fixation_compatible || "" }); 
        });
        
        let needsMethanol = false;
        let needsPFA = false;
        let conflicts = [];

        reqs.forEach(r => {
            let c = (r.compat || '').toLowerCase();
            if (c.includes("methanol") && !c.includes("pfa")) needsMethanol = true;
            if (c.includes("pfa") && !c.includes("methanol")) needsPFA = true;
        });

        if (needsMethanol && needsPFA) {
            conflicts.push("Fixation Conflict: Reagents require contrasting fixatives (Methanol vs PFA).");
        }

        return { valid: conflicts.length === 0, warnings: conflicts };
    },

    scoreCombination(panel, application, userWeights) {
        const weights = Object.assign({
            coverage: 40,
            crossAdsorption: 20,
            hostDiversity: 15,
            fixationPenalty: 30,
            spectralPenalty: 35
        }, userWeights || {});

        let score = 100;

        // 1. Target Coverage
        const requested = (panel.targets_requested || []).length;
        const covered = (panel.targets_covered || []).length;
        if (requested > 0 && covered < requested) {
            const missingRatio = (requested - covered) / requested;
            score -= Math.round(missingRatio * weights.coverage);
        }

        // 2. Fixation Compatibility Penalty
        if (panel.fixation && !panel.fixation.valid) {
            score -= weights.fixationPenalty;
        }

        // 3. Spectral Overlap / Channel Conflict Penalty
        if (panel.conflicts && panel.conflicts.length > 0) {
            score -= (panel.conflicts.length * weights.spectralPenalty);
        }

        // 4. Host Diversity Bonus
        let hosts = new Set((panel.primaries || []).map(p => (p && p.primary) ? p.primary.host : '').filter(Boolean));
        if (hosts.size > 1) {
            score += Math.round((hosts.size - 1) * (weights.hostDiversity / 3));
        }

        // 5. Cross-Adsorption Specificity Bonus
        let otherHosts = Array.from(hosts);
        (panel.primaries || []).forEach(p => {
            if (p && p.primary && p.secondary) {
                const text = ((p.secondary.cross_adsorbed || '') + ' ' + (p.secondary.comments || '')).toLowerCase();
                if (text.includes('cross') || text.includes('adsorbed')) {
                    score += Math.round(weights.crossAdsorption / 4);
                }
            }
        });

        return Math.max(0, Math.round(score));
    }
};
