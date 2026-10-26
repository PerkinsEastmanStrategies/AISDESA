import {
  canonicalName,
  categoryKey,
  isObservational,
  spaceKey,
  spaceSubcategoryKey,
  subcategoryKey,
} from "@/lib/qa-revised/normalize"
import { isNonScoringQuestion } from "@/lib/qa-revised/non-scoring"
import type {
  SchoolLevel,
  SchoolSnapshot,
  WeightFile,
  WeightOverrides,
  WeightRowFocus,
  WeightRowSpace,
} from "@/lib/qa-revised/types"

export const DEFAULT_WEIGHT = 6
export const MAX_WEIGHT = 15

export const EMPTY_OVERRIDES: WeightOverrides = {
  focus: {},
  space: {},
  category: {},
  subcategory: {},
  question: {},
}

export function emptyOverrides(): WeightOverrides {
  return {
    focus: {},
    space: {},
    category: {},
    subcategory: {},
    question: {},
  }
}

export function filterWeightsForLevel(file: WeightFile, level: SchoolLevel): WeightFile {
  return {
    ...file,
    schoolLevelDefault: level,
    focusAreas: file.focusAreas.filter((row) => row.schoolLevel === level),
    spaceTypes: file.spaceTypes.filter((row) => row.schoolLevel === level),
    categories: file.categories.filter((row) => row.schoolLevel === level),
    subcategories: file.subcategories.filter((row) => row.schoolLevel === level),
    questions: file.questions.filter((row) => row.schoolLevel === level),
  }
}

/** Re-home snapshot rooms under the focus areas and question categories used by this weight scheme. */
export function alignSnapshotToWeights(snapshot: SchoolSnapshot, weights: WeightFile): SchoolSnapshot {
  const focusBySpace = new Map<string, string>()
  for (const row of weights.spaceTypes) {
    focusBySpace.set(canonicalName(row.spaceType), row.focusArea)
  }
  const questionMeta = new Map<string, { category: string; subcategory: string }>()
  for (const row of weights.questions) {
    questionMeta.set(row.questionId, {
      category: row.category,
      subcategory: row.subcategory,
    })
  }
  return {
    ...snapshot,
    rooms: snapshot.rooms.map((room) => {
      const mappedFocus = focusBySpace.get(canonicalName(room.spaceType))
      const focusAreaLabel =
        mappedFocus && mappedFocus !== room.focusAreaLabel ? mappedFocus : room.focusAreaLabel
      let categoryChanged = false
      const units = room.units.map((unit) => {
        const meta = questionMeta.get(unit.questionId)
        if (!meta) return unit
        if (meta.category === unit.category && meta.subcategory === unit.subcategory) return unit
        categoryChanged = true
        return { ...unit, category: meta.category, subcategory: meta.subcategory }
      })
      if (focusAreaLabel === room.focusAreaLabel && !categoryChanged) return room
      return { ...room, focusAreaLabel, units }
    }),
  }
}

export function createWeightResolver(file: WeightFile, overrides: WeightOverrides) {
  const focusDefaults = new Map<string, number>()
  for (const row of file.focusAreas) {
    focusDefaults.set(canonicalName(row.focusArea), row.weight)
  }

  const spaceDefaults = new Map<string, number>()
  for (const row of file.spaceTypes) {
    spaceDefaults.set(spaceKey(row.focusArea, row.spaceType), row.weight)
  }

  const categoryDefaults = new Map<string, number>()
  for (const row of file.categories) {
    const scoped = categoryKey(row.focusArea, row.spaceType, row.category)
    const shared = canonicalName(row.category)
    categoryDefaults.set(scoped, row.weight)
    if (!categoryDefaults.has(shared)) categoryDefaults.set(shared, row.weight)
  }

  const subcategoryDefaults = new Map<string, number>()
  for (const row of file.subcategories) {
    const scoped = spaceSubcategoryKey(row.focusArea, row.spaceType, row.category, row.subcategory)
    const shared = subcategoryKey(row.category, row.subcategory)
    subcategoryDefaults.set(scoped, row.weight)
    if (!subcategoryDefaults.has(shared)) subcategoryDefaults.set(shared, row.weight)
  }

  const questionDefaults = new Map<string, number>()
  const questionMeta = new Map<string, { category: string; subcategory: string; question: string }>()
  for (const row of file.questions) {
    questionDefaults.set(row.questionId, row.weight)
    questionMeta.set(row.questionId, {
      category: row.category,
      subcategory: row.subcategory,
      question: row.question,
    })
  }

  const resolve = (name: string, override: number | undefined, fallback: number | null) => {
    if (isObservational(name)) return 0
    if (override != null) return override
    if (fallback != null) return fallback
    return DEFAULT_WEIGHT
  }

  return {
    focus(focusArea: string): number {
      return resolve(focusArea, overrides.focus[canonicalName(focusArea)], focusDefaults.get(canonicalName(focusArea)) ?? null)
    },
    space(focusArea: string, spaceType: string): number {
      const key = spaceKey(focusArea, spaceType)
      return resolve(spaceType, overrides.space[key], spaceDefaults.get(key) ?? null)
    },
    category(category: string, focusArea?: string, spaceType?: string): number {
      if (focusArea && spaceType) {
        const scoped = categoryKey(focusArea, spaceType, category)
        if (overrides.category[scoped] != null || categoryDefaults.has(scoped)) {
          return resolve(category, overrides.category[scoped], categoryDefaults.get(scoped) ?? null)
        }
      }
      const key = canonicalName(category)
      return resolve(category, overrides.category[key], categoryDefaults.get(key) ?? null)
    },
    subcategory(category: string, subcategory: string, focusArea?: string, spaceType?: string): number {
      if (focusArea && spaceType) {
        const scoped = spaceSubcategoryKey(focusArea, spaceType, category, subcategory)
        if (overrides.subcategory[scoped] != null || subcategoryDefaults.has(scoped)) {
          return resolve(subcategory, overrides.subcategory[scoped], subcategoryDefaults.get(scoped) ?? null)
        }
      }
      const key = subcategoryKey(category, subcategory)
      return resolve(subcategory, overrides.subcategory[key], subcategoryDefaults.get(key) ?? null)
    },
    question(questionId: string, category?: string, question?: string): number {
      const meta = questionMeta.get(questionId)
      if (
        isNonScoringQuestion({
          questionId,
          category: category ?? meta?.category,
          subcategory: meta?.subcategory,
          question: question ?? meta?.question,
          weight: questionDefaults.get(questionId),
        })
      ) {
        return 0
      }
      if (overrides.question[questionId] != null) return overrides.question[questionId]
      return questionDefaults.get(questionId) ?? DEFAULT_WEIGHT
    },
    defaults: {
      focus: focusDefaults,
      space: spaceDefaults,
      category: categoryDefaults,
      subcategory: subcategoryDefaults,
      question: questionDefaults,
    },
  }
}

