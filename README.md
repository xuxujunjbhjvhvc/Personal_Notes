# Personal Notes 个人笔记系统

一个轻量、开箱即用的个人笔记应用：笔记管理、标签体系、关键词搜索，以及笔记颜色与字体自定义。前后端同源部署，一条命令即可启动，数据保存在本地 SQLite 单文件中。

- 前端：原生 HTML / CSS / JavaScript，零框架、零构建步骤
- 后端：Node.js + Express，RESTful API
- 数据库：SQLite（better-sqlite3），无需安装数据库服务

> 桌面离线版（`desktop-exe` 分支）为**单用户离线使用，无需注册登录**，双击 EXE 即用，详见下方「桌面离线版」。

---

## 功能特性

**笔记管理**
- 笔记新增、查看、编辑、删除（完整 CRUD）
- 按标题 / 内容关键词搜索
- 笔记列表卡片式展示，时间倒序排列

**标签体系**
- 创建标签，编辑笔记时自动挂载新标签
- 按标签筛选笔记
- 重命名标签：自动同步到所有关联笔记
- 删除标签：自动解除与所有笔记的关联，不影响笔记本身

**样式自定义**
- 8 种预设纸感色板 + 自定义取色器，设置笔记背景色
- 6 款系统免费字体（宋体 / 楷体 / 黑体 / 幼圆 / 仿宋），零联网加载
- 深色背景自动切换浅色文字，保证可读性
- 编辑器实时预览所选字体与颜色

**其他**
- 桌面版单用户离线：无需注册登录，数据保存在本地
- 前端零外部依赖，离线可用

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | 原生 HTML + CSS + JavaScript（无框架、无构建步骤） |
| 后端 | Node.js + Express 4 |
| 数据库 | SQLite（better-sqlite3 v13，NAPI 跨 Node 版本通用） |
| 桌面窗口 | @webviewjs/webview（Rust 绑定，复用系统 WebView2，桌面版专用） |

---

## 桌面离线版（Windows EXE）

> 本分支（`desktop-exe`）提供将整套应用打包为单个 Windows EXE 的能力：**无需安装 Node.js，双击即用**，前后端与 SQLite 全部内置。

### 使用方式

1. 双击 `dist/PersonalNotes.exe`（或自行打包，见下）
2. 程序自动启动本地服务并弹出**内置窗口**（WebView2，无浏览器地址栏），直接进入笔记列表页
3. **无需注册登录**，直接开始记笔记
4. 数据保存在 **exe 同目录 `db/database.db`**（退出程序、重启电脑数据不丢失）
5. 关闭窗口即退出程序（后端服务同时停止）

> 窗口使用系统自带的 WebView2（Edge 内核，Windows 10/11 自带），**不依赖外部浏览器、不捆绑完整 Chromium**。
> 端口被占用时程序会自动顺延（3000 → 3001 → …），不影响使用。

### 重新打包 EXE

```bash
cd backend
npm install          # 安装依赖（含打包工具 @yao-pkg/pkg）
npm run build-exe    # 生成 ../dist/PersonalNotes.exe
```

打包说明：
- 打包工具：`@yao-pkg/pkg`（社区维护版，支持 Node 24）
- 首次构建会自动下载 Node 运行时（约 90MB，缓存于 `~/.pkg-cache`）；若下载失败，可手动下载
  `https://github.com/yao-pkg/pkg-fetch/releases/download/v3.6/node-v24.18.1-win-x64`
  并重命名为 `fetched-v24.18.1-win-x64` 放入 `~/.pkg-cache/v3.6/`
- better-sqlite3 为原生模块：运行时自动把内置的 `win32-x64.node` 释放到临时目录后加载（`db/init.js` 中处理）
- 内置窗口使用 `@webviewjs/webview`（Rust 实现，基于系统 WebView2）：其原生 `.node` 与 better-sqlite3 一样，打包后由 `start-app.js` 在启动时释放到临时目录并通过 `NAPI_RS_NATIVE_LIBRARY_PATH` 加载
- 后端（Express + SQLite）运行在 worker 线程中，主线程负责窗口；关闭窗口会自动终止后端并退出
- **EXE 图标**：构建前会把 `assets/icon.ico` 注入 pkg 的 base binary（普通 node.exe），再基于它打包，因此生成的 EXE 自带书本图标（`build-base-icon.js` 负责注入，幂等安全）

---

## 快速开始

### 环境要求

- Node.js 18 及以上（`node -v` 查看版本）

### 安装与启动

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖（首次运行，需联网下载 npm 包）
npm install

# 3. 启动服务
npm start
```

看到如下输出即启动成功：

```
Personal Notes 服务已启动: http://localhost:3000
前端页面: http://localhost:3000/index.html
```

浏览器打开 `http://localhost:3000/index.html` 即可使用（桌面版无登录，直接进入笔记列表）。

- 开发模式：`npm run dev`（Node 自带 watch，改代码自动重启）
- 数据文件：`backend/db/database.db`（首次启动自动生成）

### 环境变量

复制 `backend/.env.example` 为 `backend/.env`，按需修改：

```env
PORT=3000                    # 服务端口
```

---

## 笔记样式自定义

### 字体（fontKey）

| key | 字体 | 适用场景 |
| --- | --- | --- |
| `default` | 系统默认（微软雅黑 / PingFang） | 日常正文 |
| `song` | 宋体 | 阅读、文艺 |
| `kai` | 楷体 | 手写感、日记 |
| `hei` | 黑体 | 标题、强调 |
| `yuan` | 幼圆 | 轻松、可爱 |
| `fang` | 仿宋 | 公文、正式 |

