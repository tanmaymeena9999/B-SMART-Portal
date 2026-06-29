# B-SMART

This repository contains the frontend and backend for B-SMART.

## Structure

- `frontend/`
  - `assets/`
    - `images/`
    - `icons/`
    - `logos/`
  - `shared/`
    - `css/`
      - `variables.css`
      - `common.css`
      - `layout.css`
      - `components.css`
    - `js/`
      - `api.js`
      - `auth.js`
      - `storage.js`
      - `utils.js`
    - `components/`
      - `navbar.js`
      - `sidebar.js`
      - `modal.js`
      - `table.js`
      - `loader.js`
  - `pages/`
    - `login/`
      - `login.html`
      - `login.css`
      - `login.js`
    - `dashboard/`
      - `dashboard.html`
      - `dashboard.css`
      - `dashboard.js`
    - `retail-service-report/`
      - `retail-service-report.html`
      - `retail-service-report.css`
      - `retail-service-report.js`
    - `monthly-report/`
      - `monthly-report.html`
      - `monthly-report.css`
      - `monthly-report.js`
    - `additional-kpi/`
      - `additional-kpi.html`
      - `additional-kpi.css`
      - `additional-kpi.js`
    - `vin-retention/`
      - `vin-retention.html`
      - `vin-retention.css`
      - `vin-retention.js`
    - `view-report/`
      - `view-report.html`
      - `view-report.css`
      - `view-report.js`
  - `index.html`

- `backend/`
  - `src/`
    - `config/`
    - `middleware/`
    - `routes/`
    - `controllers/`
    - `services/`
    - `models/`
    - `utils/`
    - `server.js`
  - `.env`
  - `package.json`

## Next steps

1. Add frontend styles/components/scripts inside `frontend/shared` and page folders.
2. Initialize backend dependencies in `backend/` and implement routes/controllers.
3. Run frontend/backend locally after wiring configuration.

## Backend Auth

The backend starts with a seeded admin user when no admin exists in MongoDB.

- Default admin email: `admin@bsmart.local`
- Default admin password: `admin123`
- Override with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`

Routes:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/credentials` admin only
- `POST /api/credentials` admin only
- `PUT /api/credentials/:id` admin only
- `DELETE /api/credentials/:id` admin only

## Database

The backend uses MongoDB through Mongoose.

- Default URI: `mongodb://127.0.0.1:27017/bsmart`
- Override with `MONGO_URI` in `backend/.env`
- The default admin user is seeded into MongoDB on startup when no admin exists.

## Monthly Excel Uploads

Dealers can upload one Excel file per report type for the current month. Re-uploading the same report type/month updates that month and stores a simple row-level change summary.
Dealers can also fill reports manually. Excel uploads populate the report form, and users can continue editing the populated values before saving or submitting.
All report types are stored in the MongoDB `reports` collection. New and updated reports store:

- `reportKey`: `${dealerCode}.${reportType}.${reportMonth}`; example `D001.retail_service_activity.2026-06`
- `dealerCode`: the assigned dealer code used to fetch that dealer's reports
- `distributorCode`: compatibility alias for the assigned dealer/distributor code
- `countryCode`: the dealer's country code, used so a country manager can view reports from all dealers under the same country code
- `reportType`, `reportMonth`, `source`, `status`, parsed workbook data, form data, and change history

When listing monthly reports without an explicit `reportMonth`, the API automatically returns reports for the assigned dealer code from the current financial year start through the last completed month.

- `POST /api/reports/monthly/upload`
  - Auth: `dealer` or `admin`
  - Body: `multipart/form-data`
  - File field: `excel`
  - Optional fields: `reportType`, `reportMonth`
  - Valid report types: `retail_service_activity`, `additional_kpi`, `vin_retention`
  - `reportMonth` format: `YYYY-MM`; defaults to the current month
- `GET /api/reports/monthly`
  - Optional query fields: `dealerCode`, `reportType`, `reportMonth`
  - Optional query fields: `period=all`, `submittedOnly=true`
  - Without `reportMonth`, returns the current financial year through last month
  - The dealer View Report page uses `period=all&submittedOnly=true`, so the logged-in dealer sees all non-draft monthly reports submitted under their assigned dealer code
  - A `country_manager` sees all non-draft monthly reports submitted by active dealers with the same `countryCode`; when `dealerCode` is supplied, the backend verifies that dealer belongs to the manager's country before returning reports
- `GET /api/reports/monthly/:id`
  - `:id` can be the Mongo ObjectId or the generated `reportKey`
- `GET /api/reports/currency-rate?currency=INR`
  - Auth required
  - Fetches the live conversion rate from the supplied local currency to USD

Retail Service submit behavior:

- Months from April through the current report month must contain data before Submit.
- When Submit is clicked and the required month range is filled, the app fetches the live local-currency-to-USD conversion rate and stores the rate, provider, and fetch timestamp with the report form data.
- Future months after the current report month remain read-only.

Excel parsing happens in `backend/src/services/excelParser.js` with the `xlsx` package:

- The uploaded `.xls` or `.xlsx` file is stored temporarily by Multer, then read with `xlsx.readFile`.
- Every worksheet is converted to JSON rows with `xlsx.utils.sheet_to_json` for storage in `parsedWorkbook`.
- The same workbook is also mapped into report-specific `formData`:
  - Retail service uses the first sheet, finds the month header row, reads distributor fields, maps month columns into each row through the current report month, and sets FY from the report month using the Apr-Mar financial year.
  - Additional KPI uses the first sheet, finds the `Sr. No` / `Parameter` header row, then maps workshop columns and remarks.
  - VIN retention scans all sheets for retail/service VIN headers and maps matching rows into retail and service datasets.
- After parsing, the temporary upload file is deleted and the parsed data is saved in MongoDB.
# B-SMART-Portal
