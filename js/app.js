// app.js - Main Application Controller

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI event bindings and channels
    UI.init();

    // 2. Load Default Demo Data on first visit
    DataLoader.loadDefaultData();

    // 3. Header Action Buttons
    const btnDownloadTemplate = document.getElementById('btn-download-template');
    if (btnDownloadTemplate) {
        btnDownloadTemplate.addEventListener('click', () => {
            DataLoader.generateExcelTemplate();
        });
    }

    const fileUploadInput = document.getElementById('db-upload');
    if (fileUploadInput) {
        fileUploadInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                DataLoader.handleFileUpload(e.target.files[0]);
                e.target.value = ''; // Reset input so same file can be re-uploaded
            }
        });
    }

    // 4. Settings Button & Modal
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            UI.renderChannelSettingsTable();
            UI.showModal('modal-settings');
        });
    }

    // Suggestions / Feedback Button & Modal
    const btnFeedback = document.getElementById('btn-feedback');
    if (btnFeedback) {
        btnFeedback.addEventListener('click', () => {
            UI.showModal('modal-feedback');
        });
    }

    const btnSubmitFeedback = document.getElementById('btn-submit-feedback');
    if (btnSubmitFeedback) {
        btnSubmitFeedback.addEventListener('click', () => {
            UI.submitFeedback();
        });
    }

    // Settings Modal Tabs
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const targetTab = e.currentTarget.getAttribute('data-settings-tab');
            
            document.querySelectorAll('.settings-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            const activeContent = document.getElementById(`settings-tab-${targetTab}`);
            if (activeContent) activeContent.style.display = 'block';
        });
    });

    // Channel Presets Buttons in Settings
    const btnPreset4ch = document.getElementById('btn-preset-4ch');
    if (btnPreset4ch) {
        btnPreset4ch.addEventListener('click', () => UI.loadPresetChannels('4ch'));
    }

    const btnPreset5ch = document.getElementById('btn-preset-5ch');
    if (btnPreset5ch) {
        btnPreset5ch.addEventListener('click', () => UI.loadPresetChannels('5ch'));
    }

    const btnPreset6ch = document.getElementById('btn-preset-6ch');
    if (btnPreset6ch) {
        btnPreset6ch.addEventListener('click', () => UI.loadPresetChannels('6ch'));
    }

    // Add Channel Row Button
    const btnAddChannelRow = document.getElementById('btn-add-channel-row');
    if (btnAddChannelRow) {
        btnAddChannelRow.addEventListener('click', () => UI.addEmptyChannelRow());
    }

    // Save Channel Configuration Button
    const btnSaveChannels = document.getElementById('btn-save-channels');
    if (btnSaveChannels) {
        btnSaveChannels.addEventListener('click', () => UI.saveChannelSettings());
    }

    // 5. Database Loaded Event Handler
    document.addEventListener('dbLoaded', () => {
        UI.updateTabCounts();
        UI.populateFilterKeys();
        UI.renderActiveFilters();
        UI.renderDatabaseTable();
        UI.renderSelectedTargetsBox();
    });

    // 6. Application Context Switching in Panel Designer
    const appRadioBtns = document.querySelectorAll('input[name="application"]');
    const modeContainer = document.getElementById('mode-selector-container');
    const hrpCheckbox = document.getElementById('cb-channel-hrp');

    appRadioBtns.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'WB') {
                if (modeContainer) modeContainer.classList.add('hidden');
                if (hrpCheckbox) {
                    hrpCheckbox.disabled = false;
                    hrpCheckbox.checked = true;
                }
            } else {
                if (modeContainer) modeContainer.classList.remove('hidden');
                if (hrpCheckbox) {
                    hrpCheckbox.disabled = true;
                    hrpCheckbox.checked = false;
                }
            }
            UI.updateOptionsSummary();
        });
    });

    // 7. Generate Combinations Button
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', () => {
            const app = document.querySelector('input[name="application"]:checked')?.value || 'ICC';
            const mode = document.querySelector('input[name="mode"]:checked')?.value || 'Fixed';
            
            // Gather all checked detection channels strictly
            const allowedChannels = Array.from(document.querySelectorAll('input[name="channel"]:checked'))
                .map(cb => cb.value);

            if (allowedChannels.length === 0) {
                alert("Please select at least one permitted detection channel under Panel Options.");
                return;
            }

            // Pull selected targets/dyes/reporters synced from left-side table
            const selectedConfig = UI.getSelectedConfig();

            if (selectedConfig.targets.length === 0 && selectedConfig.dyes.length === 0 && selectedConfig.reporters.length === 0) {
                alert("Please select at least one target, dye, or reporter from the database table on the left before generating panels.");
                return;
            }

            // Auto-collapse the Panel Options card so results appear immediately at the top!
            UI.togglePanelOptions(true);

            const config = {
                application: app,
                mode: mode,
                allowedChannels: allowedChannels,
                configuredChannels: UI.state.configuredChannels,
                targets: selectedConfig.targets,
                reporters: selectedConfig.reporters,
                dyes: selectedConfig.dyes,
                lockedTargets: selectedConfig.lockedTargets,
                lockedDyes: selectedConfig.lockedDyes
            };

            console.log("[IFGuidePy] Generating combinations with config:", config);
            const results = CombinationEngine.generateCombinations(config);
            console.log("[IFGuidePy] Results generated:", results);
            
            UI.renderResults(results, config);
        });
    }

    // 8. Manual Entry Modal Logic
    const modalManualEntry = document.getElementById('modal-manual-entry');
    const btnManualEntry = document.getElementById('btn-manual-entry');

    if (btnManualEntry) {
        btnManualEntry.addEventListener('click', () => {
            UI.showManualEntry(UI.state.activeTab || 'primaries');
            document.querySelectorAll('.entry-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-target-tab') === UI.state.activeTab);
            });
            UI.showModal('modal-manual-entry');
        });
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            UI.hideModal('modal-manual-entry');
            UI.hideModal('modal-settings');
            UI.hideModal('modal-feedback');
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === modalManualEntry) {
            UI.hideModal('modal-manual-entry');
        }
        const modalSettings = document.getElementById('modal-settings');
        if (event.target === modalSettings) {
            UI.hideModal('modal-settings');
        }
        const modalFeedback = document.getElementById('modal-feedback');
        if (event.target === modalFeedback) {
            UI.hideModal('modal-feedback');
        }
    });

    document.querySelectorAll('.entry-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.entry-tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            UI.showManualEntry(e.currentTarget.getAttribute('data-target-tab'));
        });
    });

    const btnSaveManualEntry = document.getElementById('btn-save-manual-entry');
    if (btnSaveManualEntry) {
        btnSaveManualEntry.addEventListener('click', () => {
            const typeInput = document.getElementById('entry_type');
            if (!typeInput) return;
            const type = typeInput.value;
            const newEntry = { id: `${type.slice(0, 3)}_${Date.now()}` };

            const inputs = document.querySelectorAll('#manual-entry-form input');
            let hasContent = false;
            inputs.forEach(inp => {
                const field = inp.id.replace('entry_', '');
                if (field !== 'type') {
                    newEntry[field] = inp.value.trim();
                    if (inp.value.trim()) hasContent = true;
                }
            });

            if (!hasContent) {
                alert("Please fill in the required fields before saving.");
                return;
            }

            if (!window.db[type]) window.db[type] = [];
            window.db[type].push(newEntry);
            
            document.dispatchEvent(new CustomEvent('dbLoaded'));
            UI.hideModal('modal-manual-entry');
            alert(`New ${type.slice(0, -1)} entry added to database.`);
        });
    }
});
