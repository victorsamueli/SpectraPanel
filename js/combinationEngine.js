// combinationEngine.js - Logic for antibody combinations and channel multiplexing with wavelength matching

const CombinationEngine = {
    
    hasApplication(appString, app) {
        if (!appString) return false;
        return appString.split(',').map(a => a.trim().toLowerCase()).includes(app.toLowerCase());
    },

    generateCombinations(config) {
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
                    targets_covered: [],
                    assignedDyes: []
                };

                let comboValid = true;
                reporters.forEach(rep => {
                    const c = this.matchChannelForReagent(rep, configuredChannels, allowedChannels);
                    if (c && allowedChannels.includes(c)) {
                        panelConfig.channels_used.push(c);
                    }
                });

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
        let validPrimaries = window.db.primaries.filter(p => this.hasApplication(p.applications, application));
        
        // 1b. If live-cell mode, filter further
        if (config.mode === 'Live') {
            validPrimaries = validPrimaries.filter(p => p.live_cell_compatible === 'Yes');
        }

        let fullCombos = [];
        
        // 2. Generate target subsets (for partial panels)
        let maxAvailableChannels = allowedChannels.length - reporters.length;
        if (maxAvailableChannels < 1) maxAvailableChannels = 1;

        const targetSubsets = this.generateSubsets(targets, lockedTargets, maxAvailableChannels);
        
        for (let subset of targetSubsets) {
            let targetPrimariesList = [];
            let subsetValid = true;
            for (let target of subset) {
                let matches = validPrimaries.filter(p => p.target.toLowerCase() === target.toLowerCase());
                if (matches.length === 0) {
                    subsetValid = false;
                    break;
                }
                targetPrimariesList.push(matches);
            }
            if (!subsetValid) continue;

            let primaryCombos = this.cartesianProduct(targetPrimariesList);
            primaryCombos = primaryCombos.filter(combo => this.checkPrimaryConflict(combo, application));

            for (let pCombo of primaryCombos) {
                let panelConfig = {
                    primaries: [], 
                    reporters: reporters,
                    dyes: dyes,
                    channels_used: [],
                    targets_requested: targets,
                    targets_covered: subset,
                    assignedDyes: []
                };

                reporters.forEach(rep => {
                    const c = this.matchChannelForReagent(rep, configuredChannels, allowedChannels);
                    if (c && allowedChannels.includes(c)) {
                        panelConfig.channels_used.push(c);
                    }
                });

                let comboValid = true;
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
        let validSecs = window.db.secondaries.filter(s => this.hasApplication(s.applications, application));
        validSecs = validSecs.filter(s => s.anti_host && s.anti_host.toLowerCase() === primary.host.toLowerCase());
        
        let sameHostCount = allPrimaries.filter(p => !p.conjugated_fluorophore && p.host === primary.host).length;
        if (sameHostCount > 1) {
            validSecs = validSecs.filter(s => s.anti_isotype === primary.isotype);
        } else {
            validSecs = validSecs.filter(s => s.anti_isotype === primary.isotype || s.anti_isotype.includes("H+L") || s.anti_isotype === "IgG");
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

    matchChannelForReagent(reagent, configuredChannels, allowedChannels) {
        if (!reagent) return null;
        
        const ex = parseFloat(reagent.excitation_nm);
        const em = parseFloat(reagent.emission_nm);
        const rColor = (reagent.color || reagent.fluorophore || reagent.name || '').toLowerCase();

        // 1. Try matching by wavelength ranges against configured channels
        if (!isNaN(ex) && !isNaN(em) && configuredChannels && configuredChannels.length > 0) {
            for (let ch of configuredChannels) {
                if (!allowedChannels.includes(ch.name)) continue;
                if (ex >= ch.ex_min && ex <= ch.ex_max && em >= ch.em_min && em <= ch.em_max) {
                    return ch.name;
                }
            }
        }

        // 2. Fallback: match by color name / keyword
        if (configuredChannels && configuredChannels.length > 0) {
            for (let ch of configuredChannels) {
                if (!allowedChannels.includes(ch.name)) continue;
                const chColor = ch.color.toLowerCase();
                const chName = ch.name.toLowerCase();
                
                if (rColor.includes(chColor) || rColor.includes(chName)) return ch.name;
                if (chColor === 'blue' && (rColor.includes('dapi') || rColor.includes('bfp') || rColor.includes('hoechst'))) return ch.name;
                if (chColor === 'green' && (rColor.includes('fitc') || rColor.includes('gfp') || rColor.includes('488'))) return ch.name;
                if (chColor === 'orange' && (rColor.includes('594') || rColor.includes('texas'))) return ch.name;
                if (chColor === 'red' && (rColor.includes('tritc') || rColor.includes('555') || rColor.includes('568') || rColor.includes('mcherry'))) return ch.name;
                if (chColor === 'far-red' && (rColor.includes('cy5') || rColor.includes('647') || rColor.includes('alexa 647'))) return ch.name;
                if (chColor === 'near-ir' && (rColor.includes('750') || rColor.includes('cy7') || rColor.includes('800'))) return ch.name;
            }
        }

        // 3. Fallback: standard color name matching directly in allowedChannels
        for (let chName of allowedChannels) {
            const chLower = chName.toLowerCase();
            if (rColor.includes(chLower)) return chName;
            if (chLower.includes('blue') && (rColor.includes('dapi') || rColor.includes('bfp'))) return chName;
            if (chLower.includes('green') && (rColor.includes('fitc') || rColor.includes('gfp') || rColor.includes('488'))) return chName;
            if (chLower.includes('orange') && (rColor.includes('594') || rColor.includes('texas'))) return chName;
            if (chLower.includes('red') && (rColor.includes('tritc') || rColor.includes('555') || rColor.includes('mcherry'))) return chName;
            if (chLower.includes('far-red') && (rColor.includes('cy5') || rColor.includes('647'))) return chName;
            if (chLower.includes('near-ir') && (rColor.includes('750') || rColor.includes('cy7'))) return chName;
        }

        return null;
    },

    isChannelAvailable(used, color, application, allowedChannels) {
        if (!allowedChannels.includes(color)) return false;
        return !used.includes(color);
    },

    checkFixationCompatibility(panelConfig) {
        let reqs = [];
        panelConfig.primaries.forEach(p => reqs.push({ name: p.primary.target, compat: p.primary.fixation_compatible || "" }));
        panelConfig.reporters.forEach(r => reqs.push({ name: r.reporter_name, compat: r.recommended_fixation || "" }));
        panelConfig.assignedDyes.forEach(d => reqs.push({ name: d.dye.name, compat: d.dye.notes || "" })); 
        
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
        
        if (!panel.fixation.valid) score -= 30;

        let hosts = new Set(panel.primaries.map(p => p.primary.host));
        score += (hosts.size * 5);

        let otherHosts = Array.from(hosts);
        panel.primaries.forEach(p => {
            if (p.secondary && p.secondary.cross_adsorbed) {
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
