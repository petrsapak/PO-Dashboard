"use strict";

let suppressDetailsPersistence = false;
let printDetailsSnapshot = null;

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
