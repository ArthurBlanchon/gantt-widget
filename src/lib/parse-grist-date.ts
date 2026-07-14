const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Grist Date columns store calendar days as UTC midnight — map to local midnight. */
function gristDateToLocalCalendar(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** DateTime values — map the instant to a local calendar day. */
function instantToLocalCalendar(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Convert a local calendar day back to Grist's UTC-midnight Date wire value. */
export function formatGristDateForWrite(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function parseToDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1000 : value)
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : new Date(parsed)
  }
  if (
    Array.isArray(value) &&
    (value[0] === "d" || value[0] === "D") &&
    typeof value[1] === "number"
  ) {
    return new Date(value[1] * 1000)
  }
  return null
}

function normalizeGristDate(parsed: Date, source: unknown): Date {
  if (
    Array.isArray(source) &&
    source[0] === "D" &&
    typeof source[1] === "number"
  ) {
    return instantToLocalCalendar(parsed)
  }
  if (typeof source === "string" && !DATE_ONLY_RE.test(source.trim())) {
    return instantToLocalCalendar(parsed)
  }
  return gristDateToLocalCalendar(parsed)
}

/** Normalize Grist Date / DateTime cell values to a local calendar `Date`, or `null` when invalid. */
export function parseGristDate(value: unknown): Date | null {
  const parsed = parseToDate(value)
  if (!parsed) return null
  return normalizeGristDate(parsed, value)
}
