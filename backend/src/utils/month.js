function getCurrentReportMonth(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPreviousReportMonth(date = new Date()) {
    return getCurrentReportMonth(new Date(date.getFullYear(), date.getMonth() - 1, 1));
}

function isReportMonth(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getFinancialYearFromReportMonth(reportMonth) {
    const [yearValue, monthValue] = reportMonth.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);
    const startYear = month >= 4 ? year : year - 1;
    const endYear = String(startYear + 1).slice(-2);

    return `${startYear}-${endYear}`;
}

function getFinancialYearStartReportMonth(reportMonth) {
    const [yearValue, monthValue] = reportMonth.split('-');
    const year = Number(yearValue);
    const month = Number(monthValue);
    const startYear = month >= 4 ? year : year - 1;

    return `${startYear}-04`;
}

module.exports = {
    getFinancialYearFromReportMonth,
    getFinancialYearStartReportMonth,
    getCurrentReportMonth,
    getPreviousReportMonth,
    isReportMonth,
};
