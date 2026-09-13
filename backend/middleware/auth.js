const jwt = require('jsonwebtoken');
const { fail } = require('../utils/helper');

// JWT 身份校验中间件：校验通过后把用户信息挂到 req.user
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return fail(res, 401, '未登录或登录已过期');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    return fail(res, 401, '未登录或登录已过期');
  }
}

module.exports = auth;
