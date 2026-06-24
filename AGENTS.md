# AGENTS.md

## Scope

These instructions apply to the entire repository.

This is a dependency-free static dashboard for tracking purchase order budget hours, monthly invoice hours, forecasts, and people capacity. The app is opened directly from `index.html`; there is no build step, package manager, or local server requirement.

## Repository Map

- `index.html`: document shell and static section structure.
- `styles.css`: all screen, responsive, and print styling.
- `state.js`: shared constants, default/demo state, state normalization, date normalization helpers, and persistence.
- `calculations.js`: hour formatting, PO budget math, forecast/status logic, and capacity calculations.
- `charts.js`: PO graph controls, chart legends, SVG chart rendering, and print graph page rendering.
- `io.js`: export/import helpers, print layout flow, reset behavior, and HTML escaping helpers.
- `render.js`: screen rendering for settings, overview, PO/monthly/people/team sections, and details expansion state.
- `app.js`: controller/bootstrap code, form event handling, commands, add/delete actions, and initial render.
- `README.md`: user-facing behavior and data model notes.

## Core Product Rules

Preserve these behaviors unless the user explicitly asks to change the model:

- Dashboard data is stored in browser `localStorage` under `po-time-balance-dashboard-v1`.
- Import/export uses JSON backups of the app state.
- A PO has an annual budget plus active start/end dates.
- Monthly invoice cells outside a PO active period are inactive and excluded from totals.
- PO status, pace target, invoiced-to-date totals, and forecast use checked invoiced months only.
- Unchecked months may contain draft hours, but those draft values must not affect PO status.
- Forecast projects the active PO period from the run rate of checked invoiced months.
- Engagement capacity is prorated by exact engagement date range and FTE.
- PO capacity clips each engagement to that PO's active date range.
- When capacity basis is `subtractAbsence`, PTO, sick days, holidays, and extra leave are prorated by engagement range and FTE before subtraction.
- Keep hour labels as `[h]` and day labels as `[d]`.

## Development Guidelines

- Keep the app static and dependency-free unless the user explicitly asks for tooling or framework migration.
- Prefer focused changes in the existing plain JavaScript/CSS style over broad rewrites.
- Treat imported JSON and `localStorage` data as untrusted; normalize and clamp values before use.
- Preserve backward compatibility for saved dashboards where practical. If persisted shape changes, update `normalizeState`, import behavior, and `README.md`.
- Escape any user-controlled text before inserting it into HTML with `escapeHtml` or `escapeAttr`.
- Do not add remote assets, CDNs, analytics, or network calls without explicit user approval.
- Keep print behavior working when editing layout or chart sections.
- Avoid changing demo data unless the task is about examples, defaults, or onboarding.

## High-Risk Areas

Be especially careful when editing:

- Date math: `activeMonthWeight`, `activePeriodWeightForRange`, PO date normalization, and engagement date normalization.
- Forecast and status: `forecastForPo`, `poPaceTarget`, `statusFor`, and checked-month handling.
- Capacity math: `engagementCountedMonths`, `engagementGrossCapacity`, `engagementCapacityForPo`, and `engagementAbsenceHours`.
- Import/export and persistence: `normalizeState`, `saveState`, `exportData`, and `importData`.
- Print flow: `preparePrintLayout`, `restorePrintLayout`, `renderPrintPoGraphs`, and `@media print` styles.
- Dynamic HTML rendering: keep escaping intact and avoid introducing unsanitized `innerHTML`.

## Validation

Run these after JavaScript changes:

```powershell
node --check state.js
node --check calculations.js
node --check charts.js
node --check io.js
node --check render.js
node --check app.js
```

For load-order syntax validation, concatenate the scripts in the same order used by `index.html`: `state.js`, `calculations.js`, `charts.js`, `io.js`, `render.js`, then `app.js`.

For HTML/CSS-only changes, inspect `index.html` directly in a browser when possible. For UI changes, check at least:

- Desktop width with the demo data.
- Mobile-width responsive layout.
- Monthly invoice table horizontal scrolling.
- PO graph controls and chart rendering.
- Print preview or print stylesheet behavior when relevant.
- Import/export if persistence or normalization changed.

There is currently no automated test suite. If you add one, keep it lightweight and focused on the calculation functions first.

## Git And File Hygiene

- Check the working tree before editing and do not overwrite user changes.
- Keep edits scoped to the user's request.
- Do not commit unless the user asks.
- Do not run destructive git commands such as `reset --hard` or checkout-based reverts unless explicitly requested.
- Use ASCII in new content unless a file already requires otherwise.
