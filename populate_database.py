import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os
import csv

# Create workbook for public demo
wb = openpyxl.Workbook()

# Setup sheets
ws_inst = wb.active
ws_inst.title = 'Instructions'
ws_prim = wb.create_sheet('Primaries')
ws_sec = wb.create_sheet('Secondaries')
ws_dyes = wb.create_sheet('Direct_Dyes')
ws_rep = wb.create_sheet('Reporters')

# Header styles
header_fill = PatternFill(start_color='1E293B', end_color='1E293B', fill_type='solid') # Slate 800
header_font = Font(name='Segoe UI', size=11, bold=True, color='FFFFFF')
data_font = Font(name='Segoe UI', size=10)
border_side = Side(style='thin', color='CBD5E1')
cell_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)

# 1. Instructions
instructions_content = [
    ["SpectraPanel v1.0 — Demo Laboratory Inventory Database Template"],
    [""],
    ["Instructions:"],
    ["1. Keep the column headers in row 1 unchanged across all sheets."],
    ["2. Enter your laboratory's antibody and reagent inventory into the respective sheets."],
    ["3. Detection channels for Secondaries and Reporters are computed dynamically in SpectraPanel based on emission wavelengths."],
    ["4. Save this workbook and click 'Upload Database' in SpectraPanel to import all sheets at once."],
    [""],
    ["Sheet Column Reference & Conventions:"],
    ["• Primaries Sheet:"],
    ["    - target: Target protein or marker (e.g., 'Ki67', 'alpha-Tubulin')"],
    ["    - clonality: 'Monoclonal', 'Polyclonal', or 'Recombinant Monoclonal'"],
    ["    - clone: Clone name or ID (e.g., 'SP6', 'DM1A')"],
    ["    - host: Primary host species (e.g., 'Mouse', 'Rabbit', 'Rat', 'Chicken', 'Goat')"],
    ["    - isotype: Primary isotype (e.g., 'IgG1', 'IgG2a', 'IgG2b', 'IgG', 'IgY')"],
    ["    - make: Generic supplier (e.g., 'Generic Bio', 'Demo Labs')"],
    ["    - catalog: Product catalog number"],
    ["    - applications: Comma-separated validated applications (e.g., 'ICC, IHC, WB')"],
    ["    - conjugated_color: Leave blank for unconjugated; enter fluorophore color if directly conjugated."],
    ["    - fixation_compatible: 'PFA', 'Methanol', or 'PFA, Methanol'"],
    ["    - live_cell_compatible: 'Yes' or 'No'"],
    ["    - comments: Generic notes"],
    [""],
    ["• Secondaries Sheet:"],
    ["    - anti_host: Target species recognized by the secondary (e.g., 'Mouse', 'Rabbit', 'Rat', 'Chicken', 'Goat')"],
    ["    - anti_isotype: Specific isotype recognized (e.g., 'IgG (H+L)', 'IgG1', 'IgG2a')"],
    ["    - host: Host animal species that produced the secondary antibody (e.g., 'Goat', 'Donkey')"],
    ["    - conjugate: Fluorophore or enzyme name (e.g., 'Alexa Fluor 488', 'Alexa Fluor Plus 555', 'HRP')"],
    ["    - conjugate_type: 'Fluorophore' or 'HRP'"],
    ["    - color: Optical color group ('Green', 'Red', 'Far-Red')"],
    ["    - excitation_nm: Peak excitation wavelength in nm (e.g., 490, 650)"],
    ["    - emission_nm: Peak emission wavelength in nm (e.g., 525, 665)"],
    ["    - applications: 'ICC, IHC, WB'"],
    ["    - make: Generic supplier"],
    ["    - catalogue: Secondary antibody catalog number"],
    ["    - comments: Box location, receipt date, or lot notes"],
    [""],
    ["• Direct Dyes Sheet:"],
    ["    - name, target_structure, color, excitation_nm, emission_nm, live_cell_compatible, make, catalogue"],
    [""],
    ["• Reporters Sheet:"],
    ["    - reporter_name, color, excitation_nm, emission_nm, recommended_fixation"]
]

