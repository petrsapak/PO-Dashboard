"use strict";

function render() {
  renderSettings();
  renderOverview();
  renderPoTable();
  renderRiskList();
  renderMonthlyTable();
  renderPoChart();
  renderPeopleTable();
  renderTeamView();
  applyDetailsState();
}

function renderSettings() {
  document.querySelector('[data-setting="reportName"]').value = state.settings.reportName;
  document.querySelector('[data-setting="year"]').value = state.settings.year;
  document.querySelector('[data-setting="dailyHours"]').value = state.settings.dailyHours;
  document.querySelector('[data-setting="tolerancePct"]').value = state.settings.tolerancePct;
  document.querySelector('[data-setting="capacityBasis"]').value = state.settings.capacityBasis;
  document.querySelector('[data-setting="defaultAnnualHours"]').value = state.settings.defaultAnnualHours;
  document.querySelector('[data-setting="defaultPtoDays"]').value = state.settings.defaultPtoDays;
  document.querySelector('[data-setting="defaultSickDays"]').value = state.settings.defaultSickDays;
  document.querySelector('[data-setting="defaultHolidayDays"]').value = state.settings.defaultHolidayDays;

  const throughSelect = document.querySelector('[data-setting="throughMonth"]');
  throughSelect.innerHTML = monthNames
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join("");
  throughSelect.value = state.settings.throughMonth;

  document.getElementById("status-period").textContent =
    invoicedPeriodLabel();
  document.title = state.settings.reportName
    ? `${state.settings.reportName} - PO Time Balance Dashboard`
    : "PO Time Balance Dashboard";
}

