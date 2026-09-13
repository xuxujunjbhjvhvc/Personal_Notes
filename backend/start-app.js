// Personal Notes 桌面版入口（pkg 打包成 exe 后双击运行）
// 职责：定位数据目录 → 探测空闲端口 → 启动后端 → 自动打开浏览器
const path = require('path');
const fs = require('fs');
const net = require('net');

// ---- 数据目录：exe 所在目录（真实磁盘；pkg 虚拟文件系统只读，不能写数据）----
const appDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const dataDir = path.join(appDir, 'db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
process.env.DB_PATH = process.env.DB_PATH || path.join(dataDir, 'database.db');
console.log(`[app] 数据文件: ${process.env.DB_PATH}`);

// ---- 探测空闲端口：3000 起，被占用则顺延 ----
function findFreePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(findFreePort(start + 1)));
    srv.listen(start, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

(async () => {
  const PORT = await findFreePort(Number(process.env.PORT || 3000));
  process.env.PORT = String(PORT);

  // 启动后端（内部加载路由并托管前端静态文件）
  require('./server.js');

  // 等服务就绪后打开默认浏览器
  const url = `http://127.0.0.1:${PORT}/index.html`;
  const http = require('http');
  const { exec } = require('child_process');

  const tryOpen = () => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: '/index.html' }, (res) => {
      console.log(`[app] 正在打开浏览器: ${url}`);
      exec(`start "" "${url}"`);
    });
    req.on('error', () => setTimeout(tryOpen, 500));
    req.setTimeout(2000, () => req.destroy());
  };
  setTimeout(tryOpen, 600);
})();
