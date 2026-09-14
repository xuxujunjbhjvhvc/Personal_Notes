// Personal Notes 桌面版入口（pkg 打包成 exe 后双击运行）
// 架构：worker 线程运行 Express 后端，主线程创建原生 WebView 窗口（不依赖外部浏览器）
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { Worker } = require('worker_threads');

// ---- 依赖锚点：后端在 worker 线程中运行，pkg 打包时依赖树不会自动从入口可达，
//      这里显式引用，确保 dotenv/express 等连同完整依赖树被打进 exe ----
require.resolve('dotenv');
require.resolve('express');
require.resolve('cors');
require.resolve('better-sqlite3');
require.resolve('./routes/notes');
require.resolve('./routes/tags');
require.resolve('./routes/stats');
require.resolve('./routes/export');
require.resolve('./controllers/notesController');
require.resolve('./controllers/tagsController');
require.resolve('./controllers/statsController');
require.resolve('./controllers/exportController');
require.resolve('./db/init');
require.resolve('./utils/helper');

// ---- 数据目录：exe 所在目录（真实磁盘；pkg 虚拟文件系统只读，不能写数据）----
const appDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const dataDir = path.join(appDir, 'db');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
process.env.DB_PATH = process.env.DB_PATH || path.join(dataDir, 'database.db');
process.env.EXPORT_DIR = process.env.EXPORT_DIR || path.join(appDir, 'exports');
console.log(`[app] 数据文件: ${process.env.DB_PATH}`);
console.log(`[app] 导出目录: ${process.env.EXPORT_DIR}`);

// ---- pkg 打包环境下，原生模块无法从虚拟文件系统 dlopen：
//      把 .node 复制到真实磁盘，并通过 NAPI_RS_NATIVE_LIBRARY_PATH 交给加载器 ----
if (process.pkg) {
  const src = path.join(
    __dirname,
    'node_modules',
    '@webviewjs',
    'webview-win32-x64-msvc',
    'webview.win32-x64-msvc.node'
  );
  const dest = path.join(os.tmpdir(), `webview_${process.pid}.node`);
  fs.copyFileSync(src, dest);
  process.env.NAPI_RS_NATIVE_LIBRARY_PATH = dest;
}

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

  // ---- worker 线程启动 Express 后端（主线程要被 WebView 的 run() 阻塞）----
  const serverWorker = new Worker(path.join(__dirname, 'server.js'));
  serverWorker.on('error', (err) => {
    console.error('[server] worker 异常:', err);
    process.exit(1);
  });

  // ---- 等待服务就绪后创建原生窗口 ----
  const { Application, WebviewApplicationEvent } = require('@webviewjs/webview');
  const http = require('http');

  const waitServer = () =>
    new Promise((resolve) => {
      const tryOnce = () => {
        const req = http.get(
          { host: '127.0.0.1', port: PORT, path: '/index.html', timeout: 2000 },
          (res) => resolve(true)
        );
        req.on('error', () => setTimeout(tryOnce, 400));
        req.on('timeout', () => req.destroy());
      };
      tryOnce();
    });

  await waitServer();

  // ---- 窗口图标：pkg 环境下复制到真实磁盘（wry 需要真实文件路径）----
  const iconSrc = path.join(__dirname, 'assets', 'icon.ico');
  let winIconPath = null;
  if (fs.existsSync(iconSrc)) {
    if (process.pkg) {
      winIconPath = path.join(os.tmpdir(), `pn_icon_${process.pid}.ico`);
      fs.copyFileSync(iconSrc, winIconPath);
    } else {
      winIconPath = iconSrc;
    }
  }

  const app = new Application();
  const win = app.createBrowserWindow({
    title: '个人笔记',
    width: 1100,
    height: 720,
    resizable: true,
  });
  if (winIconPath) {
    try {
      win.setWindowIcon(winIconPath, 32, 32);
    } catch (e) {
      console.warn('[app] 设置窗口图标失败:', e.message);
    }
  }
  const webview = win.createWebview({ url: `http://127.0.0.1:${PORT}/index.html` });

  console.log(`[app] 服务地址: http://127.0.0.1:${PORT}`);
  console.log('[app] 原生窗口已创建，关闭窗口即退出');

  // ---- 关闭窗口：停止后端并退出 ----
  let closed = false;
  app.bind((event) => {
    if (
      !closed &&
      (event.event === WebviewApplicationEvent.WindowCloseRequested ||
        event.event === WebviewApplicationEvent.ApplicationCloseRequested)
    ) {
      closed = true;
      console.log('[app] 窗口关闭，程序退出');
      setTimeout(() => {
        serverWorker.terminate().catch(() => {});
        process.exit(0);
      }, 100);
    }
  });

  app.run();
})().catch((err) => {
  console.error('[app] 启动失败:', err);
  process.exit(1);
});
