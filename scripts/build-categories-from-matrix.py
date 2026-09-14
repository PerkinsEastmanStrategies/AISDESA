"""Build AISD_ESA_Categories.csv from AISD_Matrix.xlsx, carrying weights from the old table."""
from __future__ import annotations

import csv
from pathlib import Path

import openpyxl

ROOT = Path(r"C:\dev\AISD-ESA")
MATRIX = Path(r"c:\Users\p.davis\Downloads\AISD_Matrix.xlsx")
OLD_CSV = ROOT / "AISD_ESA_Categories.csv"
OUT_CSV = ROOT / "AISD_ESA_Categories.csv"
PUBLIC_CSV = ROOT / "public" / "AISD_ESA_Categories.csv"

FOCUS_AREA_WEIGHT = {
    "Arrival Experience and Campus Organization": 6,
    "Administration": 6,
    "Studios": 12,
    "Special Education": 12,
    "Special education": 12,
    "Neighborhoods": 9,
    "Athletics and Wellness": 9,
    "Shared Spaces": 9,
    "Outdoor": 9,
    "Outdoor Elements": 9,
    "CTE": 9,
    "Performing Arts": 9,
    "Visual Arts": 9,
}

SPACE_ALIASES = {
    "entry experience": "entry experience",
    "main entry/reception": "entry experience",
    "main office": "entry experience",
    "admin offices": "admin offices",
    "admin office": "admin offices",
    "community partners suite": "community partners suite",
    "community partner suite": "community partners suite",
    "mental wellness and counseling suite": "mental wellness and counseling suite",
    "counseling suite": "mental wellness and counseling suite",
    "tranditional studio": "tranditional studio",
    "traditional studio": "tranditional studio",
    "sped flex studio": "sped flex studio",
    "sped flex": "sped flex studio",
    "sensory motor lab": "sensory motor lab",
    "sensory lab": "sensory motor lab",
    "life skills studio": "life skills studio",
    "life skills room": "life skills studio",
    "music studio": "music studio",
    "music": "music studio",
    "maker space": "maker space",
    "open collaboration": "open collaboration",
    "open collaboration space": "open collaboration",
    "group room": "group room",
    "small group room": "group room",
    "es gymnasium": "es gymnasium",
    "gym": "es gymnasium",
    "early childhood special education studio": "early childhood special education studio",
}

DEFAULT_WEIGHTS = {
    "entry experience": (True, 12, "EE"),
    "campus": (True, 12, "CA"),
    "special education suite": (True, 12, "SU"),
    "sensory motor lab": (True, 9, "SN"),
    "life skills studio": (True, 12, "LS"),
    "music studio": (True, 12, "MU"),
    "music suite": (True, 3, "MT"),
    "early childhood neighborhood": (True, 12, "EN"),
    "es gymnasium": (True, 12, "GY"),
    "science prep room": (True, 6, "PR"),
    "2d art studio": (True, 12, "A2"),
    "3d art studio": (True, 12, "A3"),
    "digital art studio": (True, 12, "DI"),
}

OLD_DEFAULT_BY_KEY: dict[tuple[str, str], tuple[bool, int, str]] = {}


def norm_space(name: str) -> str:
    key = " ".join(name.strip().lower().split())
    return SPACE_ALIASES.get(key, key)


def load_old() -> None:
    with OLD_CSV.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) < 8:
                continue
            level = row[2].strip()
            if level not in {"ES", "MS", "HS"}:
                continue
            space = norm_space(row[1])
            required = row[3].strip().upper() == "Y"
            weight = int(row[5]) if row[5].strip().isdigit() else 0
            code = row[7].strip()
            OLD_DEFAULT_BY_KEY[(space, level)] = (required, weight, code)


def meta_for(space: str, level: str) -> tuple[bool, int, str]:
    key = norm_space(space)
    if (key, level) in OLD_DEFAULT_BY_KEY:
        return OLD_DEFAULT_BY_KEY[(key, level)]
    return DEFAULT_WEIGHTS.get(key, (True, 12, ""))


def main() -> None:
    load_old()
    wb = openpyxl.load_workbook(MATRIX, data_only=True)
    ws = wb.active
    rows: list[list[str]] = []
    for raw in ws.iter_rows(min_row=2, values_only=True):
        if not any(raw):
            continue
        survey = str(raw[0] or "").strip()
        scoring = str(raw[1] or "").strip()
        space = str(raw[2] or "").strip()
        level = str(raw[3] or "").strip()
        required, weight, code = meta_for(space, level)
        if not code:
            code = "".join(part[0] for part in space.split()[:2]).upper()
        focus_weight = FOCUS_AREA_WEIGHT.get(scoring, 9)
        rows.append(
            [
                survey,
                space,
                level,
                "Y" if required else "N",
                scoring,
                str(weight),
                str(focus_weight),
                code,
            ]
        )

    header = [
        "Focus Area",
        "Space Type",
        "School Level",
        "Required",
        "Focus Area (Scoring)",
        "Space Type Weight",
        "Focus Area Weight",
        "Score Code",
    ]
    text_rows = [header, *rows]
    for path in (OUT_CSV, PUBLIC_CSV):
        with path.open("w", encoding="utf-8", newline="") as f:
            csv.writer(f).writerows(text_rows)
    print(f"Wrote {len(rows)} rows to {OUT_CSV}")


if __name__ == "__main__":
    main()
