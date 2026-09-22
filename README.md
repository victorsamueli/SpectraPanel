# SpectraPanel v1.0 — Multiplex Antibody Panel Designer

**SpectraPanel** is a modern, client-side web application designed to help scientists build validated, conflict-free multiplex antibody and fluorophore panels for immunoassays (**ICC**, **IHC**, and **Western Blot**).

Live demo and hosted version: **GitHub Pages compatible with zero backend required.**

---

## 🌟 Key Features

- **Side-by-Side Interface with Independent Scrolling**:
  - **Left Side (Inventory & Selection Hub)**: Browse, filter by any column, search, and check/lock reagents directly in the table.
  - **Right Side (Panel Designer & Results)**: Configure applications, preparation modes (Fixed/Live), and view strictly permitted channel panels.
- **Customizable Microscopy Channels & Optical Physics Color Calculation**:
  - Customize channel names (e.g. `DAPI (405nm)`, `GFP/FITC`, `Alexa 647`).
  - Set custom Excitation and Emission wavelength ranges (nm).
  - **Real-Time Wavelength Calculation**: Editing the emission range automatically updates the color picker to the physical visible light spectrum of the midpoint wavelength ($\lambda_{\text{mid}}$), with full manual color picker liberty.
  - Supports **4-Channel**, **5-Channel (+594nm)**, and **6-Channel (+750nm / Near-IR)** imaging systems.
- **Vastly Streamlined Excel Template (`.xlsx`)**:
  - Clean, lean spreadsheet format containing strictly the 5–8 essential columns required for panel building (no protocol clutter, no dilution tables, no buffer entries).
  - Single-click upload imports all four sheets (`Primaries`, `Secondaries`, `Direct_Dyes`, `Reporters`) simultaneously.
- **Intelligent Combination Engine**:
  - Automatically verifies host-species compatibility, isotype cross-reactivity, and fixation suitability (PFA vs Methanol).
  - Results strictly render **only the channels currently permitted/checked** by the user.
- **User Suggestions & Feedback System**:
  - In-app suggestions modal that automatically formats and downloads a timestamped `suggestion_log_YYYYMMDD_HHMMSS.txt` file directly to the user's disk.

---

## 📂 File Structure

```
SpectraPanel/
├── index.html              # Main Single Page Application interface
├── css/
│   └── style.css           # Glassmorphism dark-theme styling & responsive grid
├── js/
│   ├── app.js              # Application controller & event bindings
│   ├── combinationEngine.js# Conflict checking & multiplex channel allocation
│   ├── dataLoader.js       # XLSX template generator & CSV/Excel parser
│   └── uiComponents.js     # DOM rendering, optical color calculation & modals
├── data/                   # Default demo databases (CSVs)
│   ├── primary_antibodies.csv
│   ├── secondary_antibodies.csv
│   ├── direct_dyes.csv
│   ├── reporters.csv
│   └── channels.csv
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
├── .gitignore              # Standard ignore rules
└── README.md               # Documentation & deployment guide
```

---

## 📄 License & Citation
Developed for scientific researchers and microscopy labs. Free to use, adapt, and share.
