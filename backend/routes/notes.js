const express = require('express');
const {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
} = require('../controllers/notesController');
const auth = require('../middleware/auth');

const router = express.Router();

// 以下所有笔记接口都需要登录
router.use(auth);

router.get('/', listNotes);
router.get('/:id', getNote);
router.post('/', createNote);
router.put('/:id', updateNote);
router.delete('/:id', deleteNote);

module.exports = router;
