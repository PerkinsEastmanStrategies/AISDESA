const ALIASES: Record<string, string> = {
  art: "art studio",
  "admin office": "admin offices",
  "community partner suite": "community partners suite",
  "counseling suite": "mental wellness and counseling suite",
  "open collaboration space": "open collaboration",
  "maker space": "maker space",
}

export function canonicalName(value: string | null | undefined): string {
  let text = String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bpartners\b/g, "partner")
    .replace(/\boffices\b/g, "office")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  text = text.replace(/\bpartner\b/g, "partner")
  if (text === "admin office") text = "admin offices"
  if (ALIASES[text]) text = ALIASES[text]
  return text
}

export function namesMatch(a: string, b: string): boolean {
  return canonicalName(a) === canonicalName(b)
}

export function isObservational(name: string | null | undefined): boolean {
  return /(^|\s)observational$/i.test(String(name ?? "").trim())
}

export function spaceKey(focusArea: string, spaceType: string): string {
  return `${canonicalName(focusArea)}::${canonicalName(spaceType)}`
}

export function categoryKey(focusArea: string, spaceType: string, category: string): string {
  return `${spaceKey(focusArea, spaceType)}::${canonicalName(category)}`
}

export function subcategoryKey(category: string, subcategory: string): string {
  return `${canonicalName(category)}::${canonicalName(subcategory)}`
}

export function spaceSubcategoryKey(
  focusArea: string,
  spaceType: string,
  category: string,
  subcategory: string,
): string {
  return `${categoryKey(focusArea, spaceType, category)}::${canonicalName(subcategory)}`
}
