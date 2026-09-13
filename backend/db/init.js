const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

// 默认使用 backend/db/database.db，可用环境变量 DB_PATH 覆盖（便于测试/部署时指定路径）
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database.db');

// pkg 打包后原生模块无法从虚拟文件系统直接 dlopen：
// 把 .node 复制到真实磁盘（临时目录），并通过 nativeBinding 选项交给 better-sqlite3 加载
let nativeBinding;
if (process.pkg) {
  const src = path.join(
    __dirname,
    '..',
    'node_modules',
    'better-sqlite3',
    'prebuilds',
    'win32-x64.node'
  );
  const dest = path.join(os.tmpdir(), `better_sqlite3_${process.pid}.node`);
  fs.copyFileSync(src, dest);
  nativeBinding = dest;
}

const db = nativeBinding ? new Database(DB_PATH, { nativeBinding }) : new Database(DB_PATH);

// 开启 WAL 提升并发读写性能
db.pragma('journal_mode = WAL');
// 开启外键约束（保证级联删除生效）
db.pragma('foreign_keys = ON');

db.exec(`
  -- 用户表
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- 笔记表
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL DEFAULT '',
    content    TEXT    NOT NULL DEFAULT '',
    color      TEXT,
    font_key   TEXT    NOT NULL DEFAULT 'default',
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  -- 标签表（每个用户的标签名唯一）
  CREATE TABLE IF NOT EXISTS tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT    NOT NULL,
    UNIQUE (user_id, name)
  );

  -- 笔记-标签 多对多关联表
  CREATE TABLE IF NOT EXISTS note_tags (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE (note_id, tag_id)
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user       ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_tags_user        ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_note_tags_note   ON note_tags(note_id);
  CREATE INDEX IF NOT EXISTS idx_note_tags_tag    ON note_tags(tag_id);
`);

// 兼容旧数据库：已存在的 notes 表自动补充新列
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] notes 表已补充字段: ${column}`);
  }
}
ensureColumn('notes', 'color', 'TEXT');
ensureColumn('notes', 'font_key', "TEXT NOT NULL DEFAULT 'default'");

module.exports = db;
