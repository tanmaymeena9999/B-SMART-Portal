const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination(req, file, callback) {
        callback(null, UPLOAD_DIR);
    },
    filename(req, file, callback) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        callback(null, `${Date.now()}-${safeName}`);
    },
});

function excelFileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const isExcelFile = ['.xls', '.xlsx'].includes(extension);

    if (!isExcelFile) {
        return callback(new Error('Only .xls and .xlsx files are allowed.'));
    }

    return callback(null, true);
}

const uploadExcel = multer({
    storage,
    fileFilter: excelFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

module.exports = {
    uploadExcel,
};
