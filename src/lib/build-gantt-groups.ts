import type { GanttFeature, GanttStatus } from "@/components/kibo-ui/gantt"
import type { GristRowRecord } from "grist-widget-sdk"

import {
  resolveEventBarStyle,
  resolveGroupColor,
  type ChoiceStyle,
} from "./grist-colors"
import { computeSequenceSubRowCount } from "./gantt-row-layout"
import { parseGristDate } from "./parse-grist-date"
import { resolveLabeledField } from "./resolve-group"

const UNGROUPED_SEQUENCE_LABEL = "(ungrouped sequence)"

export type GanttSequence = {
  id: string
  name: string
  /** Timeline row count when overlapping events stack on sub-rows. */
  rowCount: number
  features: GanttFeature[]
  sidebarFeature: GanttFeature
}

export type GanttTopLevelGroup = {
  id: string
  name: string
  status: GanttStatus
  sequences: GanttSequence[]
}

export type GanttColumnIds = {
  groupName: string
  sequence: string
  name: string
  start: string
  end: string
  eventStatusColor?: string
}

export type GanttColorContext = {
  groupChoiceStyles: Map<string, ChoiceStyle>
  eventStatusChoiceStyles: Map<string, ChoiceStyle>
}

function asString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

function statusFromStyle(
  id: string,
  name: string,
  style: { fillColor: string; textColor?: string },
): GanttStatus {
  return {
    id,
    name,
    color: style.fillColor,
    textColor: style.textColor,
  }
}

function normalizeEndDate(startAt: Date, endAt: Date): Date {
  return endAt.getTime() < startAt.getTime() ? startAt : endAt
}

function featureDateSpan(features: GanttFeature[]): {
  startAt: Date
  endAt: Date
} {
  const startAt = features.reduce(
    (min, feature) =>
      feature.startAt.getTime() < min.getTime() ? feature.startAt : min,
    features[0]!.startAt,
  )
  const endAt = features.reduce(
    (max, feature) =>
      feature.endAt.getTime() > max.getTime() ? feature.endAt : max,
    features[0]!.endAt,
  )
  return { startAt, endAt }
}

export function buildGanttGroups(
  rows: readonly GristRowRecord[],
  colIds: GanttColumnIds,
  colorContext: GanttColorContext = {
    groupChoiceStyles: new Map(),
    eventStatusChoiceStyles: new Map(),
  },
): GanttTopLevelGroup[] {
  const byGroup = new Map<
    string,
    {
      label: string
      order: number
      color?: string
      sequences: Map<
        string,
        { label: string; order: number; features: GanttFeature[] }
      >
    }
  >()
  let groupOrder = 0

  for (const row of rows) {
    const rowId = row.id
    if (typeof rowId !== "number") continue

    const { key: groupKey, label: groupLabel } = resolveLabeledField(
      row,
      colIds.groupName,
    )
    const { key: sequenceKey, label: sequenceLabel } = resolveLabeledField(
      row,
      colIds.sequence,
      UNGROUPED_SEQUENCE_LABEL,
    )
    const eventName = asString(row[colIds.name]) || "(untitled event)"
    const startAt = parseGristDate(row[colIds.start])
    const endAtRaw = parseGristDate(row[colIds.end])
    if (!startAt || !endAtRaw) continue

    const endAt = normalizeEndDate(startAt, endAtRaw)

    let groupBucket = byGroup.get(groupKey)
    if (!groupBucket) {
      groupBucket = {
        label: groupLabel,
        order: groupOrder++,
        sequences: new Map(),
      }
      byGroup.set(groupKey, groupBucket)
    }

    const groupIndex = groupBucket.order
    const groupChoiceValue = asString(row[colIds.groupName]) || undefined
    const groupColor =
      groupBucket.color ??
      resolveGroupColor({
        groupLabel,
        groupValue: groupChoiceValue,
        groupIndex,
        groupChoiceStyles: colorContext.groupChoiceStyles,
      })
    groupBucket.color = groupColor

    let sequenceBucket = groupBucket.sequences.get(sequenceKey)
    if (!sequenceBucket) {
      sequenceBucket = {
        label: sequenceLabel,
        order: groupBucket.sequences.size,
        features: [],
      }
      groupBucket.sequences.set(sequenceKey, sequenceBucket)
    }

    const eventStyle = resolveEventBarStyle(row, {
      eventStatusColId: colIds.eventStatusColor,
      eventStatusChoiceStyles: colorContext.eventStatusChoiceStyles,
    })

    sequenceBucket.features.push({
      id: String(rowId),
      name: eventName,
      startAt,
      endAt,
      status: statusFromStyle(String(rowId), eventName, eventStyle),
      lane: `${groupKey}::${sequenceKey}`,
    })
  }

  return [...byGroup.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([groupKey, groupBucket], groupIndex) => {
      const name = groupBucket.label
      const groupColor =
        groupBucket.color ??
        resolveGroupColor({
          groupLabel: name,
          groupIndex,
          groupChoiceStyles: colorContext.groupChoiceStyles,
        })
      const groupStatus = statusFromStyle(`group-${groupIndex}`, name, {
        fillColor: groupColor,
      })

      const sequences = [...groupBucket.sequences.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([sequenceKey, sequenceBucket], sequenceIndex) => {
          const features = [...sequenceBucket.features].sort(
            (a, b) => a.startAt.getTime() - b.startAt.getTime(),
          )
          const sequenceName = sequenceBucket.label
          const { startAt, endAt } = featureDateSpan(features)

          return {
            id: `group-${groupIndex}-seq-${sequenceIndex}-${groupKey}-${sequenceKey}`,
            name: sequenceName,
            rowCount: computeSequenceSubRowCount(features),
            features,
            sidebarFeature: {
              id: `group-${groupIndex}-seq-${sequenceIndex}-${groupKey}-${sequenceKey}`,
              name: sequenceName,
              startAt,
              endAt,
              status: groupStatus,
            },
          }
        })
        .filter((sequence) => sequence.features.length > 0)

      return {
        id: `group-${groupIndex}-${groupKey}`,
        name,
        status: groupStatus,
        sequences,
      }
    })
    .filter((group) => group.sequences.length > 0)
}

/** Flat list of all rendered event ids (for skip counting). */
export function collectRenderedEventIds(
  groups: readonly GanttTopLevelGroup[],
): Set<string> {
  const ids = new Set<string>()
  for (const group of groups) {
    for (const sequence of group.sequences) {
      for (const feature of sequence.features) {
        ids.add(feature.id)
      }
    }
  }
  return ids
}
