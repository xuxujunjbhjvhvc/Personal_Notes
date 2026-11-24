const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-notes-test-'));
process.env.DB_PATH = path.join(tempDir, 'test.db');
const db = require('../db/init');
const { listNotes } = require('../controllers/notesController');

function addNote(title, content, tagName) {
  const noteId = db.prepare('INSERT INTO notes (title, content) VALUES (?, ?)').run(title, content).lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName);
  const tagId = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName).id;
  db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run(noteId, tagId);
}

function query(query) {
  const res = { json(body) { this.body = body; } };
  listNotes({ query }, res);
  return res.body.data.map(note => note.title).sort();
}

test('tag and keyword filters work separately and together', (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  addNote('蓝色笔记', '出行清单', '旅行');
  addNote('绿色笔记', '出行清单', '学习');
  addNote('读书记录', '读完一本书', '旅行');

  assert.deepEqual(query({ tag: '旅行' }), ['蓝色笔记', '读书记录']);
  assert.deepEqual(query({ keyword: '出行' }), ['绿色笔记', '蓝色笔记']);
  assert.deepEqual(query({ tag: '旅行', keyword: '出行' }), ['蓝色笔记']);
  assert.deepEqual(query({ tag: '旅行', keyword: '不存在' }), []);
  assert.equal(query({}).length, 3);
});
