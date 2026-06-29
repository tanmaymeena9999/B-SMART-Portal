import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";
import { showDialog } from "../../components/dialog.js";
import { renderReviewPanel } from "../../components/review-panel.js";
import {
  getSessionUser,
  getAdditionalKpiReport,
  saveAdditionalKpiReport,
  uploadMonthlyReportExcel,
} from "../../shared/js/api.js";
import {
  KPI_WORKSHOPS,
  buildDefaultKpiRows,
} from "./additional-kpi-template.js";

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
renderSidebar({ active: isReadOnlyReport ? "view" : "additional", variant: isReadOnlyReport ? "view" : "fill" });
bindBackButtons();

if (isViewMode) {
  const title = document.querySelector(".report-tabs h1");

  if (title) {
    title.textContent = "View Report";
  }
}

const kpiTableHead = document.getElementById("kpiTableHead");
const kpiTableBody = document.getElementById("kpiTableBody");
const draftKpiButton = document.getElementById("draftKpiButton");
const submitKpiButton = document.getElementById("submitKpiButton");
const additionalKpiExcelUpload = document.getElementById("additionalKpiExcelUpload");
const supportingUploadInputs = document.querySelectorAll("[data-supporting-upload]");

const supportingUploadLabels = {
  campPhotograph: "Camp Photograph",
  sqsTraining: "SQS Training",
  inHouseTraining: "In house Training",
};

let currentRows = buildDefaultKpiRows();
let currentWorkshops = KPI_WORKSHOPS;
let currentFields = {
  selectedMonth: "",
  distributorName: "Mustafa Karam and Sons Co. Kuwait",
};
let supportingUploads = {};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getInput(rowIndex, key) {
  return document.querySelector(`[data-row-index="${rowIndex}"][data-kpi-key="${key}"]`);
}

function isPngFile(file) {
  return file?.type === "image/png" || /\.png$/i.test(file?.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Unable to read the selected image.")));
    reader.readAsDataURL(file);
  });
}

function renderSupportingUploadNames() {
  Object.keys(supportingUploadLabels).forEach((key) => {
    const target = document.querySelector(`[data-upload-file-name="${key}"]`);
    const upload = supportingUploads[key];

    if (target) {
      target.textContent = upload?.fileName || "PNG required";
      target.classList.toggle("has-file", Boolean(upload?.fileName));
    }
  });
}

function getMissingSupportingUploads() {
  return Object.keys(supportingUploadLabels).filter((key) => !supportingUploads[key]?.dataUrl);
}

async function handleSupportingUploadChange(input) {
  const key = input.dataset.supportingUpload;
  const [file] = input.files;

  if (!file) {
    return;
  }

  if (!isPngFile(file)) {
    input.value = "";
    window.alert(`${supportingUploadLabels[key]} must be uploaded as a PNG image.`);
    return;
  }

  supportingUploads[key] = {
    fileName: file.name,
    mimeType: "image/png",
    fileSize: file.size,
    dataUrl: await readFileAsDataUrl(file),
    uploadedAt: new Date().toISOString(),
  };
  renderSupportingUploadNames();
}

function renderTable(rows = currentRows, workshops = currentWorkshops, fields = currentFields) {
  currentRows = rows;
  currentWorkshops = workshops;
  currentFields = fields;

  kpiTableHead.innerHTML = `
    <tr>
      <th colspan="3">Select Month: ${escapeHtml(fields.selectedMonth || currentReportMonth)}</th>
      <th colspan="${workshops.length}">NAME OF DISTRIBUTOR : ${escapeHtml(fields.distributorName || "")}</th>
      <th>Remarks, if any</th>
    </tr>
    <tr>
      <th>Sr. No</th>
      <th>PARAMETER</th>
      <th>DETAILS REQUIRED</th>
      ${workshops.map((workshop) => `<th>${escapeHtml(workshop.label)}</th>`).join("")}
      <th>Remarks, if any</th>
    </tr>
  `;

  kpiTableBody.innerHTML = rows
    .map((row, rowIndex) => `
      <tr>
        <td>${escapeHtml(row.srNo)}</td>
        <td>${escapeHtml(row.parameter).replace(/\n/g, "<br />")}</td>
        <td>${escapeHtml(row.detailsRequired)}</td>
        ${workshops.map((workshop) => `
          <td>
            <input
              class="kpi-input"
              data-row-index="${rowIndex}"
              data-kpi-key="${workshop.key}"
              type="text"
              ${isReadOnlyReport ? "readonly" : ""}
              value="${escapeHtml(row.values?.[workshop.key] || "")}">
          </td>
        `).join("")}
        <td>
          <input
            class="kpi-input remarks-input"
            data-row-index="${rowIndex}"
            data-kpi-key="remarks"
            type="text"
            ${isReadOnlyReport ? "readonly" : ""}
            value="${escapeHtml(row.remarks || "")}">
        </td>
      </tr>
    `)
    .join("");
  applyReadOnlyState();
}

