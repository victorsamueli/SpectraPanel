// app.js - Main Application Controller

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI event bindings and channels
    UI.init();

    // 2. Initialize Database (starts empty by default, or loads saved custom inventory from localStorage)
    DataLoader.initDatabase();

    // 3. Header Action Buttons
    const btnDownloadTemplate = document.getElementById('btn-download-template');
    if (btnDownloadTemplate) {
        btnDownloadTemplate.addEventListener('click', () => {
            DataLoader.generateExcelTemplate();
        });
    }

    const btnEmptyDownloadTemplate = document.getElementById('btn-empty-download-template');
    if (btnEmptyDownloadTemplate) {
        btnEmptyDownloadTemplate.addEventListener('click', () => {
            DataLoader.generateExcelTemplate();
        });
    }

    const btnClearDb = document.getElementById('btn-clear-db');
    if (btnClearDb) {
        btnClearDb.addEventListener('click', () => {
            DataLoader.clearDatabase(true);
        });
    }

    const btnLoadDemo = document.getElementById('btn-load-demo');
    if (btnLoadDemo) {
        btnLoadDemo.addEventListener('click', () => {
            DataLoader.loadDemoData(false);
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

    // 4. Mobile View Switcher & Floating Shortcut
    const mainLayout = document.getElementById('main-layout');
    const tabMobileDb = document.getElementById('tab-mobile-db');
    const tabMobileDesigner = document.getElementById('tab-mobile-designer');
    const mobileFloatingBar = document.getElementById('mobile-floating-bar');
    const btnMobileGotoDesigner = document.getElementById('btn-mobile-goto-designer');

    function switchMobileView(view) {
        if (!mainLayout) return;
        if (view === 'database') {
            mainLayout.classList.remove('show-designer');
            mainLayout.classList.add('show-database');
            if (tabMobileDb) tabMobileDb.classList.add('active');
            if (tabMobileDesigner) tabMobileDesigner.classList.remove('active');
            if (mobileFloatingBar) {
                const selCount = (UI.state.selectedReagents || []).length;
                mobileFloatingBar.style.display = selCount > 0 ? 'flex' : 'none';
            }
        } else if (view === 'designer') {
            mainLayout.classList.remove('show-database');
            mainLayout.classList.add('show-designer');
            if (tabMobileDesigner) tabMobileDesigner.classList.add('active');
            if (tabMobileDb) tabMobileDb.classList.remove('active');
            if (mobileFloatingBar) {
                mobileFloatingBar.style.display = 'none';
            }
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (tabMobileDb) {
        tabMobileDb.addEventListener('click', () => switchMobileView('database'));
    }
    if (tabMobileDesigner) {
        tabMobileDesigner.addEventListener('click', () => switchMobileView('designer'));
    }
    if (btnMobileGotoDesigner) {
        btnMobileGotoDesigner.addEventListener('click', () => switchMobileView('designer'));
    }

    // 5. Settings Button & Modal
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

            try {
                console.log("[SpectraPanel] Generating combinations with config:", config);
                const results = CombinationEngine.generateCombinations(config);
                console.log("[SpectraPanel] Results generated:", results);
                UI.renderResults(results, config);
            } catch (err) {
                console.error("[SpectraPanel] Error in combination generation workflow:", err);
                UI.renderResults({ error: err.message }, config);
            }
        });
    }

    // 8. Combinations Export Buttons
    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => {
            UI.exportCombinationsToExcel();
        });
    }

    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            UI.exportCombinationsToCSV();
        });
    }

    // 9. Table Column Visibility Dropdown Toggle & Reset
    const btnToggleColumns = document.getElementById('btn-toggle-columns');
    const columnDropdown = document.getElementById('column-dropdown');
    if (btnToggleColumns && columnDropdown) {
        btnToggleColumns.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = columnDropdown.style.display === 'block';
            columnDropdown.style.display = isOpen ? 'none' : 'block';
        });

        columnDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        window.addEventListener('click', () => {
            if (columnDropdown.style.display === 'block') {
                columnDropdown.style.display = 'none';
            }
        });
    }

    const btnResetColumns = document.getElementById('btn-reset-columns');
    if (btnResetColumns) {
        btnResetColumns.addEventListener('click', () => {
            UI.resetVisibleColumns(UI.state.activeTab);
        });
    }

    // 10. Manual Entry Modal Logic
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
            DataLoader.saveToLocalStorage();
            
            document.dispatchEvent(new CustomEvent('dbLoaded'));
            UI.hideModal('modal-manual-entry');
            alert(`New ${type.slice(0, -1)} entry added to database.`);
        });
    }
});
