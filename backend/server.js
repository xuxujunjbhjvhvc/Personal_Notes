const path = require('path');
// 加载环境变量：开发时读取 backend/.env；打包后从 exe 内置的虚拟文件系统读取
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

// 初始化数据库（启动时自动建表，首次运行会生成 backend/db/database.db）
require('./db/init');

const notesRoutes = require('./routes/notes');
const tagsRoutes = require('./routes/tags');
const statsRoutes = require('./routes/stats');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ---- API 路由 ----
app.use('/api/notes', notesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/export', exportRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 0, message: 'ok', data: { time: new Date().toISOString() } });
});

// ---- 托管前端静态文件（frontend 与 backend 同级目录）----
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// ---- 404 处理（仅针对 /api 前缀）----
app.use('/api', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// ---- 统一错误处理 ----
app.use((err, req, res, next) => {
  console.error('[server error]', err);
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

app.listen(PORT, () => {
  console.log(`Personal Notes 服务已启动: http://localhost:${PORT}`);
  console.log(`前端页面: http://localhost:${PORT}/index.html`);
});