function renderOverview() {
  const budget = annualBudget();
  const capacity = totalCapacity();
  const ytd = state.pos.reduce((total, po) => total + poInvoicedHours(po), 0);
  const targetToDate = state.pos.reduce((total, po) => total + poPaceTarget(po), 0);
  const forecast = state.pos.reduce((total, po) => total + forecastForPo(po.id), 0);
  const forecastDelta = budget - forecast;
  const capacityDelta = capacity - budget;

  const cards = [
    {
      label: "Annual PO budget",
      value: formatHoursWithUnit(budget),
      note: `${state.pos.length} purchase orders`
    },
    {
      label: "Invoiced to date",
      value: formatHoursWithUnit(ytd),
      note: `${signedHours(ytd - targetToDate)} versus balanced pace`
    },
    {
      label: "Full year forecast",
      value: formatHoursWithUnit(forecast),
      note: `${signedHours(forecastDelta)} remaining against budget`
    },
    {
      label: "People capacity",
      value: formatHoursWithUnit(capacity),
      note: `${signedHours(capacityDelta)} versus PO budget`
    }
  ];

  document.getElementById("overview").innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card">
          <div class="kpi-label">${escapeHtml(card.label)}</div>
          <div class="kpi-value">${escapeHtml(card.value)}</div>
          <div class="kpi-note">${escapeHtml(card.note)}</div>
        </article>
      `
    )
    .join("");
}

function poOptions(selectedPoId) {
  return state.pos
    .map(
      (po) =>
        `<option value="${escapeAttr(po.id)}"${po.id === selectedPoId ? " selected" : ""}>${escapeHtml(po.name)}</option>`
    )
    .join("");
}

function renderPoTable() {
  const rows = state.pos
    .map((po) => {
      const ytd = poInvoicedHours(po);
      const target = poPaceTarget(po);
      const forecast = forecastForPo(po.id);
      const status = statusFor(po, forecast);
      const capacity = poCapacity(po.id);
      const remaining = po.annualHours - ytd;
      const forecastGap = po.annualHours - forecast;
      const progress = po.annualHours > 0 ? clamp((ytd / po.annualHours) * 100, 0, 130) : 0;
      const progressWidth = Math.min(progress, 100);
      const deltaClass = forecast > po.annualHours ? "delta-negative" : "delta-positive";

      return `
        <tr>
          <td>
            <div class="po-name">
              <span class="swatch" style="background:${escapeAttr(po.color)}"></span>
              <input class="name-input" type="text" value="${escapeAttr(po.name)}" data-po-field="name" data-po-id="${escapeAttr(po.id)}">
            </div>
          </td>
          <td class="numeric"><input class="editable" type="number" min="0" step="1" value="${po.annualHours}" data-po-field="annualHours" data-po-id="${escapeAttr(po.id)}"></td>
          <td><input class="date-input" type="date" min="${yearStartDate(state.settings.year)}" max="${yearEndDate(state.settings.year)}" value="${escapeAttr(po.startDate)}" data-po-field="startDate" data-po-id="${escapeAttr(po.id)}"></td>
          <td><input class="date-input" type="date" min="${yearStartDate(state.settings.year)}" max="${yearEndDate(state.settings.year)}" value="${escapeAttr(po.endDate)}" data-po-field="endDate" data-po-id="${escapeAttr(po.id)}"></td>
          <td class="numeric">${formatHours(target)}</td>
          <td class="numeric">${formatHours(ytd)}</td>
          <td class="numeric">${formatHours(remaining)}</td>
          <td class="numeric ${deltaClass}">${signedHoursWithPercent(forecastGap, po.annualHours)}</td>
          <td>
            <div class="bar-track" aria-hidden="true">
              <div class="bar-fill" style="width:${progressWidth}%; background:${escapeAttr(po.color)}"></div>
            </div>
          </td>
          <td class="numeric">${formatHours(capacity)}</td>
          <td><span class="status-pill ${status.className}">${status.label}</span></td>
          <td class="actions"><button class="icon-button" type="button" title="Delete PO" data-command="delete-po" data-po-id="${escapeAttr(po.id)}">x</button></td>
        </tr>
      `;
    })
    .join("");

  document.getElementById("po-table").innerHTML = `
    <thead>
      <tr>
        <th>Purchase order</th>
        <th class="numeric">Annual budget [h]</th>
        <th>Start date</th>
        <th>End date</th>
        <th class="numeric">Pace target [h]</th>
        <th class="numeric">To date [h]</th>
        <th class="numeric">Remaining [h]</th>
        <th class="numeric">Forecast gap [h]</th>
        <th>Burn</th>
        <th class="numeric">Capacity [h]</th>
        <th>Status</th>
        <th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

function renderRiskList() {
  const items = [];
  const budget = annualBudget();
  const capacity = totalCapacity();

  state.pos.forEach((po) => {
    const forecast = forecastForPo(po.id);
    const status = statusFor(po, forecast);
    const capacityGap = poCapacity(po.id) - po.annualHours;

    if (status.key === "over" || status.key === "under") {
      const gap = forecast - po.annualHours;
      const gapPercent = percentOfBudget(gap, po.annualHours);
      const percentCopy = gapPercent ? ` (${gapPercent})` : "";
      items.push({
        type: status.key,
        title: po.name,
        copy:
          status.key === "over"
            ? `Forecast is ${formatHoursWithUnit(Math.abs(gap))}${percentCopy} above annual budget.`
            : `Forecast is ${formatHoursWithUnit(Math.abs(gap))}${percentCopy} below annual budget.`
      });
    }

    if (capacityGap < 0) {
      items.push({
        type: "info",
        title: `${po.name} capacity`,
        copy: `Assigned people capacity is ${formatHoursWithUnit(Math.abs(capacityGap))} below PO budget.`
      });
    }
  });

  state.people.forEach((entry) => {
    const monthlyFte = personMonthlyFte(entry);
    const peakFte = Math.max(...monthlyFte);

    if (!entry.engagements.length) {
      items.push({
        type: "info",
        title: entry.name,
        copy: "No engagements are assigned."
      });
    }

    if (peakFte > 1.0001) {
      const months = monthlyFte
        .map((fte, index) => (fte > 1.0001 ? shortMonths[index] : null))
        .filter(Boolean)
        .join(", ");
      items.push({
        type: "over",
        title: `${entry.name} allocation`,
        copy: `Engagements exceed 1 FTE in ${months}. Peak allocation is ${percentNumber.format(peakFte * 100)}%.`
      });
    }
  });

  if (capacity < budget) {
    items.unshift({
      type: "info",
      title: "Portfolio capacity",
      copy: `Total people capacity is ${formatHoursWithUnit(budget - capacity)} below total PO budget.`
    });
  }

  if (!items.length) {
    document.getElementById("risk-list").innerHTML =
      '<div class="empty-state">No material PO risk inside the current tolerance.</div>';
    return;
  }

  document.getElementById("risk-list").innerHTML = items
    .map(
      (item) => `
        <article class="risk-item ${escapeAttr(item.type)}">
          <span class="risk-mark"></span>
          <div>
            <div class="risk-title">${escapeHtml(item.title)}</div>
            <div class="risk-copy">${escapeHtml(item.copy)}</div>
          </div>
        </article>
      `
    )
    .join("");
}

function personMonthlyFte(entry) {
  const months = Array(12).fill(0);
  months.forEach((_, monthIndex) => {
    for (let day = 1; day <= daysInMonth(state.settings.year, monthIndex); day += 1) {
      const date = isoDate(state.settings.year, monthIndex, day);
      const dailyFte = entry.engagements.reduce(
        (total, item) =>
          date >= item.startDate && date <= item.endDate
            ? total + numberOr(item.fte, 0)
            : total,
        0
      );
      months[monthIndex] = Math.max(months[monthIndex], dailyFte);
    }
  });
  return months;
}

function renderMonthlyTable() {
  const header = state.pos
    .map(
      (po) => `
        <th class="numeric">
          ${escapeHtml(po.name)}
          <span class="th-sub">${poPeriodLabel(po)} [h]</span>
        </th>
      `
    )
    .join("");

  const rows = monthNames
    .map((month, monthIndex) => {
      const invoiced = isInvoicedMonth(monthIndex);
      const cells = state.pos
        .map((po) => {
          const value = state.monthlyHours[po.id][monthIndex] || 0;
          const active = isPoActiveInMonth(po, monthIndex);
          return `
            <td class="numeric ${active ? "" : "inactive-month"}">
              <input type="number" min="0" step="0.25" value="${active ? value : ""}" data-month-index="${monthIndex}" data-po-id="${escapeAttr(po.id)}"${active ? "" : " disabled title=\"Outside PO period\""}>
            </td>
          `;
        })
        .join("");
      const total = state.pos.reduce(
        (totalHours, po) =>
          totalHours + (isPoActiveInMonth(po, monthIndex) ? numberOr(state.monthlyHours[po.id][monthIndex], 0) : 0),
        0
      );

      return `
        <tr class="${invoiced ? "" : "not-invoiced-row"}">
          <td class="invoice-check-cell">
            <input type="checkbox" title="Include ${escapeAttr(month)} in PO status" data-invoiced-month-index="${monthIndex}"${invoiced ? " checked" : ""}>
          </td>
          <td class="month-cell">${shortMonths[monthIndex]}</td>
          ${cells}
          <td class="numeric">${formatHours(total)}</td>
        </tr>
      `;
    })
    .join("");

  const totalCells = state.pos
    .map((po) => `<td class="numeric">${formatHours(poInvoicedHours(po))}</td>`)
    .join("");

  document.getElementById("monthly-table").innerHTML = `
    <thead>
      <tr>
        <th class="invoice-check-heading">Invoiced</th>
        <th>Month</th>
        ${header}
        <th class="numeric">Total [h]</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="2">Invoiced [h]</td>
        ${totalCells}
        <td class="numeric">${formatHours(state.pos.reduce((total, po) => total + poInvoicedHours(po), 0))}</td>
      </tr>
    </tbody>
  `;
}

function renderPeopleTable() {
  const rows = state.people.map((entry) => renderPersonNode(entry)).join("");

  document.getElementById("people-table").innerHTML =
    rows || '<div class="empty-state">No people yet.</div>';
}

function renderPersonNode(entry) {
  const openAttr = isPersonOpen(entry.id) ? " open" : "";

  return `
    <details class="person-node" data-person-id="${escapeAttr(entry.id)}"${openAttr}>
      <summary class="person-summary">
        <span class="person-summary-name">${escapeHtml(entry.name)}</span>
        <span class="person-summary-meta">${formatHoursWithUnit(personCapacity(entry))} allocated</span>
      </summary>
      <div class="person-main">
        <label class="person-field person-name-field">
          <span>Name</span>
          <input class="name-input" type="text" value="${escapeAttr(entry.name)}" data-person-field="name" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <label class="person-field">
          <span>Annual [h]</span>
          <input class="editable" type="number" min="0" step="1" value="${entry.annualHours}" data-person-field="annualHours" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <label class="person-field">
          <span>PTO [d]</span>
          <input class="editable" type="number" min="0" step="0.5" value="${entry.ptoDays}" data-person-field="ptoDays" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <label class="person-field">
          <span>Sick days [d]</span>
          <input class="editable" type="number" min="0" step="0.5" value="${entry.sickDays}" data-person-field="sickDays" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <label class="person-field">
          <span>Holidays [d]</span>
          <input class="editable" type="number" min="0" step="0.5" value="${entry.holidayDays}" data-person-field="holidayDays" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <label class="person-field">
          <span>Extra leave [d]</span>
          <input class="editable" type="number" min="0" step="0.5" value="${entry.extraLeaveDays}" data-person-field="extraLeaveDays" data-person-id="${escapeAttr(entry.id)}">
        </label>
        <div class="person-metric">
          <span>Absence [h]</span>
          <strong>${formatHours(personProratedAbsenceHours(entry))}</strong>
        </div>
        <div class="person-metric">
          <span>Base [h]</span>
          <strong>${formatHours(personBaseCapacity(entry))}</strong>
        </div>
        <div class="person-metric">
          <span>Allocated [h]</span>
          <strong>${formatHours(personCapacity(entry))}</strong>
        </div>
        <button class="icon-button person-delete" type="button" title="Delete person" data-command="delete-person" data-person-id="${escapeAttr(entry.id)}">x</button>
      </div>
      <div class="person-children">
        <div class="engagement-list-header">
          <span>Engagements</span>
          <button class="secondary small-button" type="button" data-command="add-engagement" data-person-id="${escapeAttr(entry.id)}">Add engagement</button>
        </div>
        ${renderEngagements(entry)}
      </div>
    </details>
  `;
}

function renderEngagements(entry) {
  const rows = entry.engagements
    .map(
      (item) => `
        <div class="engagement-row">
          <label class="engagement-field">
            <span>Team</span>
            <input class="team-input" type="text" value="${escapeAttr(item.team)}" data-engagement-field="team" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">
          </label>
          <label class="engagement-field">
            <span>PO</span>
            <select class="po-select" data-engagement-field="poId" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">${poOptions(item.poId)}</select>
          </label>
          <label class="engagement-field">
            <span>Start date</span>
            <input class="date-input" type="date" min="${yearStartDate(state.settings.year)}" max="${yearEndDate(state.settings.year)}" value="${escapeAttr(item.startDate)}" data-engagement-field="startDate" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">
          </label>
          <label class="engagement-field">
            <span>End date</span>
            <input class="date-input" type="date" min="${yearStartDate(state.settings.year)}" max="${yearEndDate(state.settings.year)}" value="${escapeAttr(item.endDate)}" data-engagement-field="endDate" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">
          </label>
          <label class="engagement-field">
            <span>FTE</span>
            <input class="fte-input" type="number" min="0" max="2" step="0.05" value="${numberOr(item.fte, 0)}" data-engagement-field="fte" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">
          </label>
          <div class="engagement-field readonly-field">
            <span>Hours [h]</span>
            <strong>${formatHours(engagementCapacityForPo(entry, item))}</strong>
          </div>
          <button class="icon-button engagement-delete" type="button" title="Delete engagement" data-command="delete-engagement" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">x</button>
        </div>
      `
    )
    .join("");

  return `
    <div class="engagement-list">
      ${rows || '<div class="mini-copy">No engagements</div>'}
    </div>
  `;
}

function renderTeamView() {
  const teams = new Map();
  state.people.forEach((entry) => {
    entry.engagements.forEach((item) => {
      const teamName = item.team || "Unassigned";
      const existing = teams.get(teamName) || { people: new Set(), capacity: 0, absence: 0 };
      existing.people.add(entry.id);
      existing.capacity += engagementCapacityForPo(entry, item);
      existing.absence += engagementAbsenceHours(entry, item);
      teams.set(teamName, existing);
    });
  });

  const rows = Array.from(teams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([teamName, team]) => {
      const peopleCount = team.people.size;
      const perPerson = peopleCount ? team.capacity / peopleCount : 0;
      return `
        <article class="mini-row">
          <div>
            <div class="mini-title">${escapeHtml(teamName)}</div>
            <div class="mini-copy">${peopleCount} people, ${formatHoursWithUnit(team.absence)} prorated absence</div>
          </div>
          <div class="mini-value">
            ${formatHoursWithUnit(team.capacity)}
            <div class="mini-copy">${formatHoursWithUnit(perPerson)}/person</div>
          </div>
        </article>
      `;
    })
    .join("");

  const poRows = state.pos
    .map((po) => {
      const capacity = poCapacity(po.id);
      const gap = capacity - po.annualHours;
      const className = gap < 0 ? "delta-negative" : "delta-positive";
      return `
        <article class="mini-row">
          <div>
            <div class="mini-title">${escapeHtml(po.name)}</div>
            <div class="mini-copy">Assigned capacity vs annual budget</div>
          </div>
          <div class="mini-value ${className}">
            ${signedHours(gap)}
          </div>
        </article>
      `;
    })
    .join("");

  document.getElementById("team-view").innerHTML = `${rows}${poRows}`;
}

function isSectionOpen(key) {
  return !state.ui.collapsedSections.includes(key);
}

function isPersonOpen(personId) {
  return !state.ui.collapsedPeople.includes(personId);
}

function setCollapsed(list, key, collapsed) {
  const index = list.indexOf(key);
  if (collapsed && index === -1) {
    list.push(key);
  }
  if (!collapsed && index !== -1) {
    list.splice(index, 1);
  }
}

function applyDetailsState() {
  document.querySelectorAll("details[data-section-key]").forEach((details) => {
    details.open = isSectionOpen(details.dataset.sectionKey);
  });
}

function handleDetailsToggle(event) {
  if (suppressDetailsPersistence) {
    return;
  }

  const details = event.target;
  if (!details || details.tagName !== "DETAILS") {
    return;
  }

  if (details.dataset.sectionKey) {
    setCollapsed(state.ui.collapsedSections, details.dataset.sectionKey, !details.open);
    saveState();
    return;
  }

  if (details.dataset.personId) {
    setCollapsed(state.ui.collapsedPeople, details.dataset.personId, !details.open);
    saveState();
  }
}