for r_idx, row in enumerate(instructions_content, 1):
    for c_idx, val in enumerate(row, 1):
        cell = ws_inst.cell(row=r_idx, column=c_idx, value=val)
        if r_idx == 1:
            cell.font = Font(name='Segoe UI', size=14, bold=True, color='0F172A')
        elif r_idx in [3, 9, 10, 23, 37, 40]:
            cell.font = Font(name='Segoe UI', size=11, bold=True, color='334155')
        else:
            cell.font = Font(name='Segoe UI', size=10, color='475569')

# 2. Primaries (Exactly 10 standard educational dummy reagents)
prim_headers = [
    'target', 'clonality', 'clone', 'host', 'isotype', 'make', 'catalog',
    'applications', 'conjugated_color', 'fixation_compatible', 'live_cell_compatible', 'comments'
]

primaries_data = [
    {
        'target': 'Ki67', 'clonality': 'Monoclonal', 'clone': 'SP6', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Generic Bio', 'catalog': 'DEMO-P01', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Nuclear marker'
    },
    {
        'target': 'alpha-Tubulin', 'clonality': 'Monoclonal', 'clone': 'DM1A', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Generic Bio', 'catalog': 'DEMO-P02', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Microtubule cytoskeleton'
    },
    {
        'target': 'beta-Actin', 'clonality': 'Monoclonal', 'clone': 'AC-15', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'Generic Bio', 'catalog': 'DEMO-P03', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Actin cytoskeleton'
    },
    {
        'target': 'Lamin A/C', 'clonality': 'Polyclonal', 'clone': '', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Generic Bio', 'catalog': 'DEMO-P04', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Nuclear envelope'
    },
    {
        'target': 'GAPDH', 'clonality': 'Polyclonal', 'clone': '', 'host': 'Chicken', 'isotype': 'IgY',
        'make': 'Generic Bio', 'catalog': 'DEMO-P05', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Cytoplasmic loading control'
    },
    {
        'target': 'Vimentin', 'clonality': 'Monoclonal', 'clone': 'RV202', 'host': 'Rat', 'isotype': 'IgG2a',
        'make': 'Generic Bio', 'catalog': 'DEMO-P06', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Intermediate filaments'
    },
    {
        'target': 'CD31', 'clonality': 'Polyclonal', 'clone': '', 'host': 'Goat', 'isotype': 'IgG',
        'make': 'Generic Bio', 'catalog': 'DEMO-P07', 'applications': 'ICC, IHC',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Endothelial marker'
    },
    {
        'target': 'CD45', 'clonality': 'Monoclonal', 'clone': '30-F11', 'host': 'Mouse', 'isotype': 'IgG2b',
        'make': 'Generic Bio', 'catalog': 'DEMO-P08', 'applications': 'ICC, IHC',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'Yes', 'comments': 'Leukocyte common antigen'
    },
    {
        'target': 'Histone H3', 'clonality': 'Monoclonal', 'clone': 'D1H2', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Generic Bio', 'catalog': 'DEMO-P09', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Chromatin marker'
    },
    {
        'target': 'NeuN', 'clonality': 'Monoclonal', 'clone': 'A60', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Generic Bio', 'catalog': 'DEMO-P10', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Neuronal nuclear marker'
    }
]

ws_prim.append(prim_headers)
for item in primaries_data:
    ws_prim.append([item[h] for h in prim_headers])

# 3. Secondaries (Exactly 10 standard educational dummy reagents)
sec_headers = [
    'anti_host', 'anti_isotype', 'host', 'conjugate', 'conjugate_type', 'color',
    'excitation_nm', 'emission_nm', 'applications', 'make', 'catalogue', 'comments'
]

