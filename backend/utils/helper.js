// 统一 API 响应格式：{ code: 0, message, data }，code 0 表示成功

function ok(res, data = null, message = 'ok') {
  res.json({ code: 0, message, data });
}

function fail(res, status = 400, message = '请求失败', data = null) {
  res.status(status).json({ code: status, message, data });
}

module.exports = { ok, fail };
