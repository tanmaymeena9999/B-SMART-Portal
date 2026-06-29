import { hideLoader, showLoader } from "../../components/loader.js";

const API_BASE_URLS = import.meta.env.VITE_API_BASE_URL
  ? [import.meta.env.VITE_API_BASE_URL]
  : ["http://127.0.0.1:3001/api", "http://127.0.0.1:3000/api"];

function getAuthToken() {
  return localStorage.getItem("bsmartAuthToken");
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const loaderMessage = options.loaderMessage || "Loading...";
  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };
  const token = getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  showLoader(loaderMessage);

  try {
    let lastError = null;

    for (const baseUrl of API_BASE_URLS) {
      const url = `${baseUrl}${path}`;

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.status === 204) {
          return null;
        }

        const data = await response.json();

        if (response.ok) {
          return data;
        }

        lastError = new Error(data.message ? `${data.message} (${url})` : `Request failed. (${url})`);

        if (response.status !== 404 || data.message !== "Route not found.") {
          throw lastError;
        }
      } catch (error) {
        lastError = error;

        if (!String(error.message || "").includes("Failed to fetch")) {
          throw error;
        }
      }
    }

    throw lastError || new Error("Request failed.");
  } finally {
    hideLoader();
  }
}

export function saveSession({ token, user }) {
  localStorage.setItem("bsmartAuthToken", token);
  localStorage.setItem("bsmartUser", JSON.stringify(user));
}

export function getSessionUser() {
  const user = localStorage.getItem("bsmartUser");
  return user ? JSON.parse(user) : null;
}

export function clearSession() {
  localStorage.removeItem("bsmartAuthToken");
  localStorage.removeItem("bsmartUser");
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    loaderMessage: "Signing in...",
    body: JSON.stringify({ email, password }),
  });
}

export function getCredentials() {
  return request("/credentials");
}

export function createCredential(payload) {
  return request("/credentials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCredential(id, payload) {
  return request(`/credentials/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCredential(id) {
  return request(`/credentials/${id}`, {
    method: "DELETE",
  });
}

export function uploadMonthlyReportExcel({ file, reportType, reportMonth }) {
  const formData = new FormData();
  formData.append("excel", file);

  if (reportType) {
    formData.append("reportType", reportType);
  }

  if (reportMonth) {
    formData.append("reportMonth", reportMonth);
  }

  return request("/reports/monthly/upload", {
    method: "POST",
    body: formData,
  });
}

export function getMonthlyReports({ reportMonth, reportType, dealerCode, period, submittedOnly } = {}) {
  const params = new URLSearchParams();

  if (dealerCode) {
    params.set("dealerCode", dealerCode);
  }

  if (period) {
    params.set("period", period);
  }

  if (submittedOnly) {
    params.set("submittedOnly", "true");
  }

  if (reportMonth) {
    params.set("reportMonth", reportMonth);
  }

  if (reportType) {
    params.set("reportType", reportType);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  return request(`/reports/monthly${query}`);
}

function buildReportQuery({ reportMonth, dealerCode } = {}) {
  const params = new URLSearchParams();

  if (reportMonth) {
    params.set("reportMonth", reportMonth);
  }

  if (dealerCode) {
    params.set("dealerCode", dealerCode);
  }

  return params.toString() ? `?${params.toString()}` : "";
}

export function getRetailServiceReport(reportMonth, dealerCode) {
  const query = buildReportQuery({ reportMonth, dealerCode });
  return request(`/reports/retail-service${query}`);
}

export function getCurrencyRate(currency) {
  return request(`/reports/currency-rate?currency=${encodeURIComponent(currency)}`);
}

export function saveRetailServiceReport({ reportMonth, formData, status }) {
  return request("/reports/retail-service", {
    method: "POST",
    body: JSON.stringify({ reportMonth, formData, status }),
  });
}

export function getAdditionalKpiReport(reportMonth, dealerCode) {
  const query = buildReportQuery({ reportMonth, dealerCode });
  return request(`/reports/additional-kpi${query}`);
}

export function saveAdditionalKpiReport({ reportMonth, formData, status }) {
  return request("/reports/additional-kpi", {
    method: "POST",
    body: JSON.stringify({ reportMonth, formData, status }),
  });
}

export function getVinRetentionReport(reportMonth, dealerCode) {
  const query = buildReportQuery({ reportMonth, dealerCode });
  return request(`/reports/vin-retention${query}`);
}

export function saveVinRetentionReport({ reportMonth, formData, status }) {
  return request("/reports/vin-retention", {
    method: "POST",
    body: JSON.stringify({ reportMonth, formData, status }),
  });
}

export function reviewMonthlyReport({ id, action, comments }) {
  return request(`/reports/monthly/${encodeURIComponent(id)}/review`, {
    method: "PATCH",
    body: JSON.stringify({ action, comments }),
  });
}
