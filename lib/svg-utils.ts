export interface SvgViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SERIF_XMLNS = 'xmlns:serif="http://www.serif.com/"';

/**
 * DXF converter exports use `serif:id` on TEXT/MTEXT groups like native CAFM SVGs.
 * Without `xmlns:serif` on the root `<svg>`, strict XML parsers (browser DOMParser)
 * fail and floor plans never leave "Loading floor plan…".
 */
export function sanitizeFloorPlanSvgXml(svgText: string): string {
  if (!svgText || !/serif:id=/.test(svgText) || /xmlns:serif=/.test(svgText)) {
    return svgText;
  }
  return svgText.replace(
    /<svg\b([^>]*)>/i,
    (_match, attrs: string) => `<svg ${SERIF_XMLNS}${attrs}>`,
  );
}

/** Above this size, skip getBBox-based cropping when a viewBox is already declared. */
export const LARGE_SVG_CHAR_THRESHOLD = 9 * 1024 * 1024;

/** Layer ids that define the visible plan footprint (CAFM exports + legacy plans). */
const PLAN_FRAME_PRIMARY_GROUP_IDS = ["CAFM_SPACE", "planRooms"] as const;
const PLAN_FRAME_SECONDARY_GROUP_IDS = [
  "WALLS",
  "CAFM_BLDG_OTLN",
  "CAFM_BLDG-OTLN",
  "planWalls",
  "planBuildings",
] as const;

const PLAN_FRAME_SHAPE_SELECTOR =
  "path,polygon,polyline,rect,circle,ellipse,line";

function unionBboxes(boxes: DOMRect[]): DOMRect | null {
  if (!boxes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0] ?? 0;
}

/** Drop stray CAD marks far from the main room cluster (desktop WALLS/DOORS often have these). */
function robustUnionBboxes(boxes: DOMRect[]): DOMRect | null {
  if (!boxes.length) return null;
  if (boxes.length <= 2) return unionBboxes(boxes);

  const maxArea = Math.max(...boxes.map((b) => b.width * b.height));
  const minArea = maxArea * 0.00005;
  const sized = boxes.filter((b) => b.width * b.height >= minArea);
  if (!sized.length) return unionBboxes(boxes);

  const centers = sized.map((b) => ({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    box: b,
  }));

  const medianX = median(centers.map((c) => c.x));
  const medianY = median(centers.map((c) => c.y));
  const dists = centers
    .map((c) => Math.hypot(c.x - medianX, c.y - medianY))
    .sort((a, b) => a - b);
  const medianDist = median(dists);
  const p90 = dists[Math.floor(dists.length * 0.9)] ?? medianDist;
  const maxDist = Math.max(medianDist * 3.5, p90 * 1.15, 1);

  const kept = centers
    .filter((c) => Math.hypot(c.x - medianX, c.y - medianY) <= maxDist)
    .map((c) => c.box);

  if (kept.length < Math.max(3, Math.floor(sized.length * 0.45))) {
    return unionBboxes(sized);
  }
  return unionBboxes(kept);
}

function shapeBboxesInGroup(group: Element, root: SVGSVGElement): DOMRect[] {
  const boxes: DOMRect[] = [];
  for (const el of group.querySelectorAll(PLAN_FRAME_SHAPE_SELECTOR)) {
    try {
      const graphics = el as SVGGraphicsElement;
      const bbox = bboxInRootSvg(graphics, root);
      if (bbox && bbox.width > 0 && bbox.height > 0) boxes.push(bbox);
    } catch {
      continue;
    }
  }
  return boxes;
}

/** Map a shape bbox through its CTM into root SVG user space (handles Y-flip groups). */
function bboxInRootSvg(
  el: SVGGraphicsElement,
  root: SVGSVGElement,
): DOMRect | null {
  const local = el.getBBox();
  if (local.width <= 0 || local.height <= 0) return null;

  const ctm = el.getCTM();
  const rootCTM = root.getCTM();
  if (!ctm || !rootCTM) return local;

  const toRoot = rootCTM.inverse().multiply(ctm);
  const corners = [
    { x: local.x, y: local.y },
    { x: local.x + local.width, y: local.y },
    { x: local.x, y: local.y + local.height },
    { x: local.x + local.width, y: local.y + local.height },
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of corners) {
    const transformed = new DOMPoint(point.x, point.y).matrixTransform(toRoot);
    minX = Math.min(minX, transformed.x);
    minY = Math.min(minY, transformed.y);
    maxX = Math.max(maxX, transformed.x);
    maxY = Math.max(maxY, transformed.y);
  }

  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}

function viewBoxFromGroupIds(
  root: SVGSVGElement,
  groupIds: readonly string[],
): DOMRect | null {
  const boxes: DOMRect[] = [];
  for (const id of groupIds) {
    const group = root.getElementById(id);
    if (!group) continue;
    boxes.push(...shapeBboxesInGroup(group, root));
  }
  return robustUnionBboxes(boxes);
}

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
 *
 * Framing uses room boundaries first; desktop-only DOORS/FIXTURES and distant
 * CAFM_ID labels are excluded so stray CAD debris does not widen the viewBox.
 */
export function getPlanContentViewBox(
  svgElement: SVGSVGElement,
  paddingRatio = 0.03,
): SvgViewBox | null {
  if (typeof document === "undefined") return null;

  const { mount, clone } = mountSvgClone(svgElement);

  try {
    const primary = viewBoxFromGroupIds(clone, PLAN_FRAME_PRIMARY_GROUP_IDS);
    const secondary = viewBoxFromGroupIds(clone, PLAN_FRAME_SECONDARY_GROUP_IDS);
    const bbox = primary ?? secondary;
    if (!bbox) return null;
    return viewBoxFromBBox(bbox, paddingRatio);
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

  const planContent = getPlanContentViewBox(svgElement);
  const tight = getTightSvgViewBox(svgElement);

  // CAFM exports with a root Y-flip used to measure #CAFM_SPACE in local coords only,
  // producing a viewBox that misses the real linework (plan appears above the viewport).
  if (planContent && declared && !viewBoxesOverlap(planContent, declared)) {
    return tight ?? declared;
  }

  return planContent ?? tight ?? declared;
}

function viewBoxesOverlap(a: SvgViewBox, b: SvgViewBox, minOverlapRatio = 0.2): boolean {
  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  if (xOverlap <= 0 || yOverlap <= 0) return false;

  const overlapArea = xOverlap * yOverlap;
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 && overlapArea / minArea >= minOverlapRatio;
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
