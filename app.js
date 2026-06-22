"use strict";

const STORAGE_KEY = "po-time-balance-dashboard-v1";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

const shortMonths = monthNames.map((month) => month.slice(0, 3));

const currencyFreeNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1
});

const percentNumber = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1
});

const poPalette = ["#4EC9B0", "#569CD6", "#DCDCAA", "#C586C0", "#B5CEA8", "#CE9178"];
const legacyPoPalette = ["#136f63", "#335f9f", "#8f5a17", "#8c3f73", "#51743a", "#764c9b"];

let state = loadState();
let suppressDetailsPersistence = false;
let printDetailsSnapshot = null;

function defaultState() {
  const pos = [
    { id: "po-core", name: "PO-001 Core delivery", annualHours: 3300, color: poPalette[0], startMonth: 0, endMonth: 11 },
    { id: "po-platform", name: "PO-002 Platform", annualHours: 3100, color: poPalette[1], startMonth: 0, endMonth: 11 },
    { id: "po-integration", name: "PO-003 Integration", annualHours: 2800, color: poPalette[2], startMonth: 0, endMonth: 11 },
    { id: "po-support", name: "PO-004 Support", annualHours: 2600, color: poPalette[3], startMonth: 0, endMonth: 11 }
  ];

  return normalizeState({
    settings: {
      year: new Date().getFullYear(),
      throughMonth: Math.min(new Date().getMonth(), 11),
      dailyHours: 8,
      tolerancePct: 5,
      capacityBasis: "net",
      defaultAnnualHours: 1800,
      defaultPtoDays: 25,
      defaultSickDays: 2,
      defaultHolidayDays: 11
    },
    invoicedMonths: Array.from({ length: 12 }, (_, index) => index <= Math.min(new Date().getMonth(), 11)),
    pos,
    monthlyHours: {
      "po-core": [260, 280, 275, 310, 295, 290, 0, 0, 0, 0, 0, 0],
      "po-platform": [240, 245, 250, 260, 268, 275, 0, 0, 0, 0, 0, 0],
      "po-integration": [190, 205, 230, 245, 255, 270, 0, 0, 0, 0, 0, 0],
      "po-support": [220, 210, 205, 215, 225, 230, 0, 0, 0, 0, 0, 0]
    },
    people: [
      person("Alex Novak", "Team Alpha", "po-core", 740, 20, 4, 13, [
        engagement("Team Alpha", "po-core", 0, 2, 1),
        engagement("Team Beta", "po-platform", 5, 11, 0.5)
      ]),
      person("Barbora Kral", "Team Alpha", "po-core", 720, 22, 3, 13),
      person("Daniel Marek", "Team Alpha", "po-core", 760, 20, 5, 13),
      person("Eva Urban", "Team Alpha", "po-core", 700, 25, 4, 13),
      person("Filip Svoboda", "Team Alpha", "po-core", 690, 24, 5, 13),
      person("Hana Vesela", "Team Beta", "po-platform", 730, 20, 4, 13),
      person("Igor Dvorak", "Team Beta", "po-platform", 760, 18, 5, 13),
      person("Jana Horak", "Team Beta", "po-platform", 710, 24, 3, 13),
      person("Karel Cerny", "Team Beta", "po-platform", 725, 20, 6, 13),
      person("Lenka Novakova", "Team Beta", "po-platform", 695, 23, 5, 13),
      person("Martin Prochazka", "Team Gamma", "po-integration", 720, 20, 4, 13),
      person("Nina Fiala", "Team Gamma", "po-integration", 705, 24, 4, 13),
      person("Ondrej Malik", "Team Gamma", "po-integration", 760, 19, 5, 13),
      person("Petra Ruzicka", "Team Gamma", "po-integration", 690, 25, 3, 13),
      person("Roman Blaha", "Team Gamma", "po-integration", 715, 22, 5, 13),
      person("Sofia Polak", "Team Delta", "po-support", 710, 23, 4, 13),
      person("Tomas Kadlec", "Team Delta", "po-support", 745, 20, 5, 13),
      person("Veronika Sima", "Team Delta", "po-support", 700, 25, 4, 13),
      person("William Bauer", "Team Delta", "po-support", 690, 22, 6, 13),
      person("Zuzana Richter", "Team Delta", "po-support", 725, 20, 4, 13)
    ]
  });
}

