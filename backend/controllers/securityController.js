const crypto = require('../utils/crypto');
const { ok, fail } = require('../utils/helper');

function validatePassword(p) {
  const s = String(p ?? '');
  if (s.length < 4) return '密码至少 4 位';
  if (s.length > 64) return '密码不能超过 64 位';
  return null;
}

// GET /api/security/status：加密状态与锁定状态
function status(req, res) {
  return ok(res, { enabled: crypto.isEnabled(), locked: crypto.isLocked() });
}

// POST /api/security/setup { password }：首次设置 / 已解锁后重设主密码
function setup(req, res) {
  const { password } = req.body || {};
  const err = validatePassword(password);
  if (err) return fail(res, 400, err);
  if (crypto.isLocked()) return fail(res, 423, '请先解锁再修改密码');
  crypto.setup(password);
  return ok(res, { enabled: true, locked: false }, '已开启笔记加密');
}

// POST /api/security/unlock { password }
function unlock(req, res) {
  const { password } = req.body || {};
  if (!crypto.isEnabled()) return fail(res, 400, '尚未开启加密');
  if (crypto.unlock(String(password ?? ''))) {
    return ok(res, { locked: false }, '解锁成功');
  }
  return fail(res, 401, '密码错误');
}

// POST /api/security/change { oldPassword, newPassword }
function change(req, res) {
  const { oldPassword, newPassword } = req.body || {};
  const err = validatePassword(newPassword);
  if (err) return fail(res, 400, err);
  if (!crypto.isEnabled()) return fail(res, 400, '尚未开启加密');
  if (crypto.changePassword(String(oldPassword ?? ''), String(newPassword))) {
    return ok(res, { locked: false }, '密码已修改');
  }
  return fail(res, 401, '原密码错误');
}

// POST /api/security/disable { password }：关闭加密（全量解密）
function disable(req, res) {
  const { password } = req.body || {};
  if (!crypto.isEnabled()) return fail(res, 400, '尚未开启加密');
  if (crypto.disable(String(password ?? ''))) {
    return ok(res, { enabled: false, locked: false }, '已关闭加密，笔记恢复明文保存');
  }
  return fail(res, 401, '密码错误');
}

module.exports = { status, setup, unlock, change, disable };
