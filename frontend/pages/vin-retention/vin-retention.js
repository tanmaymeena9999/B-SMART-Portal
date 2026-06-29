import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";
import { showDialog } from "../../components/dialog.js";
import { renderReviewPanel } from "../../components/review-panel.js";
import {
  getSessionUser,
  getVinRetentionReport,
  saveVinRetentionReport,
  uploadMonthlyReportExcel,
} from "../../shared/js/api.js";

const currentDate = new Date();
const urlParams = new URLSearchParams(window.location.search);
const defaultReportMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
const requestedReportMonth = urlParams.get("reportMonth") || "";
const currentReportMonth = requestedReportMonth || defaultReportMonth;
const selectedDealerCode = urlParams.get("dealerCode") || "";
const isViewMode = urlParams.get("mode") === "view";
const isEditMode = urlParams.get("mode") === "edit";
const sessionUser = getSessionUser();
const isViewingSelectedDealerReport = Boolean(selectedDealerCode);
const isReadOnlyReport = isViewMode || (isViewingSelectedDealerReport && !isEditMode) || sessionUser?.role === "country_manager";

renderNavbar();
renderSidebar({ active: isReadOnlyReport ? "view" : "vin", variant: isReadOnlyReport ? "view" : "fill" });
bindBackButtons();

if (isViewMode) {
  const title = document.querySelector(".report-tabs h1");

  if (title) {
    title.textContent = "View Report";
  }
}

const vinDataToggle = document.getElementById("vinDataToggle");
const vinTableHead = document.getElementById("vinTableHead");
const vinTableBody = document.getElementById("vinTableBody");
const addVinRowButton = document.getElementById("addVinRowButton");
const draftVinButton = document.getElementById("draftVinButton");
const submitVinButton = document.getElementById("submitVinButton");
const vinExcelUpload = document.getElementById("vinExcelUpload");

const tableModes = {
  retail: {
    label: "Retail Sales data",
    className: "mode-retail",
    columns: [
      { key: "vinNumber", label: "VIN Number", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "dateOfSale", label: "Date of Sale", type: "date" },
      { key: "typeOfSale", label: "Type of Sale (Retail / Fleet / Rental etc.)", type: "text" },
    ],
  },
  service: {
    label: "Service Data",
    className: "mode-service",
    columns: [
      { key: "vinNumber", label: "VIN Number", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "dateOfService", label: "Date of Service", type: "date" },
      { key: "typeOfService", label: "Type of Service (PMS / General Repair / Warranty / recall etc.)", type: "text" },
      { key: "mileage", label: "Mileage", type: "text" },
    ],
  },
};

let currentMode = "retail";
let retailRows = [];
let serviceRows = [];

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRowsForMode(modeKey) {
  return modeKey === "retail" ? retailRows : serviceRows;
}

function setRowsForMode(modeKey, rows) {
  if (modeKey === "retail") {
    retailRows = rows;
  } else {
    serviceRows = rows;
  }
}

function emptyRow(modeKey) {
  const row = { id: `vin-${modeKey}-${Date.now()}-${Math.random().toString(16).slice(2)}` };
  tableModes[modeKey].columns.forEach((column) => {
    row[column.key] = "";
  });
  return row;
}

function collectCurrentModeRows() {
  const mode = tableModes[currentMode];
  const rows = Array.from(vinTableBody.querySelectorAll("tr")).map((rowElement, rowIndex) => {
    const existing = getRowsForMode(currentMode)[rowIndex] || emptyRow(currentMode);

    mode.columns.forEach((column) => {
      const input = rowElement.querySelector(`[data-vin-key="${column.key}"]`);
      existing[column.key] = input ? input.value.trim() : "";
    });

    return existing;
  });

  setRowsForMode(currentMode, rows);
}

function renderVinTable(modeKey) {
  const mode = tableModes[modeKey];
  const rows = getRowsForMode(modeKey);

  vinDataToggle.dataset.mode = modeKey;
  vinDataToggle.setAttribute("aria-pressed", String(modeKey === "service"));
  vinTableHead.innerHTML = `
    <tr>
      <th>Sl No.</th>
      ${mode.columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
    </tr>
  `;
  vinTableBody.innerHTML = rows
    .map((row, rowIndex) => `
      <tr>
        <td>${rowIndex + 1}</td>
        ${mode.columns.map((column) => `
          <td>
            <input
              class="vin-input"
              data-vin-key="${column.key}"
              type="${column.type}"
              ${isReadOnlyReport ? "readonly" : ""}
              value="${escapeHtml(row[column.key] || "")}">
          </td>
        `).join("")}
      </tr>
    `)
    .join("");
  document.querySelector(".vin-table").classList.remove("mode-retail", "mode-service");
  document.querySelector(".vin-table").classList.add(mode.className);
  applyReadOnlyState();
}

