"""Generate space-type-assessment-guidance.ts from the Excel source."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Downloads" / "Scoring Tool Space Type Instructions.xlsx"
OUT = ROOT / "packages" / "shared" / "src" / "data" / "space-type-assessment-guidance.ts"


def main() -> None:
    xlsx = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb["Sheet1"]
    rows: list[dict[str, str]] = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        st, level, note = r
        if not st:
            continue
        rows.append(
            {
                "spaceType": str(st).strip(),
                "schoolLevel": str(level or "ALL").strip(),
                "note": str(note or "").replace("\r\n", "\n").replace("\r", "\n"),
            }
        )

    lines = [
        'import type { TableSchoolLevel } from "./table-of-surveys"',
        'import { schoolLevelFromSchoolClass, TABLE_OF_SURVEY_ENTRIES } from "./table-of-surveys"',
        "",
        "export interface SpaceTypeAssessmentGuidanceEntry {",
        "  spaceType: string",
        '  /** ES, MS, HS, ALL, or combined like "MS, HS" */',
        "  schoolLevel: string",
        "  note: string",
        "}",
        "",
        "/** From Scoring Tool Space Type Instructions.xlsx */",
        "export const SPACE_TYPE_ASSESSMENT_GUIDANCE: SpaceTypeAssessmentGuidanceEntry[] = "
        + json.dumps(rows, indent=2, ensure_ascii=False)
        + ";",
        "",
    ]
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(rows)} entries to {OUT}")


if __name__ == "__main__":
    main()
