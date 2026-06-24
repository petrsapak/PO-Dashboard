"use strict";

function selectedChartPoIds() {
  const validPoIds = new Set(state.pos.map((po) => po.id));
  state.ui.visibleChartPoIds = normalizeKeyList(state.ui.visibleChartPoIds).filter((id) =>
    validPoIds.has(id)
  );
  return state.ui.visibleChartPoIds;
}

function currentChartType() {
  state.ui.chartType = normalizeChartType(state.ui.chartType);
  return state.ui.chartType;
}

function chartCaption(chartType) {
  if (chartType === "burndown") {
    return "Solid lines show remaining hours after entered monthly hours. Dashed lines show planned remaining budget. Uninvoiced months are shaded.";
  }

  if (chartType === "cumulative") {
    return "Solid lines show cumulative entered hours. Dashed lines show cumulative planned budget. Uninvoiced months are shaded.";
  }

  if (chartType === "forecast") {
    return "Solid lines show cumulative invoiced hours. Dashed projection lines show current run-rate forecast, and shaded cones show the budget tolerance range at PO end.";
  }

  if (chartType === "health") {
    return "Each bubble is a selected PO. X shows active period elapsed, Y shows budget consumed, and bubble size reflects forecast risk.";
  }

  return "Solid lines show monthly hours [h]. Dashed lines show each selected PO's monthly budget pace. Uninvoiced months are shaded.";
}