function collectFormData() {
  const rows = currentRows.map((row, rowIndex) => {
    const values = currentWorkshops.reduce((result, workshop) => {
      const input = getInput(rowIndex, workshop.key);
      result[workshop.key] = input ? input.value.trim() : "";
      return result;
    }, {});
    const remarksInput = getInput(rowIndex, "remarks");

    return {
      ...row,
      values,
      remarks: remarksInput ? remarksInput.value.trim() : "",
    };
  });

  return {
    fields: currentFields,
    workshops: currentWorkshops,
    rows,
    supportingUploads,
  };
}

function applyFormData(formData) {
  if (!formData) {
    supportingUploads = {};
    renderSupportingUploadNames();
    renderTable(buildDefaultKpiRows(), KPI_WORKSHOPS, currentFields);
    return;
  }

  supportingUploads = formData.supportingUploads || {};
  renderSupportingUploadNames();
  renderTable(
    formData.rows?.length ? formData.rows : buildDefaultKpiRows(),
    formData.workshops?.length ? formData.workshops : KPI_WORKSHOPS,
    {
      ...currentFields,
      ...(formData.fields || {}),
    }
  );
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
    const data = await getAdditionalKpiReport(requestedReportMonth || undefined, selectedDealerCode);

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

function setKpiSaveButtonsDisabled(disabled) {
  if (isReadOnlyReport) {
    return;
  }

  if (draftKpiButton) {
    draftKpiButton.disabled = disabled;
  }
  submitKpiButton.disabled = disabled;
}

async function saveKpiReport(status) {
  if (isReadOnlyReport) {
    window.alert("Country managers can view reports only.");
    return;
  }

  try {
    if (status === "submitted") {
      const missingUploads = getMissingSupportingUploads();

      if (missingUploads.length) {
        window.alert(`Please upload PNG images for: ${missingUploads.map((key) => supportingUploadLabels[key]).join(", ")}.`);
        return;
      }
    }

    setKpiSaveButtonsDisabled(true);
    await saveAdditionalKpiReport({
      reportMonth: currentReportMonth,
      formData: collectFormData(),
      status,
    });
    if (status === "draft") {
      window.alert("Additional KPI report saved as draft.");
    } else {
      await showDialog({
        title: "Report Submitted",
        message: "Additional KPI Report has been submitted successfully and stored as a separate submission copy.",
        buttonText: "Done",
      });
    }
  } catch (error) {
    window.alert(error.message);
  } finally {
    setKpiSaveButtonsDisabled(false);
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

  [draftKpiButton, submitKpiButton].forEach((button) => {
    if (button) {
      button.hidden = true;
      button.disabled = true;
    }
  });

  supportingUploadInputs.forEach((input) => {
    input.disabled = true;
  });

  document.querySelectorAll("label[for='additionalKpiExcelUpload']").forEach((element) => {
    element.hidden = true;
  });
}

if (draftKpiButton && !isReadOnlyReport) {
  draftKpiButton.addEventListener("click", function () {
    saveKpiReport("draft");
  });
}

if (submitKpiButton && !isReadOnlyReport) {
  submitKpiButton.addEventListener("click", function () {
    saveKpiReport("submitted");
  });
}

if (additionalKpiExcelUpload && !isReadOnlyReport) {
  additionalKpiExcelUpload.addEventListener("change", async function () {
    const [file] = additionalKpiExcelUpload.files;

    if (!file) {
      return;
    }

    try {
      await uploadMonthlyReportExcel({
        file,
        reportType: "additional_kpi",
        reportMonth: currentReportMonth,
      });
      additionalKpiExcelUpload.value = "";
      window.alert("Excel uploaded successfully.");
      await loadSavedReport();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

if (!isReadOnlyReport) {
  supportingUploadInputs.forEach((input) => {
    input.addEventListener("change", function () {
      handleSupportingUploadChange(input).catch((error) => {
        input.value = "";
        window.alert(error.message);
      });
    });
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