secondaries_data = [
    {
        'anti_host': 'Rabbit', 'anti_isotype': 'IgG (H+L)', 'host': 'Donkey',
        'conjugate': 'Alexa Fluor 488', 'conjugate_type': 'Fluorophore', 'color': 'Green',
        'excitation_nm': 490, 'emission_nm': 525, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S01', 'comments': 'Broad cross-adsorbed'
    },
    {
        'anti_host': 'Mouse', 'anti_isotype': 'IgG1', 'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 555', 'conjugate_type': 'Fluorophore', 'color': 'Red',
        'excitation_nm': 555, 'emission_nm': 565, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S02', 'comments': 'Isotype specific anti-Mouse IgG1'
    },
    {
        'anti_host': 'Mouse', 'anti_isotype': 'IgG2a', 'host': 'Goat',
        'conjugate': 'Alexa Fluor 594', 'conjugate_type': 'Fluorophore', 'color': 'Red',
        'excitation_nm': 590, 'emission_nm': 617, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S03', 'comments': 'Isotype specific anti-Mouse IgG2a'
    },
    {
        'anti_host': 'Mouse', 'anti_isotype': 'IgG2b', 'host': 'Goat',
        'conjugate': 'Alexa Fluor 488', 'conjugate_type': 'Fluorophore', 'color': 'Green',
        'excitation_nm': 495, 'emission_nm': 519, 'applications': 'ICC, IHC',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S04', 'comments': 'Isotype specific anti-Mouse IgG2b'
    },
    {
        'anti_host': 'Rat', 'anti_isotype': 'IgG (H+L)', 'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 647', 'conjugate_type': 'Fluorophore', 'color': 'Far-Red',
        'excitation_nm': 650, 'emission_nm': 665, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S05', 'comments': 'Highly cross-adsorbed'
    },
    {
        'anti_host': 'Chicken', 'anti_isotype': 'IgY (H+L)', 'host': 'Donkey',
        'conjugate': 'Alexa Fluor 405', 'conjugate_type': 'Fluorophore', 'color': 'Blue',
        'excitation_nm': 401, 'emission_nm': 421, 'applications': 'ICC, IHC',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S06', 'comments': 'Anti-Chicken IgY'
    },
    {
        'anti_host': 'Goat', 'anti_isotype': 'IgG (H+L)', 'host': 'Donkey',
        'conjugate': 'Alexa Fluor 680', 'conjugate_type': 'Fluorophore', 'color': 'Near-IR',
        'excitation_nm': 679, 'emission_nm': 702, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S07', 'comments': 'Near-IR detection'
    },
    {
        'anti_host': 'Rabbit', 'anti_isotype': 'IgG (H+L)', 'host': 'Donkey',
        'conjugate': 'Alexa Fluor 750', 'conjugate_type': 'Fluorophore', 'color': 'Near-IR',
        'excitation_nm': 749, 'emission_nm': 775, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S08', 'comments': 'Far Near-IR'
    },
    {
        'anti_host': 'Mouse', 'anti_isotype': 'IgG (H+L)', 'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 647', 'conjugate_type': 'Fluorophore', 'color': 'Far-Red',
        'excitation_nm': 650, 'emission_nm': 665, 'applications': 'ICC, IHC, WB',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S09', 'comments': 'Anti-Mouse polyvalent'
    },
    {
        'anti_host': 'Goat', 'anti_isotype': 'IgG (H+L)', 'host': 'Donkey',
        'conjugate': 'HRP', 'conjugate_type': 'HRP', 'color': 'HRP',
        'excitation_nm': '', 'emission_nm': '', 'applications': 'WB, ICC',
        'make': 'Generic Bio', 'catalogue': 'DEMO-S10', 'comments': 'Chemiluminescence / enzymatic'
    }
]

ws_sec.append(sec_headers)
for item in secondaries_data:
    ws_sec.append([item[h] for h in sec_headers])

