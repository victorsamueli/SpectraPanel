# SpectraPanel — Multiplex Antibody Panel Designer

**SpectraPanel** is a free, browser-based multiplex panel design tool for life science researchers, microscopists, and core facilities. It automatically designs validated, conflict-free antibody and fluorophore staining panels for **Immunocytochemistry (ICC)**, **Immunohistochemistry (IHC)**, and **Western Blotting (WB)**.

With SpectraPanel, you can upload your laboratory's actual antibody and fluorophore inventory, configure your microscope's exact laser lines and optical emission filter ranges, and instantly generate ranked, multi-channel staining combinations tailored to your experiment.

---

## 🚀 Quick Start in 3 Steps

1. **Load Your Inventory**: Click **Download Template** to get the streamlined laboratory inventory template (`.xlsx`), fill in your laboratory's antibodies, dyes, or reporter lines, and click **Upload Database**. Or simply click **Load Demo** to test immediately.
2. **Select & Lock Targets**: In the left database table, check the targets, dyes (e.g., DAPI), or reporter lines (e.g., EGFP) you wish to image. Optionally click the lock icon to fix any specific reagent into all generated panels.
3. **Generate & Export Panels**: Select your immunoassay type (ICC, IHC, or WB) and permitted detection channels, then click **Generate Combinations**. Review your conflict-free panels in equal-column tables and export them directly to **Excel (.xlsx)** or **CSV**.

---

## 🌟 Key Features (User Perspective)

### 1. Interactive Split-Screen Workspace
- **Left Side — Inventory Hub**: Browse your primaries, secondaries, direct dyes, and reporter lines. Filter instantaneously by host, isotype, conjugate, clonality, or application, search by text, and toggle visible table columns.
- **Right Side — Panel Designer & Results**: Configure immunoassay options, preparation modes (Fixed-Cell vs. Live-Cell), permitted channels, and examine generated panels. Collapsible options ensure maximum vertical screen space for viewing results.
- **Mobile & Tablet Friendly**: Responsive interface with a dedicated mobile view switcher and floating shortcut counter to seamlessly jump between inventory browsing and panel design.

### 2. Multi-Format Inventory Ingestion
- **Streamlined Excel Template (`.xlsx`)**: Pre-formatted workbook with dedicated sheets for `Primaries`, `Secondaries`, `Direct_Dyes`, and `Reporters`. Essential columns required for panel generation are clearly indicated with an asterisk (`*`):
  - **Primaries**: `target*`, `clonality*`, `host*`, `isotype*`, `fixation_compatible*`
  - **Secondaries**: `anti_host*`, `conjugate*`, `emission_nm*`
  - **Direct Dyes**: `name*`, `emission_nm*`, `live_cell_compatible*`
  - **Reporters**: `target*`, `reporter*`, `emission_nm*`
  *(All other columns such as `clone`, `make`, `catalog`, `excitation_nm`, and `comments` are optional for lab tracking).*
- **Smart Key Sanitizer**: Upload files with starred or unstarred headers—SpectraPanel automatically cleans and standardizes them.
- **Google Sheets Live Sync**: Connect a shared laboratory Google Sheet URL with background auto-sync so your entire team's updated inventory is always reflected.
- **Manual Reagent Entry**: Add single antibodies, dyes, or fluorescent tags on the fly without leaving the browser. Required fields are clearly highlighted with asterisks and real-time form validation.
- **Clean Database Reset**: Clear your active inventory, target selections, and results in one click while preserving Google Sheet connection settings.

### 3. Target Selection & Smart Reagent Locking
- **One-Click Target Staining**: Check items in the inventory table to stage them for multiplexing.
- **Reagent Locking**: Click the lock icon next to any reagent (e.g., lock `DAPI` in Blue, or lock `Ki-67` with Rabbit primary) to force it into all combinations. 
- **Automatic Channel Reservation**: Locking a reagent automatically reserves its detection channel, intelligently preventing competing unlocked reagents from causing channel collisions.

### 4. Hardware-Matched Microscopy Optical Channels
- **Match Your Exact Microscope Filters**: Avoid spectral bleed-through by configuring your exact filter cube bandwidths and laser lines.
- **One-Click Channel Presets**:
  - **4-Channel**: Blue (DAPI/405), Green (AF488/GFP), Red (AF555/TRITC), Far-Red (AF647/Cy5)
  - **5-Channel**: Adds Orange (AF594/Texas Red)
  - **6-Channel / Near-IR**: Adds Near-IR (AF750/Cy7)
- **Optical Physics Wavelength Calculation**: Adjusting emission wavelength ranges automatically calculates the physical visible light color of the midpoint wavelength ($\lambda_{\text{mid}}$) in real time, with full manual color-picker overrides.
- **Dynamic Emission Allocation**: Secondary antibodies, dyes, and reporter lines are automatically assigned to detection channels based on their peak emission wavelengths.

