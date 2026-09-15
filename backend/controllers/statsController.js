const db = require('../db/init');
const { ok, fail } = require('../utils/helper');

// 月度日历统计：按天统计笔记数与总字数（当月 1 号 ~ 次月 1 号）
function calendarStats(req, res) {
  const m = String(req.query.month || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    return fail(res, 400, 'month 参数格式应为 YYYY-MM');
  }
  const year = +m[1];
  const month = +m[2];
  if (month < 1 || month > 12) {
    return fail(res, 400, '月份不合法');
  }
  const start = `${m[1]}-${m[2]}-01`;
  const next = new Date(year, month, 1); // month 从 0 起算，这里即下月 1 号
  const pad = (n) => String(n).padStart(2, '0');
  const end = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`;

  const rows = db
    .prepare(
      `SELECT date(created_at) AS d,
              COUNT(*)        AS c,
              SUM(content_len) AS w
       FROM notes
       WHERE date(created_at) >= ? AND date(created_at) < ?
       GROUP BY d
       ORDER BY d`
    )
    .all(start, end);

  return ok(
    res,
    {
      year,
      month,
      days: rows.map((r) => ({ date: r.d, notes: r.c, words: r.w })),
    },
    '获取成功'
  );
}

module.exports = { calendarStats };
