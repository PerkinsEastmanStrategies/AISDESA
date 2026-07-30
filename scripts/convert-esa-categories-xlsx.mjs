#!/usr/bin/env node
/**
 * Convert ESA_SPACE_TYPECATEGORIES.xlsx → AISD_ESA_Categories.csv
 * Usage: node scripts/convert-esa-categories-xlsx.mjs [path-to-xlsx]
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const xlsxPath =
  process.argv[2] ||
  path.join(process.env.USERPROFILE ?? "", "Downloads", "ESA_SPACE_TYPECATEGORIES.xlsx")
const outPath = path.join(root, "AISD_ESA_Categories.csv")
const csvDir = path.join(
  process.env.USERPROFILE ?? "",
  "Downloads",
  "AISD_ESA_FinalDraft0729_CSV_Package",
)

const script = `
import openpyxl, csv, os, sys
xlsx_path = sys.argv[1]
out_path = sys.argv[2]
csv_dir = sys.argv[3]

RAW_TO_ID = {
    'Main Entry/Reception': 'SPT-MAIN-ENTRY-RECEPTION',
    'Main Admin Suite': 'SPT-MAIN-ADMIN-SUITE',
    'Community Partners Suite': 'SPT-COMMUNITY-PARTNERS-SUITE',
    'Admin Offices': 'SPT-ADMIN-OFFICES',
    'Professional Learning Center': 'SPT-PROFESSIONAL-LEARNING-CENTER',
    'Mental Wellness and Counseling Suite': 'SPT-MENTAL-WELLNESS-AND-COUNSELING-SUI',
    'Early childhood studio': 'SPT-EARLY-CHILDHOOD-STUDIO',
    'Early childhood special education studio': 'SPT-EARLY-CHILDHOOD-SPECIAL-EDUCATION-',
    'Tranditional Studio': 'SPT-TRADITIONAL-STUDIO',
    'Sped Flex Studio': 'SPT-SPED-FLEX-STUDIO',
    'SPED Flex Studio': 'SPT-SPED-FLEX-STUDIO',
    'Sensory Lab': 'SPT-SENSORY-MOTOR-LAB',
    'Sensory Motor Lab': 'SPT-SENSORY-MOTOR-LAB',
    'Life Skills Room': 'SPT-LIFE-SKILLS-STUDIO',
    'Life Skills Studio': 'SPT-LIFE-SKILLS-STUDIO',
    'Art': 'SPT-ART-STUDIO',
    '2D Art Studio': 'SPT-2D-ART-STUDIO',
    '3D Art Studio': 'SPT-3D-ART-STUDIO',
    'Art Studio': 'SPT-ART-STUDIO',
    'Digital Art Studio': 'SPT-DIGITAL-ARTS-STUDIO',
    'Maker Space': 'SPT-MAKER-SPACE',
    'Science': 'SPT-SCIENCE',
    'Science Prep Room': 'SPT-SCIENCE-PREP-ROOM',
    'Vocational Lab': 'SPT-VOCATIONAL-LAB',
    'Special Education Suite': 'SPT-SPECIAL-EDUCATION-SUITE',
    'Outdoor Spaces': 'SPT-OUTDOOR-SPACES',
    'Outdoor Athletics': 'SPT-OUTDOOR-ATHLETICS',
    'Media Center': 'SPT-LIBRARY-MEDIA-CENTER',
    'Library Media Center': 'SPT-LIBRARY-MEDIA-CENTER',
    'Multi-Purpose Gym': 'SPT-MULTIPURPOSE-GYM',
    'Gym': 'SPT-MULTIPURPOSE-GYM',
    'Practice Gym': 'SPT-PRACTICE-GYM',
    'Competition Gym': 'SPT-COMPETITION-GYM',
    'Locker Room': 'SPT-LOCKER-ROOMS',
    'Weight Room': 'SPT-WEIGHT-ROOM',
    'Wrestling': 'SPT-WRESTLING',
    'PE Fitness Room': 'SPT-PE-FITNESS-ROOM',
    'Athletics Wing': 'SPT-ATHLETICS-WING',
    'Theater Arts Studio': 'SPT-THEATER-ARTS-STUDIO',
    'Theater Arts Suite': 'SPT-THEATER-ARTS-SUITE',
    'Theater Arts': 'SPT-THEATER-ARTS-STUDIO',
    'Black Box': 'SPT-BLACK-BOX',
    'Auditorium': 'SPT-AUDITORIUM',
    'Dance': 'SPT-DANCE',
}

def focus_weight(label):
    return {'Arrival/Administration':6,'Studios':12,'Special Education':12,'Special education':12,'Neighborhoods':9,'Shared Spaces':9,'Outdoor Elements':9,'Athletics and Wellness':9,'CTE':9,'Performing Arts':9}.get(label,9)

q_counts = {}
q_path = os.path.join(csv_dir, '05_Questions.csv')
if os.path.isfile(q_path):
    with open(q_path, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            if row.get('IsActive','').lower()=='true':
                q_counts[row['SpaceTypeID']] = q_counts.get(row['SpaceTypeID'],0)+1

wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
ws = wb.active
rows_out = []
for r in list(ws.iter_rows(min_row=2, values_only=True)):
    focus, space_raw, level, req, min_surveys, scoring_focus, score_code = r
    if level not in ('ES','MS','HS'): continue
    space_raw = str(space_raw).strip()
    scoring_focus = str(scoring_focus).strip()
    focus = str(focus).strip()
    sw = 12 if str(req).upper()=='Y' else 3
    fw = focus_weight(scoring_focus)
    if focus == 'Neighborhoods':
        qstatus = 'placeholder'
    else:
        sid = RAW_TO_ID.get(space_raw)
        qc = q_counts.get(sid, 0) if sid else 0
        qstatus = 'ready' if qc > 0 else 'pending'
    rows_out.append([focus, space_raw, level, req, scoring_focus, sw, fw, score_code, qstatus])

with open(out_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['Focus Area','Space Type','School Level','Required','Focus Area (Scoring)','Space Type Weight','Focus Area Weight','Score Code','Question Set Status'])
    w.writerows(rows_out)
print(f'Wrote {len(rows_out)} rows to {out_path}')
`

if (!fs.existsSync(xlsxPath)) {
  console.error(`Missing xlsx: ${xlsxPath}`)
  process.exit(1)
}

execSync(`python -c ${JSON.stringify(script)} ${JSON.stringify([xlsxPath, outPath, csvDir])}`, {
  stdio: "inherit",
})
