const express = require('express');
const { calendarStats } = require('../controllers/statsController');

const router = express.Router();

router.get('/calendar', calendarStats);

module.exports = router;
