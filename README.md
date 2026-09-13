# Personal Notes 个人笔记系统

一个带用户登录、笔记增删改查、标签分类与搜索的轻量个人笔记系统。
前端零依赖（原生 HTML/CSS/JS），后端 Express + SQLite，适合新手学习前后端联调与 CRUD 开发。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | 原生 HTML + CSS + JavaScript（无框架、无构建步骤） |
| 后端 | Node.js + Express |
| 数据库 | SQLite（better-sqlite3，单文件，无需安装数据库服务） |
| 鉴权 | JWT（jsonwebtoken）+ 密码哈希（bcryptjs） |

## 功能

- 用户注册 / 登录（JWT 鉴权）
- 笔记新增、查看、编辑、删除（CRUD）
- 标签：创建标签、按标签筛选笔记、删除标签
- 搜索：按标题 / 内容关键词搜索
- 标签自动挂载：编辑笔记时填入标签名会自动创建

## 目录结构

```
Personal_Notes/
├── backend/                  # 后端 Express 服务
│   ├── package.json
│   ├── .env                  # 环境变量（端口、JWT 密钥）
│   ├── .env.example          # 环境变量示例
│   ├── server.js             # 服务入口
│   ├── db/
│   │   ├── init.js           # 建表初始化（自动生成 database.db）
│   │   └── database.db       # SQLite 数据文件（首次启动自动生成）
│   ├── routes/               # 路由定义
│   │   ├── auth.js
│   │   ├── notes.js
│   │   └── tags.js
│   ├── controllers/          # 业务逻辑
│   │   ├── authController.js
│   │   ├── notesController.js
│   │   └── tagsController.js
│   ├── middleware/
│   │   └── auth.js           # JWT 校验中间件
│   └── utils/
│       └── helper.js         # 统一响应格式
├── frontend/                 # 前端静态页面（由后端直接托管）
│   ├── index.html            # 笔记列表页
│   ├── login.html            # 登录页
│   ├── register.html         # 注册页
│   ├── note-editor.html      # 新增 / 编辑笔记页
│   └── assets/
│       ├── css/style.css
│       └── js/
│           ├── api.js        # 请求封装
│           ├── auth.js       # 登录注册逻辑
│           └── notes.js      # 列表页与编辑器逻辑
├── README.md
└── .gitignore
```

## 环境要求

- Node.js 18 及以上（`node -v` 查看版本）

## 启动步骤

```bash
# 1. 进入后端目录
cd backend

# 2. 安装依赖（首次运行，需要联网下载 npm 包）
npm install

# 3. 启动服务
npm start
```

看到 `Personal Notes 服务已启动: http://localhost:3000` 后，浏览器打开：

```
http://localhost:3000/login.html
```

先注册一个账号，即可开始使用。数据保存在 `backend/db/database.db` 文件中。

> 开发模式：`npm run dev` 使用 Node 自带 watch 模式，改代码自动重启。

## API 接口

所有接口返回统一格式：`{ code, message, data }`，`code = 0` 表示成功。
需要登录的接口需在请求头携带 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- |
| POST | /api/auth/register | 注册 `{ username, password }` | 否 |
| POST | /api/auth/login | 登录，返回 token | 否 |
| GET | /api/auth/me | 获取当前用户信息 | 是 |
| GET | /api/notes | 笔记列表，支持 `?tag=标签名` 与 `?keyword=关键词` | 是 |
| GET | /api/notes/:id | 单条笔记 | 是 |
| POST | /api/notes | 新建笔记 `{ title, content, tags: [] }` | 是 |
| PUT | /api/notes/:id | 更新笔记（字段缺省保留原值） | 是 |
| DELETE | /api/notes/:id | 删除笔记 | 是 |
| GET | /api/tags | 标签列表（含笔记数） | 是 |
| POST | /api/tags | 新建标签 `{ name }` | 是 |
| PUT | /api/tags/:id | 重命名标签 `{ name }`（自动同步到所有笔记） | 是 |
| DELETE | /api/tags/:id | 删除标签（自动解除与笔记的关联） | 是 |

## 数据库表

| 表 | 说明 |
| --- | --- |
| users | 用户（用户名唯一，密码存 bcrypt 哈希） |
| notes | 笔记（标题、内容、时间戳） |
| tags | 标签（同一用户下标签名唯一） |
| note_tags | 笔记-标签多对多关联表 |

## 常见问题

- **npm install 很慢或失败**：better-sqlite3 v13+ 自带跨平台预编译二进制（NAPI），一般无需联网下载；若仍安装慢，可配置国内 npm 镜像：`npm config set registry https://registry.npmmirror.com`。
- **端口被占用**：修改 `backend/.env` 中的 `PORT` 后重启。
- **忘记密码**：目前无找回功能，可删除 `backend/db/database.db` 后重启服务重建数据（会清空所有数据）。

## 安全提醒

- 部署前务必修改 `backend/.env` 中的 `JWT_SECRET` 为一长串随机字符。
- 本项目用于学习，生产环境还需补充：HTTPS、速率限制、密码找回、内容审核等。
