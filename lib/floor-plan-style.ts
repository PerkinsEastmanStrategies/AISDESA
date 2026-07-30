/**
 * Prepare floor-plan SVGs for display:
 * high-contrast schematic — white background, consistent hairline black walls
 * (matches the thin Boone-style reference look across every school/floor).
 *
 * Especially important for Lively, which ships colored building/room fills
 * (blue/green/orange/purple sections) that must become black outlines.
 */

/** Screen-pixel stroke weights (via vector-effect: non-scaling-stroke). */
const PLAN_WALL_STROKE_PX = 0.75
const PLAN_DETAIL_STROKE_PX = 0.5
const PLAN_STROKE_COLOR = "#1e293b"
/** LBJ CAD exports — slightly heavier/darker linework for readability. */
const LBJ_PLAN_WALL_STROKE_PX = 0.85
const LBJ_PLAN_STROKE_COLOR = "#0f172a"

export type FloorPlanDisplayOptions = {
  /** LBJ bundled CAFM exports — hide hatch fills; show CAFM room outlines + building perimeter. */
  lbjCafmPlan?: boolean
  /** LBJ only — show DEF_HATCH_* fills (size deviation) in the base plan SVG. */
  lbjShowHatch?: boolean
}

export function prepareFloorPlanSvgForDisplay(
  svgText: string,
  options: FloorPlanDisplayOptions = {},
): string {
  const lbjCafmPlan = options.lbjCafmPlan === true
  const lbjShowHatch = options.lbjShowHatch === true
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return svgText
  }

  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const svg = doc.documentElement
    if (!svg || svg.tagName.toLowerCase() !== "svg") return svgText
    if (doc.querySelector("parsererror")) return svgText

    const ns = "http://www.w3.org/2000/svg"
    const strokeColor = lbjCafmPlan ? LBJ_PLAN_STROKE_COLOR : PLAN_STROKE_COLOR
    const wallStrokePx = lbjCafmPlan ? LBJ_PLAN_WALL_STROKE_PX : PLAN_WALL_STROKE_PX
    const detailStrokePx = PLAN_DETAIL_STROKE_PX

    // Remove ALL author styles so class rules (.proom, .pbuilding, #planWalls)
    // cannot keep blue/green/grey strokes and fills.
    for (const old of Array.from(svg.querySelectorAll("style"))) {
      old.remove()
    }

    const style = doc.createElementNS(ns, "style")
    style.setAttribute("data-aisd-plan-style", "1")
    style.textContent = `
      svg { background: #ffffff !important; }
      path:not([data-aisd-hatch]), line, polyline, polygon:not([data-aisd-hatch]), circle, ellipse,
      rect:not([data-aisd-plan-backdrop]):not([data-aisd-hatch]) {
        fill: none !important;
        stroke: ${strokeColor} !important;
        stroke-opacity: 1 !important;
        fill-opacity: 1 !important;
        color: #000000 !important;
        stroke-width: ${wallStrokePx}px !important;
        vector-effect: non-scaling-stroke !important;
      }
      rect[data-aisd-plan-backdrop] {
        fill: #ffffff !important;
        stroke: none !important;
      }
      text, tspan {
        fill: #000000 !important;
        stroke: none !important;
        fill-opacity: 1 !important;
      }
      a, a * {
        stroke: ${strokeColor} !important;
        color: #000000 !important;
        fill: #000000 !important;
      }
      .proom, .pbuilding, #planWalls *, #planDetail *, #planBuildings * {
        fill: none !important;
        stroke: ${strokeColor} !important;
        vector-effect: non-scaling-stroke !important;
      }
      #planDetail *, #planDetail line, #planDetail path {
        stroke-width: ${detailStrokePx}px !important;
      }
      #planWalls *, .pbuilding, #planBuildings * {
        stroke-width: ${wallStrokePx}px !important;
      }
      polygon.proom, #planRooms polygon, polygon[data-i], polygon[data-k] {
        display: none !important;
        stroke: none !important;
        fill: none !important;
      }
      #planBuildingLabels text, #planBuildingLabels tspan,
      #planLabels text, #planLabels tspan,
      #CAFM_ID text, #CAFM_ID tspan {
        fill: #000000 !important;
        stroke: none !important;
      }
      ${lbjCafmPlan ? `
      #CAFM_SPACE path, #CAFM_SPACE polygon, #CAFM_SPACE polyline, #CAFM_SPACE rect,
      #A-WALLS path, #A-WALLS line, #A-WALLS polyline, #A-WALLS polygon,
      #A-WALL path, #A-WALL line, #A-WALL polyline, #A-WALL polygon,
      #CAFM_BLDG_OTLN path, #CAFM_BLDG_OTLN polygon, #CAFM_BLDG-OTLN path, #CAFM_BLDG-OTLN polygon {
        display: inline !important;
        fill: none !important;
        stroke: ${strokeColor} !important;
        stroke-width: ${wallStrokePx}px !important;
        vector-effect: non-scaling-stroke !important;
      }
      ${lbjShowHatch ? `
      [id^="DEF_HATCH_"] path, [id^="DEF_HATCH_"] polygon, [id^="DEF_HATCH_"] rect, [id^="DEF_HATCH_"] circle {
        display: inline !important;
        stroke: none !important;
        stroke-width: 0 !important;
        fill-opacity: 0.88 !important;
        vector-effect: none !important;
      }
      ` : `
      [id^="DEF_HATCH_"] * {
        display: none !important;
      }
      `}
      ` : ""}
    `
    svg.insertBefore(style, svg.firstChild)

    const existingBackdrop = svg.querySelector("[data-aisd-plan-backdrop]")
    existingBackdrop?.remove()
    const vb = readViewBox(svg)
    if (vb) {
      const backdrop = doc.createElementNS(ns, "rect")
      backdrop.setAttribute("data-aisd-plan-backdrop", "1")
      backdrop.setAttribute("x", String(vb.x))
      backdrop.setAttribute("y", String(vb.y))
      backdrop.setAttribute("width", String(vb.width))
      backdrop.setAttribute("height", String(vb.height))
      backdrop.setAttribute("fill", "#ffffff")
      backdrop.setAttribute("stroke", "none")
      svg.insertBefore(backdrop, style.nextSibling)
    }

    svg.setAttribute("style", "background:#ffffff")

    const lineStyle = { strokeColor, wallStrokePx, detailStrokePx }

    const strokeEls = svg.querySelectorAll(
      "path, line, polyline, polygon, circle, ellipse, rect",
    )
    for (const el of Array.from(strokeEls)) {
      if (el.getAttribute("data-aisd-plan-backdrop")) continue
      if (isRoomOverlayElement(el, lbjCafmPlan, lbjShowHatch)) {
        hideRoomOverlayElement(el)
        continue
      }
      if (lbjCafmPlan && lbjShowHatch && isLbjHatchElement(el)) {
        preserveLbjHatchShape(el)
        continue
      }
      if (lbjCafmPlan && isLbjWallElement(el)) {
        schemaizeBuildingOutline(el, lineStyle)
        continue
      }
      if (lbjCafmPlan && isBuildingOutlineElement(el)) {
        schemaizeBuildingOutline(el, lineStyle)
        continue
      }
      schemaizeShape(el, lineStyle)
    }

    for (const el of Array.from(svg.querySelectorAll("text, tspan"))) {
      forceBlackText(el)
    }

    return new XMLSerializer().serializeToString(doc)
  } catch {
    return svgText
  }
}

