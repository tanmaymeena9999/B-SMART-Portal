const express = require('express');
const {
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
} = require('../controllers/reportsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { uploadExcel } = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/currency-rate', fetchCurrencyRate);
router.get('/monthly', getMonthlyReports);
router.get('/retail-service', getRetailServiceReport);
router.post('/retail-service', requireRole('dealer', 'admin'), saveRetailServiceReport);
router.get('/additional-kpi', getAdditionalKpiReport);
router.post('/additional-kpi', requireRole('dealer', 'admin'), saveAdditionalKpiReport);
router.get('/vin-retention', getVinRetentionReport);
router.post('/vin-retention', requireRole('dealer', 'admin'), saveVinRetentionReport);
router.get('/monthly/:id', getMonthlyReport);
router.patch('/monthly/:id/review', requireRole('country_manager', 'admin'), reviewMonthlyReport);
router.post(
    '/monthly/upload',
    requireRole('dealer', 'admin'),
    uploadExcel.single('excel'),
    uploadMonthlyReport
);

module.exports = router;
