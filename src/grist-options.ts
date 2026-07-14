import type { UseGristOptions } from "grist-widget-sdk"

export const GRIST_OPTIONS: UseGristOptions = {
  requiredAccess: "full",
  columns: [
    {
      name: "Group_name",
      type: "Text,Ref,Choice",
      description:
        "Sidebar section title. When mapped to Choice, group accents use option fill colors.",
    },
    {
      name: "Sequence_name",
      type: "Text,Ref",
      description:
        "Events with the same sequence share one timeline row within a group.",
    },
    { name: "Event_name", type: "Text" },
    { name: "Event_start_date", type: "Date" },
    { name: "Event_end_date", type: "Date" },
    {
      name: "Event_status_color",
      type: "Choice",
      optional: true,
      description:
        "Optional status Choice — timeline bar colors follow each option's Grist fill color.",
    },
  ],
  suppressAlerts: ["section-not-linked"],
}
