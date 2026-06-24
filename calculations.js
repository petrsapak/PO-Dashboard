"use strict";

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

function engagementAbsenceHours(entry, item) {
  return (absenceHours(entry) * engagementCountedMonths(item) * numberOr(item.fte, 0)) / 12;
}
