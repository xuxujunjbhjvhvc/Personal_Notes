const express = require('express');
const {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/notesController');

const router = express.Router();

router.get('/', listNotes);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
