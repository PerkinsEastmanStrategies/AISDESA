#!/usr/bin/env python3
"""Strip CAFM floor plans — keep room geometry, hatch colors, and building outline."""

from __future__ import annotations

import copy
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Layers that define selectable rooms — fills removed (outlines only).
STRIP_FILL_LAYER_IDS = ("CAFM_SPACE", "CAFM_ID")

# Building footprint outline(s) — stroke preserved, no fill.
OUTLINE_LAYER_IDS = ("CAFM_BLDG_OTLN", "CAFM_BLDG-OTLN")

# CAD exterior/interior wall linework (cyan in source exports).
WALL_LAYER_IDS = ("A-WALLS", "A-WALL")

HATCH_LAYER_PREFIX = "DEF_HATCH_"

SVG_NS = "http://www.w3.org/2000/svg"


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def find_by_id(root: ET.Element, element_id: str) -> ET.Element | None:
    for el in root.iter():
        if el.attrib.get("id") == element_id:
            return el
    return None


def find_hatch_layers(root: ET.Element) -> list[ET.Element]:
    layers: list[ET.Element] = []
    for el in root:
        if local(el.tag) != "g":
            continue
        layer_id = el.attrib.get("id", "")
        if layer_id.startswith(HATCH_LAYER_PREFIX):
            layers.append(el)
    return layers


def clean_serif_ids(el: ET.Element) -> None:
    for node in el.iter():
        node.attrib.pop("serif:id", None)


def strip_room_layer(el: ET.Element) -> None:
    """CAFM room boundaries + labels — no fills."""
    for node in el.iter():
        node.attrib.pop("serif:id", None)
        style = node.attrib.get("style")
        if style:
            cleaned = re.sub(r"fill\s*:\s*[^;]+;?", "fill:none;", style, flags=re.I)
            cleaned = re.sub(r"fill-opacity\s*:\s*[^;]+;?", "", cleaned, flags=re.I)
            cleaned = cleaned.strip().strip(";")
            if cleaned:
                node.attrib["style"] = cleaned
            else:
                node.attrib.pop("style", None)

        name = local(node.tag)
        if name in {"path", "rect", "polygon", "polyline", "line", "circle", "ellipse"}:
            if "fill" not in node.attrib and "fill:" not in (node.attrib.get("style") or ""):
                node.attrib.setdefault("fill", "none")
        elif name in {"text", "tspan"}:
            if "fill" not in node.attrib:
                node.attrib["fill"] = "#000000"


def strip_outline_layer(el: ET.Element) -> None:
    """Building perimeter — keep stroke, drop fill."""
    for node in el.iter():
        node.attrib.pop("serif:id", None)
        style = node.attrib.get("style")
        if style:
            cleaned = re.sub(r"fill\s*:\s*[^;]+;?", "fill:none;", style, flags=re.I)
            cleaned = re.sub(r"fill-opacity\s*:\s*[^;]+;?", "", cleaned, flags=re.I)
            cleaned = cleaned.strip().strip(";")
            if cleaned:
                node.attrib["style"] = cleaned
            else:
                node.attrib.pop("style", None)

        name = local(node.tag)
        if name in {"path", "rect", "polygon", "polyline", "line", "circle", "ellipse"}:
            node.attrib["fill"] = "none"


def collect_layers(root: ET.Element) -> list[ET.Element]:
    kept: list[ET.Element] = []

    for layer_id in STRIP_FILL_LAYER_IDS:
        layer = find_by_id(root, layer_id)
        if layer is None:
            raise ValueError(f"Missing required layer #{layer_id}")
        strip_room_layer(layer)
        kept.append(copy.deepcopy(layer))

    for layer in find_hatch_layers(root):
        clean_serif_ids(layer)
        kept.append(copy.deepcopy(layer))

    for layer_id in WALL_LAYER_IDS:
        layer = find_by_id(root, layer_id)
        if layer is None:
            continue
        strip_outline_layer(layer)
        kept.append(copy.deepcopy(layer))

    for layer_id in OUTLINE_LAYER_IDS:
        layer = find_by_id(root, layer_id)
        if layer is None:
            continue
        strip_outline_layer(layer)
        kept.append(copy.deepcopy(layer))

    return kept


def strip_svg(svg_text: str) -> str:
    root = ET.fromstring(svg_text)
    if local(root.tag) != "svg":
        raise ValueError("Root element is not <svg>")

    kept_layers = collect_layers(root)

    for child in list(root):
        root.remove(child)

    for layer in kept_layers:
        root.append(layer)

    return ET.tostring(root, encoding="unicode")


def summarize(svg_text: str) -> list[tuple[str, int]]:
    root = ET.fromstring(svg_text)
    summary: list[tuple[str, int]] = []
    for child in root:
        if local(child.tag) not in {"g", "svg"}:
            summary.append((local(child.tag), 1))
            continue
        layer_id = child.attrib.get("id", local(child.tag))
        summary.append((layer_id, sum(1 for _ in child.iter())))
    return summary


def finalize_svg(stripped: str) -> str:
    stripped = re.sub(r"<ns0:", "<", stripped)
    stripped = re.sub(r"</ns0:", "</", stripped)
    stripped = re.sub(r' xmlns:ns0="http://www.w3.org/2000/svg"', "", stripped)
    stripped = re.sub(r' xmlns:ns1="[^"]+"', "", stripped)
    stripped = re.sub(r' ns1:id="[^"]*"', "", stripped)
    if not stripped.startswith("<?xml"):
        stripped = '<?xml version="1.0" encoding="UTF-8"?>\n' + stripped
    if 'xmlns="http://www.w3.org/2000/svg"' not in stripped:
        stripped = stripped.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1)
    return stripped


def main() -> None:
    input_path = Path(
        sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\p.davis\Downloads\LBJ 2 CT.svg"
    )
    output_path = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else r"C:\dev\AISD-ESA\public\floor-plans\LBJ_2_CT_uncolored.svg"
    )

    svg_text = input_path.read_text(encoding="utf-8")
    print(f"Input: {input_path} ({len(svg_text) / 1024 / 1024:.2f} MB)")
    print("Before:", summarize(svg_text))

    stripped = finalize_svg(strip_svg(svg_text))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(stripped, encoding="utf-8")

    print(f"Output: {output_path} ({len(stripped) / 1024 / 1024:.2f} MB)")
    print("After:", summarize(stripped))


if __name__ == "__main__":
    main()