export type WeightResolver = ReturnType<typeof createWeightResolver>

export function overrideCount(overrides: WeightOverrides): number {
  return (
    Object.keys(overrides.focus).length +
    Object.keys(overrides.space).length +
    Object.keys(overrides.category).length +
    Object.keys(overrides.subcategory).length +
    Object.keys(overrides.question).length
  )
}

export function uniqueFocusAreas(rows: WeightRowFocus[]): string[] {
  return [...new Set(rows.map((row) => row.focusArea))]
}

export function spacesByFocus(rows: WeightRowSpace[]): Map<string, WeightRowSpace[]> {
  const map = new Map<string, WeightRowSpace[]>()
  for (const row of rows) {
    const list = map.get(row.focusArea) ?? []
    list.push(row)
    map.set(row.focusArea, list)
  }
  return map
}

export interface WeightTreeQuestion {
  questionId: string
  question: string
}

export interface WeightTreeSubcategory {
  name: string
  questions: WeightTreeQuestion[]
}

export interface WeightTreeCategory {
  name: string
  subcategories: WeightTreeSubcategory[]
}

export interface WeightTreeSpace {
  name: string
  categories: WeightTreeCategory[]
}

export interface WeightTreeFocus {
  name: string
  spaces: WeightTreeSpace[]
}

function pushUnique(list: string[], value: string) {
  if (!list.some((item) => canonicalName(item) === canonicalName(value))) list.push(value)
}

export function buildWeightTree(file: WeightFile): WeightTreeFocus[] {
  const spaces = spacesByFocus(file.spaceTypes)
  const categoriesBySpace = new Map<string, string[]>()
  for (const row of file.categories) {
    if (isObservational(row.category)) continue
    const key = spaceKey(row.focusArea, row.spaceType)
    const list = categoriesBySpace.get(key) ?? []
    pushUnique(list, row.category)
    categoriesBySpace.set(key, list)
  }

  const subcategoriesByCategory = new Map<string, string[]>()
  for (const row of file.subcategories) {
    if (isObservational(row.category) || isObservational(row.subcategory)) continue
    const key = categoryKey(row.focusArea, row.spaceType, row.category)
    const list = subcategoriesByCategory.get(key) ?? []
    pushUnique(list, row.subcategory)
    subcategoriesByCategory.set(key, list)
  }

  const questionsBySubcategory = new Map<string, WeightTreeQuestion[]>()
  for (const row of file.questions) {
    if (isNonScoringQuestion(row)) continue
    const key = spaceSubcategoryKey(row.focusArea, row.spaceType, row.category, row.subcategory)
    const list = questionsBySubcategory.get(key) ?? []
    if (!list.some((item) => item.questionId === row.questionId)) {
      list.push({ questionId: row.questionId, question: row.question })
    }
    questionsBySubcategory.set(key, list)
  }

  return uniqueFocusAreas(file.focusAreas).map((focusArea) => ({
    name: focusArea,
    spaces: (spaces.get(focusArea) ?? [])
      .slice()
      .sort((a, b) => a.spaceType.localeCompare(b.spaceType))
      .map((space) => {
        const spaceId = spaceKey(focusArea, space.spaceType)
        return {
          name: space.spaceType,
          categories: (categoriesBySpace.get(spaceId) ?? [])
            .slice()
            .sort((a, b) => a.localeCompare(b))
            .map((category) => {
              const categoryId = categoryKey(focusArea, space.spaceType, category)
              return {
                name: category,
                subcategories: (subcategoriesByCategory.get(categoryId) ?? [])
                  .slice()
                  .sort((a, b) => a.localeCompare(b))
                  .map((subcategory) => {
                    const subId = spaceSubcategoryKey(
                      focusArea,
                      space.spaceType,
                      category,
                      subcategory,
                    )
                    return {
                      name: subcategory,
                      questions: (questionsBySubcategory.get(subId) ?? []).sort((a, b) =>
                        a.questionId.localeCompare(b.questionId),
                      ),
                    }
                  }),
              }
            }),
        }
      }),
  }))
}
