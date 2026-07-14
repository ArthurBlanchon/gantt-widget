# gantt-widget

A Grist custom widget built with `grist-widget-sdk`: a timeline grouped by
`Group_name` and `Sequence_name`, with bar colors driven by
`Event_status_color` Choice styling.

`src/main.tsx` wraps the app with `GristWidgetProvider`, `GristBoundary`, and `GristSdkAlerts`. The latter maps `getGristSdkAlertDescriptors()` from the SDK to shadcn `Alert` (`src/components/grist-sdk-alerts.tsx` + `src/components/ui/alert.tsx`); keep them in sync with the playground when you change alert styling.

Opened outside a Grist iframe, `main.tsx` picks between two components purely by URL shape (`src/lib/showcase-routing.ts`, no router needed): a bare path with no recognized channel suffix renders `TemplateLanding` (its own hero, onboarding, and released-version index); `/latest/`, `/dev/`, or `/v<version>/` renders `ChannelNotice` instead — a distinct hero explaining which build this is, chips to jump to any other version/channel (`src/lib/showcase-versions.ts`), and a copy-this-URL helper for pasting into Grist's custom widget field.

When actually embedded, `GristStatusChip` (`src/components/grist-status-chip.tsx`) shows a small pill with live handshake status — connecting, retrying with a countdown, connected, or unavailable — using `useGristHandshakeContext()` from `grist-widget-sdk/advanced` in its own `<GristHandshakeProvider>`. Safe to mount alongside `GristWidgetProvider`: both share the page's `ensureGristReady()` singleton (see `apps/docs/api/handshake.md`), so this is purely observational and never duplicates the real handshake.

`src/App.tsx` uses `useGrist()` for the selected table's rows, mapped via `GRIST_OPTIONS` (`src/grist-options.ts`) into groups/sequences/events — see `src/grist-types.ts` for the real column typings and `src/lib/build-gantt-groups.ts` for how rows become the Gantt's group/sequence tree.

- **ESLint** blocks direct `grist` global usage in `src/` — use the SDK only.
- `GRIST_OPTIONS.columns` (in `src/grist-options.ts`) declares the required `Group_name`, `Sequence_name`, `Event_name`, `Event_start_date`, `Event_end_date` columns and the optional `Event_status_color` Choice column; `main.tsx` sets `GristBoundary gate="canRender"` accordingly. Mapping alerts use `GristSdkAlerts`.

To add widget tests later, see [Testing](https://github.com/ArthurBlanchon/grist-widget-sdk/blob/main/apps/docs/guide/testing.md) (`renderWithGrist` from `grist-widget-sdk/emulator/testing`).

## Deployment

A bundled GitHub Actions workflow (`.github/workflows/deploy.yml` +
`scripts/deploy.mjs`) publishes this widget to **your own** GitHub Pages.

### The workflow: always develop on `dev`, release by merging to `main`

1. Commit and push to the `dev` branch (created for you at scaffold time).
   Every push auto-deploys a live preview at `/dev/` that self-reloads
   inside an open Grist document a few seconds later — paste that URL into
   a Grist doc once, then just keep pushing while you iterate.
2. Ready to publish a release? **Bump `package.json`'s `version`** as part
   of your `dev` branch changes, then open a PR from `dev` into `main`.
3. **Merge the PR.** This is the step that actually publishes — merging to
   `main` builds immutable `/v<version>/` and updates mutable `/latest/`.

> ⚠️ **Merging without bumping the version publishes nothing.** The release
> build is idempotent — it skips whenever `package.json`'s version already
> has a matching `v<version>/` directory published, which is always true if
> you forgot to bump it (it'll match whatever's already live). The PR merges
> cleanly and CI runs "successfully," but `/latest/` silently stays exactly
> as it was. Bump the version *before* merging, not after.

After merging, keep committing to the same `dev` branch for your next round
of changes — it's the permanent working/preview branch for this widget, not
a one-off feature branch to delete and recreate. Deleting it retires `/dev/`
automatically.

**One-time setup** (the workflow can't do this part for you):

1. **Settings → Pages** → Source: "Deploy from a branch" → branch `gh-pages`
   → `/ (root)`. The workflow creates the `gh-pages` branch itself the first
   time it runs (if it doesn't exist yet), but Pages needs to be pointed at
   it once.
   > ⚠️ **Not `main`.** If Pages is left on (or accidentally set to) `main`,
   > it serves this repo's raw, unbuilt source — including a script tag
   > pointing at `/src/main.tsx` — instead of the built site. The symptom is
   > a blank/black page with a 404 for `/src/main.tsx` in the browser
   > console, even though the workflow itself reports success (it pushed the
   > right build to `gh-pages`; Pages is just reading from the wrong place).
2. **Settings → Actions → General → Workflow permissions** → "Read and write
   permissions". New repos sometimes default the workflow's token to
   read-only, which would fail the push to `gh-pages` with a 403.
3. If the repo is private, set **Pages visibility to Public** — a widget
   embeds inside a Grist iframe, which needs a publicly reachable URL.

No manifest/widget-catalog file is generated — that's a multi-widget,
Grist-widget-repository concept this single-widget template doesn't need.
Paste your `/latest/` or `/v<version>/` URL directly into Grist's custom
widget URL field.

