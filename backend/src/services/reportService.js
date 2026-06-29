const Report = require('../models/Report');
const User = require('../models/User');
const {
    getCurrentReportMonth,
    getFinancialYearFromReportMonth,
    getFinancialYearStartReportMonth,
    getPreviousReportMonth,
    isReportMonth,
} = require('../utils/month');

const VALID_REPORT_TYPES = [
    'retail_service_activity',
    'additional_kpi',
    'vin_retention',
];

const CALENDAR_MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const RETAIL_FY_MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];
const USD_CONVERSION_SECTION_LABELS = [
    'Service Entry (Customer paid)',
    'Service Entry (Free for customer)',
    'Profitability (Customer paid)',
    'Profitability (Free for customer)',
];

function normalizeReportType(reportType = 'retail_service_activity') {
    if (!VALID_REPORT_TYPES.includes(reportType)) {
        const error = new Error('Invalid report type.');
        error.statusCode = 400;
        throw error;
    }

    return reportType;
}

function normalizeReportMonth(reportMonth) {
    const month = reportMonth || getCurrentReportMonth();

    if (!isReportMonth(month)) {
        const error = new Error('Report month must use YYYY-MM format.');
        error.statusCode = 400;
        throw error;
    }

    return month;
}

function normalizeOptionalReportMonth(reportMonth) {
    if (!reportMonth) {
        return null;
    }

    return normalizeReportMonth(reportMonth);
}

function normalizeReportStatus(status = 'submitted') {
    return status === 'draft' ? 'draft' : 'submitted';
}

function normalizeReviewAction(action = '') {
    const normalized = String(action || '').trim();
    const statusByAction = {
        under_review: 'under_review',
        approve: 'approved',
        send_back: 'correction_required',
    };

    if (!statusByAction[normalized]) {
        const error = new Error('Invalid review action.');
        error.statusCode = 400;
        throw error;
    }

    return {
        action: normalized,
        status: statusByAction[normalized],
    };
}

function normalizeCode(value = '') {
    return String(value || '').trim();
}

function getAssignedDealerCode(user, formData = null) {
    return normalizeCode(user.dealerCode || formData?.fields?.distributorCode || user.id);
}

function getAssignedDistributorCode(user, formData = null) {
    return getAssignedDealerCode(user, formData);
}

function getAssignedCountryCode(user) {
    return normalizeCode(user.countryCode);
}

function buildReportKey(dealerCode, reportType, reportMonth) {
    return `${normalizeCode(dealerCode)}.${reportType}.${reportMonth}`;
}

function buildDraftReportKey(dealerCode, reportType, reportMonth) {
    return `${buildReportKey(dealerCode, reportType, reportMonth)}.draft`;
}

