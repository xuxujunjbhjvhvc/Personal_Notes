// =========================================================
// 笔记加密模块：AES-256-GCM + scrypt 密码派生
// - 未设置密码：所有笔记明文存储（enc = 0）
// - 设置密码后：content 加密存储（enc = 1），密钥只保存在进程内存
//   重启程序后需重新输入密码解锁；忘记密码无法恢复数据
// =========================================================
const crypto = require('crypto');
const db = require('../db/init');

const CHECK_TEXT = 'PN_UNLOCK_OK';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

// 会话密钥（仅内存，进程退出即失效）
let sessionKey = null;

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

// 是否已开启加密（存在密钥参数即视为开启）
function isEnabled() {
  return !!getSetting('cipher_salt');
}

// 是否处于锁定状态（已开启加密但尚未输入密码解锁）
function isLocked() {
  return isEnabled() && !sessionKey;
}

function deriveKey(password, saltHex) {
  return crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), KEY_LEN);
}

function encrypt(key, plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain ?? ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('hex');
}

function decrypt(key, hexStr) {
  try {
    const buf = Buffer.from(String(hexStr), 'hex');
    if (buf.length < IV_LEN + TAG_LEN) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null; // 密钥错误 / 数据损坏
  }
}

// 设置/重设主密码：全量加密现有明文笔记
function setup(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = deriveKey(password, salt);

  const rows = db.prepare('SELECT id, content FROM notes WHERE enc = 0').all();
  const upd = db.prepare('UPDATE notes SET content = ?, enc = 1, content_len = ? WHERE id = ?');
  db.transaction((list) => {
    for (const r of list) {
      const plain = String(r.content ?? '');
      upd.run(encrypt(key, plain), plain.length, r.id);
    }
  })(rows);

  setSetting('cipher_salt', salt);
  setSetting('cipher_check', encrypt(key, CHECK_TEXT));
  sessionKey = key;
  return true;
}

// 密码解锁：验证成功后在内存中保存会话密钥
function unlock(password) {
  const salt = getSetting('cipher_salt');
  const check = getSetting('cipher_check');
  if (!salt || !check) return false;
  const key = deriveKey(password, salt);
  if (decrypt(key, check) !== CHECK_TEXT) return false;
  sessionKey = key;
  return true;
}

// 修改密码：用旧密钥解密全部，再用新密钥重新加密
function changePassword(oldPwd, newPwd) {
  if (!unlock(oldPwd)) return false;

  const rows = db.prepare('SELECT id, content FROM notes WHERE enc = 1').all();
  const oldKey = sessionKey;
  const salt = crypto.randomBytes(16).toString('hex');
  const newKey = deriveKey(newPwd, salt);

  const upd = db.prepare('UPDATE notes SET content = ?, enc = 1, content_len = ? WHERE id = ?');
  db.transaction((list) => {
    for (const r of list) {
      const plain = decrypt(oldKey, r.content) ?? '';
      upd.run(encrypt(newKey, plain), plain.length, r.id);
    }
  })(rows);

  setSetting('cipher_salt', salt);
  setSetting('cipher_check', encrypt(newKey, CHECK_TEXT));
  sessionKey = newKey;
  return true;
}

// 关闭加密：全量解密为明文并删除密钥参数
function disable(password) {
  if (!unlock(password)) return false;

  const rows = db.prepare('SELECT id, content FROM notes WHERE enc = 1').all();
  const upd = db.prepare('UPDATE notes SET content = ?, enc = 0, content_len = ? WHERE id = ?');
  db.transaction((list) => {
    for (const r of list) {
      const plain = decrypt(sessionKey, r.content) ?? '';
      upd.run(plain, plain.length, r.id);
    }
  })(rows);

  db.prepare("DELETE FROM settings WHERE key IN ('cipher_salt', 'cipher_check')").run();
  sessionKey = null;
  return true;
}

function lock() {
  sessionKey = null;
}

// 写入侧：开启加密时加密内容，否则明文；未解锁直接抛 423
function encryptIfEnabled(plain) {
  const s = String(plain ?? '');
  if (isEnabled()) {
    if (!sessionKey) {
      const err = new Error('笔记已加密，请先解锁');
      err.status = 423;
      throw err;
    }
    return { content: encrypt(sessionKey, s), enc: 1, len: s.length };
  }
  return { content: s, enc: 0, len: s.length };
}

// 读取侧：加密笔记解密后返回；解密失败置空并保留原字段
function decryptIfNeeded(note) {
  if (!note || note.enc !== 1) return note;
  if (!sessionKey) return { ...note, content: '' };
  return { ...note, content: decrypt(sessionKey, note.content) ?? '' };
}

module.exports = {
  isEnabled,
  isLocked,
  setup,
  unlock,
  changePassword,
  disable,
  lock,
  encryptIfEnabled,
  decryptIfNeeded,
};
