const xlsx = require('xlsx');

const MONTH_ALIASES = {
    apr: 'apr',
    april: 'apr',
    may: 'may',
    jun: 'jun',
    june: 'jun',
    jul: 'jul',
    july: 'jul',
    aug: 'aug',
    august: 'aug',
    sep: 'sep',
    sept: 'sep',
    september: 'sep',
    oct: 'oct',
    october: 'oct',
    nov: 'nov',
    november: 'nov',
    dec: 'dec',
    december: 'dec',
    jan: 'jan',
    january: 'jan',
    feb: 'feb',
    february: 'feb',
    mar: 'mar',
    march: 'mar',
};
const RETAIL_MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];
const RETAIL_TABLE_START_ROW_INDEX = 8;
const RETAIL_CATEGORY_COLUMN_INDEX = 7;
const RETAIL_ITEM_START_COLUMN_INDEX = 8;
const RETAIL_ITEM_END_COLUMN_INDEX = 10;
const RETAIL_REMARK_START_COLUMN_INDEX = 11;
const RETAIL_REMARK_END_COLUMN_INDEX = 12;
const RETAIL_FIRST_MONTH_COLUMN_INDEX = 13;

function normalizeCell(value) {
    return String(value || '').trim();
}

function normalizeKey(value) {
    return normalizeCell(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeLabel(value) {
    return normalizeCell(value).replace(/\s+/g, ' ').trim();
}

function stripLeadingRowNumber(row, monthInfo) {
    const firstCell = normalizeCell(row[0]);

    if (/^\d+$/.test(firstCell) && monthInfo.firstMonthColumn > 0) {
        return row.slice(1);
    }

    return row;
}

function getCellsBeforeMonths(row, monthInfo) {
    const normalizedRow = stripLeadingRowNumber(row, monthInfo);
    const offset = normalizedRow === row ? 0 : 1;
    return normalizedRow.slice(0, Math.max(monthInfo.firstMonthColumn - offset, 0));
}

function getMonthCell(row, monthInfo, columnIndex) {
    const normalizedRow = stripLeadingRowNumber(row, monthInfo);
    const offset = normalizedRow === row ? 0 : 1;
    return normalizeCell(normalizedRow[columnIndex - offset]);
}

function isRetailFieldRow(cellsBeforeMonths) {
    const text = normalizeLabel(cellsBeforeMonths.join(' '));
    return /^(name of country|name of distributor|name of ceo|name of general manager)/i.test(text);
}

function hasMonthValues(values) {
    return Object.values(values).some((value) => normalizeCell(value));
}

function compactRetailCells(cellsBeforeMonths) {
    return cellsBeforeMonths.map(normalizeLabel).filter(Boolean);
}

function pickRetailRowLabels(cellsBeforeMonths, previousLabels) {
    const compactCells = compactRetailCells(cellsBeforeMonths);
    const cells = cellsBeforeMonths.map(normalizeLabel);
    const labels = {
        category: previousLabels.category,
        item: '',
        subItem: '',
        remark: '',
    };

    if (!compactCells.length) {
        return labels;
    }

    if (cellsBeforeMonths.length >= RETAIL_FIRST_MONTH_COLUMN_INDEX) {
        labels.category = cells[RETAIL_CATEGORY_COLUMN_INDEX] || previousLabels.category;
        labels.item = cells
            .slice(RETAIL_ITEM_START_COLUMN_INDEX, RETAIL_ITEM_END_COLUMN_INDEX + 1)
            .filter(Boolean)
            .join(' - ');
        labels.remark = cells
            .slice(RETAIL_REMARK_START_COLUMN_INDEX, RETAIL_REMARK_END_COLUMN_INDEX + 1)
            .filter(Boolean)
            .join(' ');
        return labels;
    }

    if (cellsBeforeMonths.length <= 3) {
        labels.category = cells[0] || previousLabels.category;
        labels.item = cells[1] || '';
        labels.remark = cells[2] || '';
        return labels;
    }

    const categoryCell = cells[0] || '';
    const primaryCell = cells[1] || '';
    const secondaryCell = cells[2] || '';
    const tertiaryCell = cells[3] || '';
    const remarkCell = cells.slice(4).find(Boolean) || '';

    if (categoryCell) {
        labels.category = categoryCell;
    }

    if (primaryCell) {
        labels.item = primaryCell;
        labels.subItem = secondaryCell && tertiaryCell
            ? `${secondaryCell} - ${tertiaryCell}`
            : secondaryCell || tertiaryCell;
    } else if (secondaryCell) {
        labels.item = previousLabels.item;
        labels.subItem = secondaryCell;
    } else if (tertiaryCell) {
        labels.item = previousLabels.item;
        labels.subItem = tertiaryCell;
    }

    if (!labels.item && labels.category && !primaryCell && !secondaryCell && !tertiaryCell) {
        labels.item = labels.category;
        labels.category = previousLabels.category;
    }

    labels.remark = remarkCell || tertiaryCell || secondaryCell || '';

    return labels;
}

function cleanRetailRowLabel(value) {
    return normalizeLabel(value)
        .replace(/\u3000/g, '')
        .replace(/^["']|["']$/g, '')
        .replace(/\*/g, '')
        .replace(/\s+Currency\s*:\s*[A-Z]+/i, '')
        .replace(/\s*Currency\s*$/i, 'Currency')
        .trim();
}

function getNextValue(row, labelPattern) {
    const index = row.findIndex((cell) => labelPattern.test(normalizeCell(cell)));

    if (index === -1) {
        return '';
    }

    for (let cellIndex = index + 1; cellIndex < row.length; cellIndex += 1) {
        const value = normalizeCell(row[cellIndex]).replace(/^:/, '').trim();

        if (value && !labelPattern.test(value)) {
            return value;
        }
    }

    return '';
}

function findRowValue(rows, labelPattern) {
    for (const row of rows) {
        const value = getNextValue(row, labelPattern);

        if (value) {
            return value;
        }
    }

    return '';
}

function findMonthColumns(rows) {
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const monthColumns = {};

        rows[rowIndex].forEach((cell, columnIndex) => {
            const key = MONTH_ALIASES[normalizeKey(cell)];

            if (key) {
                monthColumns[key] = columnIndex;
            }
        });

        if (Object.keys(monthColumns).length >= 10) {
            return {
                rowIndex,
                monthColumns,
                firstMonthColumn: Math.min(...Object.values(monthColumns)),
            };
        }
    }

    return null;
}

function getFixedRetailMonthInfo(detectedMonthInfo) {
    return {
        rowIndex: detectedMonthInfo?.rowIndex ?? RETAIL_TABLE_START_ROW_INDEX - 1,
        firstMonthColumn: RETAIL_FIRST_MONTH_COLUMN_INDEX,
        monthColumns: RETAIL_MONTH_KEYS.reduce((columns, monthKey, index) => {
            columns[monthKey] = RETAIL_FIRST_MONTH_COLUMN_INDEX + index;
            return columns;
        }, {}),
    };
}

function parseRetailServiceFormData(workbook) {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
    });
    const monthInfo = getFixedRetailMonthInfo(findMonthColumns(rows));

    const fields = {
        distributorCode: findRowValue(rows, /distributor code/i),
        distributorName: findRowValue(rows, /distributor name/i),
        currency: findRowValue(rows, /^currency$/i),
        fiscalYear: findRowValue(rows, /year|fy/i),
        countryName: findRowValue(rows, /name of country/i),
        ceoName: findRowValue(rows, /name of ceo/i),
        generalManagerService: findRowValue(rows, /name of general manager/i),
    };
    const retailRows = [];
    let previousLabels = {
        category: '',
        item: '',
    };

    const tableStartIndex = RETAIL_TABLE_START_ROW_INDEX;

    rows
        .slice(tableStartIndex)
        .filter((row) => row.some((cell) => normalizeCell(cell)))
        .forEach((row) => {
            const cellsBeforeMonths = getCellsBeforeMonths(row, monthInfo);
            const values = Object.entries(monthInfo.monthColumns).reduce((result, [monthKey, columnIndex]) => {
                result[monthKey] = getMonthCell(row, monthInfo, columnIndex);
                return result;
            }, {});
            const labels = pickRetailRowLabels(cellsBeforeMonths, previousLabels);

            if (isRetailFieldRow(cellsBeforeMonths) || (!hasMonthValues(values) && !labels.item && !labels.subItem)) {
                return;
            }

            if (labels.item) {
                previousLabels.item = labels.item;
            }

            if (labels.category) {
                previousLabels.category = labels.category;
            }

            retailRows.push({
                id: `retail-row-${retailRows.length + 1}`,
                category: cleanRetailRowLabel(labels.category),
                item: cleanRetailRowLabel(labels.item),
                subItem: cleanRetailRowLabel(labels.subItem),
                remark: cleanRetailRowLabel(labels.remark),
                values,
            });
        });

    return {
        fields,
        rows: retailRows,
    };
}

function getRowCell(row, index) {
    return normalizeCell(row[index]);
}

function parseAdditionalKpiFormData(workbook) {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
    });
    const headerIndex = rows.findIndex((row) =>
        row.some((cell) => /^sr\.?\s*no\.?$/i.test(normalizeCell(cell))) &&
        row.some((cell) => /parameter/i.test(normalizeCell(cell)))
    );

    if (headerIndex === -1) {
        return null;
    }

    const selectMonthRow = rows.find((row) => row.some((cell) => /select month/i.test(normalizeCell(cell)))) || [];
    const selectedMonth = selectMonthRow.map(normalizeCell).find((cell) => /^[a-z]{3}-\d{2}$/i.test(cell)) || '';
    const distributorHeader = rows[headerIndex].find((cell) => /name of distributor/i.test(normalizeCell(cell))) || '';
    const distributorName = distributorHeader.split(':').slice(1).join(':').trim()
        || (rows[1] || []).slice(3, 9).map(normalizeCell).filter(Boolean).join(' ');
    const workshopHeader = rows[headerIndex] || [];
    const workshopColumns = [3, 4, 5, 6, 7, 8].map((columnIndex, index) => ({
        key: ['ws1', 'ws2', 'ws3', 'ws4', 'total', 'workshopLocation'][index],
        label: getRowCell(workshopHeader, columnIndex) || ['WS1', 'WS2', 'WS3', 'Dealer 4 / WS 4', 'Total', 'Workshop Location'][index],
        columnIndex,
    }));
    let currentSrNo = '';
    let currentParameter = '';
    const kpiRows = rows
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => normalizeCell(cell)))
        .map((row, index) => {
            currentSrNo = getRowCell(row, 0) || currentSrNo;
            currentParameter = getRowCell(row, 1) || currentParameter;

            const values = workshopColumns.reduce((result, workshop) => {
                result[workshop.key] = getRowCell(row, workshop.columnIndex);
                return result;
            }, {});

            return {
                id: `additional-kpi-row-${index + 1}`,
                srNo: currentSrNo,
                parameter: currentParameter,
                detailsRequired: getRowCell(row, 2),
                values,
                remarks: getRowCell(row, 9),
            };
        });

    return {
        fields: {
            selectedMonth,
            distributorName,
        },
        workshops: workshopColumns.map(({ key, label }) => ({ key, label })),
        rows: kpiRows,
    };
}