function readViewBox(
  svg: Element,
): { x: number; y: number; width: number; height: number } | null {
  const raw = svg.getAttribute("viewBox")
  if (raw) {
    const parts = raw.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] }
    }
  }
  const width = parseFloat(svg.getAttribute("width") ?? "")
  const height = parseFloat(svg.getAttribute("height") ?? "")
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { x: 0, y: 0, width, height }
  }
  return null
}

/** Room polygons used only for hit-testing/overlays — not visible linework. */
function isRoomOverlayElement(
  el: Element,
  lbjCafmPlan: boolean,
  lbjShowHatch: boolean,
): boolean {
  if (el.classList.contains("proom")) return true
  if (el.closest("#planRooms")) return true
  if (lbjCafmPlan && !lbjShowHatch && el.closest("[id^='DEF_HATCH_']")) return true
  if (el.tagName.toLowerCase() === "polygon" && (el.hasAttribute("data-i") || el.hasAttribute("data-k"))) {
    return true
  }
  return false
}

function isLbjHatchElement(el: Element): boolean {
  return Boolean(el.closest("[id^='DEF_HATCH_']"))
}

function readShapeFill(el: Element): string | null {
  const style = el.getAttribute("style") ?? ""
  const fromStyle = style.match(/fill\s*:\s*([^;]+)/i)?.[1]?.trim()
  const raw = el.getAttribute("fill") ?? fromStyle
  if (!raw || raw.toLowerCase() === "none" || raw.toLowerCase() === "transparent") return null
  return raw
}

/** Keep CAD hatch fill colors for LBJ size-deviation display. */
function preserveLbjHatchShape(el: Element): void {
  const fill = readShapeFill(el)
  if (!fill) {
    hideRoomOverlayElement(el)
    return
  }
  el.setAttribute("data-aisd-hatch", "1")
  el.removeAttribute("display")
  el.setAttribute("fill", fill)
  el.setAttribute("stroke", "none")
  el.setAttribute("fill-opacity", "0.88")
  el.setAttribute(
    "style",
    `fill: ${fill} !important; stroke: none !important; fill-opacity: 0.88 !important`,
  )
}

