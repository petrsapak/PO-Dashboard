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

let state;

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
