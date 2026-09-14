// 构建前置：给 pkg 的 base binary（普通 node.exe）注入图标。
// pkg 生成 EXE 时会基于此 base 输出，图标随 EXE 一起生成，不会被资源工具破坏。
// 幂等：重复执行只是再次替换图标，无害。
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const base = path.join(os.homedir(), '.pkg-cache', 'v3.6', 'fetched-v24.18.1-win-x64');
  const ico = path.join(__dirname, 'assets', 'icon.ico');
  if (!fs.existsSync(base)) {
    console.error('[build-base-icon] 未找到 base binary，请先执行一次普通构建（会自动下载）:', base);
    process.exit(1);
  }
  if (!fs.existsSync(ico)) {
    throw new Error(`缺少图标: ${ico}`);
  }
  const { rcedit } = require('rcedit');
  await rcedit(base, { icon: ico });
  console.log('[build-base-icon] 图标已注入 base:', base);
})().catch((err) => {
  console.error('[build-base-icon] 失败:', err.message);
  process.exit(1);
});
