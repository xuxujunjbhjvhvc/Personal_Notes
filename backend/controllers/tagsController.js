const db = require('../db/init');
const { ok, fail } = require('../utils/helper');

// 标签列表（附带每个标签下的笔记数量，按数量降序）
function listTags(req, res) {
  const tags = db
    .prepare(
      `SELECT t.id, t.name, COUNT(nt.note_id) AS note_count
       FROM tags t
       LEFT JOIN note_tags nt ON nt.tag_id = t.id
       GROUP BY t.id
       ORDER BY note_count DESC, t.name`
    )
    .all();
  return ok(res, tags);
}

// 新建标签
function createTag(req, res) {
  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 20) {
    return fail(res, 400, '标签名不能为空且不超过 20 个字符');
  }

  const exists = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (exists) {
    return fail(res, 409, '该标签已存在');
  }

  const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  return ok(res, { id: info.lastInsertRowid, name, note_count: 0 }, '创建成功');
}

// 重命名标签（所有关联该标签的笔记自动生效）
function renameTag(req, res) {
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return fail(res, 404, '标签不存在');

  const name = String((req.body || {}).name || '').trim();
  if (!name || name.length > 20) {
    return fail(res, 400, '标签名不能为空且不超过 20 个字符');
  }

  const dup = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name, tag.id);
  if (dup) return fail(res, 409, '已存在同名标签');

  db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name, tag.id);
  return ok(res, { id: tag.id, name }, '重命名成功');
}

// 删除标签（同时解除该标签与所有笔记的关联）
function deleteTag(req, res) {
  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return fail(res, 404, '标签不存在');

  db.prepare('DELETE FROM tags WHERE id = ?').run(tag.id);
  return ok(res, null, '删除成功');
}

module.exports = { listTags, createTag, renameTag, deleteTag };