function renderChartLegend(selectedPos, chartType) {
  return `
    <div class="chart-legend">
      ${selectedPos
        .map((po) => {
          const metrics = chartLegendMetrics(po, chartType);

          return `
            <div class="chart-legend-item">
              <span class="swatch" style="background:${escapeAttr(po.color)}"></span>
              <span class="chart-legend-name">${escapeHtml(po.name)}</span>
              ${metrics.map((metric) => `<span>${escapeHtml(metric)}</span>`).join("")}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function chartLegendMetrics(po, chartType) {
  if (chartType === "burndown") {
    return [
      `${formatHoursWithUnit(poEnteredActiveHours(po))} spent`,
      `${formatHoursWithUnit(poRemainingHours(po))} remaining`,
      `${formatHoursWithUnit(po.annualHours - poPaceTarget(po))} pace remaining`
    ];
  }

  if (chartType === "cumulative") {
    const entered = poEnteredActiveHours(po);
    return [
      `${formatHoursWithUnit(entered)} entered`,
      `${formatHoursWithUnit(po.annualHours)} budget`,
      `${signedHours(entered - po.annualHours)} vs budget`
    ];
  }

  if (chartType === "forecast") {
    const forecast = forecastForPo(po.id);
    return [
      `${formatHoursWithUnit(poInvoicedHours(po))} invoiced`,
      `${formatHoursWithUnit(forecast)} forecast`,
      `${signedHours(forecast - po.annualHours)} vs budget`
    ];
  }

  if (chartType === "health") {
    const elapsed = poElapsedRatio(po);
    const consumed = poConsumedRatio(po);
    return [
      `${percentNumber.format(elapsed * 100)}% elapsed`,
      `${percentNumber.format(consumed * 100)}% consumed`,
      `${signedHours(forecastForPo(po.id) - po.annualHours)} forecast risk`
    ];
  }

  return [
    `${formatHoursWithUnit(poInvoicedHours(po))} invoiced`,
    `${formatHoursWithUnit(forecastForPo(po.id))} forecast`
  ];
}

function renderPoChart() {
  const container = document.getElementById("po-chart");
  if (!container) {
    return;
  }

  const chartType = currentChartType();
  const selectedIds = selectedChartPoIds();
  const selectedIdSet = new Set(selectedIds);
  const selectedPos = state.pos.filter((po) => selectedIdSet.has(po.id));
  const typeSelector = chartTypes
    .map(
      (type) => `
        <label class="chart-type-option${chartType === type.key ? " selected" : ""}">
          <input type="radio" name="po-chart-type" data-chart-type="${escapeAttr(type.key)}"${chartType === type.key ? " checked" : ""}>
          <span>${escapeHtml(type.label)}</span>
        </label>
      `
    )
    .join("");
  const selector = state.pos
    .map(
      (po) => `
        <label class="chart-toggle">
          <input type="checkbox" data-chart-po-id="${escapeAttr(po.id)}"${selectedIdSet.has(po.id) ? " checked" : ""}>
          <span class="swatch" style="background:${escapeAttr(po.color)}"></span>
          <span>${escapeHtml(po.name)}</span>
        </label>
      `
    )
    .join("");

  const chart = selectedPos.length
    ? renderPoChartSvg(selectedPos, chartType)
    : '<div class="empty-state">Select at least one PO to display the graph.</div>';
  const legend = selectedPos.length ? renderChartLegend(selectedPos, chartType) : "";

  container.innerHTML = `
    <div class="chart-controls">
      <div class="chart-control-stack">
        <div class="chart-type-selector" aria-label="Graph type">${typeSelector}</div>
        <div class="chart-selector" aria-label="Displayed POs">${selector}</div>
      </div>
      <div class="chart-actions">
        <button class="secondary small-button" type="button" data-command="chart-select-all">All</button>
        <button class="secondary small-button" type="button" data-command="chart-clear">None</button>
      </div>
    </div>
    <div class="chart-frame">
      ${chart}
    </div>
    <div class="chart-caption">${escapeHtml(chartCaption(chartType))}</div>
    ${legend}
  `;
}

function renderPrintPoGraphs() {
  const existing = document.getElementById("print-graph-pages");
  if (existing) {
    existing.remove();
  }

  const poGraphSection = document.querySelector('[data-section-key="po-graphs"]');
  if (!poGraphSection || !state.pos.length) {
    return;
  }

  const container = document.createElement("section");
  container.id = "print-graph-pages";
  container.className = "print-graph-pages";
  container.setAttribute("aria-label", "Individual PO graph print pages");
  container.innerHTML = state.pos.map((po) => renderPrintPoGraphPage(po)).join("");
  poGraphSection.insertAdjacentElement("afterend", container);
}

function renderPrintPoGraphPage(po) {
  const chartType = currentChartType();
  const meta = printGraphMeta(po, chartType);
  const subtitle = printGraphSubtitle(chartType);

  return `
    <article class="panel print-graph-page">
      <header class="panel-header print-graph-header">
        <div class="summary-text">
          <h2>${escapeHtml(po.name)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </header>
      <div class="print-graph-meta">
        ${meta
          .map(
            ([label, value]) => `
              <div>
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
      <div class="chart-frame print-chart-frame">
        ${renderPoChartSvg([po], chartType)}
      </div>
      <div class="chart-caption print-chart-caption">
        ${escapeHtml(chartCaption(chartType))}
      </div>
    </article>
  `;
}

function printGraphMeta(po, chartType) {
  if (chartType === "burndown") {
    return [
      ["Active period", poPeriodLabel(po)],
      ["Annual budget", formatHoursWithUnit(po.annualHours)],
      ["Spent entered", formatHoursWithUnit(poEnteredActiveHours(po))],
      ["Remaining", formatHoursWithUnit(poRemainingHours(po))],
      ["Pace remaining", formatHoursWithUnit(po.annualHours - poPaceTarget(po))]
    ];
  }

  if (chartType === "cumulative") {
    const entered = poEnteredActiveHours(po);
    return [
      ["Active period", poPeriodLabel(po)],
      ["Annual budget", formatHoursWithUnit(po.annualHours)],
      ["Entered", formatHoursWithUnit(entered)],
      ["Actual delta", signedHours(entered - po.annualHours)],
      ["Invoiced", formatHoursWithUnit(poInvoicedHours(po))]
    ];
  }

  if (chartType === "forecast") {
    const forecast = forecastForPo(po.id);
    return [
      ["Active period", poPeriodLabel(po)],
      ["Invoiced", formatHoursWithUnit(poInvoicedHours(po))],
      ["Forecast", formatHoursWithUnit(forecast)],
      ["Budget delta", signedHours(forecast - po.annualHours)],
      ["Tolerance", `+/- ${formatHoursWithUnit(po.annualHours * (state.settings.tolerancePct / 100))}`]
    ];
  }

  if (chartType === "health") {
    return [
      ["Active period", poPeriodLabel(po)],
      ["Elapsed", `${percentNumber.format(poElapsedRatio(po) * 100)}%`],
      ["Consumed", `${percentNumber.format(poConsumedRatio(po) * 100)}%`],
      ["Forecast", formatHoursWithUnit(forecastForPo(po.id))],
      ["Risk", signedHours(forecastForPo(po.id) - po.annualHours)]
    ];
  }

  const activeMonths = activePeriodWeight(po);
  const monthlyPace = activeMonths ? po.annualHours / activeMonths : 0;
  return [
    ["Active period", poPeriodLabel(po)],
    ["Annual budget", formatHoursWithUnit(po.annualHours)],
    ["Monthly pace", formatHoursWithUnit(monthlyPace)],
    ["Invoiced", formatHoursWithUnit(poInvoicedHours(po))],
    ["Forecast", formatHoursWithUnit(forecastForPo(po.id))]
  ];
}

function printGraphSubtitle(chartType) {
  if (chartType === "burndown") {
    return "Remaining budget from PO start date";
  }
  if (chartType === "cumulative") {
    return "Cumulative actual hours against planned budget";
  }
  if (chartType === "forecast") {
    return "Cumulative invoices, run-rate forecast, and tolerance range";
  }
  if (chartType === "health") {
    return "Budget consumed versus active period elapsed";
  }

  return "Monthly invoice hours [h], budget pace, and forecast";
}

function renderPoChartSvg(selectedPos, chartType = currentChartType()) {
  const normalizedType = normalizeChartType(chartType);
  if (normalizedType === "burndown") {
    return renderBurndownChartSvg(selectedPos);
  }
  if (normalizedType === "cumulative") {
    return renderCumulativeChartSvg(selectedPos);
  }
  if (normalizedType === "forecast") {
    return renderForecastConeChartSvg(selectedPos);
  }
  if (normalizedType === "health") {
    return renderHealthMatrixChartSvg(selectedPos);
  }

  return renderMonthlyHoursChartSvg(selectedPos);
}

function renderMonthlyHoursChartSvg(selectedPos) {
  const width = 960;
  const height = 360;
  const left = 62;
  const right = 24;
  const top = 26;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const monthStep = plotWidth / 12;
  const xFor = (monthIndex) => left + monthStep * monthIndex + monthStep / 2;
  const activeValues = selectedPos.flatMap((po) =>
    (state.monthlyHours[po.id] || [])
      .filter((_, monthIndex) => isPoActiveInMonth(po, monthIndex))
      .map((value) => numberOr(value, 0))
  );
  const paceValues = selectedPos.flatMap((po) =>
    monthNames
      .map((_, monthIndex) => (isPoActiveInMonth(po, monthIndex) ? monthlyBudgetPace(po, monthIndex) : 0))
      .filter((value) => value > 0)
  );
  const yMax = niceChartMax(Math.max(1, ...activeValues, ...paceValues));
  const yFor = (value) => top + plotHeight - (Math.max(0, value) / yMax) * plotHeight;
  const tickValues = Array.from({ length: 5 }, (_, index) => (yMax * index) / 4);

  const shadedMonths = monthNames
    .map((_, monthIndex) =>
      isInvoicedMonth(monthIndex)
        ? ""
        : `<rect x="${left + monthStep * monthIndex}" y="${top}" width="${monthStep}" height="${plotHeight}" class="chart-shade"></rect>`
    )
    .join("");
  const grid = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line>
        <text class="chart-y-label" x="${left - 8}" y="${y + 4}">${formatHours(value)}</text>
      `;
    })
    .join("");
  const monthLabels = shortMonths
    .map(
      (month, monthIndex) =>
        `<text class="chart-x-label" x="${xFor(monthIndex)}" y="${height - 18}">${month}</text>`
    )
    .join("");
  const targetLines = selectedPos
    .map((po) => {
      if (!activePeriodWeight(po) || po.annualHours <= 0) {
        return "";
      }
      const points = monthNames
        .map((_, monthIndex) =>
          isPoActiveInMonth(po, monthIndex)
            ? {
                x: xFor(monthIndex),
                y: yFor(monthlyBudgetPace(po, monthIndex))
              }
            : null
        )
        .filter(Boolean);

      if (points.length === 1) {
        const point = points[0];
        const halfWidth = monthStep * 0.28;
        return `<line class="chart-target-line" x1="${point.x - halfWidth}" x2="${point.x + halfWidth}" y1="${point.y}" y2="${point.y}" stroke="${escapeAttr(po.color)}"></line>`;
      }

      return `<path class="chart-target-line" d="${chartPath(points)}" stroke="${escapeAttr(po.color)}" fill="none"></path>`;
    })
    .join("");
  const actualLines = selectedPos
    .map((po) => {
      const points = monthNames
        .map((_, monthIndex) =>
          isPoActiveInMonth(po, monthIndex)
            ? {
                x: xFor(monthIndex),
                y: yFor(numberOr(state.monthlyHours[po.id][monthIndex], 0))
              }
            : null
        )
        .filter(Boolean);

      if (points.length < 2) {
        return "";
      }

      return `<path class="chart-line" d="${chartPath(points)}" stroke="${escapeAttr(po.color)}"></path>`;
    })
    .join("");
  const dots = selectedPos
    .map((po) =>
      monthNames
        .map((month, monthIndex) => {
          if (!isPoActiveInMonth(po, monthIndex)) {
            return "";
          }
          const value = numberOr(state.monthlyHours[po.id][monthIndex], 0);
          return `
            <circle class="chart-dot" cx="${xFor(monthIndex)}" cy="${yFor(value)}" r="4" fill="${escapeAttr(po.color)}">
              <title>${escapeHtml(`${po.name}, ${month}: ${formatHoursWithUnit(value)}`)}</title>
            </circle>
          `;
        })
        .join("")
    )
    .join("");

  return `
    <svg class="po-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly PO hours chart">
      ${shadedMonths}
      ${grid}
      <line class="chart-axis-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <line class="chart-axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}"></line>
      <text class="chart-axis-title" x="${left}" y="16">Hours [h]</text>
      ${monthLabels}
      ${targetLines}
      ${actualLines}
      ${dots}
    </svg>
  `;
}

