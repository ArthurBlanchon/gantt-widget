import { useCallback, useEffect, useMemo, useState } from "react"
import { Calendar, CalendarDays } from "lucide-react"

import {
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttFeatureRow,
  GanttHeader,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
  type GanttFeature,
  type Range,
} from "@/components/kibo-ui/gantt"
import { Button } from "@/components/ui/button"
import {
  buildGanttGroups,
  collectRenderedEventIds,
  type GanttColorContext,
  type GanttTopLevelGroup,
} from "@/lib/build-gantt-groups"
import { formatGristDateForWrite } from "@/lib/parse-grist-date"
import { buildChoiceStyleMap } from "@/lib/grist-colors"
import {
  tableDataToRows,
  useGrist,
  useGristSchema,
  useWidgetMetadata,
  type GristRowRecord,
  type GristWidgetColumnMap,
} from "grist-widget-sdk"

import type { EventMapped, EventRow } from "./grist-types"

export { GRIST_OPTIONS } from "./grist-options"

export const WIDGET_METADATA = {
  title: "Gantt",
  description:
    "Timeline grouped by Group_name and Sequence_name — bar colors from Event_status_color Choice styling.",
} as const

function resolveOptionalMappedColumnId(
  mappings: GristWidgetColumnMap | null,
  logicalName: string,
): string | undefined {
  const value = mappings?.[logicalName]
  if (typeof value === "string" && value) return value
  return undefined
}

function StatusPanel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="text-muted-foreground flex h-svh items-center justify-center p-6 text-sm">
      <div className="max-w-md space-y-2 text-center">
        <p className="text-foreground font-medium">{title}</p>
        {body ? <p className="text-xs leading-relaxed">{body}</p> : null}
      </div>
    </div>
  )
}

function EventBar({ feature }: { feature: GanttFeature }) {
  return <p className="min-w-0 flex-1 truncate text-xs">{feature.name}</p>
}

