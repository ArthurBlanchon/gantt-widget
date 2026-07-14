import type { GristRowRecord } from "grist-widget-sdk"

export const UNGROUPED_LABEL = "(ungrouped)"

export type ResolvedLabeledField = {
  /** Stable key for grouping. */
  key: string
  /** Human-readable label. */
  label: string
}

function asString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function readRefDisplayLabel(
  row: GristRowRecord,
  refColId: string,
): string | null {
  const helperColId = `gristHelper_${refColId}`
  const helper = row[helperColId]
  if (helper == null) return null
  if (typeof helper === "string") {
    const label = helper.trim()
    return label || null
  }
  if (Array.isArray(helper)) {
    for (const item of helper) {
      const label = asString(item)
      if (label) return label
    }
  }
  return null
}

function readRefRowId(value: unknown): number | null {
  if (value == null || value === "" || value === 0) return null
  if (typeof value === "number" && Number.isFinite(value)) {
    return value === 0 ? null : value
  }
  if (value && typeof value === "object" && "__ref" in value) {
    const rowId = (value as { rowId?: unknown }).rowId
    if (typeof rowId === "number" && Number.isFinite(rowId) && rowId !== 0) {
      return rowId
    }
  }
  return null
}

/** Resolve a Text, Choice, or Ref column into a stable key and display label. */
export function resolveLabeledField(
  row: GristRowRecord,
  colId: string,
  emptyLabel = UNGROUPED_LABEL,
): ResolvedLabeledField {
  const raw = row[colId]

  const refRowId = readRefRowId(raw)
  if (refRowId != null) {
    const label = readRefDisplayLabel(row, colId) ?? `#${refRowId}`
    return { key: `ref:${refRowId}`, label }
  }

  const text = asString(raw)
  if (text) return { key: text, label: text }

  return { key: emptyLabel, label: emptyLabel }
}