function buildSubmittedReportKey(dealerCode, reportType, reportMonth) {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${buildReportKey(dealerCode, reportType, reportMonth)}.submitted.${timestamp}.${suffix}`;
}

function buildDealerScopeQuery(user, formData = null) {
    const dealerCode = getAssignedDealerCode(user, formData);
    const countryCode = getAssignedCountryCode(user);

    if (user.role === 'dealer') {
        return {
            $or: [
                { dealerCode },
                { distributorCode: dealerCode },
                { dealerId: user.id },
            ],
        };
    }

    if (user.dealerCode) {
        return {
            $or: [
                { dealerCode },
                { distributorCode: dealerCode },
            ],
        };
    }

    if (user.role === 'country_manager' && countryCode) {
        return { countryCode };
    }

    if (user.dealerId) {
        return { dealerId: user.dealerId };
    }

    return {};
}

function withDealerScope(baseQuery, user, formData = null) {
    const scopeQuery = buildDealerScopeQuery(user, formData);

    if (!Object.keys(scopeQuery).length) {
        return baseQuery;
    }

    if (baseQuery.$or && scopeQuery.$or) {
        return {
            $and: [baseQuery, scopeQuery],
        };
    }

    return {
        ...baseQuery,
        ...scopeQuery,
    };
}

async function buildCountryManagerScope(user) {
    const countryCode = getAssignedCountryCode(user);

    if (user.role !== 'country_manager' || !countryCode) {
        return {};
    }

    const dealers = await User.find({
        role: 'dealer',
        countryCode,
        active: { $ne: false },
    }).select('_id dealerCode');
    const dealerIds = dealers.map((dealer) => dealer._id);
    const dealerCodes = dealers.map((dealer) => normalizeCode(dealer.dealerCode)).filter(Boolean);
    const scope = [{ countryCode }];

    if (dealerCodes.length) {
        scope.push({ dealerCode: { $in: dealerCodes } });
        scope.push({ distributorCode: { $in: dealerCodes } });
    }

    if (dealerIds.length) {
        scope.push({ dealerId: { $in: dealerIds } });
    }

    return { $or: scope };
}

async function buildReportViewerScopeQuery(user, { formData = null, dealerCode = '' } = {}) {
    if (dealerCode && user.role !== 'dealer') {
        const normalizedDealerCode = normalizeCode(dealerCode);

        if (user.role === 'country_manager') {
            const dealerBelongsToCountry = await User.exists({
                role: 'dealer',
                dealerCode: normalizedDealerCode,
                countryCode: getAssignedCountryCode(user),
                active: { $ne: false },
            });

            if (!dealerBelongsToCountry) {
                return { _id: null };
            }
        }

        return {
            $or: [
                { dealerCode: normalizedDealerCode },
                { distributorCode: normalizedDealerCode },
            ],
        };
    }

    if (user.role === 'country_manager') {
        return buildCountryManagerScope(user);
    }

    return buildDealerScopeQuery(user, formData);
}

async function withReportViewerScope(baseQuery, user, dealerCode) {
    const scopeQuery = await buildReportViewerScopeQuery(user, { dealerCode });

    if (!Object.keys(scopeQuery).length) {
        return baseQuery;
    }

    if (baseQuery.$or && scopeQuery.$or) {
        return {
            $and: [baseQuery, scopeQuery],
        };
    }

    return {
        ...baseQuery,
        ...scopeQuery,
    };
}

async function findExistingMonthlyReport({ user, reportType, reportMonth, formData = null }) {
    const dealerCode = getAssignedDealerCode(user, formData);
    const reportKey = buildReportKey(dealerCode, reportType, reportMonth);

    return Report.findOne({
        reportType,
        reportMonth,
        $or: [
            { reportKey },
            { dealerCode },
            { distributorCode: dealerCode },
            { dealerId: user.id },
        ],
    });
}

async function findDraftMonthlyReport({ user, reportType, reportMonth, formData = null }) {
    const dealerCode = getAssignedDealerCode(user, formData);
    const draftReportKey = buildDraftReportKey(dealerCode, reportType, reportMonth);

    return Report.findOne({
        reportType,
        reportMonth,
        status: 'draft',
        $or: [
            { reportKey: draftReportKey },
            { dealerCode },
            { distributorCode: dealerCode },
            { dealerId: user.id },
        ],
    }).sort({ updatedAt: -1 });
}

function getMonthKeyFromReportMonth(reportMonth) {
    const monthNumber = Number(reportMonth.split('-')[1]);
    return CALENDAR_MONTH_KEYS[monthNumber - 1];
}

function getRetailMonthsThroughReportMonth(reportMonth) {
    const monthKey = getMonthKeyFromReportMonth(reportMonth);
    const monthIndex = RETAIL_FY_MONTH_KEYS.indexOf(monthKey);

    return monthIndex === -1
        ? RETAIL_FY_MONTH_KEYS
        : RETAIL_FY_MONTH_KEYS.slice(0, monthIndex + 1);
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function parseAmount(value) {
    const number = Number(String(value || '').replace(/,/g, '').replace(/%/g, '').trim());
    return Number.isFinite(number) ? number : 0;
}

function hasNumericValue(value) {
    return String(value || '').trim() !== '' && Number.isFinite(parseAmount(value));
}

function formatUsdValue(value) {
    if (!Number.isFinite(value)) {
        return '';
    }

    return Number(value.toFixed(2)).toString();
}

function normalizeLabel(value = '') {
    return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function getUsdConversionSection(row) {
    const item = normalizeLabel(row.item);

    return USD_CONVERSION_SECTION_LABELS.find((label) => item === normalizeLabel(label)) || '';
}

function applyRetailUsdConversions(formData, allowedMonthKeys) {
    const rate = parseAmount(formData?.fields?.conversionRate);
    let activeSection = '';
    let convertedAmount = 0;
    const highlightedMonth = formData?.highlightedMonth;

    const rows = (formData?.rows || []).map((row) => {
        const matchingSection = getUsdConversionSection(row);

        if (matchingSection) {
            activeSection = matchingSection;
        } else if (row.item && !matchingSection) {
            activeSection = '';
        }

        const usdValues = RETAIL_FY_MONTH_KEYS.reduce((values, monthKey) => {
            const sourceValue = row.values?.[monthKey];
            const shouldConvert = activeSection && allowedMonthKeys.includes(monthKey) && rate > 0 && hasNumericValue(sourceValue);
            const usdValue = shouldConvert ? formatUsdValue(parseAmount(sourceValue) * rate) : '';

            values[monthKey] = usdValue;

            if (monthKey === highlightedMonth && usdValue) {
                convertedAmount += parseAmount(usdValue);
            }

            return values;
        }, {});

        return {
            ...row,
            usdConversionSection: activeSection,
            usdValues,
        };
    });

    return {
        ...formData,
        fields: {
            ...(formData.fields || {}),
            convertedAmount: rate > 0 ? formatUsdValue(convertedAmount) : (formData.fields?.convertedAmount || ''),
            conversionTargetCurrency: 'USD',
        },
        rows,
    };
}

function normalizeRetailFormDataForReportMonth(formData, reportMonth, distributorCode = '') {
    if (!formData) {
        return null;
    }

    const allowedMonthKeys = getRetailMonthsThroughReportMonth(reportMonth);
    const allowedMonthSet = new Set(allowedMonthKeys);
    const fiscalYear = getFinancialYearFromReportMonth(reportMonth);

    const normalizedFormData = {
        ...formData,
        fields: {
            ...(formData.fields || {}),
            distributorCode: normalizeCode(distributorCode || formData.fields?.distributorCode),
            fiscalYear,
        },
        highlightedMonth: getMonthKeyFromReportMonth(reportMonth),
        rows: (formData.rows || []).map((row) => ({
            ...row,
            values: RETAIL_FY_MONTH_KEYS.reduce((values, monthKey) => {
                values[monthKey] = allowedMonthSet.has(monthKey) ? (row.values?.[monthKey] || '') : '';
                return values;
            }, {}),
        })),
    };

    return applyRetailUsdConversions(normalizedFormData, allowedMonthKeys);
}

function mergeRetailFormDataThroughCurrentMonth(existingFormData, incomingFormData, reportMonth, distributorCode = '') {
    if (!incomingFormData) {
        return normalizeRetailFormDataForReportMonth(existingFormData, reportMonth, distributorCode);
    }

    if (!existingFormData?.rows?.length) {
        return normalizeRetailFormDataForReportMonth(incomingFormData, reportMonth, distributorCode);
    }

    const allowedMonthKeys = getRetailMonthsThroughReportMonth(reportMonth);
    const incomingRows = incomingFormData.rows || [];
    const mergedFormData = clone(existingFormData);

    mergedFormData.fields = {
        ...(existingFormData.fields || {}),
        ...(incomingFormData.fields || {}),
    };
    mergedFormData.highlightedMonth = getMonthKeyFromReportMonth(reportMonth);
    mergedFormData.rows = (existingFormData.rows || []).map((row, index) => {
        const incomingRow = incomingRows[index];

        if (!incomingRow?.values) {
            return row;
        }

        const incomingValues = allowedMonthKeys.reduce((values, monthKey) => {
            values[monthKey] = incomingRow.values[monthKey] || '';
            return values;
        }, {});

        return {
            ...row,
            values: {
                ...(row.values || {}),
                ...incomingValues,
            },
        };
    });

    return normalizeRetailFormDataForReportMonth(mergedFormData, reportMonth, distributorCode);
}

function buildParsedWorkbookFromFormData(formData, fallbackWorkbook) {
    if (!formData?.rows) {
        return fallbackWorkbook;
    }

    return {
        sheetCount: 1,
        sheets: [
            {
                name: 'Retail Service Activity Report',
                rows: formData.rows,
                rowCount: formData.rows.length,
                columns: ['category', 'item', 'subItem', 'remark', 'values'],
            },
        ],
    };
}

function flattenParsedRows(parsedWorkbook) {
    return parsedWorkbook.sheets.flatMap((sheet) =>
        sheet.rows.map((row, index) => ({
            sheetName: sheet.name,
            rowNumber: index + 2,
            row,
        }))
    );
}

function compareParsedRows(previousWorkbook, nextWorkbook) {
    if (!previousWorkbook) {
        return [];
    }

    const previousRows = flattenParsedRows(previousWorkbook);
    const nextRows = flattenParsedRows(nextWorkbook);
    const maxLength = Math.max(previousRows.length, nextRows.length);
    const changes = [];

    for (let index = 0; index < maxLength; index += 1) {
        const previousRow = previousRows[index];
        const nextRow = nextRows[index];

        if (!previousRow && nextRow) {
            changes.push({ type: 'added', next: nextRow });
            continue;
        }

        if (previousRow && !nextRow) {
            changes.push({ type: 'removed', previous: previousRow });
            continue;
        }

        if (JSON.stringify(previousRow) !== JSON.stringify(nextRow)) {
            changes.push({
                type: 'updated',
                previous: previousRow,
                next: nextRow,
            });
        }
    }

    return changes;
}

function serializeReport(report) {
    const serialized = typeof report.toJSON === 'function' ? report.toJSON() : report;
    const parsedWorkbook = serialized.parsedWorkbook;
    const dealerCode = serialized.dealerCode || serialized.distributorCode || '';

    return {
        ...serialized,
        dealerCode,
        sheetCount: parsedWorkbook.sheetCount,
        rowCount: parsedWorkbook.sheets.reduce((total, sheet) => total + sheet.rowCount, 0),
    };
}

async function upsertMonthlyReport({ user, reportType, reportMonth, file, parsedWorkbook, formData = null }) {
    const normalizedReportType = normalizeReportType(reportType);
    const normalizedReportMonth = normalizeReportMonth(reportMonth);
    const dealerCode = getAssignedDealerCode(user, formData);
    const distributorCode = dealerCode;
    const countryCode = getAssignedCountryCode(user);
    const reportKey = buildReportKey(dealerCode, normalizedReportType, normalizedReportMonth);
    const existingReport = await findExistingMonthlyReport({
        user,
        reportType: normalizedReportType,
        reportMonth: normalizedReportMonth,
        formData,
    });
    const mergedFormData = normalizedReportType === 'retail_service_activity'
        ? mergeRetailFormDataThroughCurrentMonth(existingReport?.formData, formData, normalizedReportMonth, distributorCode)
        : formData;
    const displayWorkbook = normalizedReportType === 'retail_service_activity'
        ? buildParsedWorkbookFromFormData(mergedFormData, parsedWorkbook)
        : parsedWorkbook;
    const changes = compareParsedRows(existingReport?.parsedWorkbook, displayWorkbook);
    const uploadSnapshot = {
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
        reportMonth: normalizedReportMonth,
        parsedWorkbook,
        formData,
    };

    const report = await Report.findOneAndUpdate(
        existingReport ? { _id: existingReport._id } : { reportKey },
        {
            $set: {
                reportKey,
                dealerName: user.name,
                dealerCode,
                distributorCode,
                countryCode,
                reportType: normalizedReportType,
                reportMonth: normalizedReportMonth,
                fileName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                parsedWorkbook: displayWorkbook,
                formData: mergedFormData,
                changes,
                source: 'excel',
                status: 'uploaded',
            },
            $push: {
                uploads: uploadSnapshot,
            },
            $setOnInsert: {
                dealerId: user.id,
            },
        },
        {
            new: true,
            upsert: true,
            runValidators: true,
        }
    );

    return report;
}

async function listReports({ user, reportMonth, reportType, dealerCode, period, submittedOnly }) {
    const query = await buildReportViewerScopeQuery(user, { dealerCode });

    if (reportMonth) {
        query.reportMonth = reportMonth;
    } else if (period !== 'all') {
        const lastCompletedMonth = getPreviousReportMonth();
        query.reportMonth = {
            $gte: getFinancialYearStartReportMonth(lastCompletedMonth),
            $lte: lastCompletedMonth,
        };
    }

    if (reportType) {
        query.reportType = reportType;
    }

    if (submittedOnly) {
        query.status = { $ne: 'draft' };
    }

    const reports = await Report.find(query).sort({ reportMonth: -1, updatedAt: -1 });
    return reports.map((report) => {
        const { parsedWorkbook, ...summary } = serializeReport(report);
        return summary;
    });
}

async function getReportById({ user, id }) {
    const idQuery = /^[a-f\d]{24}$/i.test(id)
        ? { $or: [{ reportKey: id }, { _id: id }] }
        : { reportKey: id };
    const report = await Report.findOne(await withReportViewerScope(idQuery, user));

    if (!report) {
        const error = new Error('Report not found.');
        error.statusCode = 404;
        throw error;
    }

    return serializeReport(report);
}

async function updateReportReview({ user, id, action, comments = '' }) {
    if (!['admin', 'country_manager'].includes(user.role)) {
        const error = new Error('You do not have access to review reports.');
        error.statusCode = 403;
        throw error;
    }

    const normalized = normalizeReviewAction(action);
    const reviewComments = String(comments || '').trim();

    if (normalized.action === 'send_back' && !reviewComments) {
        const error = new Error('Review comments are required before sending a report back for correction.');
        error.statusCode = 400;
        throw error;
    }

    const idQuery = /^[a-f\d]{24}$/i.test(id)
        ? { $or: [{ reportKey: id }, { _id: id }] }
        : { reportKey: id };
    const report = await Report.findOne(await withReportViewerScope(idQuery, user));

    if (!report) {
        const error = new Error('Report not found.');
        error.statusCode = 404;
        throw error;
    }

    report.status = normalized.status;
    report.reviewComments = reviewComments;
    report.reviewHistory.push({
        action: normalized.action,
        status: normalized.status,
        comments: reviewComments,
        reviewedAt: new Date(),
        reviewerId: user.id,
        reviewerName: user.name,
        reviewerRole: user.role,
    });

    await report.save();

    return serializeReport(report);
}

async function getRetailServiceForm({ user, reportMonth, dealerCode }) {
    const normalizedReportMonth = normalizeOptionalReportMonth(reportMonth);
    const query = await withReportViewerScope({
        reportType: 'retail_service_activity',
        ...(normalizedReportMonth ? { reportMonth: normalizedReportMonth } : {}),
    }, user, dealerCode);

    const report = await Report.findOne(query).sort({ updatedAt: -1 });
    return report ? serializeReport(report) : null;
}

async function saveRetailServiceForm({ user, reportMonth, formData, status }) {
    const normalizedReportMonth = normalizeReportMonth(reportMonth);
    const normalizedStatus = normalizeReportStatus(status);
    const dealerCode = getAssignedDealerCode(user, formData);
    const distributorCode = dealerCode;
    const countryCode = getAssignedCountryCode(user);
    const reportKey = normalizedStatus === 'draft'
        ? buildDraftReportKey(dealerCode, 'retail_service_activity', normalizedReportMonth)
        : buildSubmittedReportKey(dealerCode, 'retail_service_activity', normalizedReportMonth);
    const normalizedFormData = normalizeRetailFormDataForReportMonth(formData, normalizedReportMonth, distributorCode);
    const rows = normalizedFormData?.rows || [];
    const previousReport = normalizedStatus === 'draft'
        ? await findDraftMonthlyReport({
            user,
            reportType: 'retail_service_activity',
            reportMonth: normalizedReportMonth,
            formData: normalizedFormData,
        })
        : await findExistingMonthlyReport({
            user,
            reportType: 'retail_service_activity',
            reportMonth: normalizedReportMonth,
            formData: normalizedFormData,
        });
    const parsedWorkbook = {
        sheetCount: 1,
        sheets: [
            {
                name: 'Retail Service Activity Report',
                rows,
                rowCount: rows.length,
                columns: ['category', 'item', 'subItem', 'remark', 'values'],
            },
        ],
    };
    const changes = compareParsedRows(previousReport?.parsedWorkbook, parsedWorkbook);

    const reportPayload = {
        reportKey,
        dealerId: user.id,
        dealerName: user.name,
        dealerCode,
        distributorCode,
        countryCode,
        reportType: 'retail_service_activity',
        reportMonth: normalizedReportMonth,
        fileName: 'manual-retail-service-report',
        fileSize: 0,
        mimeType: 'application/json',
        parsedWorkbook,
        formData: normalizedFormData,
        changes,
        source: 'manual',
        status: normalizedStatus,
    };

    const report = normalizedStatus === 'draft'
        ? await Report.findOneAndUpdate(
            previousReport ? { _id: previousReport._id } : { reportKey },
            { $set: reportPayload },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        )
        : await Report.create(reportPayload);

    return serializeReport(report);
}

async function getAdditionalKpiForm({ user, reportMonth, dealerCode }) {
    const normalizedReportMonth = normalizeOptionalReportMonth(reportMonth);
    const query = await withReportViewerScope({
        reportType: 'additional_kpi',
        ...(normalizedReportMonth ? { reportMonth: normalizedReportMonth } : {}),
    }, user, dealerCode);

    const report = await Report.findOne(query).sort({ updatedAt: -1 });
    return report ? serializeReport(report) : null;
}

async function saveAdditionalKpiForm({ user, reportMonth, formData, status }) {
    const normalizedReportMonth = normalizeReportMonth(reportMonth);
    const normalizedStatus = normalizeReportStatus(status);
    const dealerCode = getAssignedDealerCode(user, formData);
    const distributorCode = dealerCode;
    const countryCode = getAssignedCountryCode(user);
    const reportKey = normalizedStatus === 'draft'
        ? buildDraftReportKey(dealerCode, 'additional_kpi', normalizedReportMonth)
        : buildSubmittedReportKey(dealerCode, 'additional_kpi', normalizedReportMonth);
    const rows = formData?.rows || [];
    const previousReport = normalizedStatus === 'draft'
        ? await findDraftMonthlyReport({
            user,
            reportType: 'additional_kpi',
            reportMonth: normalizedReportMonth,
            formData,
        })
        : await findExistingMonthlyReport({
            user,
            reportType: 'additional_kpi',
            reportMonth: normalizedReportMonth,
            formData,
        });
    const parsedWorkbook = {
        sheetCount: 1,
        sheets: [
            {
                name: 'Additional KPI Report',
                rows,
                rowCount: rows.length,
                columns: ['srNo', 'parameter', 'detailsRequired', 'workshops', 'remarks'],
            },
        ],
    };
    const changes = compareParsedRows(previousReport?.parsedWorkbook, parsedWorkbook);

    const reportPayload = {
        reportKey,
        dealerId: user.id,
        dealerName: user.name,
        dealerCode,
        distributorCode,
        countryCode,
        reportType: 'additional_kpi',
        reportMonth: normalizedReportMonth,
        fileName: 'manual-additional-kpi-report',
        fileSize: 0,
        mimeType: 'application/json',
        parsedWorkbook,
        formData,
        changes,
        source: 'manual',
        status: normalizedStatus,
    };

    const report = normalizedStatus === 'draft'
        ? await Report.findOneAndUpdate(
            previousReport ? { _id: previousReport._id } : { reportKey },
            { $set: reportPayload },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        )
        : await Report.create(reportPayload);

    return serializeReport(report);
}

async function getVinRetentionForm({ user, reportMonth, dealerCode }) {
    const normalizedReportMonth = normalizeOptionalReportMonth(reportMonth);
    const query = await withReportViewerScope({
        reportType: 'vin_retention',
        ...(normalizedReportMonth ? { reportMonth: normalizedReportMonth } : {}),
    }, user, dealerCode);

    const report = await Report.findOne(query).sort({ updatedAt: -1 });
    return report ? serializeReport(report) : null;
}

async function saveVinRetentionForm({ user, reportMonth, formData, status }) {
    const normalizedReportMonth = normalizeReportMonth(reportMonth);
    const normalizedStatus = normalizeReportStatus(status);
    const dealerCode = getAssignedDealerCode(user, formData);
    const distributorCode = dealerCode;
    const countryCode = getAssignedCountryCode(user);
    const reportKey = normalizedStatus === 'draft'
        ? buildDraftReportKey(dealerCode, 'vin_retention', normalizedReportMonth)
        : buildSubmittedReportKey(dealerCode, 'vin_retention', normalizedReportMonth);
    const retailRows = formData?.retailRows || [];
    const serviceRows = formData?.serviceRows || [];
    const allRows = [
        ...retailRows.map((row) => ({ mode: 'retail', ...row })),
        ...serviceRows.map((row) => ({ mode: 'service', ...row })),
    ];
    const previousReport = normalizedStatus === 'draft'
        ? await findDraftMonthlyReport({
            user,
            reportType: 'vin_retention',
            reportMonth: normalizedReportMonth,
            formData,
        })
        : await findExistingMonthlyReport({
            user,
            reportType: 'vin_retention',
            reportMonth: normalizedReportMonth,
            formData,
        });
    const parsedWorkbook = {
        sheetCount: 2,
        sheets: [
            {
                name: 'Retail Sales Data',
                rows: retailRows,
                rowCount: retailRows.length,
                columns: ['vinNumber', 'model', 'dateOfSale', 'typeOfSale'],
            },
            {
                name: 'Service Data',
                rows: serviceRows,
                rowCount: serviceRows.length,
                columns: ['vinNumber', 'model', 'dateOfService', 'typeOfService', 'mileage'],
            },
        ],
    };
    const changes = compareParsedRows(previousReport?.parsedWorkbook, parsedWorkbook);

    const reportPayload = {
        reportKey,
        dealerId: user.id,
        dealerName: user.name,
        dealerCode,
        distributorCode,
        countryCode,
        reportType: 'vin_retention',
        reportMonth: normalizedReportMonth,
        fileName: 'manual-vin-retention-report',
        fileSize: 0,
        mimeType: 'application/json',
        parsedWorkbook,
        formData: {
            ...(formData || {}),
            rows: allRows,
        },
        changes,
        source: 'manual',
        status: normalizedStatus,
    };

    const report = normalizedStatus === 'draft'
        ? await Report.findOneAndUpdate(
            previousReport ? { _id: previousReport._id } : { reportKey },
            { $set: reportPayload },
            {
                new: true,
                upsert: true,
                runValidators: true,
            }
        )
        : await Report.create(reportPayload);

    return serializeReport(report);
}

module.exports = {
    VALID_REPORT_TYPES,
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
};
