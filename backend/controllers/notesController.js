const db = require('../db/init');
const { ok, fail } = require('../utils/helper');

// 支持的字体（key 与前端保持一致）
const FONT_KEYS = ['default', 'song', 'kai', 'hei', 'yuan', 'fang'];

// 规范化颜色：只接受空值或合法 hex，非法回退 null（默认）
function normalizeColor(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return /^#[0-9a-fA-F]{6}$/.test(s) || /^#[0-9a-fA-F]{3}$/.test(s) ? s : null;
}

// 规范化字体 key：不在白名单则回退 default
function normalizeFontKey(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return FONT_KEYS.includes(s) ? s : 'default';
}

// 查询某条笔记关联的标签
function getNoteTags(noteId) {
  return db
    .prepare(
      `SELECT t.id, t.name
       FROM tags t
       JOIN note_tags nt ON nt.tag_id = t.id
       WHERE nt.note_id = ?
       ORDER BY t.name`
    )
    .all(noteId);
}

// 查询单条笔记（带标签），不存在返回 null
function fetchNote(noteId) {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
  if (!note) return null;
  return { ...note, tags: getNoteTags(note.id) };
}

// 为笔记挂载标签：标签不存在则自动创建
function attachTags(noteId, tags) {
  const list = Array.isArray(tags)
    ? [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))]
    : [];

  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const findTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const link = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');

  for (const name of list) {
    insertTag.run(name);
    const tag = findTag.get(name);
    if (tag) link.run(noteId, tag.id);
  }
}

// 笔记列表：支持 ?tag=标签名 过滤、?keyword=关键词 搜索
function listNotes(req, res) {
  const { tag, keyword } = req.query;

  let notes;
  if (tag) {
    notes = db
      .prepare(
        `SELECT DISTINCT n.*
         FROM notes n
         JOIN note_tags nt ON nt.note_id = n.id
         JOIN tags t ON t.id = nt.tag_id
         WHERE t.name = ?
         ORDER BY n.updated_at DESC`
      )
      .all(String(tag));
  } else if (keyword && String(keyword).trim()) {
    const like = `%${String(keyword).trim()}%`;
    notes = db
      .prepare(
        `SELECT * FROM notes
         WHERE title LIKE ? OR content LIKE ?
         ORDER BY updated_at DESC`
      )
      .all(like, like);
  } else {
    notes = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  }

  const result = notes.map((n) => ({ ...n, tags: getNoteTags(n.id) }));
  return ok(res, result);
}

// 单条笔记
function getNote(req, res) {
  const note = fetchNote(req.params.id);
  if (!note) return fail(res, 404, '笔记不存在');
  return ok(res, note);
}

// 新建笔记
function createNote(req, res) {
  const { title = '', content = '', tags = [], color, fontKey } = req.body || {};
  const t = String(title).trim();
  const c = String(content ?? '');

  if (!t && !c) {
    return fail(res, 400, '标题和内容不能同时为空');
  }

  const info = db
    .prepare('INSERT INTO notes (title, content, color, font_key) VALUES (?, ?, ?, ?)')
    .run(t, c, normalizeColor(color), normalizeFontKey(fontKey));
  const noteId = info.lastInsertRowid;

  attachTags(noteId, tags);
  return ok(res, fetchNote(noteId), '创建成功');
}

// 更新笔记（字段缺省时保留原值；tags 传入时整体替换）
function updateNote(req, res) {
  const note = fetchNote(req.params.id);
  if (!note) return fail(res, 404, '笔记不存在');

  const { title, content, tags, color, fontKey } = req.body || {};
  const t = title === undefined ? note.title : String(title).trim();
  const c = content === undefined ? note.content : String(content ?? '');
  const cl = color === undefined ? note.color : normalizeColor(color);
  const fk = fontKey === undefined ? note.font_key : normalizeFontKey(fontKey);

  db.prepare(
    `UPDATE notes
     SET title = ?, content = ?, color = ?, font_key = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(t, c, cl, fk, note.id);

  if (tags !== undefined) {
    db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(note.id);
    attachTags(note.id, tags);
  }

  return ok(res, fetchNote(note.id), '更新成功');
}

// 删除笔记
function deleteNote(req, res) {
  const note = fetchNote(req.params.id);
  if (!note) return fail(res, 404, '笔记不存在');

  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  return ok(res, null, '删除成功');
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote };
