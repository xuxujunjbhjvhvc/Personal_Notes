// =========================================================
// API 请求封装：统一错误提示、JSON 序列化
// 后端与前端同源部署（Express 托管），直接使用相对路径 /api
// 桌面离线版：单用户，无登录鉴权
// =========================================================

const API = {
  base: '/api',

  async request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

    let res;
    try {
      res = await fetch(this.base + path, { ...options, headers });
    } catch (err) {
      throw new Error('无法连接服务器，请确认程序已启动');
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

  // ---- 统计 ----
  calendarStats(month) {
    return this.get(`/stats/calendar?month=${encodeURIComponent(month)}`);
  },

  // ---- Markdown 导出 ----
  exportNote(id) {
    return this.post('/export', { id });
  },

  exportAll() {
    return this.post('/export', { all: true });
  },

  // ---- 笔记加密 ----
  securityStatus() {
    return this.get('/security/status');
  },

  setupPassword(password) {
    return this.post('/security/setup', { password });
  },

  unlockPassword(password) {
    return this.post('/security/unlock', { password });
  },

  changePassword(oldPassword, newPassword) {
    return this.post('/security/change', { oldPassword, newPassword });
  },

  disableEncryption(password) {
    return this.post('/security/disable', { password });
  },
};

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

// =========================================================
// 笔记风格弹窗（替代浏览器默认 alert/confirm/prompt）
// openDialog 返回 Promise：
//   - 输入模式 resolve 输入值；取消 resolve null
//   - 确认模式 resolve true / null
// =========================================================
function openDialog({ title, message, value = '', confirmText = '确定', cancelText = '取消', showInput = false, inputType = 'text' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        <div class="dialog-title">${esc(title)}</div>
        ${message ? `<div class="dialog-message">${esc(message)}</div>` : ''}
        ${showInput ? `<input type="${esc(inputType)}" class="dialog-input" value="${esc(value)}" maxlength="20" />` : ''}
        <div class="dialog-actions">
          <button type="button" class="btn btn-ghost" data-dialog="cancel">${esc(cancelText)}</button>
          <button type="button" class="btn btn-primary" data-dialog="confirm">${esc(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.dialog-input');
    if (input) {
      input.focus();
      input.select();
    }

    let onKey;
    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }

    // 点击遮罩或按 Esc 取消
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    overlay.querySelector('[data-dialog="cancel"]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-dialog="confirm"]').addEventListener('click', () => {
      close(input ? input.value : true);
    });

    onKey = (e) => {
      if (e.key === 'Enter' && input) {
        e.preventDefault();
        close(input.value);
      } else if (e.key === 'Escape') {
        close(null);
      }
    };
    document.addEventListener('keydown', onKey);
  });
}

// 确认框（返回 Promise<boolean>）
function showConfirm(message, title = '确认操作', confirmText = '确定') {
  return openDialog({ title, message, confirmText, cancelText: '取消' });
}

// 输入框（返回 Promise<string|null>，取消为 null）
function showPrompt(title, value = '', confirmText = '确定') {
  return openDialog({ title, value, confirmText, cancelText: '取消', showInput: true });
}

// 密码输入框（返回 Promise<string|null>，取消为 null）
function showPromptPassword(title, message = '', confirmText = '确定') {
  return openDialog({ title, message, confirmText, cancelText: '取消', showInput: true, inputType: 'password' });
}

// 页面加载前调用：若已开启加密且未解锁，显示解锁遮罩，解锁后 resolve
async function ensureUnlocked() {
  let s;
  try {
    s = await API.securityStatus();
  } catch {
    return true; // 状态查询失败时不阻塞（保持打开即用）
  }
  if (!s || !s.locked) return true;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog unlock-card" role="dialog" aria-modal="true">
        <div class="dialog-title">笔记已加密</div>
        <div class="dialog-message">数据已加密保存，请输入密码解锁后继续使用。</div>
        <input type="password" class="dialog-input" id="unlockInput" placeholder="输入密码" autocomplete="off" maxlength="64" />
        <div class="dialog-actions">
          <button type="button" class="btn btn-primary" id="unlockBtn">解锁</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#unlockInput');
    const btn = overlay.querySelector('#unlockBtn');
    input.focus();

    async function doUnlock() {
      const pwd = input.value;
      if (!pwd) {
        showToast('请输入密码');
        return;
      }
      btn.disabled = true;
      try {
        await API.unlockPassword(pwd);
        overlay.remove();
        resolve(true);
      } catch (err) {
        showToast(err.message);
        input.value = '';
        input.focus();
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', doUnlock);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doUnlock();
    });
  });
}

// =========================================================
// 夜间模式：localStorage 记忆偏好，右下角按钮切换
// =========================================================
function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  const saved = localStorage.getItem('pn_theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
  }

  btn.addEventListener('click', () => {
    const dark = document.body.classList.toggle('dark');
    localStorage.setItem('pn_theme', dark ? 'dark' : 'light');
  });
}

initThemeToggle();
