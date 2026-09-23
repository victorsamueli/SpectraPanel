import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import os
import csv

# Create workbook
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
    ["SpectraPanel v1.0 — Streamlined Database Template"],
    [""],
    ["Instructions:"],
    ["1. This template is stripped down to strictly what is required for multiplex panel design."],
    ["2. Keep the column headers in row 1 unchanged."],
    ["3. Enter your lab's inventory across the respective sheets (Primaries, Secondaries, Direct_Dyes, Reporters)."],
    ["4. Save this workbook and click 'Upload Database' in SpectraPanel to load everything in one click."],
    [""],
    ["Accepted Values & Conventions:"],
    ["• applications: Comma-separated (e.g., 'ICC, IHC, WB' or 'ICC, IHC')"],
    ["• live_cell_compatible: 'Yes' or 'No'"],
    ["• color: 'Blue', 'Green', 'Orange', 'Red', 'Far-Red', 'Near-IR'"],
    ["• conjugate_type: 'Fluorophore' or 'HRP'"],
    ["• conjugated_color: Leave blank if unconjugated; enter fluorophore color if directly conjugated."],
    ["• fixation_compatible: 'PFA', 'Methanol', or 'PFA, Methanol'"]
]
for r_idx, row in enumerate(instructions_content, 1):
    for c_idx, val in enumerate(row, 1):
        cell = ws_inst.cell(row=r_idx, column=c_idx, value=val)
        if r_idx == 1:
            cell.font = Font(name='Segoe UI', size=14, bold=True, color='0F172A')
        elif r_idx in [3, 9]:
            cell.font = Font(name='Segoe UI', size=11, bold=True, color='334155')
        else:
            cell.font = Font(name='Segoe UI', size=10, color='475569')

# 2. Primaries (32 antibodies extracted from PDF datasheets)
prim_headers = ['target', 'host', 'isotype', 'applications', 'conjugated_color', 'fixation_compatible', 'live_cell_compatible']

