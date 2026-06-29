import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";
import { showDialog } from "../../components/dialog.js";
import { renderReviewPanel } from "../../components/review-panel.js";
import {
  getSessionUser,
  getCurrencyRate,
  getRetailServiceReport,
  saveRetailServiceReport,
  uploadMonthlyReportExcel,
} from "../../shared/js/api.js";
import {
  RETAIL_FORM_FIELDS,
  RETAIL_MONTHS,
  RETAIL_ROWS,
} from "./retail-service-template.js";

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
const selectedMonthIndex = Number(currentReportMonth.split("-")[1]) - 1;
const currentMonth = RETAIL_MONTHS.find((month) => month.monthIndex === selectedMonthIndex) || RETAIL_MONTHS[0];
const currentFinancialYear = getFinancialYearFromReportMonth(currentReportMonth);

renderNavbar();
renderSidebar({ active: isReadOnlyReport ? "view" : "retail", variant: isReadOnlyReport ? "view" : "fill" });
bindBackButtons();

if (isViewMode) {
  const title = document.querySelector(".report-tabs h1");
  const activeTab = document.querySelector(".active-tab");

  if (title) {
    title.textContent = "View Report";
  }

  if (activeTab) {
    activeTab.textContent = "Retail Service Activity Report";
  }
}

const retailExcelUpload = document.getElementById("retailExcelUpload");
const retailReportCard = document.querySelector(".report-card");
const toggleRetailDetailsButton = document.getElementById("toggleRetailDetails");
const retailTableHead = document.getElementById("retailTableHead");
const retailTableBody = document.getElementById("retailTableBody");
const copyLastMonthButton = document.getElementById("copyLastMonthButton");
const draftRetailReportButton = document.getElementById("draftRetailReportButton");
const submitRetailReportButton = document.getElementById("submitRetailReportButton");
const conversionRateInput = document.getElementById("conversionRate");
const applyConversionRateButton = document.getElementById("applyConversionRate");
const convertedAmountText = document.getElementById("convertedAmountText");
let currentRows = getDefaultRows();
let convertedAmount = 0;
let liveCurrencyRate = null;
const USD_CONVERSION_SECTION_LABELS = [
  "Service Entry (Customer paid)",
  "Service Entry (Free for customer)",
  "Profitability (Customer paid)",
  "Profitability (Free for customer)",
];

const currentMonthPosition = RETAIL_MONTHS.findIndex((month) => month.key === currentMonth.key);
const reportMonthsThroughCurrent = RETAIL_MONTHS.slice(0, currentMonthPosition + 1);
const previousMonth = RETAIL_MONTHS[(currentMonthPosition + RETAIL_MONTHS.length - 1) % RETAIL_MONTHS.length];

