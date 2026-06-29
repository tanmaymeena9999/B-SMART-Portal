const express = require('express');
const {
    addCredential,
    editCredential,
    getCredentials,
    removeCredential,
} = require('../controllers/credentialsController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', getCredentials);
router.post('/', addCredential);
router.put('/:id', editCredential);
router.delete('/:id', removeCredential);

module.exports = router;
