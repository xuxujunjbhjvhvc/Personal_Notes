const path = require('path');
const fs = require('fs');
const db = require('../db/init');
const { ok, fail } = require('../utils/helper');
const crypto = require('../utils/crypto');

// 导出目录：优先环境变量（start-app.js 设置为 exe 同目录 exports），开发模式为 backend/exports
const EXPORT_DIR = process.env.EXPORT_DIR || path.join(__dirname, '..', 'exports');

// 文件名去非法字符（Windows 不允许 \ / : * ? " < > |）
function sanitizeFilename(name) {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

// 生成单条笔记的 Markdown 文本（带 frontmatter，便于再次导入）
function noteToMarkdown(note) {
  const tags = (note.tags || []).map((t) => t.name).join(', ');
  const color = note.color ? `"${note.color}"` : '""';
  const fm = [
    '---',
    `title: ${note.title || '无标题'}`,
    `tags: ${tags}`,
    `color: ${color}`,
    `font: ${note.font_key || 'default'}`,
    `created: ${note.created_at || ''}`,
    `updated: ${note.updated_at || ''}`,
    '---',
    '',
  ].join('\n');

  const body = `# ${note.title || '无标题'}\n\n${note.content || ''}`.replace(/\r\n/g, '\n').trimEnd();
  return `${fm}\n\n${body}\n`;
}

// 时间戳前缀 YYYY-MM-DD_HHMM
function timePrefix() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

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

// 导出：POST /api/export  { id } 导出单条；{ all: true } 导出全部
function exportNotes(req, res) {
  const { id, all } = req.body || {};

  let notes;
  if (all) {
    notes = db.prepare('SELECT * FROM notes ORDER BY created_at DESC').all();
  } else if (id !== undefined) {
    const n = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(id));
    if (!n) return fail(res, 404, '笔记不存在');
    notes = [n];
  } else {
    return fail(res, 400, '请指定 id 或 all=true');
  }

  if (notes.length === 0) {
    return ok(res, { files: [], count: 0 }, '没有可导出的笔记');
  }

  try {
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }
  } catch (e) {
    return fail(res, 500, `无法创建导出目录: ${e.message}`);
  }

  const files = [];
  for (const note of notes) {
    const decrypted = crypto.decryptIfNeeded(note);
    const full = { ...decrypted, tags: getNoteTags(note.id) };
    const title = sanitizeFilename(full.title || `未命名-${full.id}`);
    const filename = `${timePrefix()}_${title}.md`;
    const target = path.join(EXPORT_DIR, filename);
    try {
      fs.writeFileSync(target, noteToMarkdown(full), 'utf8');
      files.push({ id: full.id, filename, path: target });
    } catch (e) {
      return fail(res, 500, `写入 ${filename} 失败: ${e.message}`);
    }
  }

  return ok(res, { files, count: files.length, dir: EXPORT_DIR }, '导出成功');
}

module.exports = { exportNotes, EXPORT_DIR };
