const express = require('express');
const { exportNotes } = require('../controllers/exportController');

const router = express.Router();

router.post('/', exportNotes);

module.exports = router;
