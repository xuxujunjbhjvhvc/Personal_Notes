const express = require('express');
const { listTags, createTag, renameTag, deleteTag } = require('../controllers/tagsController');

const router = express.Router();

router.get('/', listTags);
router.post('/', createTag);
router.put('/:id', renameTag);
router.delete('/:id', deleteTag);

module.exports = router;
