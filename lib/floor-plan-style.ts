/**
 * Prepare floor-plan SVGs for display:
 * high-contrast schematic ΓÇö white background, consistent hairline black walls
 * (matches the thin Boone-style reference look across every school/floor).
 *
 * Especially important for Lively, which ships colored building/room fills
 * (blue/green/orange/purple sections) that must become black outlines.
 */

/** Screen-pixel stroke weights (via vector-effect: non-scaling-stroke). */
const PLAN_WALL_STROKE_PX = 0.75
const PLAN_DETAIL_STROKE_PX = 0.5
const PLAN_STROKE_COLOR = "#1e293b"
export function prepareFloorPlanSvgForDisplay(svgText: string): string {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
    return svgText
  }

  try {
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml")
    const svg = doc.documentElement
    if (!svg || svg.tagName.toLowerCase() !== "svg") return svgText
    if (doc.querySelector("parsererror")) return svgText

    const ns = "http://www.w3.org/2000/svg"

    // Remove ALL author styles so class rules (.proom, .pbuilding, #planWalls)
    // cannot keep blue/green/grey strokes and fills.
    for (const old of Array.from(svg.querySelectorAll("style"))) {
      old.remove()
    }

    const style = doc.createElementNS(ns, "style")
    style.setAttribute("data-aisd-plan-style", "1")
    style.textContent = `
      svg { background: #ffffff !important; }
      path, line, polyline, polygon, circle, ellipse,
      rect:not([data-aisd-plan-backdrop]) {
        fill: none !important;
        stroke: ${PLAN_STROKE_COLOR} !important;
        stroke-opacity: 1 !important;
        fill-opacity: 1 !important;
        color: #000000 !important;
        stroke-width: ${PLAN_WALL_STROKE_PX}px !important;
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
        stroke: ${PLAN_STROKE_COLOR} !important;
        color: #000000 !important;
        fill: #000000 !important;
      }
      .proom, .pbuilding, #planWalls *, #planDetail *, #planBuildings * {
        fill: none !important;
        stroke: ${PLAN_STROKE_COLOR} !important;
        vector-effect: non-scaling-stroke !important;
      }
      #planDetail *, #planDetail line, #planDetail path {
        stroke-width: ${PLAN_DETAIL_STROKE_PX}px !important;
      }
      #planWalls *, .pbuilding, #planBuildings * {
        stroke-width: ${PLAN_WALL_STROKE_PX}px !important;
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

    const strokeEls = svg.querySelectorAll(
      "path, line, polyline, polygon, circle, ellipse, rect",
    )
    for (const el of Array.from(strokeEls)) {
      if (el.getAttribute("data-aisd-plan-backdrop")) continue
      if (isRoomOverlayElement(el)) {
        hideRoomOverlayElement(el)
        continue
      }
      schemaizeShape(el)
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

/** Room boundary polygons are kept for parsing but must not draw over wall linework. */
function isRoomOverlayElement(el: Element): boolean {
  if (el.classList.contains("proom")) return true
  if (el.closest("#planRooms")) return true
  if (el.tagName.toLowerCase() === "polygon" && (el.hasAttribute("data-i") || el.hasAttribute("data-k"))) {
    return true
  }
  return false
}

function hideRoomOverlayElement(el: Element): void {
  el.setAttribute("display", "none")
  el.setAttribute("fill", "none")
  el.setAttribute("stroke", "none")
}

/** Force every drawable into black stroke / no fill schematic form. */
function schemaizeShape(el: Element): void {
  el.setAttribute("fill", "none")
  el.setAttribute("stroke", PLAN_STROKE_COLOR)
  el.setAttribute("stroke-opacity", "1")
  el.setAttribute("fill-opacity", "1")
  el.removeAttribute("color")

  const style = el.getAttribute("style")
  if (style) {
    let next = style
      .replace(/fill\s*:\s*[^;]+/gi, "fill: none")
      .replace(/stroke\s*:\s*[^;]+/gi, `stroke: ${PLAN_STROKE_COLOR}`)
      .replace(/stroke-opacity\s*:\s*[^;]+/gi, "stroke-opacity: 1")
      .replace(/fill-opacity\s*:\s*[^;]+/gi, "fill-opacity: 1")
      .replace(/color\s*:\s*[^;]+/gi, "color: #000000")
    el.setAttribute("style", next)
  }

  normalizeStroke(el)
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
function normalizeStroke(el: Element): void {
  const px = isDetailStrokeElement(el) ? PLAN_DETAIL_STROKE_PX : PLAN_WALL_STROKE_PX
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
