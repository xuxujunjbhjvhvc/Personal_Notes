const express = require('express');
const { status, setup, unlock, change, disable } = require('../controllers/securityController');

const router = express.Router();

router.get('/status', status);
router.post('/setup', setup);
router.post('/unlock', unlock);
router.post('/change', change);
router.post('/disable', disable);

module.exports = router;