primaries_data = [
    # 1. 5081-MSM1-P0.pdf
    {'target': 'Pax7', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 2. 554130.pdf
    {'target': 'MyoD', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 3. Antibody-MYOD.pdf
    {'target': 'MyoD', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 4. Antibody-alpha Actinin 2.pdf
    {'target': 'alpha-Actinin 2', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 5. DSHB-9D10.pdf
    {'target': 'Titin', 'host': 'Mouse', 'isotype': 'IgM', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 6. DSHB-CAPZA1.pdf
    {'target': 'CAPZA1', 'host': 'Mouse', 'isotype': 'IgG2a', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'Methanol', 'live_cell_compatible': 'No'},
    # 7. DSHB-CAPZB.pdf
    {'target': 'CAPZB', 'host': 'Mouse', 'isotype': 'IgG2a', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'Methanol', 'live_cell_compatible': 'No'},
    # 8. DSHB-JLT12.pdf
    {'target': 'Troponin T', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 9. DSHB-MF20.pdf
    {'target': 'Myosin Heavy Chain', 'host': 'Mouse', 'isotype': 'IgG2b', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 10. DSHB-PAX7.pdf
    {'target': 'Pax7', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 11. DSHB-TI4.pdf
    {'target': 'Troponin I', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 12. DSHB-mMaC.pdf
    {'target': 'Myomesin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 13. GAPDH (GA1R)_mice mIgG1_Invitrogen_Datasheet.pdf
    {'target': 'GAPDH', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 14. LMOD3_Rabbit-pAb_ProteinTech_14948-1-AP.pdf
    {'target': 'LMOD3', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 15. Lamin AC mice mAB (SantaCruz)_DataSheet.pdf
    {'target': 'Lamin A/C', 'host': 'Mouse', 'isotype': 'IgG2b', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 16. Nexilin mice mAB (Sigma)_DataSheet.pdf
    {'target': 'Nexilin', 'host': 'Mouse', 'isotype': 'IgG2a', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 17. Pan-Actin (D18C11) Rabbit mAB (CST)_DataSheet.pdf
    {'target': 'Pan-Actin', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 18. Pax7 (NeoBiotechnologies)_DataSheet.pdf
    {'target': 'Pax7', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 19. Sarc-aActinin mice mAB (Sigma)_DataSheet.pdf
    {'target': 'Sarcomeric alpha-Actinin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 20. Telethonin(G-11)_mAb_SantaCruz_sc-25327.pdf
    {'target': 'Telethonin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 21. Ubiquitin (P4D1)_Mice mAB_EnzoLifeSciences_BML-PW0930-0100.pdf
    {'target': 'Ubiquitin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 22. Vimentin mice mAB (Invitrogen)_DataSheet.pdf
    {'target': 'Vimentin', 'host': 'Mouse', 'isotype': 'IgM', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 23. a-Tubulin mice mAB (Sigma)_DataSheet.pdf
    {'target': 'alpha-Tubulin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 24. a-Tubulin mice mAB - DM1a (Invitrogen)_DataSheet.pdf
    {'target': 'alpha-Tubulin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 25. aActinin-1 Rabbit mAB (CST)_DataSheet.pdf
    {'target': 'alpha-Actinin 1', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 26. alphaActin (5C5)_mIgMk_SantaCruz_sc-58670.pdf
    {'target': 'alpha-Actin', 'host': 'Mouse', 'isotype': 'IgM', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 27. betaActin (15G5A11-E2)_mIgG1_Invitrogen_MA1-140.pdf
    {'target': 'beta-Actin', 'host': 'Mouse', 'isotype': 'IgG1', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 28. betaActin (AC74)_mIgG2a_Sigma_A2228.pdf
    {'target': 'beta-Actin', 'host': 'Mouse', 'isotype': 'IgG2a', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 29. betaActin (arg)_rPoly_Sigma_ABT264.pdf
    {'target': 'beta-Actin (Arginylated)', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 30. gammaActin (2A3)_mIgG2b_Abcam_ab123034.pdf
    {'target': 'gamma-Actin', 'host': 'Mouse', 'isotype': 'IgG2b', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
    # 31. panActin (D18C11)_rIgG1_CST_8456.pdf
    {'target': 'Pan-Actin', 'host': 'Rabbit', 'isotype': 'IgG', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No'},
    # 32. sm-alphaActin (1A4)_mIgG2a_Sigma_A2547.pdf
    {'target': 'Smooth Muscle alpha-Actin', 'host': 'Mouse', 'isotype': 'IgG2a', 'applications': 'ICC, IHC, WB', 'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No'},
]

ws_prim.append(prim_headers)
for item in primaries_data:
    ws_prim.append([item[h] for h in prim_headers])

# 3. Secondaries (User Lab Inventory from Screenshot)
sec_headers = ['anti_host', 'anti_isotype', 'conjugate', 'conjugate_type', 'color', 'excitation_nm', 'emission_nm', 'applications']

secondaries_data = [
    # 1. Donkey Anti-Goat IgG HRP Conjugate | Cat: A15999
    {
        'anti_host': 'Goat',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'HRP (Donkey, Invitrogen A15999)',
        'conjugate_type': 'HRP',
        'color': '',
        'excitation_nm': '',
        'emission_nm': '',
        'applications': 'WB'
    },
    # 2. Goat Anti Mouse Alexafluor-488 IgM (µ chain) | Cat: A21042
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgM',
        'conjugate': 'Alexa Fluor 488 (Goat, Invitrogen A21042)',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB'
    },
    # 3. Donkey Anti Rabbit alexafluor-488 | Cat: A21206
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor 488 (Donkey, Invitrogen A21206)',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB'
    },
    # 4. Anti Chicken alexa-633 IgY (H+L) Goat Ab | Cat: A21103
    {
        'anti_host': 'Chicken',
        'anti_isotype': 'IgY (H+L)',
        'conjugate': 'Alexa Fluor 633 (Goat, Invitrogen A21103)',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 632,
        'emission_nm': 647,
        'applications': 'ICC, IHC, WB'
    },
    # 5. Goat Anti-Rabbit alexafluor-647 | Cat: A21245
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor 647 (Goat, Invitrogen A21245)',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB'
    },
    # 6. Goat Anti Mouse Alexafluor-647 | Cat: A21235
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor 647 (Goat, Invitrogen A21235)',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB'
    },
    # 7. Goat Anti Mouse Alexafluor-488 | Cat: A11001
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor 488 (Goat, Invitrogen A11001)',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB'
    },
    # 8. Goat Anti-Rabbit alexafluor-647 | Cat: A32733 (Alexa Fluor Plus 647)
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor Plus 647 (Goat, Invitrogen A32733)',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB'
    },
    # 9. Goat Anti Mouse alexa-647 | Cat: A32728 (Alexa Fluor Plus 647)
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor Plus 647 (Goat, Invitrogen A32728)',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB'
    },
    # 10. Goat Anti-Rabbit Alexafluor 555 | Cat: A32732 (Alexa Fluor Plus 555)
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'conjugate': 'Alexa Fluor Plus 555 (Goat, Invitrogen A32732)',
        'conjugate_type': 'Fluorophore',
        'color': 'Red',
        'excitation_nm': 555,
        'emission_nm': 565,
        'applications': 'ICC, IHC, WB'
    },
    # 11. Streptavidin Alexafluor 488 conjugate | Cat: S32354
    {
        'anti_host': 'Biotin',
        'anti_isotype': 'Biotin',
        'conjugate': 'Alexa Fluor 488 (Streptavidin, Invitrogen S32354)',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB'
    }
]

ws_sec.append(sec_headers)
for item in secondaries_data:
    ws_sec.append([item[h] for h in sec_headers])

# 4. Direct Dyes (including Streptavidin-AF488, DAPI, Phalloidin, etc.)
dyes_headers = ['name', 'target_structure', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible']
dyes_data = [
    {'name': 'DAPI', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 360, 'emission_nm': 460, 'live_cell_compatible': 'Yes'},
    {'name': 'Hoechst 33342', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 350, 'emission_nm': 461, 'live_cell_compatible': 'Yes'},
    {'name': 'Phalloidin-AF488', 'target_structure': 'F-Actin', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 518, 'live_cell_compatible': 'No'},
    {'name': 'Phalloidin-AF594', 'target_structure': 'F-Actin', 'color': 'Red', 'excitation_nm': 590, 'emission_nm': 617, 'live_cell_compatible': 'No'},
    {'name': 'SiR-Actin', 'target_structure': 'F-Actin', 'color': 'Far-Red', 'excitation_nm': 652, 'emission_nm': 674, 'live_cell_compatible': 'Yes'},
    {'name': 'MitoTracker Red', 'target_structure': 'Mitochondria', 'color': 'Red', 'excitation_nm': 579, 'emission_nm': 599, 'live_cell_compatible': 'Yes'},
    {'name': 'WGA-AF488', 'target_structure': 'Membrane', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 519, 'live_cell_compatible': 'Yes'},
    {'name': 'Streptavidin-AF488 (S32354)', 'target_structure': 'Biotinylated Targets', 'color': 'Green', 'excitation_nm': 490, 'emission_nm': 525, 'live_cell_compatible': 'No'},
]
ws_dyes.append(dyes_headers)
for item in dyes_data:
    ws_dyes.append([item[h] for h in dyes_headers])

# 5. Reporters
rep_headers = ['reporter_name', 'color', 'excitation_nm', 'emission_nm', 'recommended_fixation']
rep_data = [
    {'reporter_name': 'EGFP', 'color': 'Green', 'excitation_nm': 488, 'emission_nm': 507, 'recommended_fixation': 'PFA'},
    {'reporter_name': 'mCherry', 'color': 'Red', 'excitation_nm': 587, 'emission_nm': 610, 'recommended_fixation': 'PFA'},
    {'reporter_name': 'mTagBFP2', 'color': 'Blue', 'excitation_nm': 399, 'emission_nm': 454, 'recommended_fixation': 'PFA'},
    {'reporter_name': 'iRFP670', 'color': 'Far-Red', 'excitation_nm': 643, 'emission_nm': 670, 'recommended_fixation': 'PFA'},
]
ws_rep.append(rep_headers)
for item in rep_data:
    ws_rep.append([item[h] for h in rep_headers])

# Style data sheets
for ws in [ws_prim, ws_sec, ws_dyes, ws_rep]:
    # Style header row
    for col_idx in range(1, ws.max_column + 1):
        c = ws.cell(row=1, column=col_idx)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal='center', vertical='center')
    
    # Style data rows
    for row_idx in range(2, ws.max_row + 1):
        for col_idx in range(1, ws.max_column + 1):
            c = ws.cell(row=row_idx, column=col_idx)
            c.font = data_font
            c.border = cell_border
            # center alignment for short columns
            if ws.cell(row=1, column=col_idx).value in ['host', 'isotype', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible', 'anti_host', 'conjugate_type', 'recommended_fixation']:
                c.alignment = Alignment(horizontal='center', vertical='center')
            else:
                c.alignment = Alignment(horizontal='left', vertical='center')
                
    # Auto-fit column widths
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val = str(cell.value or '')
            if len(val) > max_len:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

# Set Instructions column A width
ws_inst.column_dimensions['A'].width = 85

# Save files
paths = [
    r'C:\Users\Victor\Downloads\SpectraPanel_Database_Template.xlsx',
    r'C:\Users\Victor\Desktop\antibodies\SpectraPanel_Database_Populated.xlsx',
    r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\SpectraPanel_Database_Populated.xlsx'
]

for p in paths:
    os.makedirs(os.path.dirname(p), exist_ok=True)
    wb.save(p)
    print(f'Successfully saved: {p}')

# Also update data/secondary_antibodies.csv in IFGuidePy
csv_path = r'd:\01_VSI Academic\PhD Data\Coding\Python Coding\IFGuidePy\data\secondary_antibodies.csv'
csv_cols = ['id', 'anti_host', 'anti_isotype', 'conjugate', 'conjugate_type', 'excitation_nm', 'emission_nm', 'applications', 'catalog_no', 'supplier', 'notes']

cat_map = {
    'HRP (Donkey, Invitrogen A15999)': ('A15999', 'Invitrogen', 'Donkey anti-Goat HRP'),
    'Alexa Fluor 488 (Goat, Invitrogen A21042)': ('A21042', 'Invitrogen', 'Goat anti-Mouse IgM (µ chain)'),
    'Alexa Fluor 488 (Donkey, Invitrogen A21206)': ('A21206', 'Invitrogen', 'Donkey anti-Rabbit IgG (H+L)'),
    'Alexa Fluor 633 (Goat, Invitrogen A21103)': ('A21103', 'Invitrogen', 'Goat anti-Chicken IgY (H+L), Common 4 deg box'),
    'Alexa Fluor 647 (Goat, Invitrogen A21245)': ('A21245', 'Invitrogen', 'Goat anti-Rabbit IgG (H+L)'),
    'Alexa Fluor 647 (Goat, Invitrogen A21235)': ('A21235', 'Invitrogen', 'Goat anti-Mouse IgG (H+L)'),
    'Alexa Fluor 488 (Goat, Invitrogen A11001)': ('A11001', 'Invitrogen', 'Goat anti-Mouse IgG (H+L)'),
    'Alexa Fluor Plus 647 (Goat, Invitrogen A32733)': ('A32733', 'Invitrogen', 'Goat anti-Rabbit IgG (H+L) Plus 647'),
    'Alexa Fluor Plus 647 (Goat, Invitrogen A32728)': ('A32728', 'Invitrogen', 'Goat anti-Mouse IgG (H+L) Plus 647'),
    'Alexa Fluor Plus 555 (Goat, Invitrogen A32732)': ('A32732', 'Invitrogen', 'Goat anti-Rabbit IgG (H+L) Plus 555'),
    'Alexa Fluor 488 (Streptavidin, Invitrogen S32354)': ('S32354', 'Invitrogen', 'Streptavidin AF488 conjugate')
}

with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=csv_cols)
    writer.writeheader()
    for idx, s in enumerate(secondaries_data, 1):
        meta = cat_map.get(s['conjugate'], ('', 'Invitrogen', ''))
        row = {
            'id': f'sab_{idx:03d}',
            'anti_host': s['anti_host'],
            'anti_isotype': s['anti_isotype'],
            'conjugate': s['conjugate'],
            'conjugate_type': s['conjugate_type'],
            'excitation_nm': s['excitation_nm'],
            'emission_nm': s['emission_nm'],
            'applications': s['applications'],
            'catalog_no': meta[0],
            'supplier': meta[1],
            'notes': meta[2]
        }
        writer.writerow(row)
print(f'Successfully updated default CSV: {csv_path}')

print('All databases updated successfully with lab secondary inventory!')
