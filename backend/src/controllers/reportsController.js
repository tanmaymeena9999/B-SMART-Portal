const fs = require('fs');
const { parseExcelFile } = require('../services/excelParser');
const {
    getAdditionalKpiForm,
    getReportById,
    getRetailServiceForm,
    getVinRetentionForm,
    listReports,
    saveAdditionalKpiForm,
    saveRetailServiceForm,
    saveVinRetentionForm,
    updateReportReview,
    upsertMonthlyReport,
} = require('../services/reportService');

const CURRENCY_ALIASES = {
    rupee: 'INR',
    inr: 'INR',
    usd: 'USD',
    dollar: 'USD',
    dollars: 'USD',
    kd: 'KWD',
    kwd: 'KWD',
    dinar: 'KWD',
    aed: 'AED',
    eur: 'EUR',
    gbp: 'GBP',
};

function normalizeCurrencyCode(value = '') {
    const normalized = String(value || '').trim();
    const compact = normalized.toLowerCase().replace(/[^a-z]/g, '');

    if (/^[A-Za-z]{3}$/.test(normalized)) {
        return normalized.toUpperCase();
    }

    return CURRENCY_ALIASES[compact] || compact.slice(0, 3).toUpperCase();
}

async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
        });

        if (!response.ok) {
            return null;
        }

        return response.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchCurrencyRate(req, res, next) {
    try {
        const currency = normalizeCurrencyCode(req.query.currency);

        if (!currency || currency.length !== 3) {
            return res.status(400).json({ message: 'Valid currency code is required.' });
        }

        if (currency === 'USD') {
            return res.json({
                base: 'USD',
                target: 'USD',
                rate: 1,
                provider: 'local',
                fetchedAt: new Date().toISOString(),
            });
        }

        let provider = 'api.frankfurter.app';
        let fetchedAt = new Date().toISOString();
        let rate = null;
        const frankfurterData = await fetchJsonWithTimeout(
            `https://api.frankfurter.app/latest?from=${encodeURIComponent(currency)}&to=USD`
        );

        if (frankfurterData?.rates?.USD) {
            rate = Number(frankfurterData.rates.USD);
            fetchedAt = frankfurterData.date || fetchedAt;
        } else if (currency === 'KWD') {
            const fallbackData = await fetchJsonWithTimeout('https://open.er-api.com/v6/latest/KWD');

            if (fallbackData?.rates?.USD) {
                rate = Number(fallbackData.rates.USD);
                provider = 'open.er-api.com';
                fetchedAt = fallbackData.time_last_update_utc || fetchedAt;
            }
        }

        if (!Number.isFinite(rate) || rate <= 0) {
            const error = new Error(`USD conversion rate is not available for ${currency}.`);
            error.statusCode = 502;
            throw error;
        }

        return res.json({
            base: currency,
            target: 'USD',
            rate,
            provider,
            fetchedAt,
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            error.message = 'Currency conversion API timed out.';
            error.statusCode = 504;
        }

        return next(error);
    }
}

async function uploadMonthlyReport(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required.' });
        }

        const parsedWorkbook = parseExcelFile(req.file.path);
        const report = await upsertMonthlyReport({
            user: req.user,
            reportType: req.body.reportType,
            reportMonth: req.body.reportMonth,
            file: req.file,
            parsedWorkbook,
            formData: req.body.reportType === 'retail_service_activity'
                ? parsedWorkbook.retailServiceFormData
                : req.body.reportType === 'additional_kpi'
                    ? parsedWorkbook.additionalKpiFormData
                    : parsedWorkbook.vinRetentionFormData,
        });

        fs.unlink(req.file.path, () => {});

        return res.status(201).json({
            report: {
                id: report.reportKey || report.id,
                reportKey: report.reportKey,
                reportType: report.reportType,
                reportMonth: report.reportMonth,
                dealerId: report.dealerId,
                dealerName: report.dealerName,
                dealerCode: report.dealerCode || report.distributorCode,
                distributorCode: report.distributorCode,
                countryCode: report.countryCode,
                fileName: report.fileName,
                sheetCount: report.parsedWorkbook.sheetCount,
                rowCount: report.parsedWorkbook.sheets.reduce((total, sheet) => total + sheet.rowCount, 0),
                changeCount: report.changes.length,
                source: report.source,
                status: report.status,
                updatedAt: report.updatedAt,
            },
        });
    } catch (error) {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }

        return next(error);
    }
}

async function getMonthlyReports(req, res, next) {
    try {
        const reports = await listReports({
            user: req.user,
            dealerCode: req.query.dealerCode,
            period: req.query.period,
            reportMonth: req.query.reportMonth,
            reportType: req.query.reportType,
            submittedOnly: req.query.submittedOnly === 'true',
        });

        return res.json({ reports });
    } catch (error) {
        return next(error);
    }
}

async function getMonthlyReport(req, res, next) {
    try {
        const report = await getReportById({
            user: req.user,
            id: req.params.id,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function reviewMonthlyReport(req, res, next) {
    try {
        const report = await updateReportReview({
            user: req.user,
            id: req.params.id,
            action: req.body.action,
            comments: req.body.comments,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function getRetailServiceReport(req, res, next) {
    try {
        const report = await getRetailServiceForm({
            user: req.user,
            dealerCode: req.query.dealerCode,
            reportMonth: req.query.reportMonth,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function saveRetailServiceReport(req, res, next) {
    try {
        const report = await saveRetailServiceForm({
            user: req.user,
            reportMonth: req.body.reportMonth,
            formData: req.body.formData,
            status: req.body.status,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function getAdditionalKpiReport(req, res, next) {
    try {
        const report = await getAdditionalKpiForm({
            user: req.user,
            dealerCode: req.query.dealerCode,
            reportMonth: req.query.reportMonth,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function saveAdditionalKpiReport(req, res, next) {
    try {
        const report = await saveAdditionalKpiForm({
            user: req.user,
            reportMonth: req.body.reportMonth,
            formData: req.body.formData,
            status: req.body.status,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function getVinRetentionReport(req, res, next) {
    try {
        const report = await getVinRetentionForm({
            user: req.user,
            dealerCode: req.query.dealerCode,
            reportMonth: req.query.reportMonth,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

async function saveVinRetentionReport(req, res, next) {
    try {
        const report = await saveVinRetentionForm({
            user: req.user,
            reportMonth: req.body.reportMonth,
            formData: req.body.formData,
            status: req.body.status,
        });

        return res.json({ report });
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    fetchCurrencyRate,
    getAdditionalKpiReport,
    getMonthlyReport,
    getMonthlyReports,
    getRetailServiceReport,
    getVinRetentionReport,
    saveAdditionalKpiReport,
    saveRetailServiceReport,
    saveVinRetentionReport,
    reviewMonthlyReport,
    uploadMonthlyReport,
};
