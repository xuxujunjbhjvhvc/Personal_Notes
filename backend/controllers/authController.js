const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const { ok, fail } = require('../utils/helper');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: process.env.TOKEN_EXPIRES_IN || '7d',
  });
}

// 注册
function register(req, res) {
  const { username, password } = req.body || {};
  const name = String(username || '').trim();

  if (!name || name.length < 2 || name.length > 20) {
    return fail(res, 400, '用户名长度需在 2-20 个字符之间');
  }
  if (!password || String(password).length < 6) {
    return fail(res, 400, '密码至少 6 位');
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(name);
  if (exists) {
    return fail(res, 409, '该用户名已被注册');
  }

  const passwordHash = bcrypt.hashSync(String(password), 10);
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(name, passwordHash);
  const user = { id: info.lastInsertRowid, username: name };

  return ok(res, { token: signToken(user), user }, '注册成功');
}

// 登录
function login(req, res) {
  const { username, password } = req.body || {};
  const name = String(username || '').trim();

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(name);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return fail(res, 401, '用户名或密码错误');
  }

  return ok(
    res,
    { token: signToken(user), user: { id: user.id, username: user.username } },
    '登录成功'
  );
}

// 获取当前登录用户信息
function me(req, res) {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return fail(res, 404, '用户不存在');
  }
  return ok(res, user);
}

module.exports = { register, login, me };