function isBuildingOutlineElement(el: Element): boolean {
  return Boolean(el.closest("#CAFM_BLDG_OTLN, #CAFM_BLDG-OTLN"))
}

function isLbjWallElement(el: Element): boolean {
  return Boolean(el.closest("#A-WALLS, #A-WALL"))
}

function hideRoomOverlayElement(el: Element): void {
  el.setAttribute("display", "none")
  el.setAttribute("fill", "none")
  el.setAttribute("stroke", "none")
}

type PlanLineStyle = {
  strokeColor: string
  wallStrokePx: number
  detailStrokePx: number
}

/** Building footprint — visible perimeter, no fill. */
function schemaizeBuildingOutline(el: Element, lineStyle: PlanLineStyle): void {
  el.setAttribute("fill", "none")
  el.setAttribute("stroke", lineStyle.strokeColor)
  el.setAttribute("stroke-opacity", "1")
  el.setAttribute("fill-opacity", "1")
  el.removeAttribute("color")

  const style = el.getAttribute("style")
  if (style) {
    const next = style
      .replace(/fill\s*:\s*[^;]+/gi, "fill: none")
      .replace(/stroke\s*:\s*[^;]+/gi, `stroke: ${lineStyle.strokeColor}`)
      .replace(/stroke-opacity\s*:\s*[^;]+/gi, "stroke-opacity: 1")
      .replace(/fill-opacity\s*:\s*[^;]+/gi, "fill-opacity: 1")
    el.setAttribute("style", next)
  }

  el.setAttribute("stroke-width", `${lineStyle.wallStrokePx}px`)
  el.setAttribute("vector-effect", "non-scaling-stroke")
}

/** Force every drawable into black stroke / no fill schematic form. */
function schemaizeShape(el: Element, lineStyle: PlanLineStyle): void {
  el.setAttribute("fill", "none")
  el.setAttribute("stroke", lineStyle.strokeColor)
  el.setAttribute("stroke-opacity", "1")
  el.setAttribute("fill-opacity", "1")
  el.removeAttribute("color")

  const style = el.getAttribute("style")
  if (style) {
    let next = style
      .replace(/fill\s*:\s*[^;]+/gi, "fill: none")
      .replace(/stroke\s*:\s*[^;]+/gi, `stroke: ${lineStyle.strokeColor}`)
      .replace(/stroke-opacity\s*:\s*[^;]+/gi, "stroke-opacity: 1")
      .replace(/fill-opacity\s*:\s*[^;]+/gi, "fill-opacity: 1")
      .replace(/color\s*:\s*[^;]+/gi, "color: #000000")
    el.setAttribute("style", next)
  }

  normalizeStroke(el, lineStyle)
}

function forceBlackText(el: Element): void {
  el.setAttribute("fill", "#000000")
  el.setAttribute("stroke", "none")
  el.setAttribute("fill-opacity", "1")
  const style = el.getAttribute("style")
  if (!style) return
  let next = style
    .replace(/fill\s*:\s*[^;]+/gi, "fill: #000000")
    .replace(/stroke\s*:\s*[^;]+/gi, "stroke: none")
    .replace(/fill-opacity\s*:\s*[^;]+/gi, "fill-opacity: 1")
  el.setAttribute("style", next)
}

function isDetailStrokeElement(el: Element): boolean {
  if (el.closest("#planDetail")) return true
  const raw = el.getAttribute("stroke-width")
  const style = el.getAttribute("style")
  let n = raw ? parseFloat(raw) : NaN
  if ((!Number.isFinite(n) || n <= 0) && style) {
    const m = style.match(/stroke-width\s*:\s*([\d.]+)/i)
    if (m) n = parseFloat(m[1])
  }
  return Number.isFinite(n) && n > 0 && n < 1.5
}

/**
 * Use fixed screen-pixel stroke weights so Boone, Anderson, and large CAD exports
 * all read as the same thin schematic linework regardless of viewBox size.
 */
function normalizeStroke(el: Element, lineStyle: PlanLineStyle): void {
  const px = isDetailStrokeElement(el) ? lineStyle.detailStrokePx : lineStyle.wallStrokePx
  const width = `${px}px`

  el.setAttribute("stroke-width", width)
  el.setAttribute("vector-effect", "non-scaling-stroke")

  const style = el.getAttribute("style")
  if (style && /stroke-width\s*:/i.test(style)) {
    el.setAttribute(
      "style",
      style.replace(/stroke-width\s*:\s*[^;]+/gi, `stroke-width: ${width}`),
    )
  }
}