function person(name, team, poId, annualHours, ptoDays, sickDays, holidayDays, engagements) {
  return {
    id: createId("person"),
    name,
    annualHours,
    ptoDays,
    sickDays,
    holidayDays,
    extraLeaveDays: 0,
    engagements: engagements || [engagement(team, poId, 0, 11, 1)]
  };
}

function engagement(team, poId, startMonth, endMonth, fte) {
  return {
    id: createId("engagement"),
    team,
    poId,
    startMonth,
    endMonth,
    fte
  };
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return defaultState();
    }
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn("Falling back to demo data", error);
    return defaultState();
  }
}

function normalizeState(input) {
  const safe = input && typeof input === "object" ? input : {};
  const settings = {
    year: numberOr(safe.settings && safe.settings.year, new Date().getFullYear()),
    throughMonth: clamp(numberOr(safe.settings && safe.settings.throughMonth, new Date().getMonth()), 0, 11),
    dailyHours: Math.max(1, numberOr(safe.settings && safe.settings.dailyHours, 8)),
    tolerancePct: Math.max(0, numberOr(safe.settings && safe.settings.tolerancePct, 5)),
    capacityBasis:
      safe.settings && safe.settings.capacityBasis === "subtractAbsence"
        ? "subtractAbsence"
        : "net",
    defaultAnnualHours: Math.max(0, numberOr(safe.settings && safe.settings.defaultAnnualHours, 1800)),
    defaultPtoDays: Math.max(0, numberOr(safe.settings && safe.settings.defaultPtoDays, 25)),
    defaultSickDays: Math.max(0, numberOr(safe.settings && safe.settings.defaultSickDays, 2)),
    defaultHolidayDays: Math.max(0, numberOr(safe.settings && safe.settings.defaultHolidayDays, 11))
  };
  const invoicedMonths = Array.from({ length: 12 }, (_, index) =>
    Array.isArray(safe.invoicedMonths)
      ? Boolean(safe.invoicedMonths[index])
      : index <= settings.throughMonth
  );
  const latestInvoiced = latestCheckedMonth(invoicedMonths);
  if (latestInvoiced >= 0) {
    settings.throughMonth = latestInvoiced;
  }

  const pos = Array.isArray(safe.pos) && safe.pos.length ? safe.pos : [];
  const normalizedPos = pos.map((po, index) => normalizePo(po, index));

  if (!normalizedPos.length) {
    normalizedPos.push({
      id: "po-1",
      name: "PO-001",
      annualHours: 0,
      color: poPalette[0],
      startMonth: 0,
      endMonth: 11
    });
  }

  const monthlyHours = {};
  normalizedPos.forEach((po) => {
    const source = safe.monthlyHours && Array.isArray(safe.monthlyHours[po.id]) ? safe.monthlyHours[po.id] : [];
    monthlyHours[po.id] = Array.from({ length: 12 }, (_, monthIndex) =>
      Math.max(0, numberOr(source[monthIndex], 0))
    );
  });

  const fallbackPoId = normalizedPos[0].id;
  const validPoIds = new Set(normalizedPos.map((po) => po.id));
  const people = Array.isArray(safe.people)
    ? safe.people.map((entry) => normalizePerson(entry, fallbackPoId, validPoIds))
    : [];
  const peopleIds = new Set(people.map((entry) => entry.id));
  const safeUi = safe.ui && typeof safe.ui === "object" ? safe.ui : {};
  const visibleChartPoIds = Array.isArray(safeUi.visibleChartPoIds)
    ? normalizeKeyList(safeUi.visibleChartPoIds).filter((id) => validPoIds.has(id))
    : normalizedPos.map((po) => po.id);
  const ui = {
    collapsedSections: normalizeKeyList(safeUi.collapsedSections),
    collapsedPeople: normalizeKeyList(safeUi.collapsedPeople).filter((id) => peopleIds.has(id)),
    visibleChartPoIds
  };

  return { settings, pos: normalizedPos, monthlyHours, invoicedMonths, people, ui };
}

