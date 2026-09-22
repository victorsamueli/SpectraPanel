// dataLoader.js - Handles loading CSV/TSV, Excel template generation and multi-sheet XLSX imports for SpectraPanel v1.0

window.db = {
    primaries: [],
    secondaries: [],
    dyes: [],
    reporters: [],
    channels: []
};

const DataLoader = {
    async loadDefaultData() {
        try {
            await Promise.all([
                this.loadCSV('data/primary_antibodies.csv', 'primaries'),
                this.loadCSV('data/secondary_antibodies.csv', 'secondaries'),
                this.loadCSV('data/direct_dyes.csv', 'dyes'),
                this.loadCSV('data/reporters.csv', 'reporters'),
                this.loadCSV('data/channels.csv', 'channels')
            ]);
            console.log("[SpectraPanel] Default data loaded:", window.db);
            const statusEl = document.getElementById('upload-status');
            if (statusEl) {
                statusEl.innerText = "Default Data";
                statusEl.className = "status-pill status-success";
            }
            document.dispatchEvent(new CustomEvent('dbLoaded'));
        } catch (error) {
            console.error("[SpectraPanel] Error loading default data:", error);
            const statusEl = document.getElementById('upload-status');
            if (statusEl) {
                statusEl.innerText = "Error loading data";
                statusEl.className = "status-pill status-error";
            }
        }
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
        if (statusEl) {
            statusEl.innerText = `Loaded ${targetDb} from ${filename}`;
            statusEl.className = "status-pill status-success";
        }
        document.dispatchEvent(new CustomEvent('dbLoaded'));
    },

    clearDatabase() {
        window.db.primaries = [];
        window.db.secondaries = [];
        window.db.dyes = [];
        window.db.reporters = [];
        const statusEl = document.getElementById('upload-status');
        if (statusEl) {
            statusEl.innerText = "Database Cleared";
            statusEl.className = "status-pill status-error";
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
            ["SpectraPanel v1.0 — Streamlined Database Template"],
            [""],
            ["Instructions:"],
            ["1. This template is stripped down to strictly what is required for multiplex panel design."],
            ["2. Keep the column headers in row 1 unchanged."],
            ["3. Enter your lab's inventory across the respective sheets (Primaries, Secondaries, Direct_Dyes, Reporters)."],
            ["4. Detection channels & colors for Secondaries and Reporters are computed dynamically from emission peaks matching your configured microscopy channels (no static color column required)."],
            ["5. Under Reporters, enter target (protein name) and reporter (fluorophore tag)."],
            ["6. Save this workbook and click 'Upload Database' in SpectraPanel to load everything in one click."],
            [""],
            ["Accepted Values & Conventions:"],
            ["• applications: Comma-separated (e.g., 'ICC, IHC, WB' or 'ICC, IHC')"],
            ["• live_cell_compatible: 'Yes' or 'No'"],
            ["• conjugate_type: 'Fluorophore' or 'HRP'"],
            ["• conjugated_color: Leave blank if unconjugated; enter fluorophore color if directly conjugated."],
            ["• fixation_compatible: 'PFA', 'Methanol', or 'PFA, Methanol'"]
        ];
        const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);

        // 2. Primaries Sheet (7 essential columns)
        const primariesData = [
            {
                target: "Ki67",
                host: "Rabbit",
                isotype: "IgG",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA, Methanol",
                live_cell_compatible: "No"
            },
            {
                target: "Vimentin",
                host: "Mouse",
                isotype: "IgG1",
                applications: "ICC, IHC, WB",
                conjugated_color: "",
                fixation_compatible: "PFA, Methanol",
                live_cell_compatible: "No"
            },
            {
                target: "beta-Actin",
                host: "Mouse",
                isotype: "IgG1",
                applications: "ICC, IHC, WB",
                conjugated_color: "Green",
                fixation_compatible: "PFA",
                live_cell_compatible: "No"
            }
        ];
        const wsPrimaries = XLSX.utils.json_to_sheet(primariesData);

        // 3. Secondaries Sheet (7 essential columns, no static color)
        const secondariesData = [
            {
                anti_host: "Rabbit",
                anti_isotype: "IgG (H+L)",
                conjugate: "Alexa Fluor 488",
                conjugate_type: "Fluorophore",
                excitation_nm: "490",
                emission_nm: "525",
                applications: "ICC, IHC, WB"
            },
            {
                anti_host: "Mouse",
                anti_isotype: "IgG (H+L)",
                conjugate: "Alexa Fluor 555",
                conjugate_type: "Fluorophore",
                excitation_nm: "555",
                emission_nm: "565",
                applications: "ICC, IHC, WB"
            },
            {
                anti_host: "Mouse",
                anti_isotype: "IgG1",
                conjugate: "Alexa Fluor 594",
                conjugate_type: "Fluorophore",
                excitation_nm: "590",
                emission_nm: "617",
                applications: "ICC, IHC, WB"
            },
            {
                anti_host: "Rabbit",
                anti_isotype: "IgG (H+L)",
                conjugate: "HRP",
                conjugate_type: "HRP",
                excitation_nm: "",
                emission_nm: "",
                applications: "WB"
            }
        ];
        const wsSecondaries = XLSX.utils.json_to_sheet(secondariesData);

        // 4. Direct Dyes Sheet (6 essential columns)
        const dyesData = [
            {
                name: "DAPI",
                target_structure: "DNA",
                color: "Blue",
                excitation_nm: "360",
                emission_nm: "460",
                live_cell_compatible: "Yes"
            },
            {
                name: "Phalloidin-AF488",
                target_structure: "F-Actin",
                color: "Green",
                excitation_nm: "495",
                emission_nm: "518",
                live_cell_compatible: "No"
            }
        ];
        const wsDyes = XLSX.utils.json_to_sheet(dyesData);

        // 5. Reporters Sheet (5 essential columns: target=protein, reporter=fluorophore)
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
