export type Pt = { x: number; y: number }

export function polygonArea(pts: Pt[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x + pts[i].x) * (pts[j].y - pts[i].y)
  }
  return Math.abs(area / 2)
}

export function pointInPolygon(pt: Pt, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const intersect =
      yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function findRoomAtPoint(
  rooms: { id: string; points: Pt[] }[],
  pt: Pt,
): string | null {
  for (const room of rooms) {
    if (pointInPolygon(pt, room.points)) return room.id
  }
  return null
}

export function viewBoxString(vb: { x: number; y: number; w: number; h: number }): string {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`
}

export function toPercent(x: number, y: number, vb: { x: number; y: number; w: number; h: number }) {
  return {
    left: ((x - vb.x) / vb.w) * 100,
    top: ((y - vb.y) / vb.h) * 100,
  }
}
