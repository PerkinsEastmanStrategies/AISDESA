"""Apply AISD_Matrix_RoomsRequired.xlsx required flags and survey minimums to AISD_ESA_Categories.csv."""
from __future__ import annotations

import csv
from pathlib import Path

import openpyxl

ROOT = Path(r"C:\dev\AISD-ESA")
CSV_PATH = ROOT / "AISD_ESA_Categories.csv"
PUBLIC = ROOT / "public" / "AISD_ESA_Categories.csv"
XLSX = Path(r"c:\Users\p.davis\Downloads\AISD_Matrix_RoomsRequired.xlsx")

ALIASES = {
    "main entry/reception/main admin suite": ["entry experience", "main admin suite"],
    "community partners suite": ["community partners suite", "community partner suite"],
    "admin offices": ["admin offices", "admin office"],
    "professional learning center": ["professional learning center"],
    "mental wellness and counseling suite": ["mental wellness and counseling suite", "counseling suite"],
    "early childhood studio": ["early childhood studio"],
    "early childhood special education studio": ["early childhood special education studio"],
    "tranditional studio": ["tranditional studio", "traditional studio"],
    "sped flex studio": ["sped flex studio"],
    "special education suite": ["special education suite"],
    "sensory motor lab": ["sensory motor lab", "sensory lab"],
    "life skills studio": ["life skills studio", "life skills room"],
    "art": ["art"],
    "music studio": ["music studio", "music"],
    "music": ["music studio", "music"],
    "maker space": ["maker space"],
    "science": ["science"],
    "science prep room": ["science prep room"],
    "open collaboration": ["open collaboration", "open collaboration space"],
    "small group room": ["group room", "small group room"],
    "large group room": ["large group room"],
    "neighborhood": ["neighborhood"],
    "gym": ["es gymnasium", "gym"],
    "library media center": ["library media center"],
    "food service": ["dining commons", "food service"],
    "empower center": ["empower center"],
    "outdoor spaces": ["outdoor spaces"],
    "outdoor athletics": ["outdoor athletics"],
    "vocational lab": ["vocational lab"],
    "2d art studio": ["2d art studio"],
    "3d art studio": ["3d art studio"],
    "digital art studio": ["digital art studio"],
    "cte": ["cte studio", "cte"],
    "theater arts studio": ["theater arts studio"],
    "rehersal hall": ["rehersal hall", "rehearsal hall"],
    "music suite": ["music suite"],
    "black box": ["black box"],
    "auditorium": ["auditorium"],
    "dance": ["dance"],
    "theater arts suite": ["theater arts suite"],
    "multi-purpose gym": ["multi-purpose gym", "multipurpose gym"],
    "practice gym": ["practice gym"],
    "competition gym": ["competition gym"],
    "locker room": ["locker room"],
    "weight room": ["weight room"],
    "wrestling": ["wrestling"],
    "pe fitness room": ["pe fitness room"],
    "athletics wing": ["athletics wing"],
}


def norm(value: object) -> str:
    return " ".join(str(value).strip().lower().split())


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb.active
    excel: dict[tuple[str, str], tuple[bool, int]] = {}
    for row in ws.iter_rows(min_row=3, values_only=True):
        space, level, req, mins = row[1], row[2], row[3], row[4]
        if not space or not level:
            continue
        excel[(norm(space), str(level).strip().upper())] = (
            str(req).strip().upper() == "Y",
            int(mins or 0),
        )

    updates: dict[tuple[str, str], tuple[bool, int]] = {}
    for (espace, level), meta in excel.items():
        for key in ALIASES.get(espace, [espace]):
            updates[(key, level)] = meta

    with CSV_PATH.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    out_rows: list[list[str]] = []
    for row in rows[1:]:
        if len(row) < 8:
            continue
        focus, space, level, req, scoring, weight, focus_weight, code = row[:8]
        level = level.strip()
        key = (norm(space), level)
        if key in updates:
            required, mins = updates[key]
            new_req = "Y" if required else "N"
            new_min = 0 if not required else mins
        else:
            new_req = req.strip().upper()
            new_min = 1 if new_req == "Y" else 0
        out_rows.append(
            [focus, space, level, new_req, str(new_min), scoring, weight, focus_weight, code]
        )

    have = {(norm(row[1]), row[2]) for row in out_rows}
    extras = [
        ["Neighborhoods", "Large Group Room", "MS", "N", "0", "Neighborhoods", "3", "9", "LG"],
        ["Neighborhoods", "Large Group Room", "HS", "Y", "8", "Neighborhoods", "9", "9", "LG"],
        ["Special Education", "Life Skills Studio", "MS", "Y", "1", "Special education", "12", "12", "LS"],
        ["Special Education", "Life Skills Studio", "HS", "Y", "1", "Special education", "12", "12", "LS"],
    ]
    for extra in extras:
        key = (norm(extra[1]), extra[2])
        if key in have:
            continue
        if key in updates:
            required, mins = updates[key]
            extra[3] = "Y" if required else "N"
            extra[4] = "0" if not required else str(mins)
        out_rows.append(extra)
        have.add(key)
        print("ADDED", extra[1], extra[2], extra[3], extra[4])

    header = [
        "Focus Area",
        "Space Type",
        "School Level",
        "Required",
        "Minimum Surveys",
        "Focus Area (Scoring)",
        "Space Type Weight",
        "Focus Area Weight",
        "Score Code",
    ]
    for path in (CSV_PATH, PUBLIC):
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(header)
            writer.writerows(out_rows)

    print("wrote", len(out_rows), "rows")
    totals: dict[str, dict[str, int]] = {
        "ES": {"types": 0, "surveys": 0, "optional": 0},
        "MS": {"types": 0, "surveys": 0, "optional": 0},
        "HS": {"types": 0, "surveys": 0, "optional": 0},
    }
    for row in out_rows:
        level = row[2]
        if level not in totals:
            continue
        if row[3] == "Y":
            totals[level]["types"] += 1
            totals[level]["surveys"] += int(row[4])
        else:
            totals[level]["optional"] += 1
    for level in ("ES", "MS", "HS"):
        t = totals[level]
        print(
            f"{level}: {t['types']} required space types, "
            f"{t['surveys']} required room surveys, {t['optional']} optional (not scored)"
        )


if __name__ == "__main__":
    main()
