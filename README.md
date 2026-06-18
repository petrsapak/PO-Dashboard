# PO Time Balance Dashboard

Local dashboard for tracking monthly invoice hours [h] against yearly purchase order budgets and people capacity.

## Open

Open `index.html` in a browser.

## Data

- Dashboard data is saved in browser local storage.
- Use `Export` to download a JSON backup.
- Use `Import` to load a JSON backup.
- `Reset demo` restores the sample 4 PO / 20 person dataset.

## Model

- Each PO has an annual budget plus active start and end months. Pace target spreads that PO budget only across active months.
- Monthly invoice cells outside a PO's active period are inactive and excluded from totals.
- Monthly invoice rows have an invoiced checkbox. PO status, pace target, invoiced-to-date totals, and forecast use only checked months.
- Forecast projects the active PO period from the run rate of checked invoiced months. Unchecked months can still hold draft values, but they do not affect PO status.
- PO Graphs [h] can be expanded and filtered by PO. Solid lines show entered monthly hours [h], dashed lines show each PO's monthly budget pace, and uninvoiced months are shaded.
- Default annual hours [h], PTO [d], sick days [d], and holidays [d] in the top settings strip are copied into each newly added person. Extra leave [d] is tracked per person and starts at `0`.
- Each person can have multiple engagements. Every engagement has team, PO, start month, end month, and FTE.
- Engagement capacity starts with entered annual hours [h], then prorates by active months divided by 12 and by FTE. PO capacity clips the engagement to the PO's active month range.
- When capacity basis subtracts absence, PTO [d], sick days [d], holidays [d], and extra leave [d] are also prorated by the same engagement months and FTE before subtraction. For example, a 0.4 FTE full-year engagement subtracts each absence day as `8 * 0.4` hours [h] when daily hours [h] are `8`.
- Risk signals flag PO overflow/underflow, missing portfolio capacity, unassigned people, and engagement overlaps above 1 FTE.
