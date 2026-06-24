# PO Time Balance Dashboard

Local dashboard for tracking monthly invoice hours [h] against yearly purchase order budgets and people capacity.

## Open

Open `index.html` in a browser.

No build step or server is required.

## Test

Run the logic test suite with Node:

```powershell
node --test tests/logic.test.js
```

## Data

- Dashboard data is saved in browser local storage.
- The report name is saved with the dashboard, updates the browser title, appears in print output, and is used as the export file prefix.
- Use `Export` to save a JSON backup. Supported browsers open a file save dialog; other browsers download the file automatically.
- Exported files are named with the report name when present, plus a timestamp, for example `client-q3-plan-2026-06-22_13-48-20.json`.
- Use `Import` to load a JSON backup.
- Panel collapse state, collapsed people rows, PO graph filters, and selected graph type are saved with the rest of the dashboard state.
- Use `Print` to print a landscape report. Print mode temporarily expands collapsed sections and adds one graph page per PO, then restores the previous screen layout.
- `Reset demo` restores the sample 4 PO / 20 person dataset.

## Model

- Each PO has an annual budget plus active start and end dates. Pace target spreads that PO budget across the active project period, including partial start/end months.
- Monthly invoice cells outside a PO's active period are inactive and excluded from totals.
- Monthly invoice rows have an invoiced checkbox. PO status, pace target, invoiced-to-date totals, and forecast use only checked months.
- Forecast projects the active PO period from the run rate of checked invoiced months. Unchecked months can still hold draft values, but they do not affect PO status.
- PO Graphs [h] can be expanded, filtered by PO, and switched between Monthly hours, Burndown, Cumulative, Forecast cone, and Health matrix. Monthly hours keeps the entered monthly hours [h] view with dashed budget pace. Burndown starts at each PO's annual budget on its start date and subtracts entered monthly hours over time. Cumulative compares cumulative entered hours with cumulative planned budget. Forecast cone uses checked invoiced months to project the run-rate forecast against the budget tolerance range. Health matrix plots elapsed active period against consumed budget, with bubble size reflecting forecast risk. Uninvoiced months are shaded where the graph has a time axis.
- Default annual hours [h], PTO [d], sick days [d], and holidays [d] in the top settings strip are copied into each newly added person. Extra leave [d] is tracked per person and starts at `0`.
- Each person can have multiple engagements. Every engagement has team, PO, start date, end date, and FTE.
- Engagement capacity starts with entered annual hours [h], then prorates by the exact engagement date range divided by 12 and by FTE. PO capacity clips the engagement to the PO's exact active date range.
- When capacity basis subtracts absence, PTO [d], sick days [d], holidays [d], and extra leave [d] are also prorated by the same engagement date range and FTE before subtraction. For example, a 0.4 FTE full-year engagement subtracts each absence day as `8 * 0.4` hours [h] when daily hours [h] are `8`.
- Risk signals flag PO overflow/underflow, missing portfolio capacity, unassigned people, and engagement overlaps above 1 FTE.