function burndownSeriesPoints(po, planned = false) {
  const points = [{ date: po.startDate, value: po.annualHours }];
  const monthlyHours = state.monthlyHours[po.id] || [];
  let remaining = po.annualHours;

  for (let monthIndex = po.startMonth; monthIndex <= po.endMonth; monthIndex += 1) {
    const pointDate = po.endDate < monthEndDate(state.settings.year, monthIndex)
      ? po.endDate
      : monthEndDate(state.settings.year, monthIndex);
    const spent = planned ? monthlyBudgetPace(po, monthIndex) : numberOr(monthlyHours[monthIndex], 0);
    remaining -= spent;
    points.push({
      date: pointDate,
      value: Math.abs(remaining) < 0.0001 ? 0 : remaining
    });
  }

  return points;
}

function renderBurndownChartSvg(selectedPos) {
  const width = 960;
  const height = 360;
  const left = 68;
  const right = 24;
  const top = 26;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yearStart = yearStartDate(state.settings.year);
  const yearEnd = yearEndDate(state.settings.year);
  const yearStartSerial = dateSerial(yearStart);
  const yearEndSerial = dateSerial(yearEnd);
  const serialSpan = Math.max(1, yearEndSerial - yearStartSerial);
  const xForDate = (value) =>
    left + ((dateSerial(value) - yearStartSerial) / serialSpan) * plotWidth;
  const xForMonth = (monthIndex) =>
    (xForDate(monthStartDate(state.settings.year, monthIndex)) +
      xForDate(monthEndDate(state.settings.year, monthIndex))) /
    2;
  const series = selectedPos.map((po) => ({
    po,
    actual: burndownSeriesPoints(po),
    planned: burndownSeriesPoints(po, true)
  }));
  const values = series.flatMap((entry) =>
    entry.actual.concat(entry.planned).map((point) => point.value)
  );
  const yMax = niceChartMax(Math.max(1, ...values));
  const minValue = Math.min(0, ...values);
  const yMin = minValue < 0 ? -niceChartMax(Math.abs(minValue)) : 0;
  const yRange = Math.max(1, yMax - yMin);
  const yFor = (value) => top + ((yMax - value) / yRange) * plotHeight;
  const tickValues = Array.from({ length: 5 }, (_, index) => yMin + (yRange * index) / 4);

  const shadedMonths = monthNames
    .map((_, monthIndex) => {
      if (isInvoicedMonth(monthIndex)) {
        return "";
      }

      const monthStart = monthStartDate(state.settings.year, monthIndex);
      const monthEnd = monthEndDate(state.settings.year, monthIndex);
      return `<rect x="${xForDate(monthStart)}" y="${top}" width="${xForDate(monthEnd) - xForDate(monthStart)}" height="${plotHeight}" class="chart-shade"></rect>`;
    })
    .join("");
  const grid = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line>
        <text class="chart-y-label" x="${left - 8}" y="${y + 4}">${formatHours(value)}</text>
      `;
    })
    .join("");
  const monthLabels = shortMonths
    .map(
      (month, monthIndex) =>
        `<text class="chart-x-label" x="${xForMonth(monthIndex)}" y="${height - 18}">${month}</text>`
    )
    .join("");
  const plannedLines = series
    .map((entry) => {
      const points = entry.planned.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-target-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}" fill="none"></path>`;
    })
    .join("");
  const actualLines = series
    .map((entry) => {
      const points = entry.actual.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}"></path>`;
    })
    .join("");
  const dots = series
    .map((entry) =>
      entry.actual
        .map((point) => {
          const label = point.date === entry.po.startDate ? "start" : formatShortDate(point.date);
          return `
            <circle class="chart-dot" cx="${xForDate(point.date)}" cy="${yFor(point.value)}" r="4" fill="${escapeAttr(entry.po.color)}">
              <title>${escapeHtml(`${entry.po.name}, ${label}: ${formatHoursWithUnit(point.value)} remaining`)}</title>
            </circle>
          `;
        })
        .join("")
    )
    .join("");

  return `
    <svg class="po-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="PO burndown chart">
      ${shadedMonths}
      ${grid}
      <line class="chart-axis-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <line class="chart-axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}"></line>
      <text class="chart-axis-title" x="${left}" y="16">Remaining [h]</text>
      ${monthLabels}
      ${plannedLines}
      ${actualLines}
      ${dots}
    </svg>
  `;
}

