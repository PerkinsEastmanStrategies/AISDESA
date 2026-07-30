export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.length > 1 || row[0] !== "") rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function rowsToObjects(rows) {
  const [header, ...body] = rows
  return body.map((r) => {
    const o = {}
    for (let i = 0; i < header.length; i++) o[header[i]] = r[i] ?? ""
    return o
  })
}

export function esc(s) {
  return JSON.stringify(s ?? "")
}

export function normalizeQuestionType(raw) {
  if (raw === "YesNo") return "YesNoNA"
  if (raw === "MultiSelect") return "MultiSelect"
  if (raw === "SingleSelect") return "SingleSelect"
  if (String(raw).startsWith("MultiSelect")) return "MultiSelect"
  return raw
}

export function isTrue(v) {
  return String(v).trim().toLowerCase() === "true"
}

export function numOrNull(v) {
  const s = String(v ?? "").trim()
  if (s === "") return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function parseWeight(v) {
  const s = String(v ?? "").trim()
  if (s === "") return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function resolveScoreId(o) {
  const source = String(o.SourceScoreID ?? "").trim()
  if (source) return source
  const group = String(o.ScoreGroupID ?? "").trim()
  if (group) return group
  return String(o.OptionID ?? "").trim() || `${o.QuestionID}-opt`
}

export function resolveOptionScore(o, isExclusion) {
  const explicit = numOrNull(o.OptionScore)
  if (isExclusion && explicit === null) return null
  if (explicit !== null) return explicit
  if (String(o.ItemScoringMode ?? "").trim() === "Inventory") return null
  const text = String(o.ResponseOption ?? o.OptionText ?? "").trim().toLowerCase()
  if (text === "yes") return 1
  if (text === "no") return 0
  return null
}

export function emitV4Package(pkg, bundle) {
  const { categories: allCategories, subcategories: allSubcategories, questions: allQuestions, options: allOptions } =
    bundle
  const catById = new Map(allCategories.map((c) => [c.CategoryID, c]))
  const subById = new Map(allSubcategories.map((s) => [s.SubcategoryID, s]))
  const assessmentArea = pkg.assessmentArea ?? "Arrival/Administration"

  const categories = allCategories
    .filter((c) => c.SpaceTypeID === pkg.spaceTypeId)
    .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

  const catIds = new Set(categories.map((c) => c.CategoryID))
  const subcategories = allSubcategories
    .filter((s) => catIds.has(s.CategoryID))
    .sort((a, b) => {
      const ca = catById.get(a.CategoryID)?.DisplayOrder ?? 0
      const cb = catById.get(b.CategoryID)?.DisplayOrder ?? 0
      if (Number(ca) !== Number(cb)) return Number(ca) - Number(cb)
      return Number(a.DisplayOrder) - Number(b.DisplayOrder)
    })

  const questions = allQuestions
    .filter((q) => q.SpaceTypeID === pkg.spaceTypeId && isTrue(q.IsActive))
    .sort((a, b) => Number(a.DisplayOrder) - Number(b.DisplayOrder))

  const questionIds = new Set(questions.map((q) => q.QuestionID))
  const options = allOptions
    .filter((o) => questionIds.has(o.QuestionID) && isTrue(o.IsActive))
    .sort((a, b) => {
      if (a.QuestionID !== b.QuestionID) return a.QuestionID.localeCompare(b.QuestionID)
      return Number(a.DisplayOrder) - Number(b.DisplayOrder)
    })

  let out = `export const ${pkg.versionConst} = ${pkg.version} as const

export const ${pkg.prefix}_CATEGORIES: EsaCategory[] = [
`

  for (const c of categories) {
    out += `  { assessmentArea: ${esc(assessmentArea)}, category: ${esc(c.CategoryName)}, categoryWeight: ${parseWeight(c.CategoryWeight)} },\n`
  }

  out += `]

export const ${pkg.prefix}_SUBCATEGORIES: EsaSubcategory[] = [
`

  for (const s of subcategories) {
    const parent = catById.get(s.CategoryID)
    if (!parent) throw new Error(`Missing category for subcategory ${s.SubcategoryID}`)
    out += `  { category: ${esc(parent.CategoryName)}, subcategory: ${esc(s.SubcategoryName)}, subcategoryWeight: ${parseWeight(s.SubcategoryWeight)} },\n`
  }

  out += `]

export const ${pkg.prefix}_QUESTIONS: (EsaQuestion & {
  gradeApplicability?: string
  parentScoringPattern?: string
  context?: string
})[] = [
`

  for (const q of questions) {
    const cat = catById.get(q.CategoryID)
    const sub = subById.get(q.SubcategoryID)
    if (!cat) throw new Error(`Missing category for question ${q.QuestionID}`)
    if (!sub) throw new Error(`Missing subcategory for question ${q.QuestionID}`)
    const schoolLevel = String(q.SchoolLevel ?? q.GradeApplicability ?? "ALL").trim()
    const scoringMode = String(q.ScoringMode ?? q.ParentScoringPattern ?? "SingleResponse").trim()
    const context = String(q.Context ?? "").trim()
    out += `  {
    questionId: ${esc(q.QuestionID)},
    assessmentArea: ${esc(assessmentArea)},
    category: ${esc(cat.CategoryName)},
    subcategory: ${esc(sub.SubcategoryName)},
    question: ${esc(q.QuestionText)},
    questionType: ${esc(normalizeQuestionType(q.QuestionType))},
    weight: ${parseWeight(q.QuestionWeight)},
    required: ${isTrue(q.IsRequired)},
    gradeApplicability: ${esc(schoolLevel)},
    parentScoringPattern: ${esc(scoringMode)},
    context: ${esc(context)},
  },
`
  }

  out += `]

export const ${pkg.prefix}_QUESTION_OPTIONS: (EsaQuestionOption & {
  itemScoringMode?: string
  scoreGroupId?: string
  optionScore?: number | null
  maxPoints?: number | null
  itemWeight?: number
  isExclusionOption?: boolean
})[] = [
`

  let kept = 0
  for (const o of options) {
    const optionText = String(o.ResponseOption ?? o.OptionText ?? "").trim()
    if (!optionText) continue

    const isExclusion = isTrue(o.IsExclusionOption)
    const optionScore = resolveOptionScore(o, isExclusion)
    const normalizedScore = isExclusion || optionScore === null ? null : optionScore
    const scoreId = resolveScoreId(o)

    kept += 1
    out += `  {
    questionId: ${esc(o.QuestionID)},
    option: ${esc(optionText)},
    normalizedScore: ${normalizedScore === null ? "null" : normalizedScore},
    displayOrder: ${Number(o.DisplayOrder)},
    scoreId: ${esc(scoreId)},
    itemScoringMode: ${esc(o.ItemScoringMode)} as any,
    scoreGroupId: ${esc(o.ScoreGroupID)},
    optionScore: ${optionScore === null ? "null" : optionScore},
    maxPoints: null,
    itemWeight: 1,
    isExclusionOption: ${isExclusion},
  } as EsaQuestionOption & Record<string, unknown>,
`
  }

  out += `]
`

  return {
    out,
    stats: {
      label: pkg.label,
      questions: questions.length,
      options: kept,
      categories: categories.length,
      subcategories: subcategories.length,
      questionIds: questions.map((q) => q.QuestionID),
    },
  }
}
