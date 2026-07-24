/** Convert a weight to its share of a sibling total, formatted for display. */
export function weightSharePercent(weight: number, totalWeight: number): number | null {
  if (weight <= 0 || totalWeight <= 0) return null
  return (weight / totalWeight) * 100
}

export function formatWeightShare(weight: number, totalWeight: number): string | null {
  const pct = weightSharePercent(weight, totalWeight)
  if (pct == null) return null
  const rounded = Math.round(pct * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

export function sumPositiveWeights(weights: readonly number[]): number {
  return weights.reduce((sum, weight) => sum + (weight > 0 ? weight : 0), 0)
}