function normalizePo(po, index) {
  const startMonth = clamp(numberOr(po.startMonth, 0), 0, 11);
  const endMonth = clamp(numberOr(po.endMonth, 11), 0, 11);
  const legacyColorIndex = legacyPoPalette.findIndex(
    (color) => color.toLowerCase() === String(po.color || "").toLowerCase()
  );
  return {
    id: po.id || createId("po"),
    name: po.name || `PO-${index + 1}`,
    annualHours: Math.max(0, numberOr(po.annualHours, 0)),
    color:
      legacyColorIndex >= 0
        ? poPalette[legacyColorIndex % poPalette.length]
        : po.color || poPalette[index % poPalette.length],
    startMonth: Math.min(startMonth, endMonth),
    endMonth: Math.max(startMonth, endMonth)
  };
}

function normalizePerson(entry, fallbackPoId, validPoIds) {
  const rawEngagements =
    Array.isArray(entry.engagements)
      ? entry.engagements
      : [
          {
            team: entry.team || "Unassigned",
            poId: entry.poId || fallbackPoId,
            startMonth: 0,
            endMonth: 11,
            fte: 1
          }
        ];

  return {
    id: entry.id || createId("person"),
    name: entry.name || "New person",
    annualHours: Math.max(0, numberOr(entry.annualHours, 0)),
    ptoDays: Math.max(0, numberOr(entry.ptoDays, 0)),
    sickDays: Math.max(0, numberOr(entry.sickDays, 0)),
    holidayDays: Math.max(0, numberOr(entry.holidayDays, 0)),
    extraLeaveDays: Math.max(0, numberOr(entry.extraLeaveDays, 0)),
    engagements: rawEngagements.map((item) => normalizeEngagement(item, fallbackPoId, validPoIds))
  };
}

function normalizeEngagement(item, fallbackPoId, validPoIds) {
  const startMonth = clamp(numberOr(item.startMonth, 0), 0, 11);
  const endMonth = clamp(numberOr(item.endMonth, 11), 0, 11);
  return {
    id: item.id || createId("engagement"),
    team: item.team || "Unassigned",
    poId: validPoIds.has(item.poId) ? item.poId : fallbackPoId,
    startMonth: Math.min(startMonth, endMonth),
    endMonth: Math.max(startMonth, endMonth),
    fte: Math.max(0, numberOr(item.fte, 1))
  };
}

function normalizeKeyList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === "string" && item))];
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatHours(value) {
  return currencyFreeNumber.format(value);
}

function formatHoursWithUnit(value) {
  return `${formatHours(value)} [h]`;
}