export function App() {
  useWidgetMetadata(WIDGET_METADATA)
  const w = useGrist<EventRow, EventMapped>()
  const { fetchSelectedTable } = w

  const schema = useGristSchema({
    requiredAccess: "read table",
    tableId: w.currentTableId ?? undefined,
    replicaRowMode: "schema-only",
  })

  const groupColId = w.resolveMappedColumnId("Group_name")
  const sequenceColId = w.resolveMappedColumnId("Sequence_name")
  const nameColId = w.resolveMappedColumnId("Event_name")
  const startColId = w.resolveMappedColumnId("Event_start_date")
  const endColId = w.resolveMappedColumnId("Event_end_date")
  const eventStatusColId = resolveOptionalMappedColumnId(
    w.mappings,
    "Event_status_color",
  )

  const colorContext = useMemo<GanttColorContext>(() => {
    const table =
      schema.table ??
      (w.currentTableId
        ? schema.document?.tables?.[w.currentTableId]
        : undefined)
    return {
      groupChoiceStyles: buildChoiceStyleMap(table, groupColId),
      eventStatusChoiceStyles: buildChoiceStyleMap(table, eventStatusColId),
    }
  }, [schema.table, schema.document, w.currentTableId, groupColId, eventStatusColId])

  const [fallbackRows, setFallbackRows] = useState<
    readonly GristRowRecord[] | null
  >(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetchingFallback, setFetchingFallback] = useState(false)
  const [timeScale, setTimeScale] = useState<Extract<Range, "monthly" | "weekly">>(
    "weekly",
  )

  const colIds = useMemo(() => {
    if (
      !groupColId ||
      !sequenceColId ||
      !nameColId ||
      !startColId ||
      !endColId
    ) {
      return null
    }
    return {
      groupName: groupColId,
      sequence: sequenceColId,
      name: nameColId,
      start: startColId,
      end: endColId,
      eventStatusColor: eventStatusColId,
    }
  }, [
    groupColId,
    sequenceColId,
    nameColId,
    startColId,
    endColId,
    eventStatusColId,
  ])

  const groupsFromRecords = useMemo<GanttTopLevelGroup[] | null>(() => {
    if (!w.columnMappingStatus.ok || !colIds || w.records == null) return null
    return buildGanttGroups(w.records, colIds, colorContext)
  }, [w.columnMappingStatus.ok, w.records, colIds, colorContext])

  const shouldFetchFallback =
    w.isReady &&
    w.columnMappingStatus.ok &&
    Boolean(colIds) &&
    w.records == null

  useEffect(() => {
    if (!shouldFetchFallback || !colIds) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setFetchingFallback(true)
      setLoadError(null)

      try {
        const columnar = await fetchSelectedTable()
        if (cancelled) return
        setFallbackRows(tableDataToRows(columnar))
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err))
          setFallbackRows(null)
        }
      } finally {
        if (!cancelled) setFetchingFallback(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [shouldFetchFallback, fetchSelectedTable, colIds])

  const activeFallbackRows = shouldFetchFallback ? fallbackRows : null
  const activeLoadError = shouldFetchFallback ? loadError : null
  const activeFetchingFallback = shouldFetchFallback ? fetchingFallback : false

  const groups = useMemo(
    () =>
      groupsFromRecords ??
      (activeFallbackRows && colIds
        ? buildGanttGroups(activeFallbackRows, colIds, colorContext)
        : []),
    [groupsFromRecords, activeFallbackRows, colIds, colorContext],
  )

  const loading =
    w.isReady &&
    w.columnMappingStatus.ok &&
    groupsFromRecords == null &&
    activeFallbackRows == null &&
    !activeLoadError &&
    (w.records == null || activeFetchingFallback)

  const skippedCount = useMemo(() => {
    const rows = w.records ?? activeFallbackRows
    if (!rows || !colIds) return 0
    const validIds = collectRenderedEventIds(groups)
    return rows.filter(
      (row) => typeof row.id === "number" && !validIds.has(String(row.id)),
    ).length
  }, [w.records, activeFallbackRows, colIds, groups])

  const handleMove = useCallback(
    async (id: string, startAt: Date, endAt: Date | null) => {
      if (!endAt) return
      const rowId = Number(id)
      if (!Number.isFinite(rowId)) return

      await w.table.update({
        id: rowId,
        fields: w.mapBack({
          Event_start_date: formatGristDateForWrite(startAt),
          Event_end_date: formatGristDateForWrite(endAt),
        }),
      })
    },
    [w],
  )

  const stats = useMemo(() => {
    let events = 0
    let sequences = 0
    for (const group of groups) {
      sequences += group.sequences.length
      for (const sequence of group.sequences) {
        events += sequence.features.length
      }
    }
    return { events, groups: groups.length, sequences }
  }, [groups])

  if (w.status === "booting") {
    return <StatusPanel title="Connecting to Grist…" />
  }

  if (!w.columnMappingStatus.ok && !w.columnMappingStatus.pending) {
    return (
      <StatusPanel
        title="Map columns in the widget panel"
        body={`Required: Group_name (Text, Ref, or Choice), Sequence_name, Event_name, Event_start_date, Event_end_date. Optional: Event_status_color (Choice). Missing: ${w.columnMappingStatus.missing.join(", ")}`}
      />
    )
  }

  if (activeLoadError) {
    return (
      <StatusPanel title="Could not load table data" body={activeLoadError} />
    )
  }

  if (loading) {
    return <StatusPanel title="Loading events…" />
  }

  if (groups.length === 0) {
    return (
      <StatusPanel
        title="No events to display"
        body="Add rows with Event_name, Event_start_date, and Event_end_date. Rows missing dates are skipped."
      />
    )
  }

  return (
    <div className="flex h-svh min-h-80 flex-col">
      <header className="border-border flex shrink-0 items-center justify-between gap-4 border-b px-4 py-2 text-sm">
        <div>
          <h1 className="font-medium">Gantt</h1>
          <p className="text-muted-foreground text-xs">
            {stats.events} event{stats.events === 1 ? "" : "s"} ·{" "}
            {stats.sequences} sequence{stats.sequences === 1 ? "" : "s"} ·{" "}
            {stats.groups} group{stats.groups === 1 ? "" : "s"}
            {skippedCount > 0
              ? ` · ${skippedCount} row${skippedCount === 1 ? "" : "s"} skipped (missing dates)`
              : ""}
          </p>
        </div>
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
          role="group"
          aria-label="Timeline scale"
        >
          <Button
            type="button"
            variant={timeScale === "monthly" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-pressed={timeScale === "monthly"}
            title="Monthly scale"
            onClick={() => setTimeScale("monthly")}
          >
            <Calendar aria-hidden />
            <span className="sr-only">Monthly scale</span>
          </Button>
          <Button
            type="button"
            variant={timeScale === "weekly" ? "secondary" : "ghost"}
            size="icon-sm"
            aria-pressed={timeScale === "weekly"}
            title="Weekly scale"
            onClick={() => setTimeScale("weekly")}
          >
            <CalendarDays aria-hidden />
            <span className="sr-only">Weekly scale</span>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 p-2">
        <GanttProvider
          key={timeScale}
          className="h-full"
          range={timeScale}
        >
          <GanttSidebar>
            {groups.map((group) => (
              <GanttSidebarGroup key={group.id} name={group.name}>
                {group.sequences.map((sequence, sequenceIndex) => (
                  <GanttSidebarItem
                    key={sequence.id}
                    feature={sequence.sidebarFeature}
                    rowCount={sequence.rowCount}
                    showTopDivider={sequenceIndex > 0}
                  />
                ))}
              </GanttSidebarGroup>
            ))}
          </GanttSidebar>
          <GanttTimeline>
            <GanttHeader />
            <GanttFeatureList>
              {groups.map((group) => (
                <GanttFeatureListGroup key={group.id}>
                  {group.sequences.map((sequence, sequenceIndex) => (
                    <GanttFeatureRow
                      key={sequence.id}
                      features={sequence.features}
                      onMove={handleMove}
                      showTopDivider={sequenceIndex > 0}
                    >
                      {(feature) => <EventBar feature={feature} />}
                    </GanttFeatureRow>
                  ))}
                </GanttFeatureListGroup>
              ))}
            </GanttFeatureList>
            <GanttToday />
          </GanttTimeline>
        </GanttProvider>
      </div>
    </div>
  )
}

export default App