所有字体均为操作系统自带，无需联网下载，跨 Windows / macOS 自动回退。

### 颜色

- 预设 8 色纸感色板：默认、奶油、淡绿、浅青、淡蓝、淡紫、樱粉、暖灰
- 自定义取色器：支持任意颜色，保存后自动判断明暗并适配文字颜色

---

## 项目结构

```
Personal_Notes/
├── backend/                  # 后端 Express 服务
│   ├── package.json
│   ├── .env                  # 环境变量（不入库）
│   ├── .env.example          # 环境变量示例
│   ├── server.js             # 服务入口（API + 托管前端静态文件）
│   ├── start-app.js          # 桌面版入口（worker 跑后端 + 内置 WebView 窗口）
│   ├── db/
│   │   ├── init.js           # 建表初始化
│   │   └── database.db       # SQLite 数据文件（首次启动自动生成）
│   ├── routes/               # 路由定义
│   │   ├── notes.js          # 笔记路由
│   │   └── tags.js           # 标签路由
│   ├── controllers/          # 业务逻辑
│   │   ├── notesController.js
│   │   └── tagsController.js
│   └── utils/
│       └── helper.js         # 统一响应格式
├── frontend/                 # 前端静态页面（由后端同源托管）
│   ├── index.html            # 笔记列表页
│   ├── note-editor.html      # 新增 / 编辑笔记页
│   └── assets/
│       ├── css/style.css     # 全局样式（书卷暖纸风格）
│       └── js/
│           ├── api.js        # 请求封装
│           └── notes.js      # 列表页与编辑器逻辑
├── dist/                     # 打包产物（EXE，不入库）
├── README.md
└── .gitignore
```

---

## API 文档

### 统一约定

- 所有接口返回 `{ code, message, data }`，`code = 0` 表示成功
- 桌面离线版为单用户，所有接口**无需鉴权**，直接调用

### 接口一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notes` | 笔记列表，支持 `?tag=标签名`、`?keyword=关键词` |
| GET | `/api/notes/:id` | 单条笔记（含标签、颜色、字体） |
| POST | `/api/notes` | 新建笔记 |
| PUT | `/api/notes/:id` | 更新笔记（字段缺省保留原值） |
| DELETE | `/api/notes/:id` | 删除笔记 |
| GET | `/api/tags` | 标签列表（含各标签笔记数） |
| POST | `/api/tags` | 新建标签 `{ name }` |
| PUT | `/api/tags/:id` | 重命名标签 `{ name }`（自动同步到所有笔记） |
| DELETE | `/api/tags/:id` | 删除标签（自动解除与笔记的关联） |
| GET | `/api/health` | 健康检查 |

### 笔记字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 标题（可为空，但标题与内容不能同时为空） |
| `content` | string | 内容 |
| `tags` | string[] | 标签名数组，不存在则自动创建 |
| `color` | string | 背景色 hex 值（如 `#fdf6e3`），传空回退默认 |
| `fontKey` | string | 字体 key（`default/song/kai/hei/yuan/fang`），非法值回退 `default` |

### 请求示例

```bash
# 新建带样式与标签的笔记
curl -X POST http://localhost:3000/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"第一篇","content":"你好","tags":["灵感"],"color":"#fdf6e3","fontKey":"kai"}'

# 按标签筛选
curl "http://localhost:3000/api/notes?tag=灵感"
```

---

## 数据库设计

| 表 | 说明 |
| --- | --- |
| `notes` | 笔记（标题、内容、背景色 `color`、字体 `font_key`、时间戳） |
| `tags` | 标签（名称唯一） |
| `note_tags` | 笔记-标签多对多关联表（级联删除） |

> 版本升级时会自动为旧库补充新字段（`ensureColumn` 迁移逻辑），无需手工操作数据库。

---

## 常见问题

**npm install 很慢或失败**
better-sqlite3 v13 自带跨平台预编译二进制（NAPI），一般无需联网下载。若仍安装慢，可配置国内镜像：
```bash
npm config set registry https://registry.npmmirror.com
```

**端口被占用**
修改 `backend/.env` 中的 `PORT` 后重启，访问地址同步变更。

**数据重置**
想清空所有数据：删除数据库文件后重启即可（默认 `backend/db/database.db`，EXE 版为程序同目录 `db/database.db`，会清空全部笔记）。

**页面样式没有更新**
浏览器缓存导致，使用 `Ctrl + F5` 强制刷新。

---

## 部署说明

本项目使用 SQLite 单文件数据库，适合**本机长期运行**：重启服务、重启电脑数据都不会丢失。

- **本机部署**：直接 `npm start`，配合 Windows 开机自启脚本即可常驻使用
- **云服务器部署**：SQLite 文件保存在服务器硬盘，重启不丢失；注意选择带持久磁盘的方案
- **容器平台（Render / Railway 等）**：免费容器为临时文件系统，重启会清空 SQLite 文件；若需部署到此类平台，建议将数据库迁移到 PostgreSQL 等远程数据库

---

## 安全提醒

- `.env` 与 `database.db` 已加入 `.gitignore`，请勿提交到版本库
- 本项目定位为个人使用 / 学习项目，对外提供生产服务还需补充：HTTPS、速率限制、内容审核等
- 桌面离线版数据保存在本机，请勿将包含隐私数据的 `database.db` 直接分享给他人

---

## 路线图

- [ ] 笔记 Markdown 渲染
- [ ] 笔记置顶 / 归档
- [ ] 按颜色、字体筛选
- [ ] 笔记导出（Markdown / PDF）
- [ ] 移动端适配优化

---

## License

MIT