# 4. Direct Dyes (Exactly 10 standard educational dummy reagents)
dyes_headers = ['name', 'target_structure', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible', 'make', 'catalogue']

dyes_data = [
    {'name': 'DAPI', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 360, 'emission_nm': 460, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D01'},
    {'name': 'Hoechst 33342', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 350, 'emission_nm': 461, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D02'},
    {'name': 'Phalloidin-AF488', 'target_structure': 'F-Actin', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 518, 'live_cell_compatible': 'No', 'make': 'Generic Bio', 'catalogue': 'DEMO-D03'},
    {'name': 'Phalloidin-AF594', 'target_structure': 'F-Actin', 'color': 'Red', 'excitation_nm': 590, 'emission_nm': 617, 'live_cell_compatible': 'No', 'make': 'Generic Bio', 'catalogue': 'DEMO-D04'},
    {'name': 'Phalloidin-AF647', 'target_structure': 'F-Actin', 'color': 'Far-Red', 'excitation_nm': 650, 'emission_nm': 668, 'live_cell_compatible': 'No', 'make': 'Generic Bio', 'catalogue': 'DEMO-D05'},
    {'name': 'SiR-Actin', 'target_structure': 'F-Actin', 'color': 'Far-Red', 'excitation_nm': 652, 'emission_nm': 674, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D06'},
    {'name': 'MitoTracker Green', 'target_structure': 'Mitochondria', 'color': 'Green', 'excitation_nm': 490, 'emission_nm': 516, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D07'},
    {'name': 'MitoTracker Red', 'target_structure': 'Mitochondria', 'color': 'Red', 'excitation_nm': 579, 'emission_nm': 599, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D08'},
    {'name': 'WGA-AF488', 'target_structure': 'Membrane', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 519, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D09'},
    {'name': 'DRAQ5', 'target_structure': 'DNA', 'color': 'Far-Red', 'excitation_nm': 646, 'emission_nm': 697, 'live_cell_compatible': 'Yes', 'make': 'Generic Bio', 'catalogue': 'DEMO-D10'},
]

ws_dyes.append(dyes_headers)
for item in dyes_data:
    ws_dyes.append([item[h] for h in dyes_headers])

# 5. Reporters (Exactly 10 standard educational dummy reagents)
rep_headers = ['target', 'reporter', 'color', 'excitation_nm', 'emission_nm', 'recommended_fixation']

rep_data = [
    {'target': 'Tubulin', 'reporter': 'EGFP', 'color': 'Green', 'excitation_nm': 488, 'emission_nm': 507, 'recommended_fixation': 'PFA'},
    {'target': 'Actin', 'reporter': 'mCherry', 'color': 'Red', 'excitation_nm': 587, 'emission_nm': 610, 'recommended_fixation': 'PFA'},
    {'target': 'Mitochondria', 'reporter': 'tdTomato', 'color': 'Orange', 'excitation_nm': 554, 'emission_nm': 581, 'recommended_fixation': 'PFA'},
    {'target': 'Histone H2B', 'reporter': 'mTurquoise2', 'color': 'Blue', 'excitation_nm': 434, 'emission_nm': 474, 'recommended_fixation': 'PFA'},
    {'target': 'Peroxisome', 'reporter': 'mVenus', 'color': 'Green', 'excitation_nm': 515, 'emission_nm': 528, 'recommended_fixation': 'PFA'},
    {'target': 'Golgi', 'reporter': 'EYFP', 'color': 'Green', 'excitation_nm': 514, 'emission_nm': 527, 'recommended_fixation': 'PFA'},
    {'target': 'Endosome', 'reporter': 'mTagBFP2', 'color': 'Blue', 'excitation_nm': 399, 'emission_nm': 454, 'recommended_fixation': 'PFA'},
    {'target': 'Nucleus', 'reporter': 'iRFP670', 'color': 'Far-Red', 'excitation_nm': 643, 'emission_nm': 670, 'recommended_fixation': 'PFA'},
    {'target': 'Plasma Membrane', 'reporter': 'TagRFP', 'color': 'Orange', 'excitation_nm': 555, 'emission_nm': 584, 'recommended_fixation': 'PFA'},
    {'target': 'Vimentin', 'reporter': 'GFP', 'color': 'Green', 'excitation_nm': 488, 'emission_nm': 509, 'recommended_fixation': 'PFA'},
]

ws_rep.append(rep_headers)
for item in rep_data:
    ws_rep.append([item[h] for h in rep_headers])

# Formatting tables
for ws in [ws_prim, ws_sec, ws_dyes, ws_rep]:
    ws.views.sheetView[0].showGridLines = True
    # Header format
    for col_idx in range(1, ws.max_column + 1):
        c = ws.cell(row=1, column=col_idx)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal='center', vertical='center')
        c.border = cell_border
    ws.row_dimensions[1].height = 28
    
    # Data format
    for row_idx in range(2, ws.max_row + 1):
        ws.row_dimensions[row_idx].height = 20
        for col_idx in range(1, ws.max_column + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = data_font
            c.border = cell_border
            header_val = ws.cell(row=1, column=col_idx).value
            if header_val in ['host', 'isotype', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible', 'anti_host', 'conjugate_type', 'recommended_fixation', 'clonality']:
                c.alignment = Alignment(horizontal='center', vertical='center')
            else:
                c.alignment = Alignment(horizontal='left', vertical='center')
                
    # Auto-fit column width
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

ws_inst.column_dimensions['A'].width = 95

# Save public demo workbook
demo_xlsx_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\SpectraPanel_Demo_Database.xlsx'
wb.save(demo_xlsx_path)
print(f'Successfully saved public demo workbook: {demo_xlsx_path}')

# Update data/primary_antibodies.csv
prim_csv_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\primary_antibodies.csv'
prim_csv_cols = ['id', 'target', 'clonality', 'clone', 'host', 'isotype', 'make', 'catalog', 'applications', 'conjugated_color', 'fixation_compatible', 'live_cell_compatible', 'comments']
with open(prim_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=prim_csv_cols)
    writer.writeheader()
    for idx, p in enumerate(primaries_data, 1):
        row = {'id': f'pab_{idx:03d}'}
        for h in prim_headers:
            row[h] = p[h]
        writer.writerow(row)
print(f'Successfully updated: {prim_csv_path} (10 rows)')

# Update data/secondary_antibodies.csv
sec_csv_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\secondary_antibodies.csv'
sec_csv_cols = ['id', 'anti_host', 'anti_isotype', 'host', 'conjugate', 'conjugate_type', 'color', 'excitation_nm', 'emission_nm', 'applications', 'make', 'catalogue', 'comments']
with open(sec_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=sec_csv_cols)
    writer.writeheader()
    for idx, s in enumerate(secondaries_data, 1):
        row = {'id': f'sab_{idx:03d}'}
        for h in sec_headers:
            row[h] = s[h]
        writer.writerow(row)
print(f'Successfully updated: {sec_csv_path} (10 rows)')

# Update data/direct_dyes.csv
dyes_csv_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\direct_dyes.csv'
dyes_csv_cols = ['id', 'name', 'target_structure', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible', 'make', 'catalogue']
with open(dyes_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=dyes_csv_cols)
    writer.writeheader()
    for idx, d in enumerate(dyes_data, 1):
        row = {'id': f'dye_{idx:03d}'}
        for h in dyes_headers:
            row[h] = d[h]
        writer.writerow(row)
print(f'Successfully updated: {dyes_csv_path} (10 rows)')

# Update data/reporters.csv
rep_csv_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\reporters.csv'
rep_csv_cols = ['id', 'target', 'reporter', 'color', 'excitation_nm', 'emission_nm', 'recommended_fixation']
with open(rep_csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=rep_csv_cols)
    writer.writeheader()
    for idx, r in enumerate(rep_data, 1):
        row = {'id': f'rep_{idx:03d}'}
        for h in rep_headers:
            row[h] = r[h]
        writer.writerow(row)
print(f'Successfully updated: {rep_csv_path} (10 rows)')

print('All 10-item dummy databases updated successfully!')
