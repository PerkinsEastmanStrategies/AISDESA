export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Above this size, skip getBBox-based cropping when a viewBox is already declared. */
export const LARGE_SVG_CHAR_THRESHOLD = 9 * 1024 * 1024;

/** Layer ids that define the visible plan footprint (CAFM exports + legacy plans). */
const PLAN_CONTENT_GROUP_IDS = [
  "CAFM_SPACE",
  "CAFM_ID",
  "WALLS",
  "DOORS",
  "FIXTURES",
  "CAFM_BLDG_OTLN",
  "CAFM_BLDG-OTLN",
  "planWalls",
  "planRooms",
  "planBuildings",
  "planDetail",
] as const;

function mountSvgClone(svgElement: SVGSVGElement): {
  mount: HTMLDivElement;
  clone: SVGSVGElement;
} {
  const mount = document.createElement("div");
  mount.style.cssText =
    "position:fixed;left:-10000px;top:0;width:2400px;height:2400px;overflow:hidden;visibility:hidden;pointer-events:none;";
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", "2400");
  clone.setAttribute("height", "2400");
  mount.appendChild(clone);
  document.body.appendChild(mount);
  return { mount, clone };
}

function viewBoxFromBBox(
  bbox: DOMRect,
  paddingRatio: number,
): SvgViewBox | null {
  if (
    !Number.isFinite(bbox.width) ||
    !Number.isFinite(bbox.height) ||
    bbox.width <= 0 ||
    bbox.height <= 0
  ) {
    return null;
  }

  const pad = Math.max(bbox.width, bbox.height) * paddingRatio;
  return {
    x: bbox.x - pad,
    y: bbox.y - pad,
    width: bbox.width + pad * 2,
    height: bbox.height + pad * 2,
  };
}

export function parseSvgViewBoxAttribute(
  svgElement: SVGSVGElement
): SvgViewBox | null {
  const viewBoxAttr = svgElement.getAttribute("viewBox");
  if (viewBoxAttr) {
    const parts = viewBoxAttr.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const w = parseFloat(svgElement.getAttribute("width") || "800");
  const h = parseFloat(svgElement.getAttribute("height") || "600");
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { x: 0, y: 0, width: w, height: h };
  }

  return null;
}

/** Measure rendered SVG content bounds (respects transforms). */
export function getTightSvgViewBox(
  svgElement: SVGSVGElement,
  paddingRatio = 0.03
): SvgViewBox | null {
  if (typeof document === "undefined") return null;

  const { mount, clone } = mountSvgClone(svgElement);

  try {
    return viewBoxFromBBox(clone.getBBox(), paddingRatio);
  } catch {
    return null;
  } finally {
    document.body.removeChild(mount);
  }
}

/**
 * Crop to plan layers only (#CAFM_SPACE, #WALLS, etc.) so CAD sheet padding
 * does not shrink the building on screen. More consistent across WebKit/desktop
 * than measuring the entire SVG root.
 */
export function getPlanContentViewBox(
  svgElement: SVGSVGElement,
  paddingRatio = 0.03,
): SvgViewBox | null {
  if (typeof document === "undefined") return null;

  const { mount, clone } = mountSvgClone(svgElement);

  try {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hit = false;

    for (const id of PLAN_CONTENT_GROUP_IDS) {
      const group = clone.getElementById(id);
      if (!group) continue;

      try {
        const bbox = (group as SVGGraphicsElement).getBBox();
        if (bbox.width <= 0 || bbox.height <= 0) continue;
        hit = true;
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      } catch {
        continue;
      }
    }

    if (!hit) return null;

    return viewBoxFromBBox(
      new DOMRect(minX, minY, maxX - minX, maxY - minY),
      paddingRatio,
    );
  } finally {
    document.body.removeChild(mount);
  }
}

/** Prefer declared viewBox on very large SVGs to avoid an extra DOM measurement pass. */
export function resolveSvgViewBox(
  svgElement: SVGSVGElement,
  sourceCharLength?: number
): SvgViewBox | null {
  const declared = parseSvgViewBoxAttribute(svgElement);
  if (
    sourceCharLength !== undefined &&
    sourceCharLength >= LARGE_SVG_CHAR_THRESHOLD &&
    declared
  ) {
    return declared;
  }

  const tight =
    getPlanContentViewBox(svgElement) ?? getTightSvgViewBox(svgElement);
  return tight ?? declared;
}

export function applySvgViewBox(
  svgElement: SVGSVGElement,
  viewBox: SvgViewBox
): void {
  svgElement.setAttribute(
    "viewBox",
    `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
  );
}

export function parseSvgViewBoxFromText(svgText: string): SvgViewBox | null {
  if (typeof DOMParser === "undefined") return null;

  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg") return null;

  return parseSvgViewBoxAttribute(svg as unknown as SVGSVGElement);
}