function signedHours(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatHours(value)} [h]`;
}

function percentOfBudget(value, budget) {
  return budget > 0 ? `${percentNumber.format((Math.abs(value) / budget) * 100)}%` : "";
}

function signedHoursWithPercent(value, budget) {
  const percent = percentOfBudget(value, budget);
  return percent ? `${signedHours(value)} (${percent})` : signedHours(value);
}

function poHours(poId, start = 0, end = 11, includeMonth = () => true) {
  const months = state.monthlyHours[poId] || Array(12).fill(0);
  return months.reduce(
    (total, value, monthIndex) =>
      monthIndex >= start && monthIndex <= end && includeMonth(monthIndex)
        ? total + numberOr(value, 0)
        : total,
    0
  );
}

function poInvoicedHours(po, start = 0, end = 11) {
  const activeStart = Math.max(po.startMonth, start);
  const activeEnd = Math.min(po.endMonth, end);
  return activeStart <= activeEnd ? poHours(po.id, activeStart, activeEnd, isInvoicedMonth) : 0;
}

function monthCount(startMonth, endMonth) {
  return Math.max(0, endMonth - startMonth + 1);
}

function overlapMonthCount(startA, endA, startB, endB) {
  const start = Math.max(startA, startB);
  const end = Math.min(endA, endB);
  return monthCount(start, end);
}

function isPoActiveInMonth(po, monthIndex) {
  return monthIndex >= po.startMonth && monthIndex <= po.endMonth;
}

function isInvoicedMonth(monthIndex) {
  return Boolean(state.invoicedMonths && state.invoicedMonths[monthIndex]);
}

function invoicedActiveMonthCount(po) {
  return state.invoicedMonths.reduce(
    (count, checked, monthIndex) => count + (checked && isPoActiveInMonth(po, monthIndex) ? 1 : 0),
    0
  );
}

function latestCheckedMonth(months) {
  return months.reduce((latest, checked, monthIndex) => (checked ? monthIndex : latest), -1);
}

function invoicedPeriodLabel() {
  const selected = state.invoicedMonths
    .map((checked, index) => (checked ? index : null))
    .filter((index) => index !== null);

  if (!selected.length) {
    return `No invoiced months selected for ${state.settings.year}`;
  }

  const latest = selected[selected.length - 1];
  const contiguousFromJanuary = selected.length === latest + 1;
  if (contiguousFromJanuary) {
    return `Invoiced through ${monthNames[latest]} ${state.settings.year}`;
  }

  return `${selected.length} invoiced months selected for ${state.settings.year}`;
}

function monthRangeLabel(startMonth, endMonth) {
  return `${shortMonths[startMonth]}-${shortMonths[endMonth]}`;
}

function poPaceTarget(po) {
  const activeMonths = monthCount(po.startMonth, po.endMonth);
  const elapsedMonths = invoicedActiveMonthCount(po);
  return activeMonths ? po.annualHours * (elapsedMonths / activeMonths) : 0;
}

function personCapacity(entry) {
  return entry.engagements.reduce(
    (total, item) => total + engagementCapacityForPo(entry, item),
    0
  );
}

function engagementCountedMonths(item) {
  const po = state.pos.find((candidate) => candidate.id === item.poId);
  return po
    ? overlapMonthCount(item.startMonth, item.endMonth, po.startMonth, po.endMonth)
    : monthCount(item.startMonth, item.endMonth);
}

function engagementGrossCapacity(entry, item) {
  const months = engagementCountedMonths(item);
  return (Math.max(0, numberOr(entry.annualHours, 0)) * months * numberOr(item.fte, 0)) / 12;
}

function engagementCapacityForPo(entry, item) {
  const grossCapacity = engagementGrossCapacity(entry, item);
  if (state.settings.capacityBasis === "net") {
    return grossCapacity;
  }

  return Math.max(0, grossCapacity - engagementAbsenceHours(entry, item));
}

function personBaseCapacity(entry) {
  return entry.engagements.reduce(
    (total, item) => total + engagementGrossCapacity(entry, item),
    0
  );
}

function personProratedAbsenceHours(entry) {
  return entry.engagements.reduce(
    (total, item) => total + engagementAbsenceHours(entry, item),
    0
  );
}

function absenceHours(entry) {
  return (
    numberOr(entry.ptoDays, 0) +
    numberOr(entry.sickDays, 0) +
    numberOr(entry.holidayDays, 0) +
    numberOr(entry.extraLeaveDays, 0)
  ) * state.settings.dailyHours;
}

function poCapacity(poId) {
  return state.people.reduce(
    (total, entry) =>
      total +
      entry.engagements
        .filter((item) => item.poId === poId)
        .reduce((subtotal, item) => subtotal + engagementCapacityForPo(entry, item), 0),
    0
  );
}

function totalCapacity() {
  return state.people.reduce(
    (total, entry) =>
      total + entry.engagements.reduce((subtotal, item) => subtotal + engagementCapacityForPo(entry, item), 0),
    0
  );
}

function annualBudget() {
  return state.pos.reduce((total, po) => total + po.annualHours, 0);
}

function forecastForPo(poId) {
  const po = state.pos.find((candidate) => candidate.id === poId);
  if (!po) {
    return 0;
  }

  const actualToDate = poInvoicedHours(po);
  const elapsedMonths = invoicedActiveMonthCount(po);
  const activeMonths = monthCount(po.startMonth, po.endMonth);
  return elapsedMonths > 0 && activeMonths > 0 ? (actualToDate / elapsedMonths) * activeMonths : 0;
}

function statusFor(po, forecast) {
  if (invoicedActiveMonthCount(po) === 0 && forecast === 0) {
    return { key: "info", label: "No invoices yet", className: "status-info" };
  }

  const tolerance = po.annualHours * (state.settings.tolerancePct / 100);
  const delta = forecast - po.annualHours;

  if (delta > tolerance) {
    return { key: "over", label: "Overflow risk", className: "status-over" };
  }

  if (delta < -tolerance) {
    return { key: "under", label: "Underflow risk", className: "status-under" };
  }

  return { key: "balanced", label: "Balanced", className: "status-balanced" };
}

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

function monthOptions(selectedMonth) {
  return monthNames
    .map(
      (month, index) =>
        `<option value="${index}"${index === selectedMonth ? " selected" : ""}>${escapeHtml(month)}</option>`
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
          <td><select class="month-select" data-po-field="startMonth" data-po-id="${escapeAttr(po.id)}">${monthOptions(po.startMonth)}</select></td>
          <td><select class="month-select" data-po-field="endMonth" data-po-id="${escapeAttr(po.id)}">${monthOptions(po.endMonth)}</select></td>
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
        <th>Starts</th>
        <th>Ends</th>
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
  entry.engagements.forEach((item) => {
    for (let index = item.startMonth; index <= item.endMonth; index += 1) {
      months[index] += numberOr(item.fte, 0);
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
          <span class="th-sub">${monthRangeLabel(po.startMonth, po.endMonth)} [h]</span>
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

function selectedChartPoIds() {
  const validPoIds = new Set(state.pos.map((po) => po.id));
  state.ui.visibleChartPoIds = normalizeKeyList(state.ui.visibleChartPoIds).filter((id) =>
    validPoIds.has(id)
  );
  return state.ui.visibleChartPoIds;
}

function renderPoChart() {
  const container = document.getElementById("po-chart");
  if (!container) {
    return;
  }

  const selectedIds = selectedChartPoIds();
  const selectedIdSet = new Set(selectedIds);
  const selectedPos = state.pos.filter((po) => selectedIdSet.has(po.id));
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
    ? renderPoChartSvg(selectedPos)
    : '<div class="empty-state">Select at least one PO to display the graph.</div>';
  const legend = selectedPos.length
    ? `
      <div class="chart-legend">
        ${selectedPos
          .map(
            (po) => `
              <div class="chart-legend-item">
                <span class="swatch" style="background:${escapeAttr(po.color)}"></span>
                <span class="chart-legend-name">${escapeHtml(po.name)}</span>
                <span>${formatHoursWithUnit(poInvoicedHours(po))} invoiced</span>
                <span>${formatHoursWithUnit(forecastForPo(po.id))} forecast</span>
              </div>
            `
          )
          .join("")}
      </div>
    `
    : "";

  container.innerHTML = `
    <div class="chart-controls">
      <div class="chart-selector" aria-label="Displayed POs">${selector}</div>
      <div class="chart-actions">
        <button class="secondary small-button" type="button" data-command="chart-select-all">All</button>
        <button class="secondary small-button" type="button" data-command="chart-clear">None</button>
      </div>
    </div>
    <div class="chart-frame">
      ${chart}
    </div>
    <div class="chart-caption">Solid lines show monthly hours [h]. Dashed lines show each selected PO's monthly budget pace. Uninvoiced months are shaded.</div>
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
  const activeMonths = monthCount(po.startMonth, po.endMonth);
  const monthlyPace = activeMonths ? po.annualHours / activeMonths : 0;

  return `
    <article class="panel print-graph-page">
      <header class="panel-header print-graph-header">
        <div class="summary-text">
          <h2>${escapeHtml(po.name)}</h2>
          <p>Monthly invoice hours [h], budget pace, and forecast</p>
        </div>
      </header>
      <div class="print-graph-meta">
        <div>
          <span>Active period</span>
          <strong>${monthRangeLabel(po.startMonth, po.endMonth)}</strong>
        </div>
        <div>
          <span>Annual budget</span>
          <strong>${formatHoursWithUnit(po.annualHours)}</strong>
        </div>
        <div>
          <span>Monthly pace</span>
          <strong>${formatHoursWithUnit(monthlyPace)}</strong>
        </div>
        <div>
          <span>Invoiced</span>
          <strong>${formatHoursWithUnit(poInvoicedHours(po))}</strong>
        </div>
        <div>
          <span>Forecast</span>
          <strong>${formatHoursWithUnit(forecastForPo(po.id))}</strong>
        </div>
      </div>
      <div class="chart-frame print-chart-frame">
        ${renderPoChartSvg([po])}
      </div>
      <div class="chart-caption print-chart-caption">
        Solid line shows monthly hours [h]. Dashed line shows this PO's monthly budget pace. Uninvoiced months are shaded.
      </div>
    </article>
  `;
}

