// =========================================================
// 笔记列表页（index.html）与编辑器页（note-editor.html）逻辑
// =========================================================

(function () {
  // ---------- 编辑器页 ----------
  const noteForm = document.getElementById('noteForm');
  if (noteForm) {
    initEditor();
    return;
  }

  // ---------- 列表页 ----------
  if (document.getElementById('noteList')) {
    initList();
  }

  // =========================================================
  // 编辑器页
  // =========================================================
  async function initEditor() {
    if (!requireAuth()) return;

    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const tagsInput = document.getElementById('noteTags');
    const deleteBtn = document.getElementById('deleteBtn');
    const hint = document.getElementById('editorHint');

    // 从 URL 读取笔记 id（存在即为编辑模式）
    const params = new URLSearchParams(location.search);
    const noteId = params.get('id');
    let note = null;

    if (noteId) {
      try {
        note = await API.getNote(noteId);
        titleInput.value = note.title || '';
        contentInput.value = note.content || '';
        tagsInput.value = (note.tags || []).map((t) => t.name).join(', ');
        deleteBtn.classList.remove('hidden');
        hint.textContent = '编辑模式';
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
        hint.textContent = '加载失败';
      }
    } else {
      hint.textContent = '新建模式';
    }

    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: titleInput.value.trim(),
        content: contentInput.value,
        tags: tagsInput.value
          .split(/[,，]/)
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const btn = noteForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = '保存中…';

      try {
        if (note) {
          await API.updateNote(note.id, payload);
          showToast('已保存', 'success');
        } else {
          await API.createNote(payload);
          showToast('已创建', 'success');
        }
        setTimeout(() => location.replace('index.html'), 400);
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = '保存';
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!note) return;
      if (!window.confirm('确定删除这条笔记吗？')) return;
      try {
        await API.deleteNote(note.id);
        showToast('已删除', 'success');
        setTimeout(() => location.replace('index.html'), 400);
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
      }
    });
  }

  // =========================================================
  // 列表页
  // =========================================================
  async function initList() {
    if (!requireAuth()) return;

    const noteListEl = document.getElementById('noteList');
    const emptyEl = document.getElementById('emptyState');
    const listTitle = document.getElementById('listTitle');
    const tagListEl = document.getElementById('tagList');
    const searchInput = document.getElementById('searchInput');
    const userNameEl = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const newTagInput = document.getElementById('newTagInput');
    const addTagBtn = document.getElementById('addTagBtn');

    let currentTag = '';
    let currentKeyword = '';

    // 顶部显示当前用户名；token 失效则回登录页
    try {
      const me = await API.me();
      userNameEl.textContent = me.username;
    } catch (err) {
      return redirectToLogin();
    }

    // 渲染笔记列表
    function renderNotes(notes) {
      noteListEl.innerHTML = '';
      const hasNotes = notes.length > 0;
      emptyEl.classList.toggle('hidden', hasNotes);

      notes.forEach((note) => {
        const card = document.createElement('div');
        card.className = 'note-card';

        const title = note.title || '无标题';
        const tagsHtml = (note.tags || [])
          .map((t) => `<span class="tag-pill">${esc(t.name)}</span>`)
          .join('');

        card.innerHTML = `
          <div class="note-card-title">${esc(title)}</div>
          <div class="note-card-excerpt">${esc(note.content || '')}</div>
          <div class="note-card-meta">
            <div class="tag-pills">${tagsHtml}</div>
            <span class="note-card-time">${formatTime(note.updated_at)}</span>
          </div>
          <div class="note-card-actions">
            <button class="btn btn-small btn-ghost" data-action="edit">编辑</button>
            <button class="btn btn-small btn-danger" data-action="delete">删除</button>
          </div>
        `;

        // 点击卡片主体进入编辑
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-action]')) return;
          location.href = `note-editor.html?id=${note.id}`;
        });

        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
          location.href = `note-editor.html?id=${note.id}`;
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!window.confirm('确定删除这条笔记吗？')) return;
          try {
            await API.deleteNote(note.id);
            showToast('已删除', 'success');
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
            if (err.status === 401) return redirectToLogin();
            showToast(err.message);
          }
        });

        noteListEl.appendChild(card);
      });
    }

    // 加载笔记（按当前标签 / 关键词）
    async function loadNotes() {
      try {
        const notes = await API.listNotes({ tag: currentTag, keyword: currentKeyword });
        renderNotes(notes);
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
      }
    }

    // 渲染侧栏标签（含重命名、删除操作，悬停显示）
    function renderTags(tags) {
      tagListEl.innerHTML = '';
      tags.forEach((tag) => {
        const item = document.createElement('div');
        item.className = 'tag-item' + (currentTag === tag.name ? ' active' : '');
        item.dataset.tag = tag.name;

        // 点击标签名筛选
        const nameBtn = document.createElement('button');
        nameBtn.type = 'button';
        nameBtn.className = 'tag-name';
        nameBtn.innerHTML = `<span class="tag-name-text">${esc(tag.name)}</span><span class="tag-count">${tag.note_count}</span>`;
        nameBtn.addEventListener('click', () => {
          currentTag = currentTag === tag.name ? '' : tag.name;
          currentKeyword = '';
          searchInput.value = '';
          renderTags(tags);
          syncActiveTag();
          updateListTitle();
          loadNotes();
        });

        // 重命名
        const renameBtn = document.createElement('button');
        renameBtn.type = 'button';
        renameBtn.className = 'tag-action';
        renameBtn.title = '重命名标签';
        renameBtn.textContent = '✎';
        renameBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const newName = window.prompt('重命名标签', tag.name);
          if (!newName || newName.trim() === tag.name) return;
          try {
            await API.updateTag(tag.id, newName.trim());
            showToast('标签已重命名', 'success');
            if (currentTag === tag.name) currentTag = newName.trim();
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
            if (err.status === 401) return redirectToLogin();
            showToast(err.message);
          }
        });

        // 删除
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'tag-action tag-action-danger';
        delBtn.title = '删除标签';
        delBtn.textContent = '✕';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!window.confirm(`确定删除标签「${tag.name}」吗？该标签会从所有笔记中移除。`)) return;
          try {
            await API.deleteTag(tag.id);
            showToast('标签已删除', 'success');
            if (currentTag === tag.name) {
              currentTag = '';
              updateListTitle();
            }
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
            if (err.status === 401) return redirectToLogin();
            showToast(err.message);
          }
        });

        const actions = document.createElement('span');
        actions.className = 'tag-actions';
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);

        item.appendChild(nameBtn);
        item.appendChild(actions);
        tagListEl.appendChild(item);
      });
    }

    // 同步侧栏 "全部笔记" 与标签项的高亮
    function syncActiveTag() {
      document.querySelectorAll('.tag-item[data-tag]').forEach((el) => {
        el.classList.toggle('active', el.dataset.tag === currentTag);
      });
      const allBtn = document.querySelector('.tag-item[data-tag=""]');
      if (allBtn) allBtn.classList.toggle('active', currentTag === '');
    }

    function updateListTitle() {
      listTitle.textContent = currentTag ? `标签：${currentTag}` : '全部笔记';
    }

    async function loadTags() {
      try {
        const tags = await API.listTags();
        renderTags(tags);
        syncActiveTag();
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
      }
    }

    // 搜索（防抖 300ms）
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        currentKeyword = searchInput.value.trim();
        currentTag = '';
        syncActiveTag();
        updateListTitle();
        loadNotes();
      }, 300);
    });

    // 新建标签
    async function addTag() {
      const name = newTagInput.value.trim();
      if (!name) return;
      try {
        await API.createTag(name);
        newTagInput.value = '';
        showToast('标签已创建', 'success');
        await loadTags();
      } catch (err) {
        if (err.status === 401) return redirectToLogin();
        showToast(err.message);
      }
    }

    addTagBtn.addEventListener('click', addTag);
    newTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    });

    // 退出登录
    logoutBtn.addEventListener('click', () => {
      API.clearToken();
      location.replace('login.html');
    });

    // 初始加载
    loadTags();
    loadNotes();
  }
})();
