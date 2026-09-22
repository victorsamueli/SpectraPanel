// combinationEngine.js - Logic for antibody combinations and channel multiplexing with wavelength matching

const CombinationEngine = {
    
    hasApplication(appString, app) {
        if (!appString) return false;
        return appString.split(',').map(a => a.trim().toLowerCase()).includes(app.toLowerCase());
    },

    generateCombinations(config) {
        try {
            // config: { application, mode, allowedChannels, configuredChannels, reporters, targets, dyes, lockedTargets, lockedDyes }
            const application = config.application || 'ICC';
            const targets = config.targets || [];
            const lockedTargets = config.lockedTargets || [];
            const reporters = config.reporters || [];
            const dyes = config.dyes || [];
            const lockedDyes = config.lockedDyes || [];
            const allowedChannels = (config.allowedChannels && config.allowedChannels.length > 0)
                ? config.allowedChannels
                : ['Blue', 'Green', 'Red', 'Far-Red'];
            const configuredChannels = config.configuredChannels || [];

            // Case: No primary antibodies selected, but dyes or reporters are selected
            if (targets.length === 0) {
                if (reporters.length > 0 || dyes.length > 0) {
                    const panelConfig = {
                        primaries: [],
                        reporters: reporters,
                        dyes: dyes,
                        channels_used: [],
                        targets_requested: [],
                        targets_covered: reporters.map(r => r.target).filter(Boolean),
                        assignedDyes: []
                    };

                    let comboValid = true;
                    for (let rep of reporters) {
                        const c = this.matchChannelForReagent(rep, configuredChannels, allowedChannels);
                        if (c && this.isChannelAvailable(panelConfig.channels_used, c, application, allowedChannels)) {
                            panelConfig.channels_used.push(c);
                        } else {
                            comboValid = false;
                            break;
                        }
                    }

                    for (let dye of dyes) {
                        const c = this.matchChannelForReagent(dye, configuredChannels, allowedChannels);
                        if (c && this.isChannelAvailable(panelConfig.channels_used, c, application, allowedChannels)) {
                            panelConfig.channels_used.push(c);
                            panelConfig.assignedDyes.push({ dye: dye, channel: c });
                        } else if (lockedDyes.includes(dye.id)) {
                            comboValid = false;
                            break;
                        }
                    }

                    if (comboValid) {
                        panelConfig.fixation = this.checkFixationCompatibility(panelConfig);
                        panelConfig.score = 100;
                        return { combinations: [panelConfig] };
                    }
                }
                return { combinations: [] };
            }

            // 1. Filter primaries validated for this application
            const allPrimaries = (window.db && Array.isArray(window.db.primaries)) ? window.db.primaries : [];
            let validPrimaries = allPrimaries.filter(p => this.hasApplication(p.applications, application));
            
            // 1b. If live-cell mode, filter further
            if (config.mode === 'Live') {
                validPrimaries = validPrimaries.filter(p => p.live_cell_compatible === 'Yes');
            }

            let fullCombos = [];

            // Detect any targets already covered by selected reporter lines
            const repTargetNames = reporters.map(r => (r.target || '').toLowerCase()).filter(Boolean);
            const targetsForAntibodies = targets.filter(t => !repTargetNames.includes(t.toLowerCase()));
            const lockedTargetsForAntibodies = lockedTargets.filter(t => !repTargetNames.includes(t.toLowerCase()));
            
            // 2. Generate target subsets (for partial panels)
            let maxAvailableChannels = allowedChannels.length - reporters.length;
            if (maxAvailableChannels < 1) maxAvailableChannels = 1;

            const targetSubsets = (targetsForAntibodies.length > 0)
                ? this.generateSubsets(targetsForAntibodies, lockedTargetsForAntibodies, maxAvailableChannels)
                : [[]];
            
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
                if (!subsetValid && subset.length > 0) continue;

                let primaryCombos = subset.length > 0
                    ? this.cartesianProduct(targetPrimariesList).filter(combo => this.checkPrimaryConflict(combo, application))
                    : [[]];

                for (let pCombo of primaryCombos) {
                    // Combine antibody covered targets + reporter covered targets
                    const coveredTargetsList = [
                        ...subset,
                        ...reporters.map(r => r.target).filter(t => t && targets.some(req => req.toLowerCase() === t.toLowerCase()))
                    ];

                    let panelConfig = {
                        primaries: [], 
                        reporters: reporters,
                        dyes: dyes,
                        channels_used: [],
                        targets_requested: targets,
                        targets_covered: Array.from(new Set(coveredTargetsList)),
                        assignedDyes: []
                    };

                    let comboValid = true;
                    for (let rep of reporters) {
                        const c = this.matchChannelForReagent(rep, configuredChannels, allowedChannels);
                        if (c && this.isChannelAvailable(panelConfig.channels_used, c, application, allowedChannels)) {
                            panelConfig.channels_used.push(c);
                        } else {
                            comboValid = false;
                            break;
                        }
                    }
                    if (!comboValid) continue;

                    for (let p of pCombo) {
                        if (p.conjugated_fluorophore) {
                            let c = this.matchChannelForReagent({ color: p.conjugated_color, name: p.conjugated_fluorophore }, configuredChannels, allowedChannels);
                            if (c && this.isChannelAvailable(panelConfig.channels_used, c, application, allowedChannels)) {
                                panelConfig.primaries.push({ primary: p, secondary: null, channel: c, is_direct: true });
                                panelConfig.channels_used.push(c);
                            } else {
                                comboValid = false;
                                break;
                            }
                        } else {
                            let validSecs = this.findCompatibleSecondaries(p, application, panelConfig.channels_used, pCombo, allowedChannels, configuredChannels);
                            if (validSecs.length > 0) {
                                let bestSec = validSecs[0]; 
                                let c = bestSec.channel_assigned;
                                panelConfig.primaries.push({ primary: p, secondary: bestSec, channel: c, is_direct: false });
                                panelConfig.channels_used.push(c);
                            } else {
                                comboValid = false;
                                break;
                            }
                        }
                    }

                    if (!comboValid) continue;

                    // Assign dyes
                    let assignedDyes = [];
                    for (let dye of dyes) {
                        const c = this.matchChannelForReagent(dye, configuredChannels, allowedChannels);
                        if (c && this.isChannelAvailable(panelConfig.channels_used, c, application, allowedChannels)) {
                            panelConfig.channels_used.push(c);
                            assignedDyes.push({ dye: dye, channel: c });
                        } else if (lockedDyes.includes(dye.id)) {
                            comboValid = false;
                            break;
                        }
                    }
                    if (!comboValid) continue; 

                    panelConfig.assignedDyes = assignedDyes;
                    panelConfig.fixation = this.checkFixationCompatibility(panelConfig);
                    panelConfig.score = this.scoreCombination(panelConfig, application);
                    
                    fullCombos.push(panelConfig);
                }
            }

            // Sort by targets covered (desc), then score (desc)
            fullCombos.sort((a, b) => {
                if (b.targets_covered.length !== a.targets_covered.length) {
                    return b.targets_covered.length - a.targets_covered.length;
                }
                return b.score - a.score;
            });
            
            return { combinations: fullCombos };
        } catch (err) {
            console.error("[SpectraPanel CombinationEngine] Error:", err);
            return { error: err.message, combinations: [] };
        }
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

    scoreCombination(panel, application) {
        let score = 100;
        
        if (panel.fixation && !panel.fixation.valid) score -= 30;

        let hosts = new Set((panel.primaries || []).map(p => (p && p.primary) ? p.primary.host : '').filter(Boolean));
        score += (hosts.size * 5);

        let otherHosts = Array.from(hosts);
        (panel.primaries || []).forEach(p => {
            if (p && p.primary && p.secondary && p.secondary.cross_adsorbed) {
                otherHosts.forEach(h => {
                    if (h !== p.primary.host && p.secondary.cross_adsorbed.includes(h)) {
                        score += 5; 
                    }
                });
            }
        });

        return score;
    }
};
