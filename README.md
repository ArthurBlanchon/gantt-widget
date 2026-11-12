# gantt-widget

A Grist custom widget: a Gantt timeline of your table's events, grouped into
sections and rows. Each row of the table is an event with a start and an end
date; events with the same `Sequence_name` share a timeline row, and rows
with the same `Group_name` share a section. Bars take their color from a
`Event_status_color` Choice column's own colors in Grist (and section
accents from `Group_name`'s, when it is a Choice).

<!-- install-url:start -->
**Install URL**, to paste into a Grist custom widget's URL field: <https://arthurblanchon.github.io/gantt-widget/latest/>
<!-- install-url:end -->

**Try it:** <https://arthurblanchon.github.io/gantt-widget/latest/demo/>, Grist running in your browser with sample data (nothing is saved).

## In Grist

Add a custom widget, paste the install URL, and set its access level to
**Full document access** (to read the Choice columns' colors).

Then map its columns:

| Column | Type | What it is |
| --- | --- | --- |
| `Group_name` | Text, Ref or Choice | the section |
| `Sequence_name` | Text or Ref | the timeline row |
| `Event_name` | Text | the bar's label |
| `Event_start_date` | Date | start |
| `Event_end_date` | Date | end |
| `Event_status_color` | Choice, optional | the bar's color |

## Code

The widget's own code is in `src/`:

- `src/app/App.tsx` reads the mapped rows with `useGrist()` and the table's
  column settings with `useGristSchema()`, then builds the groups and rows
  (`src/lib/build-gantt-groups.ts`, `src/lib/gantt-row-layout.ts`) and their
  colors (`src/lib/grist-colors.ts`).
- The timeline is the kibo-ui Gantt component, in
  `src/components/kibo-ui/gantt/`.
- `GRIST_OPTIONS` is in `src/grist-options.ts`.

## Develop

Develop on the `dev` branch; every push deploys `/dev/`
(<https://arthurblanchon.github.io/gantt-widget/dev/>), which reloads itself in an
open Grist document a few seconds later.

| | |
| --- | --- |
| Install | `pnpm install` |
| Test (emulated Grist, no browser) | `pnpm test` |
| Lint, type-check, build | `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| The widget in a real local Grist (Docker) | `pnpm demo` |
| Regenerate the demo page | `pnpm demo --save` |

`src/main.tsx` is one `mountGristWidget()` call from `grist-widget-sdk/app`:
inside Grist it renders the widget behind the SDK's connection and
column-mapping screens, with its alerts, in Grist's light or dark theme.
Opened anywhere else, it shows which build this is and the URL to paste into
Grist. The widget's code reads Grist only through `grist-widget-sdk`
([docs](https://gristwidgets.com/docs)), never the `grist` global.

`src/main.tsx`, the workflows and the build config are the template's: they
come from `create-grist-widget`, and `pnpm exec create-grist-widget upgrade`
(run on `dev` after Dependabot updates it) rewrites them
([Upgrading a widget](https://gristwidgets.com/docs/cli/upgrading)).
`AGENTS.md` says which files are which.

## Release

1. On `dev`, bump `package.json`'s `version`.
2. Open a pull request from `dev` into `main`, and merge it once its checks
   are green.

Merging builds `/v<version>/` and updates `/latest/` and their demo pages.
Without a version bump, nothing is published. The deploy workflow and its
one-time repository settings are described in the
[template's README](https://github.com/ArthurBlanchon/grist-widget-template#deployment).
