"use strict";

state = loadState();

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
