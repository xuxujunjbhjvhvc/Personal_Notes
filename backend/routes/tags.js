const express = require('express');
const { listTags, createTag, renameTag, deleteTag } = require('../controllers/tagsController');
const auth = require('../middleware/auth');

const router = express.Router();

// 以下所有标签接口都需要登录
router.use(auth);

router.get('/', listTags);
router.post('/', createTag);
router.put('/:id', renameTag);
router.delete('/:id', deleteTag);

module.exports = router;
