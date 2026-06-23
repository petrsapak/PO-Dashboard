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
const chartTypes = [
  { key: "monthly", label: "Monthly hours" },
  { key: "burndown", label: "Burndown" },
  { key: "cumulative", label: "Cumulative" },
  { key: "forecast", label: "Forecast cone" },
  { key: "health", label: "Health matrix" }
];

let state = loadState();
let suppressDetailsPersistence = false;
let printDetailsSnapshot = null;

function defaultState() {
  const year = new Date().getFullYear();
  const pos = [
    { id: "po-core", name: "PO-001 Core delivery", annualHours: 3300, color: poPalette[0], startDate: yearStartDate(year), endDate: yearEndDate(year), startMonth: 0, endMonth: 11 },
    { id: "po-platform", name: "PO-002 Platform", annualHours: 3100, color: poPalette[1], startDate: yearStartDate(year), endDate: yearEndDate(year), startMonth: 0, endMonth: 11 },
    { id: "po-integration", name: "PO-003 Integration", annualHours: 2800, color: poPalette[2], startDate: yearStartDate(year), endDate: yearEndDate(year), startMonth: 0, endMonth: 11 },
    { id: "po-support", name: "PO-004 Support", annualHours: 2600, color: poPalette[3], startDate: yearStartDate(year), endDate: yearEndDate(year), startMonth: 0, endMonth: 11 }
  ];

  return normalizeState({
    settings: {
      reportName: "",
      year,
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

function engagement(team, poId, startMonth, endMonth, fte, year = new Date().getFullYear()) {
  return {
    id: createId("engagement"),
    team,
    poId,
    startDate: monthStartDate(year, startMonth),
    endDate: monthEndDate(year, endMonth),
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
    reportName:
      safe.settings && typeof safe.settings.reportName === "string"
        ? safe.settings.reportName
        : "",
    year: normalizeReportYear(safe.settings && safe.settings.year),
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
  const normalizedPos = pos.map((po, index) => normalizePo(po, index, settings.year));

  if (!normalizedPos.length) {
    normalizedPos.push({
      id: "po-1",
      name: "PO-001",
      annualHours: 0,
      color: poPalette[0],
      startDate: yearStartDate(settings.year),
      endDate: yearEndDate(settings.year),
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
    ? safe.people.map((entry) => normalizePerson(entry, fallbackPoId, validPoIds, settings.year))
    : [];
  const peopleIds = new Set(people.map((entry) => entry.id));
  const safeUi = safe.ui && typeof safe.ui === "object" ? safe.ui : {};
  const visibleChartPoIds = Array.isArray(safeUi.visibleChartPoIds)
    ? normalizeKeyList(safeUi.visibleChartPoIds).filter((id) => validPoIds.has(id))
    : normalizedPos.map((po) => po.id);
  const ui = {
    collapsedSections: normalizeKeyList(safeUi.collapsedSections),
    collapsedPeople: normalizeKeyList(safeUi.collapsedPeople).filter((id) => peopleIds.has(id)),
    visibleChartPoIds,
    chartType: normalizeChartType(safeUi.chartType)
  };

  return { settings, pos: normalizedPos, monthlyHours, invoicedMonths, people, ui };
}

function normalizePo(po, index, year = normalizeReportYear()) {
  const rawStartMonth = clamp(numberOr(po.startMonth, 0), 0, 11);
  const rawEndMonth = clamp(numberOr(po.endMonth, 11), 0, 11);
  const fallbackStartMonth = Math.min(rawStartMonth, rawEndMonth);
  const fallbackEndMonth = Math.max(rawStartMonth, rawEndMonth);
  let startDate = normalizeDateForYear(
    po.startDate,
    year,
    monthStartDate(year, fallbackStartMonth)
  );
  let endDate = normalizeDateForYear(
    po.endDate,
    year,
    monthEndDate(year, fallbackEndMonth)
  );
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  const startMonth = dateMonthIndex(startDate);
  const endMonth = dateMonthIndex(endDate);
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
    startDate,
    endDate,
    startMonth: Math.min(startMonth, endMonth),
    endMonth: Math.max(startMonth, endMonth)
  };
}

function normalizePerson(entry, fallbackPoId, validPoIds, year = normalizeReportYear()) {
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
    engagements: rawEngagements.map((item) => normalizeEngagement(item, fallbackPoId, validPoIds, year))
  };
}

function normalizeEngagement(item, fallbackPoId, validPoIds, year = normalizeReportYear()) {
  const rawStartMonth = clamp(numberOr(item.startMonth, 0), 0, 11);
  const rawEndMonth = clamp(numberOr(item.endMonth, 11), 0, 11);
  const fallbackStartMonth = Math.min(rawStartMonth, rawEndMonth);
  const fallbackEndMonth = Math.max(rawStartMonth, rawEndMonth);
  let startDate = normalizeDateForYear(
    item.startDate,
    year,
    monthStartDate(year, fallbackStartMonth)
  );
  let endDate = normalizeDateForYear(
    item.endDate,
    year,
    monthEndDate(year, fallbackEndMonth)
  );
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }
  const startMonth = dateMonthIndex(startDate);
  const endMonth = dateMonthIndex(endDate);
  return {
    id: item.id || createId("engagement"),
    team: item.team || "Unassigned",
    poId: validPoIds.has(item.poId) ? item.poId : fallbackPoId,
    startDate,
    endDate,
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

function normalizeChartType(value) {
  return chartTypes.some((type) => type.key === value) ? value : "monthly";
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReportYear(value = new Date().getFullYear()) {
  return clamp(Math.trunc(numberOr(value, new Date().getFullYear())), 1000, 9999);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoDate(year, monthIndex, day) {
  return `${normalizeReportYear(year)}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(normalizeReportYear(year), monthIndex + 1, 0).getDate();
}

function monthStartDate(year, monthIndex) {
  return isoDate(year, monthIndex, 1);
}

function monthEndDate(year, monthIndex) {
  return isoDate(year, monthIndex, daysInMonth(year, monthIndex));
}

function yearStartDate(year) {
  return monthStartDate(year, 0);
}

function yearEndDate(year) {
  return monthEndDate(year, 11);
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > daysInMonth(year, monthIndex)) {
    return null;
  }

  return { year, monthIndex, day, value: isoDate(year, monthIndex, day) };
}

function normalizeDateForYear(value, year, fallback) {
  const parsed = parseIsoDate(value) || parseIsoDate(fallback) || parseIsoDate(yearStartDate(year));
  const monthIndex = clamp(parsed.monthIndex, 0, 11);
  const day = clamp(parsed.day, 1, daysInMonth(year, monthIndex));
  return isoDate(year, monthIndex, day);
}

function dateMonthIndex(value) {
  const parsed = parseIsoDate(value);
  return parsed ? parsed.monthIndex : 0;
}

function syncPoMonthsFromDates(po) {
  po.startMonth = dateMonthIndex(po.startDate);
  po.endMonth = dateMonthIndex(po.endDate);
}

function syncEngagementMonthsFromDates(item) {
  item.startMonth = dateMonthIndex(item.startDate);
  item.endMonth = dateMonthIndex(item.endDate);
}

function setPoDate(po, field, value) {
  const fallback = field === "startDate" ? po.startDate : po.endDate;
  po[field] = normalizeDateForYear(value, state.settings.year, fallback);
  if (po.startDate > po.endDate) {
    if (field === "startDate") {
      po.endDate = po.startDate;
    } else {
      po.startDate = po.endDate;
    }
  }
  syncPoMonthsFromDates(po);
}

function setPoMonthBoundary(po, field, value) {
  const monthIndex = clamp(numberOr(value, po[field]), 0, 11);
  if (field === "startMonth") {
    po.startDate = monthStartDate(state.settings.year, monthIndex);
    if (po.startDate > po.endDate) {
      po.endDate = monthEndDate(state.settings.year, monthIndex);
    }
  } else {
    po.endDate = monthEndDate(state.settings.year, monthIndex);
    if (po.startDate > po.endDate) {
      po.startDate = monthStartDate(state.settings.year, monthIndex);
    }
  }
  syncPoMonthsFromDates(po);
}

function setEngagementDate(item, field, value) {
  const fallback = field === "startDate" ? item.startDate : item.endDate;
  item[field] = normalizeDateForYear(value, state.settings.year, fallback);
  if (item.startDate > item.endDate) {
    if (field === "startDate") {
      item.endDate = item.startDate;
    } else {
      item.startDate = item.endDate;
    }
  }
  syncEngagementMonthsFromDates(item);
}

function setEngagementMonthBoundary(item, field, value) {
  const monthIndex = clamp(numberOr(value, item[field]), 0, 11);
  if (field === "startMonth") {
    item.startDate = monthStartDate(state.settings.year, monthIndex);
    if (item.startDate > item.endDate) {
      item.endDate = monthEndDate(state.settings.year, monthIndex);
    }
  } else {
    item.endDate = monthEndDate(state.settings.year, monthIndex);
    if (item.startDate > item.endDate) {
      item.startDate = monthStartDate(state.settings.year, monthIndex);
    }
  }
  syncEngagementMonthsFromDates(item);
}

function normalizePosForReportYear() {
  state.pos.forEach((po, index) => {
    Object.assign(po, normalizePo(po, index, state.settings.year));
  });
}

function normalizePeopleForReportYear() {
  const fallbackPoId = state.pos[0] && state.pos[0].id;
  const validPoIds = new Set(state.pos.map((po) => po.id));
  state.people.forEach((entry) => {
    entry.engagements = entry.engagements.map((item) =>
      normalizeEngagement(item, fallbackPoId, validPoIds, state.settings.year)
    );
  });
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

function exportFileName(reportName = state.settings.reportName) {
  const safeName = fileNameSlug(reportName) || "po-time-balance";
  return `${safeName}-${dateTimeStamp()}.json`;
}

function currentReportName() {
  const reportInput = document.querySelector('[data-setting="reportName"]');
  return reportInput ? reportInput.value : state.settings.reportName;
}

function fileNameSlug(value) {
  return String(value)
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function dateTimeStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
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

function poEnteredActiveHours(po, throughMonth = 11) {
  const activeStart = po.startMonth;
  const activeEnd = Math.min(po.endMonth, throughMonth);
  return activeStart <= activeEnd ? poHours(po.id, activeStart, activeEnd) : 0;
}

function poRemainingHours(po, throughMonth = 11) {
  return po.annualHours - poEnteredActiveHours(po, throughMonth);
}

function poInvoicedHours(po, start = 0, end = 11) {
  const activeStart = Math.max(po.startMonth, start);
  const activeEnd = Math.min(po.endMonth, end);
  return activeStart <= activeEnd ? poHours(po.id, activeStart, activeEnd, isInvoicedMonth) : 0;
}

function dateSerial(value) {
  const parsed = parseIsoDate(value);
  return parsed ? Date.UTC(parsed.year, parsed.monthIndex, parsed.day) : 0;
}

function inclusiveDayCount(startDate, endDate) {
  if (startDate > endDate) {
    return 0;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((dateSerial(endDate) - dateSerial(startDate)) / dayMs) + 1;
}

function activeMonthWeight(po, monthIndex) {
  return activeMonthWeightForRange(po.startDate, po.endDate, monthIndex);
}

function activePeriodWeight(po, startMonth = 0, endMonth = 11) {
  return activePeriodWeightForRange(po.startDate, po.endDate, startMonth, endMonth);
}

function activeDaysInMonthForRange(startDate, endDate, monthIndex) {
  const monthStart = monthStartDate(state.settings.year, monthIndex);
  const monthEnd = monthEndDate(state.settings.year, monthIndex);
  const start = startDate > monthStart ? startDate : monthStart;
  const end = endDate < monthEnd ? endDate : monthEnd;
  return inclusiveDayCount(start, end);
}

function activeMonthWeightForRange(startDate, endDate, monthIndex) {
  return activeDaysInMonthForRange(startDate, endDate, monthIndex) / daysInMonth(state.settings.year, monthIndex);
}

function activePeriodWeightForRange(startDate, endDate, startMonth = 0, endMonth = 11) {
  let weight = 0;
  for (let monthIndex = startMonth; monthIndex <= endMonth; monthIndex += 1) {
    weight += activeMonthWeightForRange(startDate, endDate, monthIndex);
  }
  return weight;
}

function monthlyBudgetPace(po, monthIndex) {
  const totalWeight = activePeriodWeight(po);
  return totalWeight ? po.annualHours * (activeMonthWeight(po, monthIndex) / totalWeight) : 0;
}

function isPoActiveInMonth(po, monthIndex) {
  return activeMonthWeight(po, monthIndex) > 0;
}

function isInvoicedMonth(monthIndex) {
  return Boolean(state.invoicedMonths && state.invoicedMonths[monthIndex]);
}

function invoicedActivePeriodWeight(po) {
  return state.invoicedMonths.reduce(
    (count, checked, monthIndex) => count + (checked ? activeMonthWeight(po, monthIndex) : 0),
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

function formatShortDate(value) {
  const parsed = parseIsoDate(value);
  return parsed ? `${parsed.day} ${shortMonths[parsed.monthIndex]}` : "";
}

function poPeriodLabel(po) {
  return `${formatShortDate(po.startDate)}-${formatShortDate(po.endDate)}`;
}

function poPaceTarget(po) {
  const activeMonths = activePeriodWeight(po);
  const elapsedMonths = invoicedActivePeriodWeight(po);
  return activeMonths ? po.annualHours * (elapsedMonths / activeMonths) : 0;
}

function poElapsedRatio(po) {
  const activeMonths = activePeriodWeight(po);
  return activeMonths ? clamp(invoicedActivePeriodWeight(po) / activeMonths, 0, 1) : 0;
}

function poConsumedRatio(po) {
  return po.annualHours > 0 ? Math.max(0, poInvoicedHours(po) / po.annualHours) : 0;
}

function poForecastRiskRatio(po) {
  const budget = Math.max(1, po.annualHours);
  return Math.abs(forecastForPo(po.id) - po.annualHours) / budget;
}

function cumulativeSeriesPoints(po, planned = false, invoicedOnly = false) {
  const points = [{ date: po.startDate, value: 0 }];
  const monthlyHours = state.monthlyHours[po.id] || [];
  let total = 0;

  for (let monthIndex = po.startMonth; monthIndex <= po.endMonth; monthIndex += 1) {
    const includeActual = !invoicedOnly || isInvoicedMonth(monthIndex);
    if (planned) {
      total += monthlyBudgetPace(po, monthIndex);
    } else if (includeActual) {
      total += numberOr(monthlyHours[monthIndex], 0);
    }

    if (planned || includeActual) {
      points.push({
        date: po.endDate < monthEndDate(state.settings.year, monthIndex)
          ? po.endDate
          : monthEndDate(state.settings.year, monthIndex),
        value: Math.abs(total) < 0.0001 ? 0 : total
      });
    }
  }

  return points;
}

function forecastProjectionPoints(po) {
  const actualPoints = cumulativeSeriesPoints(po, false, true);
  const startPoint = actualPoints[actualPoints.length - 1] || { date: po.startDate, value: 0 };
  return [
    startPoint,
    {
      date: po.endDate,
      value: forecastForPo(po.id)
    }
  ];
}

function personCapacity(entry) {
  return entry.engagements.reduce(
    (total, item) => total + engagementCapacityForPo(entry, item),
    0
  );
}

function engagementCountedMonths(item) {
  const po = state.pos.find((candidate) => candidate.id === item.poId);
  if (!po) {
    return activePeriodWeightForRange(item.startDate, item.endDate);
  }

  const startDate = item.startDate > po.startDate ? item.startDate : po.startDate;
  const endDate = item.endDate < po.endDate ? item.endDate : po.endDate;
  return activePeriodWeightForRange(startDate, endDate);
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
  const elapsedMonths = invoicedActivePeriodWeight(po);
  const activeMonths = activePeriodWeight(po);
  return elapsedMonths > 0 && activeMonths > 0 ? (actualToDate / elapsedMonths) * activeMonths : 0;
}

function statusFor(po, forecast) {
  if (invoicedActivePeriodWeight(po) === 0 && forecast === 0) {
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

  if (field === "capacityBasis" || field === "reportName") {
    state.settings[field] = event.target.value;
  } else if (field === "year") {
    state.settings.year = normalizeReportYear(event.target.value);
    normalizePosForReportYear();
    normalizePeopleForReportYear();
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

  if (target.dataset.chartType) {
    state.ui.chartType = normalizeChartType(target.dataset.chartType);
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
    } else if (field === "startDate" || field === "endDate") {
      setPoDate(po, field, target.value);
    } else if (field === "startMonth" || field === "endMonth") {
      setPoMonthBoundary(po, field, target.value);
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
    } else if (field === "startDate" || field === "endDate") {
      setEngagementDate(item, field, target.value);
    } else if (field === "startMonth" || field === "endMonth") {
      setEngagementMonthBoundary(item, field, target.value);
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
    startDate: yearStartDate(state.settings.year),
    endDate: yearEndDate(state.settings.year),
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
    engagements: [engagement("Unassigned", state.pos[0].id, 0, 11, 1, state.settings.year)]
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

  entry.engagements.push(engagement("Unassigned", state.pos[0].id, 0, 11, 1, state.settings.year));
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

async function exportData() {
  state.settings.reportName = currentReportName();
  saveState();

  const data = JSON.stringify(state, null, 2);
  const fileName = exportFileName();
  const blob = new Blob([data], { type: "application/json" });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "JSON files",
            accept: { "application/json": [".json"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }
      console.error("Save dialog export failed", error);
      alert("The file save dialog failed. Using the browser download instead.");
    }
  }

  downloadBlob(blob, fileName);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
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
