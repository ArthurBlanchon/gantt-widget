import {
  normalizeGristChoiceListEntries,
  type GristReplicaColumn,
  type GristReplicaTable,
} from "grist-widget-sdk"

export const FALLBACK_GROUP_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
] as const

export const DEFAULT_EVENT_BAR_FILL = "#000000"
export const DEFAULT_EVENT_BAR_TEXT = "#ffffff"

export type ChoiceStyle = {
  fillColor?: string
  textColor?: string
}

/** Build value → choice styling from a Grist Choice column's widgetOptions. */
export function buildChoiceStyleMap(
  table: GristReplicaTable | null | undefined,
  columnId: string | undefined,
): Map<string, ChoiceStyle> {
  const map = new Map<string, ChoiceStyle>()
  if (!table || !columnId) return map

  const column: GristReplicaColumn | undefined = table.columns?.[columnId]
  if (column?.type !== "Choice") return map

  for (const entry of normalizeGristChoiceListEntries(column.widgetOptions)) {
    map.set(entry.value, {
      fillColor: parseGristColor(entry.fillColor) ?? undefined,
      textColor: parseGristColor(entry.textColor) ?? undefined,
    })
  }
  return map
}

/** Parse a Grist Text cell (or Choice color) into a CSS color, or null. */
export function parseGristColor(value: unknown): string | null {
  if (value == null || value === "") return null
  if (typeof value !== "string") return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
    return trimmed
  }

  if (/^rgb\(/i.test(trimmed) || /^hsl\(/i.test(trimmed)) {
    return trimmed
  }

  if (/^var\(--/.test(trimmed)) {
    return trimmed
  }

  if (/^[a-z]+$/i.test(trimmed)) {
    return trimmed
  }

  return null
}

export function fallbackGroupColor(index: number): string {
  return (
    FALLBACK_GROUP_COLORS[index % FALLBACK_GROUP_COLORS.length] ??
    DEFAULT_EVENT_BAR_FILL
  )
}

export function resolveGroupColor(options: {
  groupLabel: string
  groupValue?: string
  groupIndex: number
  groupChoiceStyles: Map<string, ChoiceStyle>
}): string {
  const choiceKey = options.groupValue ?? options.groupLabel
  const fromChoice = options.groupChoiceStyles.get(choiceKey)?.fillColor
  if (fromChoice) return fromChoice

  return fallbackGroupColor(options.groupIndex)
}

function readChoiceCellValue(
  row: Record<string, unknown>,
  colId: string | undefined,
): string | null {
  if (!colId) return null
  const value = row[colId]
  if (value == null || value === "") return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

/** Bar colors when Event_status_color is unmapped, empty, or unknown. */
export function defaultEventBarStyle(): {
  fillColor: string
  textColor: string
} {
  return {
    fillColor: DEFAULT_EVENT_BAR_FILL,
    textColor: DEFAULT_EVENT_BAR_TEXT,
  }
}

export function resolveEventBarStyle(
  row: Record<string, unknown>,
  options: {
    eventStatusColId?: string
    eventStatusChoiceStyles: Map<string, ChoiceStyle>
  },
): { fillColor: string; textColor: string } {
  const choiceValue = readChoiceCellValue(row, options.eventStatusColId)
  if (!choiceValue) return defaultEventBarStyle()

  const choiceStyle = options.eventStatusChoiceStyles.get(choiceValue)
  if (!choiceStyle?.fillColor && !choiceStyle?.textColor) {
    return defaultEventBarStyle()
  }

  const fillColor = choiceStyle.fillColor ?? DEFAULT_EVENT_BAR_FILL
  const textColor =
    choiceStyle.textColor ??
    textColorForBackground(fillColor)

  return { fillColor, textColor }
}

/** Fallback when a choice defines fillColor but not textColor. */
export function textColorForBackground(background: string): string {
  const rgb = parseCssColorToRgb(background)
  if (!rgb) return DEFAULT_EVENT_BAR_TEXT

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.62 ? "#0f172a" : DEFAULT_EVENT_BAR_TEXT
}

function parseCssColorToRgb(color: string): { r: number; g: number; b: number } | null {
  if (color.startsWith("#")) {
    const hex = color.slice(1)
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0]! + hex[0], 16),
        g: Number.parseInt(hex[1]! + hex[1], 16),
        b: Number.parseInt(hex[2]! + hex[2], 16),
      }
    }
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      }
    }
  }
  return null
}