function renderCumulativeChartSvg(selectedPos) {
  const width = 960;
  const height = 360;
  const left = 68;
  const right = 24;
  const top = 26;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yearStart = yearStartDate(state.settings.year);
  const yearEnd = yearEndDate(state.settings.year);
  const yearStartSerial = dateSerial(yearStart);
  const serialSpan = Math.max(1, dateSerial(yearEnd) - yearStartSerial);
  const xForDate = (value) =>
    left + ((dateSerial(value) - yearStartSerial) / serialSpan) * plotWidth;
  const xForMonth = (monthIndex) =>
    (xForDate(monthStartDate(state.settings.year, monthIndex)) +
      xForDate(monthEndDate(state.settings.year, monthIndex))) /
    2;
  const series = selectedPos.map((po) => ({
    po,
    actual: cumulativeSeriesPoints(po),
    planned: cumulativeSeriesPoints(po, true)
  }));
  const values = series.flatMap((entry) =>
    entry.actual.concat(entry.planned).map((point) => point.value)
  );
  const yMax = niceChartMax(Math.max(1, ...values));
  const yFor = (value) => top + plotHeight - (Math.max(0, value) / yMax) * plotHeight;
  const tickValues = Array.from({ length: 5 }, (_, index) => (yMax * index) / 4);
  const shadedMonths = monthNames
    .map((_, monthIndex) =>
      isInvoicedMonth(monthIndex)
        ? ""
        : `<rect x="${xForDate(monthStartDate(state.settings.year, monthIndex))}" y="${top}" width="${xForDate(monthEndDate(state.settings.year, monthIndex)) - xForDate(monthStartDate(state.settings.year, monthIndex))}" height="${plotHeight}" class="chart-shade"></rect>`
    )
    .join("");
  const grid = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line>
        <text class="chart-y-label" x="${left - 8}" y="${y + 4}">${formatHours(value)}</text>
      `;
    })
    .join("");
  const monthLabels = shortMonths
    .map(
      (month, monthIndex) =>
        `<text class="chart-x-label" x="${xForMonth(monthIndex)}" y="${height - 18}">${month}</text>`
    )
    .join("");
  const plannedLines = series
    .map((entry) => {
      const points = entry.planned.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-target-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}" fill="none"></path>`;
    })
    .join("");
  const actualLines = series
    .map((entry) => {
      const points = entry.actual.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}"></path>`;
    })
    .join("");
  const dots = series
    .map((entry) =>
      entry.actual
        .map((point) => `
          <circle class="chart-dot" cx="${xForDate(point.date)}" cy="${yFor(point.value)}" r="4" fill="${escapeAttr(entry.po.color)}">
            <title>${escapeHtml(`${entry.po.name}, ${formatShortDate(point.date)}: ${formatHoursWithUnit(point.value)} cumulative`)}</title>
          </circle>
        `)
        .join("")
    )
    .join("");

  return `
    <svg class="po-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Cumulative actual versus budget chart">
      ${shadedMonths}
      ${grid}
      <line class="chart-axis-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <line class="chart-axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}"></line>
      <text class="chart-axis-title" x="${left}" y="16">Cumulative [h]</text>
      ${monthLabels}
      ${plannedLines}
      ${actualLines}
      ${dots}
    </svg>
  `;
}