function applyFormData(formData) {
  retailRows = formData?.retailRows?.length ? formData.retailRows : [emptyRow("retail")];
  serviceRows = formData?.serviceRows?.length ? formData.serviceRows : [emptyRow("service")];
  renderVinTable(currentMode);
}

function collectFormData() {
  collectCurrentModeRows();

  return {
    retailRows,
    serviceRows,
  };
}

function redirectToLoadedReportMonth(report) {
  if (requestedReportMonth || !report?.reportMonth || report.reportMonth === currentReportMonth) {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  params.set("reportMonth", report.reportMonth);
  window.location.replace(`${window.location.pathname}?${params.toString()}`);
  return true;
}

async function loadSavedReport() {
  try {
    const data = await getVinRetentionReport(requestedReportMonth || undefined, selectedDealerCode);

    if (redirectToLoadedReportMonth(data.report)) {
      return;
    }

    applyFormData(data.report?.formData);
    renderReviewPanel({ report: data.report });
  } catch (error) {
    applyFormData();
    window.alert(error.message);
  }
}

vinDataToggle.addEventListener("click", function () {
  collectCurrentModeRows();
  currentMode = currentMode === "retail" ? "service" : "retail";
  renderVinTable(currentMode);
});

if (addVinRowButton && !isReadOnlyReport) {
  addVinRowButton.addEventListener("click", function () {
    collectCurrentModeRows();
    setRowsForMode(currentMode, [...getRowsForMode(currentMode), emptyRow(currentMode)]);
    renderVinTable(currentMode);
  });
}

function setVinSaveButtonsDisabled(disabled) {
  if (isReadOnlyReport) {
    return;
  }

  if (draftVinButton) {
    draftVinButton.disabled = disabled;
  }
  submitVinButton.disabled = disabled;
}

async function saveVinReport(status) {
  if (isReadOnlyReport) {
    window.alert("Country managers can view reports only.");
    return;
  }

  try {
    setVinSaveButtonsDisabled(true);
    await saveVinRetentionReport({
      reportMonth: currentReportMonth,
      formData: collectFormData(),
      status,
    });
    if (status === "draft") {
      window.alert("VIN retention data saved as draft.");
    } else {
      await showDialog({
        title: "Report Submitted",
        message: "VIN Retention report has been submitted successfully and stored as a separate submission copy.",
        buttonText: "Done",
      });
    }
  } catch (error) {
    window.alert(error.message);
  } finally {
    setVinSaveButtonsDisabled(false);
  }
}

function applyReadOnlyState() {
  if (!isReadOnlyReport) {
    return;
  }

  document.querySelectorAll(".report-card input, .report-card textarea, .report-card select").forEach((element) => {
    if (element.closest(".review-panel")) {
      return;
    }

    element.disabled = true;
    element.readOnly = true;
  });

  [addVinRowButton, draftVinButton, submitVinButton].forEach((button) => {
    if (button) {
      button.hidden = true;
      button.disabled = true;
    }
  });

  document.querySelectorAll("label[for='vinExcelUpload']").forEach((label) => {
    label.hidden = true;
  });
}

if (draftVinButton && !isReadOnlyReport) {
  draftVinButton.addEventListener("click", function () {
    saveVinReport("draft");
  });
}

if (submitVinButton && !isReadOnlyReport) {
  submitVinButton.addEventListener("click", function () {
    saveVinReport("submitted");
  });
}

if (vinExcelUpload && !isReadOnlyReport) {
  vinExcelUpload.addEventListener("change", async function () {
    const [file] = vinExcelUpload.files;

    if (!file) {
      return;
    }

    try {
      await uploadMonthlyReportExcel({
        file,
        reportType: "vin_retention",
        reportMonth: currentReportMonth,
      });
      vinExcelUpload.value = "";
      window.alert("Excel uploaded successfully.");
      await loadSavedReport();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

document.querySelectorAll("[data-secondary-back-button]").forEach(function (button) {
  button.addEventListener("click", function () {
    window.history.back();
  });
});

applyFormData();
applyReadOnlyState();
loadSavedReport();
