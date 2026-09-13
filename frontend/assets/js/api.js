// =========================================================
// API 请求封装：统一处理鉴权、错误提示、JSON 序列化
// 后端与前端同源部署（Express 托管），直接使用相对路径 /api
// =========================================================

const API = {
  base: '/api',

  getToken() {
    return localStorage.getItem('pn_token');
  },

  setToken(token) {
    localStorage.setItem('pn_token', token);
  },

  clearToken() {
    localStorage.removeItem('pn_token');
  },

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = this.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(this.base + path, { ...options, headers });
    } catch (err) {
      throw new Error('无法连接服务器，请确认后端已启动');
    }

    const data = await res.json().catch(() => ({
      code: res.status,
      message: '服务器响应异常',
      data: null,
    }));

    if (!res.ok || data.code !== 0) {
      const err = new Error(data.message || '请求失败');
      err.status = res.status;
      throw err;
    }
    return data.data;
  },

  get(path) {
    return this.request(path);
  },

  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },

  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  },

  del(path) {
    return this.request(path, { method: 'DELETE' });
  },

  // ---- 认证 ----
  register(username, password) {
    return this.post('/auth/register', { username, password });
  },

  login(username, password) {
    return this.post('/auth/login', { username, password });
  },

  me() {
    return this.get('/auth/me');
  },

  // ---- 笔记 ----
  listNotes(params = {}) {
    const qs = new URLSearchParams();
    if (params.tag) qs.set('tag', params.tag);
    if (params.keyword) qs.set('keyword', params.keyword);
    const s = qs.toString();
    return this.get('/notes' + (s ? `?${s}` : ''));
  },

  getNote(id) {
    return this.get(`/notes/${id}`);
  },

  createNote(payload) {
    return this.post('/notes', payload);
  },

  updateNote(id, payload) {
    return this.put(`/notes/${id}`, payload);
  },

  deleteNote(id) {
    return this.del(`/notes/${id}`);
  },

  // ---- 标签 ----
  listTags() {
    return this.get('/tags');
  },

  createTag(name) {
    return this.post('/tags', { name });
  },

  updateTag(id, name) {
    return this.put(`/tags/${id}`, { name });
  },

  deleteTag(id) {
    return this.del(`/tags/${id}`);
  },
};

// 未登录跳转登录页；返回是否已登录
function requireAuth() {
  if (!API.getToken()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

// 登录态失效：清空 token 并跳转登录页
function redirectToLogin() {
  API.clearToken();
  location.href = 'login.html';
}

// 轻量提示条（页面中需有 #toast 元素）
function showToast(message, type = 'error') {
  const el = document.getElementById('toast');
  if (!el) {
    alert(message);
    return;
  }
  el.textContent = message;
  el.className = `toast toast-${type} show`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    el.className = 'toast';
  }, 2500);
}

// HTML 转义，防止笔记内容注入
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 将 "YYYY-MM-DD HH:MM:SS" 转为 "MM-DD HH:MM"
function formatTime(str) {
  if (!str) return '';
  const m = String(str).match(/^\d{4}-\d{2}-\d{2} (\d{2}:\d{2})/);
  return m ? m[1] : String(str).slice(0, 16);
}