function renderForecastConeChartSvg(selectedPos) {
  const width = 960;
  const height = 360;
  const left = 68;
  const right = 24;
  const top = 26;
  const bottom = 46;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yearStart = yearStartDate(state.settings.year);
  const yearEnd = yearEndDate(state.settings.year);
  const yearStartSerial = dateSerial(yearStart);
  const serialSpan = Math.max(1, dateSerial(yearEnd) - yearStartSerial);
  const xForDate = (value) =>
    left + ((dateSerial(value) - yearStartSerial) / serialSpan) * plotWidth;
  const xForMonth = (monthIndex) =>
    (xForDate(monthStartDate(state.settings.year, monthIndex)) +
      xForDate(monthEndDate(state.settings.year, monthIndex))) /
    2;
  const series = selectedPos.map((po) => {
    const tolerance = po.annualHours * (state.settings.tolerancePct / 100);
    return {
      po,
      actual: cumulativeSeriesPoints(po, false, true),
      planned: cumulativeSeriesPoints(po, true),
      projection: forecastProjectionPoints(po),
      lowerBound: po.annualHours - tolerance,
      upperBound: po.annualHours + tolerance
    };
  });
  const values = series.flatMap((entry) =>
    entry.actual
      .concat(entry.planned, entry.projection)
      .map((point) => point.value)
      .concat([entry.lowerBound, entry.upperBound])
  );
  const yMax = niceChartMax(Math.max(1, ...values));
  const minValue = Math.min(0, ...values);
  const yMin = minValue < 0 ? -niceChartMax(Math.abs(minValue)) : 0;
  const yRange = Math.max(1, yMax - yMin);
  const yFor = (value) => top + ((yMax - value) / yRange) * plotHeight;
  const tickValues = Array.from({ length: 5 }, (_, index) => yMin + (yRange * index) / 4);
  const shadedMonths = monthNames
    .map((_, monthIndex) =>
      isInvoicedMonth(monthIndex)
        ? ""
        : `<rect x="${xForDate(monthStartDate(state.settings.year, monthIndex))}" y="${top}" width="${xForDate(monthEndDate(state.settings.year, monthIndex)) - xForDate(monthStartDate(state.settings.year, monthIndex))}" height="${plotHeight}" class="chart-shade"></rect>`
    )
    .join("");
  const grid = tickValues
    .map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line>
        <text class="chart-y-label" x="${left - 8}" y="${y + 4}">${formatHours(value)}</text>
      `;
    })
    .join("");
  const monthLabels = shortMonths
    .map(
      (month, monthIndex) =>
        `<text class="chart-x-label" x="${xForMonth(monthIndex)}" y="${height - 18}">${month}</text>`
    )
    .join("");
  const cones = series
    .map((entry) => {
      const start = entry.projection[0];
      const startX = xForDate(start.date);
      const endX = xForDate(entry.po.endDate);
      const points = [
        `${startX.toFixed(2)},${yFor(start.value).toFixed(2)}`,
        `${endX.toFixed(2)},${yFor(entry.upperBound).toFixed(2)}`,
        `${endX.toFixed(2)},${yFor(entry.lowerBound).toFixed(2)}`
      ].join(" ");
      return `<polygon class="chart-cone-band" points="${points}" fill="${escapeAttr(entry.po.color)}"></polygon>`;
    })
    .join("");
  const plannedLines = series
    .map((entry) => {
      const points = entry.planned.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-target-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}" fill="none"></path>`;
    })
    .join("");
  const projectionLines = series
    .map((entry) => {
      const points = entry.projection.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-projection-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}" fill="none"></path>`;
    })
    .join("");
  const actualLines = series
    .map((entry) => {
      const points = entry.actual.map((point) => ({
        x: xForDate(point.date),
        y: yFor(point.value)
      }));
      return `<path class="chart-line" d="${chartPath(points)}" stroke="${escapeAttr(entry.po.color)}"></path>`;
    })
    .join("");
  const dots = series
    .map((entry) =>
      entry.actual
        .map((point) => `
          <circle class="chart-dot" cx="${xForDate(point.date)}" cy="${yFor(point.value)}" r="4" fill="${escapeAttr(entry.po.color)}">
            <title>${escapeHtml(`${entry.po.name}, ${formatShortDate(point.date)}: ${formatHoursWithUnit(point.value)} invoiced cumulative`)}</title>
          </circle>
        `)
        .join("")
    )
    .join("");

  return `
    <svg class="po-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Forecast cone chart">
      ${shadedMonths}
      ${cones}
      ${grid}
      <line class="chart-axis-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <line class="chart-axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}"></line>
      <text class="chart-axis-title" x="${left}" y="16">Cumulative [h]</text>
      ${monthLabels}
      ${plannedLines}
      ${projectionLines}
      ${actualLines}
      ${dots}
    </svg>
  `;
}