function setDetailsCollapsed(collapsed) {
  retailReportCard?.classList.toggle("details-collapsed", collapsed);

  if (toggleRetailDetailsButton) {
    toggleRetailDetailsButton.setAttribute("aria-expanded", String(!collapsed));
    toggleRetailDetailsButton.textContent = collapsed ? "Show details" : "Minimize details";
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getFieldElement(key) {
  return document.getElementById(key);
}

function getInput(rowIndex, monthKey) {
  return document.querySelector(`[data-row-index="${rowIndex}"][data-month-key="${monthKey}"]`);
}

function getFinancialYearFromReportMonth(reportMonth) {
  const [yearValue, monthValue] = reportMonth.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const startYear = month >= 4 ? year : year - 1;
  const endYear = String(startYear + 1).slice(-2);

  return `${startYear}-${endYear}`;
}

function parseAmount(value) {
  const number = Number(String(value || "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(number) ? number : 0;
}

function normalizeCurrencyCode(value = "") {
  return String(value || "").trim().toUpperCase();
}

function hasNumericValue(value) {
  return String(value || "").trim() !== "" && Number.isFinite(parseAmount(value));
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function normalizeLabel(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function getUsdConversionSection(row) {
  const item = normalizeLabel(row.item);

  return USD_CONVERSION_SECTION_LABELS.find((label) => item === normalizeLabel(label)) || "";
}

function markUsdConversionRows(rows) {
  let activeSection = "";

  return rows.map((row) => {
    const matchingSection = getUsdConversionSection(row);

    if (matchingSection) {
      activeSection = matchingSection;
    } else if (row.item && !matchingSection) {
      activeSection = "";
    }

    return {
      ...row,
      usdConversionSection: activeSection,
    };
  });
}

function getConvertedUsdValue(value) {
  const rate = parseAmount(conversionRateInput?.value);

  if (!rate || !hasNumericValue(value)) {
    return "";
  }

  return formatAmount(parseAmount(value) * rate);
}

function isEditableReportMonth(monthKey) {
  return reportMonthsThroughCurrent.some((month) => month.key === monthKey);
}

function syncEditableMonthValuesFromInputs() {
  currentRows = currentRows.map((row, rowIndex) => {
    const values = {
      ...buildEmptyValues(),
      ...(row.values || {}),
    };

    reportMonthsThroughCurrent.forEach((month) => {
      const input = getInput(rowIndex, month.key);

      if (input) {
        values[month.key] = input.value.trim();
      }
    });

    return {
      ...row,
      values,
    };
  });
}

function calculateConvertedAmount() {
  syncEditableMonthValuesFromInputs();
  const monthTotal = currentRows.reduce((total, row) => {
    if (!row.usdConversionSection) {
      return total;
    }

    return total + parseAmount(row.values?.[currentMonth.key]) * parseAmount(conversionRateInput?.value);
  }, 0);

  convertedAmount = monthTotal;

  if (convertedAmountText) {
    convertedAmountText.textContent = `USD ${formatAmount(convertedAmount)}`;
  }

  document.querySelectorAll("[data-usd-row-index]").forEach((element) => {
    const rowIndex = Number(element.dataset.usdRowIndex);
    const monthKey = element.dataset.usdMonthKey;
    const row = currentRows[rowIndex];
    element.textContent = row?.usdConversionSection ? getConvertedUsdValue(row.values?.[monthKey]) : "";
  });
}

async function fetchAndApplyLiveCurrencyRate() {
  const currency = normalizeCurrencyCode(getFieldElement("currency")?.value);

  if (!currency) {
    throw new Error("Currency is required before fetching the live USD conversion rate.");
  }

  const data = await getCurrencyRate(currency);
  liveCurrencyRate = data;

  if (conversionRateInput) {
    conversionRateInput.value = String(data.rate);
  }

  calculateConvertedAmount();
  return data;
}

function buildEmptyValues() {
  return RETAIL_MONTHS.reduce((values, month) => {
    values[month.key] = "";
    return values;
  }, {});
}

function getDefaultRows() {
  return RETAIL_ROWS.map((row, index) => ({
    id: `retail-row-${index + 1}`,
    ...row,
    values: buildEmptyValues(),
  }));
}

function normalizeMatchText(value = "") {
  return String(value || "")
    .replace(/\u3000/g, " ")
    .replace(/\*/g, "")
    .replace(/\s+Currency\s*:\s*[A-Z]+/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function getRowMatchParts(row = {}) {
  return [
    normalizeMatchText(row.category),
    normalizeMatchText(row.item),
    normalizeMatchText(row.subItem),
    normalizeMatchText(row.remark),
  ];
}

function buildRowMatchKeys(row = {}) {
  const [category, item, subItem, remark] = getRowMatchParts(row);
  const keys = [
    [category, item, subItem].filter(Boolean).join("|"),
    [item, subItem].filter(Boolean).join("|"),
    item,
    subItem,
    remark,
  ];

  return [...new Set(keys.filter(Boolean))];
}

function hasAnyMonthValue(row = {}) {
  return RETAIL_MONTHS.some((month) => String(row.values?.[month.key] || "").trim());
}

function mergeRowsIntoTemplate(sourceRows = []) {
  const matchedSourceIndexes = new Set();
  const sourceByKey = new Map();

  sourceRows.forEach((row, index) => {
    buildRowMatchKeys(row).forEach((key) => {
      if (!sourceByKey.has(key)) {
        sourceByKey.set(key, []);
      }

      sourceByKey.get(key).push({ row, index });
    });
  });

  return getDefaultRows().map((templateRow, templateIndex) => {
    const keys = buildRowMatchKeys(templateRow);
    let match = null;

    for (const key of keys) {
      const candidates = sourceByKey.get(key) || [];
      match = candidates.find((candidate) => !matchedSourceIndexes.has(candidate.index));

      if (match) {
        break;
      }
    }

    if (!match && sourceRows[templateIndex] && hasAnyMonthValue(sourceRows[templateIndex])) {
      match = {
        row: sourceRows[templateIndex],
        index: templateIndex,
      };
    }

    if (!match) {
      return templateRow;
    }

    matchedSourceIndexes.add(match.index);

    return {
      ...templateRow,
      values: {
        ...buildEmptyValues(),
        ...(match.row.values || {}),
      },
      usdValues: match.row.usdValues || templateRow.usdValues,
    };
  });
}

function renderFormDefaults() {
  RETAIL_FORM_FIELDS.forEach((field) => {
    const element = getFieldElement(field.key);

    if (element) {
      element.value = field.key === "fiscalYear" ? currentFinancialYear : field.defaultValue || "";
    }
  });
}

function renderTable(rows = getDefaultRows()) {
  currentRows = markUsdConversionRows(rows);
  retailTableHead.innerHTML = `
    <tr>
      <th>Category</th>
      <th>Item</th>
      <th>Sub-Item</th>
      <th>Remarks</th>
      ${RETAIL_MONTHS.map((month) => `<th class="${month.key === currentMonth.key ? "current-month" : ""}">${month.label}</th>`).join("")}
    </tr>
  `;

  retailTableBody.innerHTML = currentRows
    .map((row, rowIndex) => {
      const values = row.values || buildEmptyValues();

      return `
        <tr>
          <td title="${escapeHtml(row.category)}">${escapeHtml(row.category)}</td>
          <td title="${escapeHtml(row.item)}">${escapeHtml(row.item)}</td>
          <td title="${escapeHtml(row.subItem)}">${escapeHtml(row.subItem)}</td>
          <td title="${escapeHtml(row.remark)}">${escapeHtml(row.remark).replace(/\n/g, "<br />")}</td>
          ${RETAIL_MONTHS.map((month) => `
            <td class="${month.key === currentMonth.key ? "current-month" : ""}">
              <input
                class="month-input"
                data-row-index="${rowIndex}"
                data-month-key="${month.key}"
                type="text"
                ${isReadOnlyReport || !isEditableReportMonth(month.key) ? "readonly" : ""}
                value="${escapeHtml(values[month.key] || "")}">
              ${row.usdConversionSection ? `
                <span
                  class="usd-converted-value"
                  data-usd-row-index="${rowIndex}"
                  data-usd-month-key="${month.key}">
                  ${escapeHtml(getConvertedUsdValue(values[month.key]))}
                </span>
              ` : ""}
            </td>
          `).join("")}
        </tr>
      `;
    })
    .join("");
  updateSubmitState();
  calculateConvertedAmount();
  applyReadOnlyState();
}

function collectFormData() {
  const fields = RETAIL_FORM_FIELDS.reduce((result, field) => {
    const element = getFieldElement(field.key);
    result[field.key] = element ? element.value.trim() : "";
    return result;
  }, {});

  fields.fiscalYear = fields.fiscalYear || currentFinancialYear;
  fields.conversionRate = conversionRateInput ? conversionRateInput.value.trim() : "";
  fields.convertedAmount = String(convertedAmount || 0);
  fields.convertedMonth = currentMonth.key;
  fields.conversionBaseCurrency = liveCurrencyRate?.base || normalizeCurrencyCode(fields.currency);
  fields.conversionTargetCurrency = "USD";
  fields.conversionRateProvider = liveCurrencyRate?.provider || "";
  fields.conversionRateFetchedAt = liveCurrencyRate?.fetchedAt || "";

  syncEditableMonthValuesFromInputs();

  const rows = currentRows.map((row, rowIndex) => {
    const values = RETAIL_MONTHS.reduce((result, month) => {
      const input = getInput(rowIndex, month.key);
      result[month.key] = input ? input.value.trim() : "";
      return result;
    }, {});

    return {
      ...row,
      id: row.id || `retail-row-${rowIndex + 1}`,
      usdValues: RETAIL_MONTHS.reduce((result, month) => {
        result[month.key] = row.usdConversionSection ? getConvertedUsdValue(values[month.key]) : "";
        return result;
      }, {}),
      values,
    };
  });

  return {
    fields,
    rows,
    highlightedMonth: currentMonth.key,
  };
}

function applyFormData(formData) {
  if (!formData) {
    renderFormDefaults();
    if (conversionRateInput) {
      conversionRateInput.value = "";
    }
    renderTable();
    return;
  }

  RETAIL_FORM_FIELDS.forEach((field) => {
    const element = getFieldElement(field.key);

    if (element) {
      element.value = formData.fields?.[field.key] || (field.key === "fiscalYear" ? currentFinancialYear : field.defaultValue || "");
    }
  });

  if (conversionRateInput) {
    conversionRateInput.value = formData.fields?.conversionRate || "";
  }

  renderTable(mergeRowsIntoTemplate(formData.rows || []));
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

function getMissingReportMonths() {
  syncEditableMonthValuesFromInputs();

  return reportMonthsThroughCurrent.filter((month) =>
    !currentRows.some((row) => String(row.values?.[month.key] || "").trim())
  );
}

function getRowsMissingCurrentMonthData() {
  syncEditableMonthValuesFromInputs();

  return currentRows
    .map((row, rowIndex) => ({
      rowIndex,
      row,
      currentValue: String(row.values?.[currentMonth.key] || "").trim(),
      hasPriorValue: reportMonthsThroughCurrent
        .filter((month) => month.key !== currentMonth.key)
        .some((month) => String(row.values?.[month.key] || "").trim()),
    }))
    .filter(({ row, currentValue, hasPriorValue }) =>
      !currentValue && hasPriorValue
    );
}

function clearMissingCurrentMonthHighlights() {
  document.querySelectorAll(".month-input.missing-current-month").forEach((input) => {
    input.classList.remove("missing-current-month");
    input.removeAttribute("aria-invalid");
  });
}

function highlightMissingCurrentMonthData() {
  clearMissingCurrentMonthHighlights();

  const missingRows = getRowsMissingCurrentMonthData();

  missingRows.forEach(({ rowIndex }) => {
    const input = getInput(rowIndex, currentMonth.key);

    if (input) {
      input.classList.add("missing-current-month");
      input.setAttribute("aria-invalid", "true");
    }
  });

  const firstMissing = missingRows.length ? getInput(missingRows[0].rowIndex, currentMonth.key) : null;

  if (firstMissing) {
    firstMissing.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    firstMissing.focus({ preventScroll: true });
  }

  return missingRows;
}

function updateSubmitState() {
  if (isReadOnlyReport) {
    if (submitRetailReportButton) {
      submitRetailReportButton.disabled = true;
      submitRetailReportButton.title = "Country managers can view reports only.";
    }
    return;
  }

  const missingMonths = getMissingReportMonths();
  const canSubmit = missingMonths.length === 0;
  submitRetailReportButton.disabled = false;
  submitRetailReportButton.title = canSubmit
    ? ""
    : `Enter or upload data through ${currentMonth.label}. Missing: ${missingMonths.map((month) => month.label).join(", ")}.`;
}

function setSaveButtonsDisabled(disabled) {
  if (draftRetailReportButton) {
    draftRetailReportButton.disabled = disabled;
  }
  submitRetailReportButton.disabled = disabled;
}

async function saveRetailReport(status) {
  if (isReadOnlyReport) {
    window.alert("Country managers can view reports only.");
    return;
  }

  try {
    setSaveButtonsDisabled(true);

    if (status === "submitted") {
      const missingMonths = getMissingReportMonths();
      const missingCurrentRows = highlightMissingCurrentMonthData();

      if (missingMonths.length) {
        window.alert(`Enter or upload data through ${currentMonth.label}. Missing: ${missingMonths.map((month) => month.label).join(", ")}.`);
        return;
      }

      if (missingCurrentRows.length) {
        await showDialog({
          title: "Current Month Data Missing",
          message: `Some rows in ${currentMonth.label} are blank. The missing cells have been highlighted. Please complete or confirm the data before submitting.`,
          buttonText: "Review",
        });
        return;
      }

      await fetchAndApplyLiveCurrencyRate();
    }

    await saveRetailServiceReport({
      reportMonth: currentReportMonth,
      formData: collectFormData(),
      status,
    });
    if (status === "draft") {
      window.alert("Retail service report saved as draft.");
    } else {
      await showDialog({
        title: "Report Submitted",
        message: "Retail Service Activity Report has been submitted successfully and stored as a separate submission copy.",
        buttonText: "Done",
      });
    }
  } catch (error) {
    window.alert(error.message);
  } finally {
    if (draftRetailReportButton) {
      draftRetailReportButton.disabled = false;
    }
    updateSubmitState();
  }
}

function copyPreviousMonthData() {
  if (isReadOnlyReport) {
    return;
  }

  let copiedCells = 0;

  currentRows = currentRows.map((row, rowIndex) => {
    const previousValue = String(row.values?.[previousMonth.key] || "").trim();
    const values = {
      ...buildEmptyValues(),
      ...(row.values || {}),
    };

    if (previousValue) {
      values[currentMonth.key] = previousValue;
      copiedCells += 1;
    }

    const input = getInput(rowIndex, currentMonth.key);
    if (input) {
      input.value = values[currentMonth.key] || "";
    }

    return {
      ...row,
      values,
    };
  });

  calculateConvertedAmount();
  updateSubmitState();

  if (!copiedCells) {
    window.alert(`No ${previousMonth.label} data found to copy.`);
    return;
  }

  showDialog({
    title: "Previous Month Data Copied",
    message: `${previousMonth.label} data has been copied into ${currentMonth.label}. Please review the copied values carefully before submitting.`,
    buttonText: "Review",
  });
}

async function loadSavedReport() {
  try {
    const data = await getRetailServiceReport(requestedReportMonth || undefined, selectedDealerCode);

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

  [copyLastMonthButton, draftRetailReportButton, submitRetailReportButton, applyConversionRateButton].forEach((button) => {
    if (button) {
      button.hidden = true;
      button.disabled = true;
    }
  });

  document.querySelectorAll("label[for='retailExcelUpload']").forEach((label) => {
    label.hidden = true;
  });
}

document.querySelectorAll("[data-secondary-back-button]").forEach(function (button) {
  button.addEventListener("click", function () {
    window.history.back();
  });
});

if (copyLastMonthButton) {
  copyLastMonthButton.textContent = "Copy Prev Month Data";
  if (!isReadOnlyReport) {
    copyLastMonthButton.addEventListener("click", copyPreviousMonthData);
  }
}

if (toggleRetailDetailsButton) {
  toggleRetailDetailsButton.addEventListener("click", function () {
    setDetailsCollapsed(!retailReportCard?.classList.contains("details-collapsed"));
  });
}

if (conversionRateInput) {
  if (!isReadOnlyReport) {
    conversionRateInput.addEventListener("input", calculateConvertedAmount);
  }
}

if (retailTableBody && !isReadOnlyReport) {
  retailTableBody.addEventListener("input", function (event) {
    if (event.target.matches(".month-input")) {
      if (event.target.dataset.monthKey === currentMonth.key && event.target.value.trim()) {
        event.target.classList.remove("missing-current-month");
        event.target.removeAttribute("aria-invalid");
      }

      calculateConvertedAmount();
      updateSubmitState();
    }
  });
}

if (applyConversionRateButton && !isReadOnlyReport) {
  applyConversionRateButton.addEventListener("click", async function () {
    try {
      await fetchAndApplyLiveCurrencyRate();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

if (draftRetailReportButton && !isReadOnlyReport) {
  draftRetailReportButton.addEventListener("click", function () {
    saveRetailReport("draft");
  });
}

if (submitRetailReportButton && !isReadOnlyReport) {
  submitRetailReportButton.addEventListener("click", function () {
    saveRetailReport("submitted");
  });
}

if (retailExcelUpload && !isReadOnlyReport) {
  retailExcelUpload.addEventListener("change", async function () {
    const [file] = retailExcelUpload.files;

    if (!file) {
      return;
    }

    try {
      await uploadMonthlyReportExcel({
        file,
        reportType: "retail_service_activity",
        reportMonth: currentReportMonth,
      });
      retailExcelUpload.value = "";
      window.alert("Excel uploaded successfully.");
      await loadSavedReport();
    } catch (error) {
      window.alert(error.message);
    }
  });
}

applyFormData();
applyReadOnlyState();
loadSavedReport();
