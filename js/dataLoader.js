// dataLoader.js - Handles loading CSV/TSV, Excel template generation and multi-sheet XLSX imports for SpectraPanel v1.0

window.db = {
    primaries: [],
    secondaries: [],
    dyes: [],
    reporters: [],
    channels: []
};

const DataLoader = {
    /**
     * Initializes the database on application launch.
     * Starts empty by default unless user has saved custom inventory in localStorage.
     */
    initDatabase() {
        try {
            const saved = localStorage.getItem('spectrapanel_inventory');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && typeof parsed === 'object') {
                    window.db.primaries = parsed.primaries || [];
                    window.db.secondaries = parsed.secondaries || [];
                    window.db.dyes = parsed.dyes || [];
                    window.db.reporters = parsed.reporters || [];
                    window.db.channels = parsed.channels || [];

                    const totalItems = window.db.primaries.length + window.db.secondaries.length + window.db.dyes.length + window.db.reporters.length;
                    if (totalItems > 0) {
                        const statusEl = document.getElementById('upload-status');
                        if (statusEl) {
                            statusEl.innerText = "Saved Inventory";
                            statusEl.className = "status-pill status-success";
                        }
                        document.dispatchEvent(new CustomEvent('dbLoaded'));
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn("Could not read spectrapanel_inventory from localStorage", e);
        }

        // Default: Start completely empty!
        window.db.primaries = [];
        window.db.secondaries = [];
        window.db.dyes = [];
        window.db.reporters = [];
        window.db.channels = [];

        // Check if Google Sheets auto-sync is configured
        try {
            const gsheetUrl = localStorage.getItem('spectrapanel_gsheet_url');
            const gsheetAutoSync = localStorage.getItem('spectrapanel_gsheet_autosync');
            if (gsheetUrl && gsheetAutoSync === 'true') {
                this.loadFromGoogleSheets(gsheetUrl, true).catch(err => {
                    console.warn("[SpectraPanel] Google Sheets background auto-sync error:", err);
                });
                return;
            }
        } catch (e) {}

        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.innerText = "No Data Loaded";
            statusEl.className = "status-pill status-muted";
        }
        document.dispatchEvent(new CustomEvent('dbLoaded'));
    },

    saveToLocalStorage() {
        try {
            const payload = {
                primaries: window.db.primaries || [],
                secondaries: window.db.secondaries || [],
                dyes: window.db.dyes || [],
                reporters: window.db.reporters || [],
                channels: window.db.channels || []
            };
            localStorage.setItem('spectrapanel_inventory', JSON.stringify(payload));
        } catch (e) {
            console.warn("Could not persist inventory to localStorage", e);
        }
    },

    extractGoogleSpreadsheetId(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) return match[1];
        if (/^[a-zA-Z0-9-_]{20,60}$/.test(url.trim())) return url.trim();
        return null;
    },

    async loadFromGoogleSheets(shareUrl, autoSync = false) {
        const statusEl = document.getElementById('upload-status');
        const statusMsgEl = document.getElementById('gsheet-status-msg');
        const clearBtn = document.getElementById('btn-clear-gsheet');

        const sheetId = this.extractGoogleSpreadsheetId(shareUrl);
        if (!sheetId) {
            const err = "Invalid Google Sheets URL. Please copy the full share link (e.g. https://docs.google.com/spreadsheets/d/.../edit?usp=sharing).";
            if (statusMsgEl) {
                statusMsgEl.style.display = 'block';
                statusMsgEl.style.color = 'var(--accent-red)';
                statusMsgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${err}`;
            }
            throw new Error(err);
        }

        const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

        if (statusEl) {
            statusEl.innerText = "Syncing Google Sheet...";
            statusEl.className = "status-pill status-warn";
        }
        if (statusMsgEl) {
            statusMsgEl.style.display = 'block';
            statusMsgEl.style.color = 'var(--accent-blue)';
            statusMsgEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Fetching workbook from Google Sheets...`;
        }

        try {
            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error(`Google Sheets returned HTTP ${response.status}. Ensure sheet permissions are set to 'Anyone with the link can view'.`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            
            this.parseMultiSheetWorkbook(workbook);

            // Save sync preferences
            try {
                localStorage.setItem('spectrapanel_gsheet_url', shareUrl);
                localStorage.setItem('spectrapanel_gsheet_autosync', autoSync ? 'true' : 'false');
            } catch (e) {}

            if (statusEl) {
                statusEl.innerText = "Google Sheets Sync";
                statusEl.className = "status-pill status-success";
            }
            if (statusMsgEl) {
                statusMsgEl.style.color = 'var(--accent-green)';
                statusMsgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Successfully synchronized with Google Sheets!`;
            }
            if (clearBtn) clearBtn.style.display = 'inline-flex';

            return true;
        } catch (error) {
            console.error("[SpectraPanel] Google Sheets sync error:", error);
            if (statusEl) {
                statusEl.innerText = "Sync Failed";
                statusEl.className = "status-pill status-error";
            }
            if (statusMsgEl) {
                statusMsgEl.style.color = 'var(--accent-red)';
                statusMsgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${error.message || "Failed to sync Google Sheet"}`;
            }
            throw error;
        }
    },

    async loadDemoData(persist = false) {
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.innerText = "Loading Demo Data...";
            statusEl.className = "status-pill status-warn";
        }
        try {
            await Promise.all([
                this.loadCSV('data/primary_antibodies.csv', 'primaries'),
                this.loadCSV('data/secondary_antibodies.csv', 'secondaries'),
                this.loadCSV('data/direct_dyes.csv', 'dyes'),
                this.loadCSV('data/reporters.csv', 'reporters'),
                this.loadCSV('data/channels.csv', 'channels')
            ]);
            console.log("[SpectraPanel] Sample demo data loaded:", window.db);
            if (persist) {
                this.saveToLocalStorage();
            }
            if (statusEl) {
                statusEl.innerText = "Demo Data";
                statusEl.className = "status-pill status-demo";
            }
            document.dispatchEvent(new CustomEvent('dbLoaded'));
        } catch (error) {
            console.error("[SpectraPanel] Error loading demo data:", error);
            if (statusEl) {
                statusEl.innerText = "Error loading demo";
                statusEl.className = "status-pill status-error";
            }
        }
    },

    async loadDefaultData() {
        return this.loadDemoData();
    },

    loadCSV(url, dbKey) {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    results.data.forEach((row, idx) => {
                        Object.keys(row).forEach(key => {
                            if (typeof row[key] === 'string') {
                                row[key] = row[key].trim();
                            }
                        });
                        if (!row.id) {
                            row.id = `${dbKey.slice(0, 3)}_${idx + 1}`;
                        }
                    });
                    window.db[dbKey] = results.data;
                    resolve();
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    },

    handleFileUpload(file) {
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.innerText = `Loading ${file.name}...`;
            statusEl.className = "status-pill status-success";
        }

        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    let importedSheets = [];
                    
                    workbook.SheetNames.forEach(sheetName => {
                        const sNameLower = sheetName.toLowerCase();
                        const sheet = workbook.Sheets[sheetName];
                        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
                        
                        if (json.length === 0) return;
                        
                        // Normalize whitespace and assign ID if missing
                        json.forEach((row, idx) => {
                            Object.keys(row).forEach(k => {
                                if (typeof row[k] === 'string') row[k] = row[k].trim();
                            });
                            if (!row.id) {
                                row.id = `item_${idx + 1}`;
                            }
                        });

                        // Map sheets by name or column detection
                        if (sNameLower.includes('primar')) {
                            window.db.primaries = json;
                            importedSheets.push('Primaries');
                        } else if (sNameLower.includes('second')) {
                            window.db.secondaries = json;
                            importedSheets.push('Secondaries');
                        } else if (sNameLower.includes('dye')) {
                            window.db.dyes = json;
                            importedSheets.push('Dyes');
                        } else if (sNameLower.includes('report')) {
                            window.db.reporters = json;
                            importedSheets.push('Reporters');
                        } else {
                            // Fallback: detect by columns
                            const keys = Object.keys(json[0] || {});
                            if (keys.includes('target') && keys.includes('host')) {
                                window.db.primaries = json;
                                importedSheets.push('Primaries');
                            } else if (keys.includes('anti_host')) {
                                window.db.secondaries = json;
                                importedSheets.push('Secondaries');
                            } else if (keys.includes('target_structure')) {
                                window.db.dyes = json;
                                importedSheets.push('Dyes');
                            } else if (keys.includes('reporter') || keys.includes('reporter_name')) {
                                window.db.reporters = json;
                                importedSheets.push('Reporters');
                            }
                        }
                    });

                    if (importedSheets.length > 0) {
                        this.saveToLocalStorage();
                        if (statusEl) {
                            statusEl.innerText = `Loaded: ${importedSheets.join(', ')}`;
                            statusEl.className = "status-pill status-success";
                        }
                        document.dispatchEvent(new CustomEvent('dbLoaded'));
                    } else {
                        throw new Error("No recognizable data sheets found in Excel file.");
                    }
                } catch (err) {
                    console.error("[SpectraPanel] Excel parse error:", err);
                    if (statusEl) {
                        statusEl.innerText = `Excel error: ${err.message}`;
                        statusEl.className = "status-pill status-error";
                    }
                }
            };
            reader.readAsArrayBuffer(file);

        } else if (ext === 'csv' || ext === 'tsv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    this.processSingleTableData(results.data, file.name);
                },
                error: (error) => {
                    if (statusEl) {
                        statusEl.innerText = `CSV error: ${error.message}`;
                        statusEl.className = "status-pill status-error";
                    }
                }
            });
        } else {
            if (statusEl) {
                statusEl.innerText = "Unsupported format. Please upload .xlsx or .csv";
                statusEl.className = "status-pill status-error";
            }
        }
    },

    processSingleTableData(data, filename) {
        const statusEl = document.getElementById('upload-status');
        if (!data || data.length === 0) {
            if (statusEl) {
                statusEl.innerText = "Uploaded file is empty";
                statusEl.className = "status-pill status-error";
            }
            return;
        }

        // Normalize whitespace
        data.forEach((row, idx) => {
            Object.keys(row).forEach(key => {
                if (typeof row[key] === 'string') {
                    row[key] = row[key].trim();
                }
            });
            if (!row.id) row.id = `item_${idx + 1}`;
        });

        const keys = Object.keys(data[0]);
        let targetDb = '';
        
        if (keys.includes('target') && keys.includes('host')) targetDb = 'primaries';
        else if (keys.includes('anti_host')) targetDb = 'secondaries';
        else if (keys.includes('target_structure')) targetDb = 'dyes';
        else if (keys.includes('reporter') || keys.includes('reporter_name')) targetDb = 'reporters';
        else {
            if (statusEl) {
                statusEl.innerText = "Unrecognized table schema in CSV";
                statusEl.className = "status-pill status-error";
            }
            return;
        }

        window.db[targetDb] = data;
        this.saveToLocalStorage();
        if (statusEl) {
            statusEl.innerText = `Loaded ${targetDb} from ${filename}`;
            statusEl.className = "status-pill status-success";
        }
        document.dispatchEvent(new CustomEvent('dbLoaded'));
    },

    clearDatabase(confirmWithUser = true) {
        if (confirmWithUser) {
            const ok = confirm("Are you sure you want to clear your loaded inventory? This will remove all loaded antibodies, dyes, and reporters from your browser session.");
            if (!ok) return;
        }
        window.db.primaries = [];
        window.db.secondaries = [];
        window.db.dyes = [];
        window.db.reporters = [];
        window.db.channels = [];
        try {
            localStorage.removeItem('spectrapanel_inventory');
        } catch (e) {}

        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.innerText = "No Data Loaded";
            statusEl.className = "status-pill status-muted";
        }
        if (window.UI && window.UI.state) {
            window.UI.state.selectedReagents = [];
            window.UI.renderSelectedTargetsBox();
        }
        document.dispatchEvent(new CustomEvent('dbLoaded'));
    },

    /**
     * Generates and downloads a lean, streamlined multi-sheet Excel template (.xlsx)
     * containing strictly the columns required for panel design.
     */
    generateExcelTemplate() {
        if (typeof XLSX === 'undefined') {
            alert("Excel export library is loading. Please try again in a moment.");
            return;
        }

        const wb = XLSX.utils.book_new();

        // 1. Instructions Sheet
        const instructionsData = [
            ["SpectraPanel v1.0 — Laboratory Inventory Database Template"],
            [""],
            ["Instructions:"],
            ["1. Keep the column headers in row 1 unchanged across all sheets."],
            ["2. Enter your laboratory's antibody and reagent inventory into the respective sheets (Primaries, Secondaries, Direct_Dyes, Reporters)."],
            ["3. Detection channels & colors for Secondaries and Reporters are computed dynamically from emission peaks matching your configured microscopy channels."],
            ["4. Under Reporters, enter target (protein name) and reporter (fluorophore tag)."],
            ["5. Save this workbook and click 'Upload Database' in SpectraPanel to load everything in one click."],
            [""],
            ["Sheet Column Reference & Conventions:"],
            ["• Primaries Sheet:"],
            ["    - target: Target protein or marker (e.g., 'Ki67', 'alpha-Tubulin')"],
            ["    - clonality: 'Monoclonal', 'Polyclonal', or 'Recombinant Monoclonal'"],
            ["    - clone: Clone name or ID (e.g., 'SP6', 'DM1A')"],
            ["    - host: Primary host species (e.g., 'Mouse', 'Rabbit')"],
            ["    - isotype: Primary isotype (e.g., 'IgG1', 'IgG2a', 'IgG2b', 'IgG', 'IgM')"],
            ["    - make: Manufacturer / Supplier (e.g., 'Invitrogen', 'Sigma-Aldrich', 'DSHB', 'CST')"],
            ["    - catalog: Product catalog number"],
            ["    - applications: Comma-separated validated applications (e.g., 'ICC, IHC, WB')"],
            ["    - conjugated_color: Leave blank for unconjugated; enter fluorophore color if directly conjugated."],
            ["    - fixation_compatible: 'PFA', 'Methanol', or 'PFA, Methanol'"],
            ["    - live_cell_compatible: 'Yes' or 'No'"],
            ["    - comments: Lab notes, storage box, aliquot notes, etc."],
            [""],
            ["• Secondaries Sheet:"],
            ["    - anti_host: Target species recognized by the secondary (e.g., 'Mouse', 'Rabbit', 'Chicken')"],
            ["    - anti_isotype: Specific isotype recognized (e.g., 'IgG (H+L)', 'IgM', 'IgG1')"],
            ["    - host: Host animal species that produced the secondary antibody (e.g., 'Goat', 'Donkey')"],
            ["    - conjugate: Fluorophore or enzyme name (e.g., 'Alexa Fluor 488', 'Alexa Fluor Plus 647', 'HRP')"],
            ["    - conjugate_type: 'Fluorophore' or 'HRP'"],
            ["    - excitation_nm: Peak excitation wavelength in nm (e.g., 490, 650)"],
            ["    - emission_nm: Peak emission wavelength in nm (e.g., 525, 665)"],
            ["    - applications: 'ICC, IHC, WB'"],
            ["    - make: Manufacturer / Supplier (e.g., 'Invitrogen')"],
            ["    - catalogue: Secondary antibody catalog number"],
            ["    - comments: Box location, receipt date, or lot notes"],
            [""],
            ["• Direct Dyes Sheet:"],
            ["    - name, target_structure, color, excitation_nm, emission_nm, live_cell_compatible, make, catalogue"],
            [""],
            ["• Reporters Sheet:"],
            ["    - target, reporter, excitation_nm, emission_nm, recommended_fixation"]
        ];
        const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

        // 2. Primaries Sheet
        const primariesData = [
            {
                target: "Ki67",
                clonality: "Monoclonal",
                clone: "SP6",
                host: "Rabbit",
                isotype: "IgG",
                make: "Generic Bio",
                catalog: "DEMO-P01",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA, Methanol",
                live_cell_compatible: "No",
                comments: ""
            },
            {
                target: "alpha-Tubulin",
                clonality: "Monoclonal",
                clone: "DM1A",
                host: "Mouse",
                isotype: "IgG1",
                make: "Generic Bio",
                catalog: "DEMO-P02",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA, Methanol",
                live_cell_compatible: "No",
                comments: ""
            },
            {
                target: "beta-Actin",
                clonality: "Monoclonal",
                clone: "AC-15",
                host: "Mouse",
                isotype: "IgG2a",
                make: "Generic Bio",
                catalog: "DEMO-P03",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA",
                live_cell_compatible: "No",
                comments: ""
            },
            {
                target: "Lamin A/C",
                clonality: "Polyclonal",
                clone: "",
                host: "Rabbit",
                isotype: "IgG",
                make: "Generic Bio",
                catalog: "DEMO-P04",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA",
                live_cell_compatible: "No",
                comments: ""
            }
        ];
        const wsPrimaries = XLSX.utils.json_to_sheet(primariesData);

        // 3. Secondaries Sheet
        const secondariesData = [
            {
                anti_host: "Rabbit",
                anti_isotype: "IgG (H+L)",
                host: "Donkey",
                conjugate: "Alexa Fluor 488",
                conjugate_type: "Fluorophore",
                excitation_nm: "490",
                emission_nm: "525",
                applications: "ICC, IHC, WB",
                make: "Generic Bio",
                catalogue: "DEMO-S01",
                comments: ""
            },
            {
                anti_host: "Mouse",
                anti_isotype: "IgG1",
                host: "Goat",
                conjugate: "Alexa Fluor Plus 555",
                conjugate_type: "Fluorophore",
                excitation_nm: "555",
                emission_nm: "565",
                applications: "ICC, IHC, WB",
                make: "Generic Bio",
                catalogue: "DEMO-S02",
                comments: ""
            },
            {
                anti_host: "Mouse",
                anti_isotype: "IgG2a",
                host: "Goat",
                conjugate: "Alexa Fluor 594",
                conjugate_type: "Fluorophore",
                excitation_nm: "590",
                emission_nm: "617",
                applications: "ICC, IHC, WB",
                make: "Generic Bio",
                catalogue: "DEMO-S03",
                comments: ""
            },
            {
                anti_host: "Goat",
                anti_isotype: "IgG (H+L)",
                host: "Donkey",
                conjugate: "HRP",
                conjugate_type: "HRP",
                excitation_nm: "",
                emission_nm: "",
                applications: "WB, ICC",
                make: "Generic Bio",
                catalogue: "DEMO-S10",
                comments: ""
            }
        ];
        const wsSecondaries = XLSX.utils.json_to_sheet(secondariesData);

        // 4. Direct Dyes Sheet
        const dyesData = [
            {
                name: "DAPI",
                target_structure: "DNA",
                color: "Blue",
                excitation_nm: "360",
                emission_nm: "460",
                live_cell_compatible: "Yes",
                make: "Generic Bio",
                catalogue: "DEMO-D01"
            },
            {
                name: "Phalloidin-AF488",
                target_structure: "F-Actin",
                color: "Green",
                excitation_nm: "495",
                emission_nm: "518",
                live_cell_compatible: "No",
                make: "Generic Bio",
                catalogue: "DEMO-D03"
            },
            {
                name: "SiR-Actin",
                target_structure: "F-Actin",
                color: "Far-Red",
                excitation_nm: "652",
                emission_nm: "674",
                live_cell_compatible: "Yes",
                make: "Generic Bio",
                catalogue: "DEMO-D06"
            }
        ];
        const wsDyes = XLSX.utils.json_to_sheet(dyesData);

        // 5. Reporters Sheet
        const reportersData = [
            {
                target: "Tubulin",
                reporter: "EGFP",
                excitation_nm: "488",
                emission_nm: "507",
                recommended_fixation: "2% PFA 10 min RT"
            },
            {
                target: "Actin",
                reporter: "mCherry",
                excitation_nm: "587",
                emission_nm: "610",
                recommended_fixation: "4% PFA 15 min RT"
            }
        ];
        const wsReporters = XLSX.utils.json_to_sheet(reportersData);

        // Append Sheets
        XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");
        XLSX.utils.book_append_sheet(wb, wsPrimaries, "Primaries");
        XLSX.utils.book_append_sheet(wb, wsSecondaries, "Secondaries");
        XLSX.utils.book_append_sheet(wb, wsDyes, "Direct_Dyes");
        XLSX.utils.book_append_sheet(wb, wsReporters, "Reporters");

        // Download Lean Template
        XLSX.writeFile(wb, "SpectraPanel_Database_Template.xlsx");
    }
};
