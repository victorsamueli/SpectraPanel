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
    ["SpectraPanel v1.0 — Laboratory Inventory Database Template"],
    [""],
    ["Instructions:"],
    ["1. Keep the column headers in row 1 unchanged across all sheets."],
    ["2. Enter your laboratory's antibody and reagent inventory into the respective sheets."],
    ["3. Detection channels for Secondaries and Reporters are computed dynamically in SpectraPanel based on emission wavelengths."],
    ["4. Save this workbook and click 'Upload Database' in SpectraPanel to import all sheets at once."],
    [""],
    ["Sheet Column Reference & Conventions:"],
    ["• Primaries Sheet:"],
    ["    - target: Target protein or marker (e.g., 'Pax7', 'alpha-Tubulin')"],
    ["    - clonality: 'Monoclonal', 'Polyclonal', or 'Recombinant Monoclonal'"],
    ["    - clone: Clone name or ID (e.g., 'DM1A', '5.8A', 'PAX7/497')"],
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
    ["    - color: Optical color group ('Green', 'Red', 'Far-Red')"],
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

# 2. Primaries (32 antibodies extracted from PDF datasheets)
prim_headers = [
    'target', 'clonality', 'clone', 'host', 'isotype', 'make', 'catalog',
    'applications', 'conjugated_color', 'fixation_compatible', 'live_cell_compatible', 'comments'
]