function renderPoChartSvg(selectedPos) {
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
  const paceValues = selectedPos.map((po) => {
    const activeMonths = monthCount(po.startMonth, po.endMonth);
    return activeMonths ? po.annualHours / activeMonths : 0;
  });
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
      const activeMonths = monthCount(po.startMonth, po.endMonth);
      if (!activeMonths || po.annualHours <= 0) {
        return "";
      }
      const target = po.annualHours / activeMonths;
      const y = yFor(target);
      return `<line class="chart-target-line" x1="${xFor(po.startMonth)}" x2="${xFor(po.endMonth)}" y1="${y}" y2="${y}" stroke="${escapeAttr(po.color)}"></line>`;
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
            <span>Start</span>
            <select class="month-select" data-engagement-field="startMonth" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">${monthOptions(item.startMonth)}</select>
          </label>
          <label class="engagement-field">
            <span>End</span>
            <select class="month-select" data-engagement-field="endMonth" data-person-id="${escapeAttr(entry.id)}" data-engagement-id="${escapeAttr(item.id)}">${monthOptions(item.endMonth)}</select>
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

function preparePrintLayout() {
  if (printDetailsSnapshot) {
    return;
  }

  printDetailsSnapshot = Array.from(document.querySelectorAll("details.expander")).map((details) => ({
    details,
    open: details.open
  }));

  suppressDetailsPersistence = true;
  printDetailsSnapshot.forEach(({ details }) => {
    details.open = true;
  });
  renderPrintPoGraphs();
}

function restorePrintLayout() {
  if (!printDetailsSnapshot) {
    return;
  }

  const printGraphs = document.getElementById("print-graph-pages");
  if (printGraphs) {
    printGraphs.remove();
  }

  printDetailsSnapshot.forEach(({ details, open }) => {
    details.open = open;
  });
  printDetailsSnapshot = null;

  window.setTimeout(() => {
    suppressDetailsPersistence = false;
  }, 100);
}

function printDashboard() {
  preparePrintLayout();
  requestAnimationFrame(() => {
    window.print();
  });
}

function engagementAbsenceHours(entry, item) {
  return (absenceHours(entry) * engagementCountedMonths(item) * numberOr(item.fte, 0)) / 12;
}

function handleSettingChange(event) {
  const field = event.target.dataset.setting;
  if (!field) {
    return;
  }

  if (field === "capacityBasis") {
    state.settings[field] = event.target.value;
  } else {
    state.settings[field] = numberOr(event.target.value, state.settings[field]);
  }

  if (field === "throughMonth") {
    state.settings.throughMonth = clamp(state.settings.throughMonth, 0, 11);
    state.invoicedMonths = state.invoicedMonths.map((_, monthIndex) => monthIndex <= state.settings.throughMonth);
  }

  saveState();
  render();
}

function handleInputChange(event) {
  const target = event.target;

  if (target.dataset.invoicedMonthIndex) {
    const monthIndex = clamp(numberOr(target.dataset.invoicedMonthIndex, 0), 0, 11);
    state.invoicedMonths[monthIndex] = target.checked;
    const latestInvoiced = latestCheckedMonth(state.invoicedMonths);
    if (latestInvoiced >= 0) {
      state.settings.throughMonth = latestInvoiced;
    }
    saveState();
    render();
    return;
  }

  if (target.dataset.chartPoId) {
    const poId = target.dataset.chartPoId;
    const selectedIds = selectedChartPoIds();
    const selectedIndex = selectedIds.indexOf(poId);

    if (target.checked && selectedIndex === -1) {
      selectedIds.push(poId);
    }
    if (!target.checked && selectedIndex !== -1) {
      selectedIds.splice(selectedIndex, 1);
    }

    saveState();
    render();
    return;
  }

  if (target.dataset.poField) {
    const po = state.pos.find((entry) => entry.id === target.dataset.poId);
    if (!po) {
      return;
    }

    const field = target.dataset.poField;
    if (field === "annualHours") {
      po.annualHours = Math.max(0, numberOr(target.value, 0));
    } else if (field === "startMonth" || field === "endMonth") {
      po[field] = clamp(numberOr(target.value, po[field]), 0, 11);
      if (po.startMonth > po.endMonth) {
        if (field === "startMonth") {
          po.endMonth = po.startMonth;
        } else {
          po.startMonth = po.endMonth;
        }
      }
    } else {
      po[field] = target.value;
    }
    saveState();
    render();
    return;
  }

  if (target.dataset.personField) {
    const entry = state.people.find((personEntry) => personEntry.id === target.dataset.personId);
    if (!entry) {
      return;
    }

    const field = target.dataset.personField;
    if (["annualHours", "ptoDays", "sickDays", "holidayDays", "extraLeaveDays"].includes(field)) {
      entry[field] = Math.max(0, numberOr(target.value, 0));
    } else {
      entry[field] = target.value;
    }
    saveState();
    render();
    return;
  }

  if (target.dataset.engagementField) {
    const entry = state.people.find((personEntry) => personEntry.id === target.dataset.personId);
    const item =
      entry && entry.engagements.find((candidate) => candidate.id === target.dataset.engagementId);
    if (!entry || !item) {
      return;
    }

    const field = target.dataset.engagementField;
    if (field === "fte") {
      item.fte = Math.max(0, numberOr(target.value, 0));
    } else if (field === "startMonth" || field === "endMonth") {
      item[field] = clamp(numberOr(target.value, item[field]), 0, 11);
      if (item.startMonth > item.endMonth) {
        if (field === "startMonth") {
          item.endMonth = item.startMonth;
        } else {
          item.startMonth = item.endMonth;
        }
      }
    } else {
      item[field] = target.value;
    }
    saveState();
    render();
    return;
  }

  if (target.dataset.monthIndex && target.dataset.poId) {
    const monthIndex = Number(target.dataset.monthIndex);
    const poId = target.dataset.poId;
    state.monthlyHours[poId][monthIndex] = Math.max(0, numberOr(target.value, 0));
    saveState();
    render();
  }
}

function handleCommand(event) {
  const button = event.target.closest("[data-command]");
  if (!button) {
    return;
  }

  if (button.closest("summary")) {
    event.preventDefault();
  }

  const command = button.dataset.command;
  if (command === "add-po") {
    addPo();
  }

  if (command === "delete-po") {
    deletePo(button.dataset.poId);
  }

  if (command === "add-person") {
    addPerson();
  }

  if (command === "delete-person") {
    deletePerson(button.dataset.personId);
  }

  if (command === "add-engagement") {
    addEngagement(button.dataset.personId);
  }

  if (command === "delete-engagement") {
    deleteEngagement(button.dataset.personId, button.dataset.engagementId);
  }

  if (command === "chart-select-all") {
    state.ui.visibleChartPoIds = state.pos.map((po) => po.id);
    saveState();
    render();
  }

  if (command === "chart-clear") {
    state.ui.visibleChartPoIds = [];
    saveState();
    render();
  }

  if (command === "export") {
    exportData();
  }

  if (command === "import") {
    document.getElementById("import-file").click();
  }

  if (command === "print") {
    printDashboard();
  }

  if (command === "reset") {
    resetDemo();
  }
}

function addPo() {
  const id = createId("po");
  state.pos.push({
    id,
    name: `PO-${String(state.pos.length + 1).padStart(3, "0")}`,
    annualHours: 0,
    color: poPalette[state.pos.length % poPalette.length],
    startMonth: 0,
    endMonth: 11
  });
  state.monthlyHours[id] = Array(12).fill(0);
  state.ui.visibleChartPoIds.push(id);
  saveState();
  render();
}

function deletePo(poId) {
  if (state.pos.length <= 1) {
    return;
  }

  const po = state.pos.find((entry) => entry.id === poId);
  if (!po || !confirm(`Delete ${po.name}?`)) {
    return;
  }

  const fallbackPoId = state.pos.find((entry) => entry.id !== poId).id;
  state.pos = state.pos.filter((entry) => entry.id !== poId);
  delete state.monthlyHours[poId];
  state.ui.visibleChartPoIds = state.ui.visibleChartPoIds.filter((id) => id !== poId);
  state.people.forEach((entry) => {
    entry.engagements.forEach((item) => {
      if (item.poId === poId) {
        item.poId = fallbackPoId;
      }
    });
  });
  saveState();
  render();
}

function addPerson() {
  state.people.push({
    id: createId("person"),
    name: "New person",
    team: "Unassigned",
    poId: state.pos[0].id,
    annualHours: state.settings.defaultAnnualHours,
    ptoDays: state.settings.defaultPtoDays,
    sickDays: state.settings.defaultSickDays,
    holidayDays: state.settings.defaultHolidayDays,
    extraLeaveDays: 0,
    engagements: [engagement("Unassigned", state.pos[0].id, 0, 11, 1)]
  });
  saveState();
  render();
}

function deletePerson(personId) {
  const entry = state.people.find((personEntry) => personEntry.id === personId);
  if (!entry || !confirm(`Delete ${entry.name}?`)) {
    return;
  }

  state.people = state.people.filter((personEntry) => personEntry.id !== personId);
  state.ui.collapsedPeople = state.ui.collapsedPeople.filter((id) => id !== personId);
  saveState();
  render();
}

function addEngagement(personId) {
  const entry = state.people.find((personEntry) => personEntry.id === personId);
  if (!entry) {
    return;
  }

  entry.engagements.push(engagement("Unassigned", state.pos[0].id, 0, 11, 1));
  saveState();
  render();
}

function deleteEngagement(personId, engagementId) {
  const entry = state.people.find((personEntry) => personEntry.id === personId);
  if (!entry) {
    return;
  }

  entry.engagements = entry.engagements.filter((item) => item.id !== engagementId);
  saveState();
  render();
}

function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `po-time-balance-${state.settings.year}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(reader.result));
      saveState();
      render();
    } catch (error) {
      alert("The selected file is not valid dashboard JSON.");
      console.error(error);
    }
  };
  reader.readAsText(file);
}

function resetDemo() {
  if (!confirm("Reset all dashboard data to the demo dataset?")) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.addEventListener("change", (event) => {
  handleSettingChange(event);
  handleInputChange(event);
});

document.addEventListener("click", handleCommand);
document.addEventListener("toggle", handleDetailsToggle, true);
window.addEventListener("beforeprint", preparePrintLayout);
window.addEventListener("afterprint", restorePrintLayout);

document.getElementById("import-file").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) {
    importData(file);
  }
  event.target.value = "";
});

render();
