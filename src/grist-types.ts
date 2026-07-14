/** Raw section row (real column ids from Grist). */
export type EventRow = {
  id: number
  [key: string]: unknown
}

/** Logical names after column mapping (matches `columns[].name`). */
export type EventMapped = {
  Group_name: string
  Sequence_name: string
  Event_name: string
  Event_start_date: Date | null
  Event_end_date: Date | null
  Event_status_color?: string | null
}