function findHeaderRow(rows, requiredHeaders) {
    return rows.findIndex((row) => {
        const normalizedRow = row.map((cell) => normalizeKey(cell));
        return requiredHeaders.every((header) => normalizedRow.includes(header));
    });
}

function findColumnIndex(headerRow, headerAliases) {
    const normalizedAliases = headerAliases.map(normalizeKey);
    return headerRow.findIndex((cell) => normalizedAliases.includes(normalizeKey(cell)));
}

function parseVinRowsFromSheet(worksheet, mode) {
    const rows = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
    });
    const headerIndex = mode === 'retail'
        ? findHeaderRow(rows, ['vinnumber', 'model', 'dateofsale'])
        : findHeaderRow(rows, ['vinnumber', 'model', 'dateofservice']);

    if (headerIndex === -1) {
        return [];
    }

    const headerRow = rows[headerIndex];
    const columns = {
        vinNumber: findColumnIndex(headerRow, ['VIN Number']),
        model: findColumnIndex(headerRow, ['Model']),
        date: findColumnIndex(headerRow, [mode === 'retail' ? 'Date of sale' : 'Date of service']),
        type: findColumnIndex(headerRow, [mode === 'retail' ? 'Type of Sale' : 'Type of Service']),
        mileage: findColumnIndex(headerRow, ['Mileage']),
    };

    return rows
        .slice(headerIndex + 1)
        .filter((row) => normalizeCell(row[columns.vinNumber]) || normalizeCell(row[columns.model]))
        .map((row, index) => {
            if (mode === 'retail') {
                return {
                    id: `vin-retail-row-${index + 1}`,
                    vinNumber: getRowCell(row, columns.vinNumber),
                    model: getRowCell(row, columns.model),
                    dateOfSale: getRowCell(row, columns.date),
                    typeOfSale: getRowCell(row, columns.type),
                };
            }

            return {
                id: `vin-service-row-${index + 1}`,
                vinNumber: getRowCell(row, columns.vinNumber),
                model: getRowCell(row, columns.model),
                dateOfService: getRowCell(row, columns.date),
                typeOfService: getRowCell(row, columns.type),
                mileage: columns.mileage >= 0 ? getRowCell(row, columns.mileage) : '',
            };
        });
}