function renderHealthMatrixChartSvg(selectedPos) {
  const width = 960;
  const height = 360;
  const left = 62;
  const right = 30;
  const top = 28;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxConsumed = Math.max(1, ...selectedPos.map((po) => poConsumedRatio(po))) * 1.1;
  const yMax = Math.max(1, maxConsumed);
  const xFor = (ratio) => left + clamp(ratio, 0, 1) * plotWidth;
  const yFor = (ratio) => top + plotHeight - (Math.max(0, ratio) / yMax) * plotHeight;
  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const yTicks = Array.from({ length: 5 }, (_, index) => (yMax * index) / 4);
  const grid = [
    ...xTicks.map((value) => {
      const x = xFor(value);
      return `
        <line class="chart-grid-line" x1="${x}" x2="${x}" y1="${top}" y2="${height - bottom}"></line>
        <text class="chart-x-label" x="${x}" y="${height - 30}">${percentNumber.format(value * 100)}%</text>
      `;
    }),
    ...yTicks.map((value) => {
      const y = yFor(value);
      return `
        <line class="chart-grid-line" x1="${left}" x2="${width - right}" y1="${y}" y2="${y}"></line>
        <text class="chart-y-label" x="${left - 8}" y="${y + 4}">${percentNumber.format(value * 100)}%</text>
      `;
    })
  ].join("");
  const referenceLine = `
    <line class="chart-reference-line" x1="${xFor(0)}" x2="${xFor(1)}" y1="${yFor(0)}" y2="${yFor(1)}"></line>
    <text class="chart-inline-label" x="${xFor(1) - 92}" y="${yFor(1) - 8}">balanced pace</text>
  `;
  const bubbles = selectedPos
    .map((po) => {
      const elapsed = poElapsedRatio(po);
      const consumed = poConsumedRatio(po);
      const risk = poForecastRiskRatio(po);
      const radius = clamp(7 + risk * 28, 7, 28);
      const x = xFor(elapsed);
      const y = yFor(consumed);
      const labelOnLeft = x > width - right - 180;
      const labelX = labelOnLeft ? x - radius - 5 : x + radius + 5;
      const labelAnchor = labelOnLeft ? "end" : "start";
      return `
        <circle class="chart-health-bubble" cx="${x}" cy="${y}" r="${radius}" fill="${escapeAttr(po.color)}">
          <title>${escapeHtml(`${po.name}: ${percentNumber.format(elapsed * 100)}% elapsed, ${percentNumber.format(consumed * 100)}% consumed, ${signedHours(forecastForPo(po.id) - po.annualHours)} forecast risk`)}</title>
        </circle>
        <text class="chart-point-label" x="${labelX}" y="${y + 4}" text-anchor="${labelAnchor}">${escapeHtml(po.name)}</text>
      `;
    })
    .join("");

  return `
    <svg class="po-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="PO health matrix chart">
      ${grid}
      ${referenceLine}
      <line class="chart-axis-line" x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}"></line>
      <line class="chart-axis-line" x1="${left}" x2="${left}" y1="${top}" y2="${height - bottom}"></line>
      <text class="chart-axis-title" x="${left}" y="16">Budget consumed</text>
      <text class="chart-axis-title" x="${width - right - 155}" y="${height - 8}">Active period elapsed</text>
      ${bubbles}
    </svg>
  `;
}

function chartPath(points) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function niceChartMax(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}
