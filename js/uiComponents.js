// uiComponents.js - UI rendering, left-side inventory selection & filtering, configurable microscopy channels with optical wavelength color calculation, and compact results

const UI = {
    state: {
        activeTab: 'primaries',
        configuredChannels: [
            { id: 'ch_blue', name: 'Blue', hexColor: '#38bdf8', ex_min: 350, ex_max: 405, em_min: 420, em_max: 480 },
            { id: 'ch_green', name: 'Green', hexColor: '#34d399', ex_min: 470, ex_max: 495, em_min: 510, em_max: 540 },
            { id: 'ch_red', name: 'Red', hexColor: '#f87171', ex_min: 540, ex_max: 595, em_min: 565, em_max: 625 },
            { id: 'ch_farred', name: 'Far-Red', hexColor: '#c084fc', ex_min: 630, ex_max: 655, em_min: 660, em_max: 710 }
        ],
        selectedReagents: [], // [{ id, name, type: 'Antibody'|'Dye'|'FP', dbRef, locked: boolean }]
        activeFilters: {
            primaries: [],
            secondaries: [],
            dyes: [],
            reporters: []
        },
        searchQuery: {
            primaries: '',
            secondaries: '',
            dyes: '',
            reporters: ''
        },
        visibleColumns: {
            primaries: null,
            secondaries: null,
            dyes: null,
            reporters: null
        },
        lastResults: null,
        lastConfig: null
    },

    updateTabCounts() {
        ['primaries', 'secondaries', 'dyes', 'reporters'].forEach(tab => {
            const count = window.db[tab] ? window.db[tab].length : 0;
            const badge = document.getElementById(`badge-count-${tab}`);
            if (badge) badge.innerText = count;
        });
    },

    /**
     * Optical Physics: Approximates RGB hex color from emission wavelength (nm)
     * using the CIE/Bruton visible spectrum algorithm.
     */
    wavelengthToHex(wavelengthNm) {
        const wl = parseFloat(wavelengthNm);
        if (isNaN(wl)) return "#38bdf8";

        if (wl < 380) return "#7c3aed"; // UV / Violet
        if (wl > 750) return "#cbd5e1"; // Near-IR / Silver

        let r = 0, g = 0, b = 0;

        if (wl >= 380 && wl < 440) {
            r = -(wl - 440) / (440 - 380);
            g = 0.0;
            b = 1.0;
        } else if (wl >= 440 && wl < 490) {
            r = 0.0;
            g = (wl - 440) / (490 - 440);
            b = 1.0;
        } else if (wl >= 490 && wl < 510) {
            r = 0.0;
            g = 1.0;
            b = -(wl - 510) / (510 - 490);
        } else if (wl >= 510 && wl < 580) {
            r = (wl - 510) / (580 - 510);
            g = 1.0;
            b = 0.0;
        } else if (wl >= 580 && wl < 645) {
            r = 1.0;
            g = -(wl - 645) / (645 - 580);
            b = 0.0;
        } else if (wl >= 645 && wl <= 750) {
            r = 1.0;
            g = 0.0;
            b = 0.0;
        }

        // Intensity falloff near visual spectrum boundaries
        let factor = 1.0;
        if (wl >= 380 && wl < 420) {
            factor = 0.3 + 0.7 * (wl - 380) / (420 - 380);
        } else if (wl >= 700 && wl <= 750) {
            factor = 0.3 + 0.7 * (750 - wl) / (750 - 700);
        }

        const toHex = (c) => {
            const val = Math.round(Math.max(0, Math.min(255, c * factor * 255)));
            return val.toString(16).padStart(2, '0');
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },

    /**
     * Finds configured microscopy channel matching an emission wavelength (nm).
     * Also detects HRP conjugates.
     */
    getChannelForEmission(emissionNm, conjugateType = '') {
        if (conjugateType && String(conjugateType).toUpperCase().includes('HRP')) {
            return { name: 'HRP', hexColor: '#fbbf24' };
        }
        const em = parseFloat(emissionNm);
        if (isNaN(em)) return null;
        for (let ch of (this.state.configuredChannels || [])) {
            if (em >= ch.em_min && em <= ch.em_max) {
                return ch;
            }
        }
        return null;
    },

    getDefaultColumns(tab) {
        if (tab === 'primaries') {
            return ['target', 'host', 'isotype', 'applications', 'conjugated_color', 'fixation_compatible', 'live_cell_compatible'];
        } else if (tab === 'secondaries') {
            return ['anti_host', 'anti_isotype', 'conjugate', 'channel', 'excitation_nm', 'emission_nm', 'applications'];
        } else if (tab === 'dyes') {
            return ['name', 'target_structure', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible'];
        } else if (tab === 'reporters') {
            return ['target', 'reporter', 'channel', 'excitation_nm', 'emission_nm', 'recommended_fixation'];
        }
        return [];
    },

    getAllAvailableColumns(tab) {
        const data = window.db[tab] || [];
        const rawKeys = data.length > 0 ? Object.keys(data[0]) : [];
        const set = new Set(rawKeys.filter(k => k !== 'id'));

        if (tab === 'secondaries' || tab === 'reporters') {
            set.delete('color');
            set.add('channel');
        }

        this.getDefaultColumns(tab).forEach(c => set.add(c));
        return Array.from(set);
    },

    getVisibleColumns(tab) {
        if (!this.state.visibleColumns[tab]) {
            try {
                const saved = localStorage.getItem(`spectrapanel_cols_${tab}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        this.state.visibleColumns[tab] = parsed;
                        return parsed;
                    }
                }
            } catch (e) {}
            this.state.visibleColumns[tab] = [...this.getDefaultColumns(tab)];
        }
        return this.state.visibleColumns[tab];
    },

    setVisibleColumns(tab, cols) {
        this.state.visibleColumns[tab] = cols;
        try {
            localStorage.setItem(`spectrapanel_cols_${tab}`, JSON.stringify(cols));
        } catch (e) {}
        this.renderDatabaseTable();
        this.renderColumnVisibilityDropdown();
    },

    resetVisibleColumns(tab) {
        this.setVisibleColumns(tab, [...this.getDefaultColumns(tab)]);
    },

    renderColumnVisibilityDropdown() {
        const container = document.getElementById('column-checkboxes-container');
        if (!container) return;

        const tab = this.state.activeTab;
        const allCols = this.getAllAvailableColumns(tab);
        const visibleCols = this.getVisibleColumns(tab);

        container.innerHTML = allCols.map(col => {
            const isChecked = visibleCols.includes(col);
            const labelText = col === 'channel' ? 'Channel (Dynamic)' : col.replace(/_/g, ' ');
            return `
                <label class="column-cb-label">
                    <input type="checkbox" class="col-vis-cb" data-col="${col}" ${isChecked ? 'checked' : ''}>
                    <span>${labelText}</span>
                </label>
            `;
        }).join('');

        container.querySelectorAll('.col-vis-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const col = e.target.getAttribute('data-col');
                let current = [...this.getVisibleColumns(tab)];
                if (e.target.checked) {
                    if (!current.includes(col)) current.push(col);
                } else {
                    if (current.length <= 1) {
                        alert("You must keep at least one column visible.");
                        e.target.checked = true;
                        return;
                    }
                    current = current.filter(c => c !== col);
                }
                this.setVisibleColumns(tab, current);
            });
        });
    },

    init() {
        // Load saved channel configuration if available
        try {
            const saved = localStorage.getItem('spectrapanel_channels');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    this.state.configuredChannels = parsed;
                }
            }
        } catch (e) {
            console.warn("Could not load saved channels from localStorage", e);
        }

        // Render designer detection channels
        this.renderDesignerChannels();

        // Render channel settings table in modal
        this.renderChannelSettingsTable();

        // Render column visibility options
        this.renderColumnVisibilityDropdown();

        // Tab switching on Left Database
        document.querySelectorAll('.tab-controls .tab-btn[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-controls .tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
                const targetBtn = e.currentTarget;
                targetBtn.classList.add('active');
                this.state.activeTab = targetBtn.getAttribute('data-tab');
                
                this.populateFilterKeys();
                this.renderActiveFilters();
                this.renderColumnVisibilityDropdown();
                this.renderDatabaseTable();
            });
        });

        // Key dropdown change -> populate Value dropdown
        const keySelect = document.getElementById('filter-key');
        if (keySelect) {
            keySelect.addEventListener('change', () => {
                this.populateFilterValues(keySelect.value);
            });
        }

        // Add filter button
        const btnAddFilter = document.getElementById('btn-add-filter');
        if (btnAddFilter) {
            btnAddFilter.addEventListener('click', () => {
                const k = document.getElementById('filter-key').value;
                const v = document.getElementById('filter-value').value;
                const tab = this.state.activeTab;

                if (k && v) {
                    const existing = this.state.activeFilters[tab].find(f => f.key === k && f.value === v);
                    if (!existing) {
                        this.state.activeFilters[tab].push({ key: k, value: v });
                        this.renderActiveFilters();
                        this.renderDatabaseTable();
                    }
                }
            });
        }

        // Real-time table search input
        const searchInput = document.getElementById('db-table-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.state.searchQuery[this.state.activeTab] = e.target.value.toLowerCase().trim();
                this.renderDatabaseTable();
            });
        }

        // Clear all selected targets button on right side
        const btnClearSelected = document.getElementById('btn-clear-selected');
        if (btnClearSelected) {
            btnClearSelected.addEventListener('click', () => {
                this.state.selectedReagents = [];
                this.renderSelectedTargetsBox();
                this.renderDatabaseTable();
            });
        }

        // Collapsible Panel Options Toggle (Starts closed by default)
        const btnToggleOptions = document.getElementById('btn-toggle-options');
        if (btnToggleOptions) {
            btnToggleOptions.addEventListener('click', () => {
                this.togglePanelOptions();
            });
        }

        // Shortcut link to open channel settings
        const linkConfig = document.getElementById('link-configure-channels');
        if (linkConfig) {
            linkConfig.addEventListener('click', (e) => {
                e.preventDefault();
                this.showModal('modal-settings');
                document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
                const chTabBtn = document.querySelector('.settings-tab-btn[data-settings-tab="channels"]');
                if (chTabBtn) chTabBtn.classList.add('active');
                document.querySelectorAll('.settings-tab-content').forEach(c => c.style.display = 'none');
                const chTab = document.getElementById('settings-tab-channels');
                if (chTab) chTab.style.display = 'block';
            });
        }

        // Update summary on option changes
        document.querySelectorAll('input[name="application"], input[name="mode"]').forEach(inp => {
            inp.addEventListener('change', () => {
                this.updateOptionsSummary();
            });
        });

        this.updateOptionsSummary();
    },

    /* =========================================================
       Channel Settings Manager with Color Picker
       ========================================================= */

    renderDesignerChannels() {
        const container = document.getElementById('channels-list-container');
        if (!container) return;

        let html = '';
        this.state.configuredChannels.forEach((ch) => {
            const hex = ch.hexColor || '#38bdf8';
            html += `
                <label class="channel-chip" style="border-color: rgba(255,255,255,0.12);">
                    <input type="checkbox" name="channel" value="${ch.name}" checked>
                    <span><span class="ch-dot" style="background-color: ${hex};"></span>${ch.name}</span>
                </label>
            `;
        });

        // Add HRP for Western Blot
        html += `
            <label class="channel-chip chip-hrp">
                <input type="checkbox" name="channel" value="HRP" id="cb-channel-hrp" disabled>
                <span><span class="ch-dot" style="background-color: #fbbf24;"></span>HRP</span>
            </label>
        `;

        container.innerHTML = html;

        // Re-attach change listeners
        container.querySelectorAll('input[name="channel"]').forEach(inp => {
            inp.addEventListener('change', () => {
                this.updateOptionsSummary();
            });
        });

        this.updateOptionsSummary();
    },

    renderChannelSettingsTable() {
        const tbody = document.getElementById('channel-settings-tbody');
        if (!tbody) return;

        tbody.innerHTML = this.state.configuredChannels.map((ch, idx) => {
            // Compute default hex from emission midpoint if not present
            const emMid = ((parseFloat(ch.em_min) || 450) + (parseFloat(ch.em_max) || 500)) / 2;
            const hex = ch.hexColor || this.wavelengthToHex(emMid);
            ch.hexColor = hex;

            return `
                <tr data-channel-index="${idx}">
                    <td style="text-align: center;">
                        <input type="color" class="ch-color-picker" value="${hex}" title="Click to pick custom color">
                    </td>
                    <td>
                        <input type="text" class="form-input ch-name-input" value="${ch.name}" placeholder="e.g. DAPI (405nm)">
                    </td>
                    <td>
                        <div class="range-input-group">
                            <input type="number" class="form-input ch-ex-min" value="${ch.ex_min}" style="width: 65px;" placeholder="Min">
                            <span class="range-sep">–</span>
                            <input type="number" class="form-input ch-ex-max" value="${ch.ex_max}" style="width: 65px;" placeholder="Max">
                        </div>
                    </td>
                    <td>
                        <div class="range-input-group">
                            <input type="number" class="form-input ch-em-min" value="${ch.em_min}" style="width: 65px;" placeholder="Min">
                            <span class="range-sep">–</span>
                            <input type="number" class="form-input ch-em-max" value="${ch.em_max}" style="width: 65px;" placeholder="Max">
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-remove-channel" data-index="${idx}" title="Delete channel">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach Real-Time Wavelength Auto-Calculation Listeners to Emission Inputs
        tbody.querySelectorAll('tr').forEach(row => {
            const emMinInp = row.querySelector('.ch-em-min');
            const emMaxInp = row.querySelector('.ch-em-max');
            const colorPicker = row.querySelector('.ch-color-picker');

            const autoUpdateColor = () => {
                const emMin = parseFloat(emMinInp.value);
                const emMax = parseFloat(emMaxInp.value);
                if (!isNaN(emMin) && !isNaN(emMax)) {
                    const mid = (emMin + emMax) / 2;
                    const calculatedHex = this.wavelengthToHex(mid);
                    colorPicker.value = calculatedHex;
                }
            };

            emMinInp.addEventListener('input', autoUpdateColor);
            emMaxInp.addEventListener('input', autoUpdateColor);
        });

        // Attach remove buttons
        tbody.querySelectorAll('.btn-remove-channel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                if (this.state.configuredChannels.length <= 1) {
                    alert("You must keep at least one detection channel.");
                    return;
                }
                this.state.configuredChannels.splice(idx, 1);
                this.renderChannelSettingsTable();
            });
        });
    },

    saveChannelSettings() {
        const tbody = document.getElementById('channel-settings-tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        const newChannels = [];

        rows.forEach((row, idx) => {
            const hexColor = row.querySelector('.ch-color-picker').value;
            const name = row.querySelector('.ch-name-input').value.trim() || `Channel ${idx + 1}`;
            const ex_min = parseFloat(row.querySelector('.ch-ex-min').value) || 350;
            const ex_max = parseFloat(row.querySelector('.ch-ex-max').value) || 450;
            const em_min = parseFloat(row.querySelector('.ch-em-min').value) || 420;
            const em_max = parseFloat(row.querySelector('.ch-em-max').value) || 500;

            newChannels.push({
                id: `ch_${Date.now()}_${idx}`,
                name,
                hexColor,
                ex_min,
                ex_max,
                em_min,
                em_max
            });
        });

        if (newChannels.length === 0) {
            alert("Please configure at least one channel.");
            return;
        }

        this.state.configuredChannels = newChannels;
        try {
            localStorage.setItem('spectrapanel_channels', JSON.stringify(newChannels));
        } catch (e) {}

        this.renderDesignerChannels();
        this.renderChannelSettingsTable();
        this.hideModal('modal-settings');
        alert("Microscopy channels saved and applied to the Panel Designer!");
    },

    loadPresetChannels(presetName) {
        if (presetName === '4ch') {
            this.state.configuredChannels = [
                { id: 'ch_blue', name: 'Blue', hexColor: '#38bdf8', ex_min: 350, ex_max: 405, em_min: 420, em_max: 480 },
                { id: 'ch_green', name: 'Green', hexColor: '#34d399', ex_min: 470, ex_max: 495, em_min: 510, em_max: 540 },
                { id: 'ch_red', name: 'Red', hexColor: '#f87171', ex_min: 540, ex_max: 595, em_min: 565, em_max: 625 },
                { id: 'ch_farred', name: 'Far-Red', hexColor: '#c084fc', ex_min: 630, ex_max: 655, em_min: 660, em_max: 710 }
            ];
        } else if (presetName === '5ch') {
            this.state.configuredChannels = [
                { id: 'ch_blue', name: 'Blue', hexColor: '#38bdf8', ex_min: 350, ex_max: 405, em_min: 420, em_max: 480 },
                { id: 'ch_green', name: 'Green', hexColor: '#34d399', ex_min: 470, ex_max: 495, em_min: 510, em_max: 540 },
                { id: 'ch_red', name: 'Red', hexColor: '#f87171', ex_min: 540, ex_max: 570, em_min: 565, em_max: 600 },
                { id: 'ch_orange', name: 'Orange', hexColor: '#fb923c', ex_min: 580, ex_max: 600, em_min: 610, em_max: 640 },
                { id: 'ch_farred', name: 'Far-Red', hexColor: '#c084fc', ex_min: 630, ex_max: 655, em_min: 660, em_max: 710 }
            ];
        } else if (presetName === '6ch') {
            this.state.configuredChannels = [
                { id: 'ch_blue', name: 'Blue', hexColor: '#38bdf8', ex_min: 350, ex_max: 405, em_min: 420, em_max: 480 },
                { id: 'ch_green', name: 'Green', hexColor: '#34d399', ex_min: 470, ex_max: 495, em_min: 510, em_max: 540 },
                { id: 'ch_red', name: 'Red', hexColor: '#f87171', ex_min: 540, ex_max: 570, em_min: 565, em_max: 600 },
                { id: 'ch_orange', name: 'Orange', hexColor: '#fb923c', ex_min: 580, ex_max: 600, em_min: 610, em_max: 640 },
                { id: 'ch_farred', name: 'Far-Red', hexColor: '#c084fc', ex_min: 630, ex_max: 655, em_min: 660, em_max: 710 },
                { id: 'ch_nearir', name: 'Near-IR', hexColor: '#cbd5e1', ex_min: 740, ex_max: 765, em_min: 770, em_max: 820 }
            ];
        }
        this.renderChannelSettingsTable();
    },

    addEmptyChannelRow() {
        const idx = this.state.configuredChannels.length + 1;
        this.state.configuredChannels.push({
            id: `ch_${Date.now()}`,
            name: `Channel ${idx}`,
            hexColor: '#38bdf8',
            ex_min: 500,
            ex_max: 520,
            em_min: 530,
            em_max: 560
        });
        this.renderChannelSettingsTable();
    },

    /* =========================================================
       User Suggestions & Feedback System
       ========================================================= */

    submitFeedback() {
        const name = (document.getElementById('fb-name')?.value || '').trim() || 'Anonymous User';
        const category = document.getElementById('fb-category')?.value || 'General Feedback';
        const message = (document.getElementById('fb-message')?.value || '').trim();

        if (!message) {
            alert("Please enter your feedback or suggestion.");
            return;
        }

        const now = new Date();
        const dateStr = now.toISOString().replace('T', ' ').slice(0, 19);
        const fileTimestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);

        const logEntry = 
`======================================================================
SpectraPanel v1.0 — User Feedback & Suggestion Log
======================================================================
Timestamp:   ${dateStr}
Submitter:   ${name}
Category:    ${category}

Suggestion / Feedback:
${message}
======================================================================
`;

        // 1. Trigger immediate browser download of the log file
        const blob = new Blob([logEntry], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `suggestion_log_${fileTimestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // 2. Append to browser's cumulative feedback history in localStorage
        try {
            const history = localStorage.getItem('spectrapanel_feedback_log') || '';
            localStorage.setItem('spectrapanel_feedback_log', history + '\n\n' + logEntry);
        } catch (e) {}

        // Reset form and hide modal
        document.getElementById('fb-message').value = '';
        this.hideModal('modal-feedback');

        alert("Thank you! Your suggestion has been saved and downloaded as a timestamped log file.");
    },

    /* =========================================================
       Panel Options Collapsible Control
       ========================================================= */

    togglePanelOptions(forceCollapse = null) {
        const card = document.getElementById('panel-options-card');
        if (!card) return;

        if (forceCollapse === true) {
            card.classList.add('collapsed');
        } else if (forceCollapse === false) {
            card.classList.remove('collapsed');
        } else {
            card.classList.toggle('collapsed');
        }
    },

    updateOptionsSummary() {
        const badge = document.getElementById('options-summary-badge');
        if (!badge) return;

        const app = document.querySelector('input[name="application"]:checked')?.value || 'ICC';
        const mode = document.querySelector('input[name="mode"]:checked')?.value || 'Fixed';
        const channelsCount = document.querySelectorAll('input[name="channel"]:checked').length;

        let summary = `${app}`;
        if (app !== 'WB') {
            summary += ` • ${mode}-Cell`;
        }
        summary += ` • ${channelsCount} Channel${channelsCount > 1 ? 's' : ''}`;

        badge.innerText = summary;
    },

    /* =========================================================
       Database Filtering & Table Rendering (Left Side)
       ========================================================= */

    populateFilterKeys() {
        const keySelect = document.getElementById('filter-key');
        if (!keySelect) return;

        const data = window.db[this.state.activeTab] || [];
        if (data.length === 0) {
            keySelect.innerHTML = `<option value="">-- No Columns --</option>`;
            this.populateFilterValues('');
            return;
        }

        const sample = data[0];
        const exclude = ['id', 'catalog_no', 'notes', 'dilution_icc', 'dilution_ihc', 'dilution_wb', 'mol_weight_kda', 'excitation_nm', 'emission_nm'];
        let keys = Object.keys(sample).filter(k => !exclude.includes(k)).sort();

        // For secondaries and reporters, remove static color and add dynamic channel
        if (this.state.activeTab === 'secondaries' || this.state.activeTab === 'reporters') {
            keys = keys.filter(k => k !== 'color');
            if (!keys.includes('channel')) {
                keys.unshift('channel');
            }
        }

        keySelect.innerHTML = `<option value="">-- Select Column --</option>` +
            keys.map(k => `<option value="${k}">${k === 'channel' ? 'Channel (Dynamic)' : k.replace(/_/g, ' ')}</option>`).join('');

        this.populateFilterValues('');
    },

    populateFilterValues(selectedKey) {
        const valSelect = document.getElementById('filter-value');
        if (!valSelect) return;

        if (!selectedKey) {
            valSelect.innerHTML = `<option value="">-- All Values --</option>`;
            return;
        }

        const data = window.db[this.state.activeTab] || [];
        const values = new Set();

        if (selectedKey === 'channel') {
            data.forEach(row => {
                const ch = this.getChannelForEmission(row.emission_nm, row.conjugate_type || row.reporter || '');
                if (ch && ch.name) values.add(ch.name);
            });
        } else {
            data.forEach(row => {
                const raw = row[selectedKey];
                if (raw !== null && raw !== undefined && raw !== '') {
                    String(raw).split(',').forEach(sub => {
                        const clean = sub.trim();
                        if (clean) values.add(clean);
                    });
                }
            });
        }

        const sorted = Array.from(values).sort();
        valSelect.innerHTML = `<option value="">-- All Values (${sorted.length}) --</option>` +
            sorted.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    renderActiveFilters() {
        const container = document.getElementById('active-filters');
        if (!container) return;

        const filters = this.state.activeFilters[this.state.activeTab] || [];
        if (filters.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = filters.map((f, idx) => `
            <span class="filter-tag">
                ${f.key.replace(/_/g, ' ')}: <strong>${f.value}</strong>
                <i class="fa-solid fa-xmark remove-filter-btn" data-index="${idx}" title="Remove filter"></i>
            </span>
        `).join('');

        container.querySelectorAll('.remove-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.state.activeFilters[this.state.activeTab].splice(index, 1);
                this.renderActiveFilters();
                this.renderDatabaseTable();
            });
        });
    },

    renderDatabaseTable() {
        const table = document.getElementById('db-table');
        if (!table) return;

        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        const tab = this.state.activeTab;
        const isSelectable = (tab === 'primaries' || tab === 'dyes' || tab === 'reporters');

        let data = window.db[tab] || [];

        // 1. Apply Active Filters
        const filters = this.state.activeFilters[tab] || [];
        if (filters.length > 0) {
            data = data.filter(row => {
                return filters.every(f => {
                    if (f.key === 'channel') {
                        const ch = this.getChannelForEmission(row.emission_nm, row.conjugate_type || row.reporter || '');
                        const chName = ch ? ch.name : 'Unknown';
                        return chName.toLowerCase() === f.value.toLowerCase();
                    }
                    const rowVal = String(row[f.key] || '').toLowerCase();
                    return rowVal.includes(f.value.toLowerCase());
                });
            });
        }

        // 2. Apply Text Search
        const search = this.state.searchQuery[tab];
        if (search) {
            data = data.filter(row => {
                const values = Object.values(row).map(val => String(val).toLowerCase());
                if (tab === 'secondaries' || tab === 'reporters') {
                    const ch = this.getChannelForEmission(row.emission_nm, row.conjugate_type || row.reporter || '');
                    if (ch) values.push(ch.name.toLowerCase());
                }
                return values.some(val => val.includes(search));
            });
        }

        const countInfo = document.getElementById('table-row-count');
        if (countInfo) {
            countInfo.innerText = `Showing ${data.length} of ${window.db[tab] ? window.db[tab].length : 0} items`;
        }

        if (data.length === 0) {
            thead.innerHTML = `<tr><th>No records match criteria</th></tr>`;
            tbody.innerHTML = `<tr><td style="text-align:center; padding: 2rem; color: var(--text-muted);">No entries found matching filters.</td></tr>`;
            return;
        }

        // Build Table Headers based on visible columns
        const cols = this.getVisibleColumns(tab);
        let headHtml = '<tr>';
        if (isSelectable) {
            headHtml += `<th class="table-col-select" title="Select for panel">Sel</th>`;
            headHtml += `<th class="table-col-lock" title="Lock target into all combinations">Lock</th>`;
        }
        cols.forEach(c => {
            const label = c === 'channel' ? 'Channel (Dynamic)' : c.replace(/_/g, ' ');
            headHtml += `<th>${label}</th>`;
        });
        headHtml += '</tr>';
        thead.innerHTML = headHtml;

        // Build Table Rows
        let bodyHtml = '';
        data.forEach(row => {
            let itemId = '';
            let itemName = '';
            let itemType = 'Antibody';

            if (tab === 'primaries') {
                itemId = `primary_${row.target}`;
                itemName = row.target;
                itemType = 'Antibody';
            } else if (tab === 'dyes') {
                itemId = `dye_${row.id || row.name}`;
                itemName = row.name;
                itemType = 'Dye';
            } else if (tab === 'reporters') {
                const repTag = row.reporter || row.reporter_name || '';
                itemId = `reporter_${row.id || (row.target + '_' + repTag)}`;
                itemName = row.target ? `${row.target} (${repTag})` : repTag;
                itemType = 'FP';
            }

            const isSelected = this.state.selectedReagents.some(r => r.id === itemId);
            const selectedObj = this.state.selectedReagents.find(r => r.id === itemId);
            const isLocked = selectedObj ? selectedObj.locked : false;

            bodyHtml += `<tr class="${isSelected ? 'row-selected' : ''}">`;
            
            if (isSelectable) {
                bodyHtml += `
                    <td class="table-col-select">
                        <input type="checkbox" class="row-cb" data-id="${itemId}" data-name="${itemName}" data-type="${itemType}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td class="table-col-lock">
                        <i class="fa-solid ${isLocked ? 'fa-lock is-locked' : 'fa-unlock'} row-lock-btn" data-id="${itemId}" data-name="${itemName}" data-type="${itemType}" title="${isLocked ? 'Locked (Required in panel)' : 'Click to lock'}"></i>
                    </td>
                `;
            }

            cols.forEach(c => {
                if (c === 'channel') {
                    const ch = this.getChannelForEmission(row.emission_nm, row.conjugate_type || row.reporter || '');
                    if (ch) {
                        const hex = ch.hexColor || '#38bdf8';
                        bodyHtml += `<td><span class="channel-table-pill" style="--ch-color: ${hex}; border-color: ${hex}55;"><span class="ch-dot" style="background-color: ${hex};"></span>${ch.name}</span></td>`;
                    } else {
                        bodyHtml += `<td><span style="color: var(--text-muted); font-size: 0.75rem;">—</span></td>`;
                    }
                } else {
                    let val = row[c] !== undefined ? row[c] : '';
                    bodyHtml += `<td>${val}</td>`;
                }
            });
            bodyHtml += '</tr>';
        });

        tbody.innerHTML = bodyHtml;

        // Checkbox and Lock Event Listeners
        if (isSelectable) {
            tbody.querySelectorAll('.row-cb').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const name = e.target.getAttribute('data-name');
                    const type = e.target.getAttribute('data-type');
                    
                    if (e.target.checked) {
                        if (!this.state.selectedReagents.some(r => r.id === id)) {
                            const dbRef = this.findReagentDbRefs(type, name);
                            this.state.selectedReagents.push({ id, name, type, dbRef, locked: false });
                        }
                    } else {
                        this.state.selectedReagents = this.state.selectedReagents.filter(r => r.id !== id);
                    }
                    
                    this.renderSelectedTargetsBox();
                    e.target.closest('tr').classList.toggle('row-selected', e.target.checked);
                });
            });

            tbody.querySelectorAll('.row-lock-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const name = e.target.getAttribute('data-name');
                    const type = e.target.getAttribute('data-type');

                    let reagent = this.state.selectedReagents.find(r => r.id === id);
                    if (!reagent) {
                        const dbRef = this.findReagentDbRefs(type, name);
                        reagent = { id, name, type, dbRef, locked: true };
                        this.state.selectedReagents.push(reagent);
                    } else {
                        reagent.locked = !reagent.locked;
                    }

                    this.renderSelectedTargetsBox();
                    this.renderDatabaseTable();
                });
            });
        }
    },

    findReagentDbRefs(type, name) {
        if (type === 'Antibody') {
            return window.db.primaries.filter(p => p.target && p.target.toLowerCase() === name.toLowerCase());
        } else if (type === 'Dye') {
            return window.db.dyes.filter(d => d.name && d.name.toLowerCase() === name.toLowerCase());
        } else if (type === 'FP') {
            return window.db.reporters.filter(r => {
                const repTag = r.reporter || r.reporter_name || '';
                const rName = r.target ? `${r.target} (${repTag})` : repTag;
                return rName && rName.toLowerCase() === name.toLowerCase();
            });
        }
        return [];
    },

    renderSelectedTargetsBox() {
        const container = document.getElementById('selected-targets');
        const countSpan = document.getElementById('selected-count');
        const btnClear = document.getElementById('btn-clear-selected');

        if (countSpan) countSpan.innerText = this.state.selectedReagents.length;
        if (btnClear) btnClear.style.display = this.state.selectedReagents.length > 0 ? 'inline-block' : 'none';

        if (!container) return;

        if (this.state.selectedReagents.length === 0) {
            container.innerHTML = `<span class="empty-hint">No targets selected yet. Check items in the left database table.</span>`;
            return;
        }

        container.innerHTML = this.state.selectedReagents.map(r => {
            let typeBadgeClass = 'type-ab';
            if (r.type === 'Dye') typeBadgeClass = 'type-dye';
            if (r.type === 'FP') typeBadgeClass = 'type-fp';

            return `
                <div class="target-pill ${r.locked ? 'pill-locked' : ''}">
                    <span class="pill-type ${typeBadgeClass}">${r.type}</span>
                    <span>${r.name}</span>
                    <button class="pill-lock-btn ${r.locked ? 'is-locked' : ''}" data-id="${r.id}" title="${r.locked ? 'Locked (Required)' : 'Click to lock'}">
                        <i class="fa-solid ${r.locked ? 'fa-lock' : 'fa-unlock'}"></i>
                    </button>
                    <button class="pill-remove-btn" data-id="${r.id}" title="Remove target">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.pill-lock-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const reagent = this.state.selectedReagents.find(r => r.id === id);
                if (reagent) {
                    reagent.locked = !reagent.locked;
                    this.renderSelectedTargetsBox();
                    this.renderDatabaseTable();
                }
            });
        });

        container.querySelectorAll('.pill-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                this.state.selectedReagents = this.state.selectedReagents.filter(r => r.id !== id);
                this.renderSelectedTargetsBox();
                this.renderDatabaseTable();
            });
        });
    },

    getSelectedConfig() {
        const targets = [];
        const dyes = [];
        const reporters = [];
        const lockedTargets = [];
        const lockedDyes = [];

        this.state.selectedReagents.forEach(r => {
            if (r.type === 'Antibody') {
                targets.push(r.name);
                if (r.locked) lockedTargets.push(r.name);
            } else if (r.type === 'Dye') {
                const dyeObj = (r.dbRef && r.dbRef[0]) || window.db.dyes.find(d => d.name === r.name);
                if (dyeObj) {
                    dyes.push(dyeObj);
                    if (r.locked) lockedDyes.push(dyeObj.id);
                }
            } else if (r.type === 'FP') {
                const repObj = (r.dbRef && r.dbRef[0]) || window.db.reporters.find(rep => {
                    const repTag = rep.reporter || rep.reporter_name || '';
                    const rName = rep.target ? `${rep.target} (${repTag})` : repTag;
                    return rName === r.name;
                });
                if (repObj) reporters.push(repObj);
            }
        });

        return { targets, dyes, reporters, lockedTargets, lockedDyes };
    },

    /* =========================================================
       Combination Results: STRICTLY Reflect Allowed Channels
       ========================================================= */

    renderResults(results, config) {
        this.state.lastResults = results;
        this.state.lastConfig = config;

        const container = document.getElementById('results-container');
        const actionBar = document.getElementById('results-action-bar');
        const countBadge = document.getElementById('results-count');

        if (!container) return;

        if (results.error) {
            if (actionBar) actionBar.style.display = 'none';
            container.innerHTML = `
                <div class="empty-state glass-panel" style="border-color: var(--accent-red);">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red);"></i>
                    <h3>Configuration Error</h3>
                    <p>${results.error}</p>
                </div>`;
            return;
        }

        if (!results.combinations || results.combinations.length === 0) {
            if (actionBar) actionBar.style.display = 'none';
            container.innerHTML = `
                <div class="empty-state glass-panel">
                    <i class="fa-solid fa-circle-exclamation" style="color: var(--accent-yellow);"></i>
                    <h3>No Valid Combinations Found</h3>
                    <p style="text-align: left; margin-top: 0.5rem; font-size: 0.775rem;">
                        • Ensure selected targets have validated antibodies for <strong>${config.application}</strong>.<br>
                        • Check for host species conflicts without matching specific secondaries.<br>
                        • Ensure detection channels match antibodies and dyes selected.<br>
                        ${config.mode === 'Live' ? '• Ensure antibodies are validated as Live-Cell compatible.<br>' : ''}
                    </p>
                </div>`;
            return;
        }

        // Show export and count action bar
        if (actionBar) {
            actionBar.style.display = 'flex';
            if (countBadge) {
                countBadge.innerText = `${results.combinations.length} Valid Combination${results.combinations.length > 1 ? 's' : ''}`;
            }
        }

        let html = '';
        results.combinations.forEach((combo, index) => {
            html += this.renderCombinationCard(combo, index, config);
        });

        container.innerHTML = html;
    },

    renderCombinationCard(combo, index, config) {
        // STRICT: Only include the channels currently checked in Permitted Detection Channels!
        const channels = config.allowedChannels && config.allowedChannels.length > 0 
            ? config.allowedChannels 
            : ["Blue", "Green", "Red", "Far-Red"];

        const channelMap = {};
        channels.forEach(ch => channelMap[ch] = []);

        combo.primaries.forEach(p => {
            const ch = p.channel;
            if (channelMap[ch] !== undefined) {
                const priStr = `<strong>${p.primary.host} ${p.primary.isotype || ''}</strong><br>anti-${p.primary.target}`;
                const secStr = p.is_direct 
                    ? `<em>(Direct ${p.primary.conjugated_color})</em>` 
                    : `${p.secondary.anti_host} ${p.secondary.anti_isotype}<br><strong>${p.secondary.conjugate}</strong>`;
                channelMap[ch].push({ target: p.primary.target, pri: priStr, sec: secStr });
            }
        });

        combo.assignedDyes.forEach(d => {
            const ch = d.channel;
            if (channelMap[ch] !== undefined) {
                channelMap[ch].push({
                    target: d.dye.name,
                    pri: `<em>(Direct Counterstain)</em>`,
                    sec: `—`
                });
            }
        });

        combo.reporters.forEach(r => {
            const ch = CombinationEngine.matchChannelForReagent(r, config.configuredChannels, channels);
            if (ch && channelMap[ch] !== undefined) {
                const repTag = r.reporter || r.reporter_name || '';
                const targetText = r.target 
                    ? `<strong>${r.target}</strong><br><span style="font-size:0.7rem; color:var(--text-secondary);">(${repTag})</span>` 
                    : `<strong>${repTag}</strong>`;
                channelMap[ch].push({
                    target: targetText,
                    pri: `<em>(Reporter Line)</em>`,
                    sec: `—`
                });
            }
        });

        let targetRow = '';
        let priRow = '';
        let secRow = '';

        channels.forEach(ch => {
            const items = channelMap[ch];
            if (items && items.length > 0) {
                targetRow += `<td>${items.map(i => i.target).join('<br>+<br>')}</td>`;
                priRow += `<td>${items.map(i => i.pri).join('<br>+<br>')}</td>`;
                secRow += `<td>${items.map(i => i.sec).join('<br>+<br>')}</td>`;
            } else {
                targetRow += `<td style="color: var(--text-muted);">—</td>`;
                priRow += `<td style="color: var(--text-muted);">—</td>`;
                secRow += `<td style="color: var(--text-muted);">—</td>`;
            }
        });

        const isFixationOk = combo.fixation.valid;
        const fixationBadge = isFixationOk
            ? `<span class="fixation-icon status-ok" title="Fixation compatible"><i class="fa-solid fa-circle-check"></i> Fixation OK</span>`
            : `<span class="fixation-icon status-warn" title="${combo.fixation.warnings.join(' | ')}"><i class="fa-solid fa-triangle-exclamation"></i> Conflict</span>`;

        const warnBanner = !isFixationOk 
            ? `<div class="fixation-warn-banner"><i class="fa-solid fa-circle-exclamation"></i> ${combo.fixation.warnings.join(' ')}</div>`
            : '';

        return `
            <div class="combo-card">
                <div class="combo-card-header">
                    <div class="combo-title-wrap">
                        <h3>Combination #${index + 1}</h3>
                        <span class="score-badge">Score: ${combo.score}</span>
                    </div>
                    <div class="combo-header-badges">
                        ${fixationBadge}
                    </div>
                </div>

                <div style="overflow-x: auto;">
                    <table class="combo-channels-table">
                        <thead>
                            <tr>
                                ${channels.map(ch => {
                                    // Find channel custom hex color
                                    const chObj = (this.state.configuredChannels || []).find(c => c.name === ch);
                                    const hex = (chObj && chObj.hexColor) ? chObj.hexColor : (ch === 'HRP' ? '#fbbf24' : '#38bdf8');
                                    return `<th style="border-top: 3px solid ${hex};"><span class="ch-dot" style="background-color: ${hex};"></span>${ch}</th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>${targetRow}</tr>
                            <tr style="font-size: 0.725rem;">${priRow}</tr>
                            <tr style="font-size: 0.725rem;">${secRow}</tr>
                        </tbody>
                    </table>
                </div>

                ${warnBanner}
            </div>
        `;
    },

    /* =========================================================
       Export Combinations (Excel .xlsx & CSV .csv)
       ========================================================= */

    exportCombinationsToExcel() {
        if (!this.state.lastResults || !this.state.lastResults.combinations || this.state.lastResults.combinations.length === 0) {
            alert("No combinations available to export. Please generate combinations first.");
            return;
        }
        if (typeof XLSX === 'undefined') {
            alert("Excel export library is not ready. Please try again in a moment.");
            return;
        }

        const combinations = this.state.lastResults.combinations;
        const config = this.state.lastConfig || {};
        const channels = config.allowedChannels && config.allowedChannels.length > 0 
            ? config.allowedChannels 
            : ["Blue", "Green", "Red", "Far-Red"];

        // 1. Detailed Rows Sheet
        const detailedRows = [];
        combinations.forEach((combo, idx) => {
            const comboNum = `Combo #${idx + 1}`;
            const score = combo.score;
            const fixStatus = combo.fixation.valid ? 'Compatible' : 'Conflict';
            const fixWarnings = combo.fixation.warnings.join('; ') || 'None';

            // Primaries + Secondaries
            combo.primaries.forEach(p => {
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": p.channel,
                    "Target / Marker": p.primary.target,
                    "Reagent Type": p.is_direct ? "Direct Conjugated Primary" : "Primary + Secondary",
                    "Primary Details": `${p.primary.host} ${p.primary.isotype || ''} anti-${p.primary.target}`,
                    "Secondary / Detection": p.is_direct 
                        ? `Direct (${p.primary.conjugated_color})` 
                        : `${p.secondary.anti_host} ${p.secondary.anti_isotype} - ${p.secondary.conjugate}`,
                    "Excitation Peak (nm)": p.secondary ? p.secondary.excitation_nm : '—',
                    "Emission Peak (nm)": p.secondary ? p.secondary.emission_nm : '—',
                    "Warnings": fixWarnings
                });
            });

            // Direct Dyes
            combo.assignedDyes.forEach(d => {
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": d.channel,
                    "Target / Marker": d.dye.target_structure ? `${d.dye.name} (${d.dye.target_structure})` : d.dye.name,
                    "Reagent Type": "Direct Counterstain / Dye",
                    "Primary Details": "—",
                    "Secondary / Detection": d.dye.name,
                    "Excitation Peak (nm)": d.dye.excitation_nm || '—',
                    "Emission Peak (nm)": d.dye.emission_nm || '—',
                    "Warnings": fixWarnings
                });
            });

            // Reporters
            combo.reporters.forEach(r => {
                const ch = CombinationEngine.matchChannelForReagent(r, config.configuredChannels, channels) || 'Reporter';
                const repTag = r.reporter || r.reporter_name || '';
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": ch,
                    "Target / Marker": r.target ? `${r.target} (${repTag})` : repTag,
                    "Reagent Type": "Fluorescent Reporter Line",
                    "Primary Details": "—",
                    "Secondary / Detection": repTag,
                    "Excitation Peak (nm)": r.excitation_nm || '—',
                    "Emission Peak (nm)": r.emission_nm || '—',
                    "Warnings": fixWarnings
                });
            });
        });

        // 2. Matrix Overview Sheet (One row per combination, columns for each channel)
        const matrixRows = combinations.map((combo, idx) => {
            const row = {
                "Combination": `Combo #${idx + 1}`,
                "Score": combo.score,
                "Fixation": combo.fixation.valid ? 'OK' : 'Conflict'
            };

            channels.forEach(ch => {
                const itemsInCh = [];
                combo.primaries.filter(p => p.channel === ch).forEach(p => {
                    const sec = p.is_direct ? `Direct ${p.primary.conjugated_color}` : p.secondary.conjugate;
                    itemsInCh.push(`${p.primary.target} [${p.primary.host}] (${sec})`);
                });
                combo.assignedDyes.filter(d => d.channel === ch).forEach(d => {
                    itemsInCh.push(`${d.dye.name}`);
                });
                combo.reporters.forEach(r => {
                    const rCh = CombinationEngine.matchChannelForReagent(r, config.configuredChannels, channels);
                    if (rCh === ch) {
                        const repTag = r.reporter || r.reporter_name || '';
                        itemsInCh.push(r.target ? `${r.target} (${repTag})` : repTag);
                    }
                });
                row[ch] = itemsInCh.length > 0 ? itemsInCh.join(' + ') : '—';
            });

            if (!combo.fixation.valid) {
                row["Warnings"] = combo.fixation.warnings.join('; ');
            }
            return row;
        });

        const wb = XLSX.utils.book_new();
        const wsDetailed = XLSX.utils.json_to_sheet(detailedRows);
        XLSX.utils.book_append_sheet(wb, wsDetailed, "Detailed_Channels");
        const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
        XLSX.utils.book_append_sheet(wb, wsMatrix, "Matrix_Overview");

        const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
        XLSX.writeFile(wb, `SpectraPanel_Combinations_${dateStr}.xlsx`);
    },

    exportCombinationsToCSV() {
        if (!this.state.lastResults || !this.state.lastResults.combinations || this.state.lastResults.combinations.length === 0) {
            alert("No combinations available to export. Please generate combinations first.");
            return;
        }

        const combinations = this.state.lastResults.combinations;
        const config = this.state.lastConfig || {};
        const channels = config.allowedChannels && config.allowedChannels.length > 0 
            ? config.allowedChannels 
            : ["Blue", "Green", "Red", "Far-Red"];

        const detailedRows = [];
        combinations.forEach((combo, idx) => {
            const comboNum = `Combo #${idx + 1}`;
            const score = combo.score;
            const fixStatus = combo.fixation.valid ? 'Compatible' : 'Conflict';
            const fixWarnings = combo.fixation.warnings.join('; ') || 'None';

            combo.primaries.forEach(p => {
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": p.channel,
                    "Target / Marker": p.primary.target,
                    "Reagent Type": p.is_direct ? "Direct Conjugated Primary" : "Primary + Secondary",
                    "Primary Details": `${p.primary.host} ${p.primary.isotype || ''} anti-${p.primary.target}`,
                    "Secondary / Detection": p.is_direct 
                        ? `Direct (${p.primary.conjugated_color})` 
                        : `${p.secondary.anti_host} ${p.secondary.anti_isotype} - ${p.secondary.conjugate}`,
                    "Excitation Peak (nm)": p.secondary ? p.secondary.excitation_nm : '',
                    "Emission Peak (nm)": p.secondary ? p.secondary.emission_nm : '',
                    "Warnings": fixWarnings
                });
            });

            combo.assignedDyes.forEach(d => {
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": d.channel,
                    "Target / Marker": d.dye.target_structure ? `${d.dye.name} (${d.dye.target_structure})` : d.dye.name,
                    "Reagent Type": "Direct Counterstain / Dye",
                    "Primary Details": "—",
                    "Secondary / Detection": d.dye.name,
                    "Excitation Peak (nm)": d.dye.excitation_nm || '',
                    "Emission Peak (nm)": d.dye.emission_nm || '',
                    "Warnings": fixWarnings
                });
            });

            combo.reporters.forEach(r => {
                const ch = CombinationEngine.matchChannelForReagent(r, config.configuredChannels, channels) || 'Reporter';
                const repTag = r.reporter || r.reporter_name || '';
                detailedRows.push({
                    "Combination": comboNum,
                    "Score": score,
                    "Fixation Status": fixStatus,
                    "Channel": ch,
                    "Target / Marker": r.target ? `${r.target} (${repTag})` : repTag,
                    "Reagent Type": "Fluorescent Reporter Line",
                    "Primary Details": "—",
                    "Secondary / Detection": repTag,
                    "Excitation Peak (nm)": r.excitation_nm || '',
                    "Emission Peak (nm)": r.emission_nm || '',
                    "Warnings": fixWarnings
                });
            });
        });

        let csvContent = '';
        if (typeof Papa !== 'undefined' && Papa.unparse) {
            csvContent = Papa.unparse(detailedRows);
        } else {
            const headers = Object.keys(detailedRows[0] || {});
            const lines = [headers.join(',')];
            detailedRows.forEach(row => {
                lines.push(headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
            });
            csvContent = lines.join('\n');
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
        a.download = `SpectraPanel_Combinations_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    showModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = "block";
    },

    hideModal(modalId) {
        const el = document.getElementById(modalId);
        if (el) el.style.display = "none";
    },

    showManualEntry(type) {
        const form = document.getElementById('manual-entry-form');
        if (!form) return;
        let fields = [];
        
        if (type === 'primaries') {
            fields = [
                { id: 'target', label: 'Target Name (e.g. Ki67)', type: 'text' },
                { id: 'host', label: 'Host Species (Rabbit, Mouse)', type: 'text' },
                { id: 'isotype', label: 'Isotype (IgG, IgG1)', type: 'text' },
                { id: 'applications', label: 'Validated Apps (ICC, IHC, WB)', type: 'text' },
                { id: 'conjugated_color', label: 'Conjugated Color (if direct, else blank)', type: 'text' },
                { id: 'fixation_compatible', label: 'Fixation Compatible (PFA, Methanol)', type: 'text' },
                { id: 'live_cell_compatible', label: 'Live-Cell Compatible (Yes/No)', type: 'text' }
            ];
        } else if (type === 'secondaries') {
            fields = [
                { id: 'anti_host', label: 'Anti-Host Species (Rabbit, Mouse)', type: 'text' },
                { id: 'anti_isotype', label: 'Anti-Isotype (IgG (H+L))', type: 'text' },
                { id: 'conjugate', label: 'Conjugate (Alexa Fluor 488, HRP)', type: 'text' },
                { id: 'conjugate_type', label: 'Conjugate Type (Fluorophore/HRP)', type: 'text' },
                { id: 'excitation_nm', label: 'Excitation Peak (nm)', type: 'number' },
                { id: 'emission_nm', label: 'Emission Peak (nm)', type: 'number' },
                { id: 'applications', label: 'Applications (ICC, IHC, WB)', type: 'text' }
            ];
        } else if (type === 'dyes') {
            fields = [
                { id: 'name', label: 'Dye Name (DAPI, Phalloidin)', type: 'text' },
                { id: 'target_structure', label: 'Target Structure (DNA, F-Actin)', type: 'text' },
                { id: 'color', label: 'Color (Blue, Green, Red)', type: 'text' },
                { id: 'excitation_nm', label: 'Excitation (nm)', type: 'number' },
                { id: 'emission_nm', label: 'Emission (nm)', type: 'number' },
                { id: 'live_cell_compatible', label: 'Live-Cell Compatible (Yes/No)', type: 'text' }
            ];
        } else if (type === 'reporters') {
            fields = [
                { id: 'target', label: 'Target Protein Name (Tubulin, Actin)', type: 'text' },
                { id: 'reporter', label: 'Reporter Fluorophore Tag (EGFP, mCherry)', type: 'text' },
                { id: 'excitation_nm', label: 'Excitation (nm)', type: 'number' },
                { id: 'emission_nm', label: 'Emission (nm)', type: 'number' },
                { id: 'recommended_fixation', label: 'Compatible Fixation (PFA)', type: 'text' },
                { id: 'live_cell_compatible', label: 'Live-Cell Compatible (Yes/No)', type: 'text' }
            ];
        }

        let formHtml = `<input type="hidden" id="entry_type" value="${type}">`;
        fields.forEach(f => {
            formHtml += `
                <div class="form-group">
                    <label>${f.label}:</label>
                    <input type="${f.type}" id="entry_${f.id}" class="form-input">
                </div>
            `;
        });
        
        form.innerHTML = formHtml;
    }
};