function parseVinRetentionFormData(workbook) {
    let retailRows = [];
    let serviceRows = [];

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        retailRows = retailRows.concat(parseVinRowsFromSheet(worksheet, 'retail'));
        serviceRows = serviceRows.concat(parseVinRowsFromSheet(worksheet, 'service'));
    });

    if (retailRows.length === 0 && serviceRows.length === 0) {
        return null;
    }

    return {
        retailRows,
        serviceRows,
        rows: [
            ...retailRows.map((row) => ({ mode: 'retail', ...row })),
            ...serviceRows.map((row) => ({ mode: 'service', ...row })),
        ],
    };
}

function parseExcelFile(filePath) {
    const workbook = xlsx.readFile(filePath, {
        cellDates: true,
        raw: false,
    });

    const sheets = workbook.SheetNames.map((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(worksheet, {
            defval: '',
            raw: false,
        });

        return {
            name: sheetName,
            rows,
            rowCount: rows.length,
            columns: rows[0] ? Object.keys(rows[0]) : [],
        };
    });

    return {
        sheetCount: sheets.length,
        sheets,
        retailServiceFormData: parseRetailServiceFormData(workbook),
        additionalKpiFormData: parseAdditionalKpiFormData(workbook),
        vinRetentionFormData: parseVinRetentionFormData(workbook),
    };
}

module.exports = {
    parseExcelFile,
};