### 5. Automated Conflict Resolution Engine
- **Host Species Cross-Reactivity Prevention**: Automatically prevents non-specific secondary cross-binding when using multiple unconjugated primary antibodies.
- **Subclass / Isotype Separation**: Intelligently permits same-species primaries (e.g., Mouse IgG1 + Mouse IgG2a) when corresponding isotype-specific secondaries are present in inventory.
- **Fixation Compatibility Check**: Detects fixative conflicts (e.g., PFA vs. Methanol) across primaries, secondaries, dyes, and reporter lines, displaying prominent status tags and warnings.
- **Strict Channel Conformance**: Combinations strictly use only the detection channels you enable.

### 6. Clean 2-Row Panels with Target Set Grouping
- **Equal-Width Responsive Columns**: Combination tables feature uniform, evenly spaced columns for each detection channel, preventing layout jitter.
- **Two-Row Staining Protocol View**:
  - **Row 1 (Primary)**: Target protein name, host species, isotype, and clonality.
  - **Row 2 (Detection)**: Conjugated secondary fluorophore, reporter FP, or direct dye with peak emission wavelength and fixation compatibility.
- **Target Set Grouping Badges**: When multiple combinations stain the exact same set of targets using alternative channel allocations, a distinct **Target Set badge** groups them together, making it easy to identify identical target coverage versus channel variations.

### 7. User-Configurable Scoring & Priorities
- Fine-tune panel ranking priorities in the **Settings** modal:
  - **Target Coverage Priority**: Reward weight for panels covering all requested markers.
  - **Cross-Adsorption Specificity**: Bonus for highly cross-adsorbed secondaries.
  - **Host Species Diversity**: Bonus for diversifying animal host species across channels.
  - **Fixation Conflict Penalty**: Penalty for panels with incompatible fixation requirements.
  - **Spectral Overlap Penalty**: Penalty for congested channel allocations.
- Changes take effect immediately upon generating combinations.

### 8. Complete Data Privacy & Instant Export
- **100% Client-Side Execution**: All data processing, inventory storage, and combination calculations run entirely within your local browser. Zero antibody data or proprietary research targets are sent to any external server.
- **Persistent Local Storage**: Your inventory, channel configurations, and scoring preferences are saved securely in your browser's local cache.
- **One-Click Export**: Download panel designs with all primary/secondary details, channels, and warnings formatted for laboratory notebooks as **Excel (.xlsx)** or **CSV**.
- **In-App Suggestion Logger**: Submit feedback or feature requests directly within the tool to generate and download a timestamped feedback log.

---

## 🔬 Supported Applications & Detection Modes

| Application | Supported Modes | Channel Types |
| :--- | :--- | :--- |
| **ICC (Immunocytochemistry)** | Fixed-Cell, Live-Cell | Fluorescence (Blue, Green, Red, Orange, Far-Red, Near-IR) |
| **IHC (Immunohistochemistry)** | Fixed-Cell | Fluorescence (Blue, Green, Red, Orange, Far-Red, Near-IR) |
| **Western Blot (WB)** | Membrane Detection | Chemiluminescence (HRP) & Multiplex Fluorescence |

---

## 📋 Essential Database Fields Reference

When uploading custom inventory or entering items manually, the following fields are required for SpectraPanel's combination engine:

| Inventory Sheet | Essential Fields (`*`) | Optional Lab Tracking Fields |
| :--- | :--- | :--- |
| **Primaries** | `target*`, `clonality*`, `host*`, `isotype*`, `fixation_compatible*` | `clone`, `make`, `catalog`, `applications`, `conjugated_color`, `live_cell_compatible`, `comments` |
| **Secondaries** | `anti_host*`, `conjugate*`, `emission_nm*` | `anti_isotype`, `host`, `conjugate_type`, `excitation_nm`, `applications`, `make`, `catalogue`, `comments` |
| **Direct Dyes** | `name*`, `emission_nm*`, `live_cell_compatible*` | `target_structure`, `color`, `excitation_nm`, `make`, `catalogue` |
| **Reporters** | `target*`, `reporter*`, `emission_nm*` | `excitation_nm`, `recommended_fixation`, `live_cell_compatible` |

---

## 💡 Practical Tips for Best Results

- **Testing with Demo Data**: Click **Load Demo** in the top navigation bar to populate the inventory with 10 primary antibodies, 10 secondaries, direct dyes, and fluorescent proteins to explore combinations immediately.
- **Live-Cell Imaging**: Switch the preparation mode to **Live-Cell** under Panel Options to automatically filter for antibodies, dyes, and reporter lines validated for live imaging.
- **Direct Conjugates**: If you have directly conjugated primary antibodies, enter their fluorophore or color in the `conjugated_color` column; SpectraPanel will assign them directly without requiring secondary antibodies.
- **Same-Host Multiplexing**: To stain two targets with mouse primaries simultaneously, ensure their isotypes differ (e.g. IgG1 vs IgG2a) and that matching anti-mouse isotype-specific secondaries are in your inventory.

---

## 📄 License & Attribution

SpectraPanel is open-source and free for academic and commercial scientific research. Built for scientists, microscopy facilities, and biomedical labs worldwide.