primaries_data = [
    # 1. 5081-MSM1-P0.pdf
    {
        'target': 'Pax7', 'clonality': 'Monoclonal', 'clone': 'PAX7/497', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'NeoBiotechnologies', 'catalog': '5081-MSM1-P0', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 2. 554130.pdf
    {
        'target': 'MyoD', 'clonality': 'Monoclonal', 'clone': '5.8A', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'BD Pharmingen', 'catalog': '554130', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 3. Antibody-MYOD.pdf
    {
        'target': 'MyoD', 'clonality': 'Recombinant Monoclonal', 'clone': 'HL1372', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Invitrogen', 'catalog': 'MA5-47019', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Recombinant rabbit monoclonal'
    },
    # 4. Antibody-alpha Actinin 2.pdf
    {
        'target': 'alpha-Actinin 2', 'clonality': 'Recombinant Monoclonal', 'clone': '7H1L69', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Invitrogen', 'catalog': '701914', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Recombinant rabbit monoclonal'
    },
    # 5. DSHB-9D10.pdf
    {
        'target': 'Titin', 'clonality': 'Monoclonal', 'clone': '9D10', 'host': 'Mouse', 'isotype': 'IgM',
        'make': 'DSHB', 'catalog': '9D10', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Hybridoma bank clone'
    },
    # 6. DSHB-CAPZA1.pdf
    {
        'target': 'CAPZA1', 'clonality': 'Monoclonal', 'clone': 'mAb 5B12.3', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'DSHB', 'catalog': 'mAb 5B12.3', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'Methanol', 'live_cell_compatible': 'No', 'comments': 'Hybridoma bank clone'
    },
    # 7. DSHB-CAPZB.pdf
    {
        'target': 'CAPZB', 'clonality': 'Monoclonal', 'clone': 'mAb 3F2.3', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'DSHB', 'catalog': 'mAb 3F2.3', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'Methanol', 'live_cell_compatible': 'No', 'comments': 'Hybridoma bank clone'
    },
    # 8. DSHB-JLT12.pdf
    {
        'target': 'Troponin T', 'clonality': 'Monoclonal', 'clone': 'JLT12', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'DSHB', 'catalog': 'JLT12', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Hybridoma bank clone'
    },
    # 9. DSHB-MF20.pdf
    {
        'target': 'Myosin Heavy Chain', 'clonality': 'Monoclonal', 'clone': 'MF 20', 'host': 'Mouse', 'isotype': 'IgG2b',
        'make': 'DSHB', 'catalog': 'MF 20', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Pan-sarcomeric MHC'
    },
    # 10. DSHB-PAX7.pdf
    {
        'target': 'Pax7', 'clonality': 'Monoclonal', 'clone': 'PAX7', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'DSHB', 'catalog': 'PAX7', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Hybridoma bank clone'
    },
    # 11. DSHB-TI4.pdf
    {
        'target': 'Troponin I', 'clonality': 'Monoclonal', 'clone': 'TI-4', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'DSHB', 'catalog': 'TI-4', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Cardiac & skeletal Troponin I'
    },
    # 12. DSHB-mMaC.pdf
    {
        'target': 'Myomesin', 'clonality': 'Monoclonal', 'clone': 'mMaC myomesin B4', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'DSHB', 'catalog': 'mMaC myomesin B4', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'M-band marker'
    },
    # 13. GAPDH (GA1R)_mice mIgG1_Invitrogen_Datasheet.pdf
    {
        'target': 'GAPDH', 'clonality': 'Monoclonal', 'clone': 'GA1R', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Invitrogen', 'catalog': 'MA5-15738', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 14. LMOD3_Rabbit-pAb_ProteinTech_14948-1-AP.pdf
    {
        'target': 'LMOD3', 'clonality': 'Polyclonal', 'clone': 'Polyclonal', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Proteintech', 'catalog': '14948-1-AP', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 15. Lamin AC mice mAB (SantaCruz)_DataSheet.pdf
    {
        'target': 'Lamin A/C', 'clonality': 'Monoclonal', 'clone': '636', 'host': 'Mouse', 'isotype': 'IgG2b',
        'make': 'Santa Cruz', 'catalog': 'sc-7292', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Nuclear envelope marker'
    },
    # 16. Nexilin mice mAB (Sigma)_DataSheet.pdf
    {
        'target': 'Nexilin', 'clonality': 'Monoclonal', 'clone': 'NX-38', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'Sigma-Aldrich', 'catalog': 'SAB4200124', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 17. Pan-Actin (D18C11) Rabbit mAB (CST)_DataSheet.pdf
    {
        'target': 'Pan-Actin', 'clonality': 'Monoclonal', 'clone': 'D18C11', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Cell Signaling Technology', 'catalog': '8456', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Rabbit monoclonal'
    },
    # 18. Pax7 (NeoBiotechnologies)_DataSheet.pdf
    {
        'target': 'Pax7', 'clonality': 'Monoclonal', 'clone': 'PAX7/497', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'NeoBiotechnologies', 'catalog': '5081-MSM1', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 19. Sarc-aActinin mice mAB (Sigma)_DataSheet.pdf
    {
        'target': 'Sarcomeric alpha-Actinin', 'clonality': 'Monoclonal', 'clone': 'EA-53', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Sigma-Aldrich', 'catalog': 'A7811', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Z-line marker'
    },
    # 20. Telethonin(G-11)_mAb_SantaCruz_sc-25327.pdf
    {
        'target': 'Telethonin', 'clonality': 'Monoclonal', 'clone': 'G-11', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Santa Cruz', 'catalog': 'sc-25327', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 21. Ubiquitin (P4D1)_Mice mAB_EnzoLifeSciences_BML-PW0930-0100.pdf
    {
        'target': 'Ubiquitin', 'clonality': 'Monoclonal', 'clone': 'P4D1', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Enzo Life Sciences', 'catalog': 'BML-PW0930-0100', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 22. Vimentin mice mAB (Invitrogen)_DataSheet.pdf
    {
        'target': 'Vimentin', 'clonality': 'Monoclonal', 'clone': 'VI-10', 'host': 'Mouse', 'isotype': 'IgM',
        'make': 'Invitrogen', 'catalog': 'MA1-10459', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 23. a-Tubulin mice mAB (Sigma)_DataSheet.pdf
    {
        'target': 'alpha-Tubulin', 'clonality': 'Monoclonal', 'clone': 'DM1A', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Sigma-Aldrich', 'catalog': 'T9026', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 24. a-Tubulin mice mAB - DM1a (Invitrogen)_DataSheet.pdf
    {
        'target': 'alpha-Tubulin', 'clonality': 'Monoclonal', 'clone': 'DM1A', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Invitrogen', 'catalog': '62204', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 25. aActinin-1 Rabbit mAB (CST)_DataSheet.pdf
    {
        'target': 'alpha-Actinin 1', 'clonality': 'Monoclonal', 'clone': 'D13E12', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Cell Signaling Technology', 'catalog': '6487', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Rabbit monoclonal'
    },
    # 26. alphaActin (5C5)_mIgMk_SantaCruz_sc-58670.pdf
    {
        'target': 'alpha-Actin', 'clonality': 'Monoclonal', 'clone': '5C5', 'host': 'Mouse', 'isotype': 'IgM',
        'make': 'Santa Cruz', 'catalog': 'sc-58670', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 27. betaActin (15G5A11-E2)_mIgG1_Invitrogen_MA1-140.pdf
    {
        'target': 'beta-Actin', 'clonality': 'Monoclonal', 'clone': '15G5A11/E2', 'host': 'Mouse', 'isotype': 'IgG1',
        'make': 'Invitrogen', 'catalog': 'MA1-140', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 28. betaActin (AC74)_mIgG2a_Sigma_A2228.pdf
    {
        'target': 'beta-Actin', 'clonality': 'Monoclonal', 'clone': 'AC-74', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'Sigma-Aldrich', 'catalog': 'A2228', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 29. betaActin (arg)_rPoly_Sigma_ABT264.pdf
    {
        'target': 'beta-Actin (Arginylated)', 'clonality': 'Polyclonal', 'clone': 'Polyclonal', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Sigma-Aldrich', 'catalog': 'ABT264', 'applications': 'ICC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': 'Arginylated beta-Actin'
    },
    # 30. gammaActin (2A3)_mIgG2b_Abcam_ab123034.pdf
    {
        'target': 'gamma-Actin', 'clonality': 'Monoclonal', 'clone': '2A3', 'host': 'Mouse', 'isotype': 'IgG2b',
        'make': 'Abcam', 'catalog': 'ab123034', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
    # 31. panActin (D18C11)_rIgG1_CST_8456.pdf
    {
        'target': 'Pan-Actin', 'clonality': 'Monoclonal', 'clone': 'D18C11', 'host': 'Rabbit', 'isotype': 'IgG',
        'make': 'Cell Signaling Technology', 'catalog': '8456', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA', 'live_cell_compatible': 'No', 'comments': 'Rabbit monoclonal'
    },
    # 32. sm-alphaActin (1A4)_mIgG2a_Sigma_A2547.pdf
    {
        'target': 'Smooth Muscle alpha-Actin', 'clonality': 'Monoclonal', 'clone': '1A4', 'host': 'Mouse', 'isotype': 'IgG2a',
        'make': 'Sigma-Aldrich', 'catalog': 'A2547', 'applications': 'ICC, IHC, WB',
        'conjugated_color': '', 'fixation_compatible': 'PFA, Methanol', 'live_cell_compatible': 'No', 'comments': ''
    },
]

ws_prim.append(prim_headers)
for item in primaries_data:
    ws_prim.append([item[h] for h in prim_headers])

# 3. Secondaries (User Lab Inventory from Screenshot)
sec_headers = [
    'anti_host', 'anti_isotype', 'host', 'conjugate', 'conjugate_type',
    'color', 'excitation_nm', 'emission_nm', 'applications', 'make', 'catalogue', 'comments'
]

secondaries_data = [
    # 1. Donkey Anti-Goat IgG HRP Conjugate | Cat: A15999
    {
        'anti_host': 'Goat',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Donkey',
        'conjugate': 'HRP',
        'conjugate_type': 'HRP',
        'color': '',
        'excitation_nm': '',
        'emission_nm': '',
        'applications': 'WB',
        'make': 'Invitrogen',
        'catalogue': 'A15999',
        'comments': 'Donkey anti-Goat HRP'
    },
    # 2. Goat Anti Mouse Alexafluor-488 IgM (µ chain) | Cat: A21042
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgM',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor 488',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A21042',
        'comments': 'Goat anti-Mouse IgM (µ chain)'
    },
    # 3. Donkey Anti Rabbit alexafluor-488 | Cat: A21206
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Donkey',
        'conjugate': 'Alexa Fluor 488',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A21206',
        'comments': 'Received Jan 2020'
    },
    # 4. Anti Chicken alexa-633 IgY (H+L) Goat Ab | Cat: A21103
    {
        'anti_host': 'Chicken',
        'anti_isotype': 'IgY (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor 633',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 632,
        'emission_nm': 647,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A21103',
        'comments': 'Common 4 deg box'
    },
    # 5. Goat Anti-Rabbit alexafluor-647 | Cat: A21245
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor 647',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A21245',
        'comments': 'Goat anti-Rabbit IgG (H+L)'
    },
    # 6. Goat Anti Mouse Alexafluor-647 | Cat: A21235
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor 647',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A21235',
        'comments': 'Goat anti-Mouse IgG (H+L)'
    },
    # 7. Goat Anti Mouse Alexafluor-488 | Cat: A11001
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor 488',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A11001',
        'comments': 'Goat anti-Mouse IgG (H+L)'
    },
    # 8. Goat Anti-Rabbit alexafluor-647 | Cat: A32733 (Alexa Fluor Plus 647)
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 647',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A32733',
        'comments': 'Alexa Fluor Plus 647'
    },
    # 9. Goat Anti Mouse alexa-647 | Cat: A32728 (Alexa Fluor Plus 647)
    {
        'anti_host': 'Mouse',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 647',
        'conjugate_type': 'Fluorophore',
        'color': 'Far-Red',
        'excitation_nm': 650,
        'emission_nm': 665,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A32728',
        'comments': 'Alexa Fluor Plus 647'
    },
    # 10. Goat Anti-Rabbit Alexafluor 555 | Cat: A32732 (Alexa Fluor Plus 555)
    {
        'anti_host': 'Rabbit',
        'anti_isotype': 'IgG (H+L)',
        'host': 'Goat',
        'conjugate': 'Alexa Fluor Plus 555',
        'conjugate_type': 'Fluorophore',
        'color': 'Red',
        'excitation_nm': 555,
        'emission_nm': 565,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'A32732',
        'comments': 'Alexa Fluor Plus 555'
    },
    # 11. Streptavidin Alexafluor 488 conjugate | Cat: S32354
    {
        'anti_host': 'Biotin',
        'anti_isotype': 'Biotin',
        'host': 'Streptavidin',
        'conjugate': 'Alexa Fluor 488',
        'conjugate_type': 'Fluorophore',
        'color': 'Green',
        'excitation_nm': 490,
        'emission_nm': 525,
        'applications': 'ICC, IHC, WB',
        'make': 'Invitrogen',
        'catalogue': 'S32354',
        'comments': 'Streptavidin AF488 conjugate'
    }
]

ws_sec.append(sec_headers)
for item in secondaries_data:
    ws_sec.append([item[h] for h in sec_headers])

# 4. Direct Dyes (including make and catalogue)
dyes_headers = [
    'name', 'target_structure', 'color', 'excitation_nm', 'emission_nm',
    'live_cell_compatible', 'make', 'catalogue'
]

dyes_data = [
    {'name': 'DAPI', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 360, 'emission_nm': 460, 'live_cell_compatible': 'Yes', 'make': 'Invitrogen', 'catalogue': 'D1306'},
    {'name': 'Hoechst 33342', 'target_structure': 'DNA', 'color': 'Blue', 'excitation_nm': 350, 'emission_nm': 461, 'live_cell_compatible': 'Yes', 'make': 'Invitrogen', 'catalogue': 'H1399'},
    {'name': 'Phalloidin-AF488', 'target_structure': 'F-Actin', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 518, 'live_cell_compatible': 'No', 'make': 'Invitrogen', 'catalogue': 'A12379'},
    {'name': 'Phalloidin-AF594', 'target_structure': 'F-Actin', 'color': 'Red', 'excitation_nm': 590, 'emission_nm': 617, 'live_cell_compatible': 'No', 'make': 'Invitrogen', 'catalogue': 'A12381'},
    {'name': 'SiR-Actin', 'target_structure': 'F-Actin', 'color': 'Far-Red', 'excitation_nm': 652, 'emission_nm': 674, 'live_cell_compatible': 'Yes', 'make': 'Spirochrome', 'catalogue': 'CY-SC001'},
    {'name': 'MitoTracker Red', 'target_structure': 'Mitochondria', 'color': 'Red', 'excitation_nm': 579, 'emission_nm': 599, 'live_cell_compatible': 'Yes', 'make': 'Invitrogen', 'catalogue': 'M7512'},
    {'name': 'WGA-AF488', 'target_structure': 'Membrane', 'color': 'Green', 'excitation_nm': 495, 'emission_nm': 519, 'live_cell_compatible': 'Yes', 'make': 'Invitrogen', 'catalogue': 'W11261'},
    {'name': 'Streptavidin-AF488', 'target_structure': 'Biotinylated Targets', 'color': 'Green', 'excitation_nm': 490, 'emission_nm': 525, 'live_cell_compatible': 'No', 'make': 'Invitrogen', 'catalogue': 'S32354'},
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
            header_val = ws.cell(row=1, column=col_idx).value
            # center alignment for short columns
            if header_val in ['host', 'isotype', 'color', 'excitation_nm', 'emission_nm', 'live_cell_compatible', 'anti_host', 'conjugate_type', 'recommended_fixation', 'clonality']:
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
ws_inst.column_dimensions['A'].width = 95

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

# Update data/primary_antibodies.csv in IFGuidePy
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
print(f'Successfully updated: {prim_csv_path}')

# Update data/secondary_antibodies.csv in IFGuidePy
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
print(f'Successfully updated: {sec_csv_path}')

# Update data/direct_dyes.csv in IFGuidePy
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
print(f'Successfully updated: {dyes_csv_path}')

print('All Excel workbooks and project CSVs updated successfully!')
