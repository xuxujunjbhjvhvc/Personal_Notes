// =========================================================
// 笔记列表页（index.html）与编辑器页（note-editor.html）逻辑
// =========================================================

(function () {
  // 支持的字体（key 与后端白名单一致；均为系统自带免费字体，无需联网加载）
  const FONT_OPTIONS = [
    { key: 'default', label: '默认', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' },
    { key: 'song', label: '宋体', family: 'Georgia, "Songti SC", SimSun, serif' },
    { key: 'kai', label: '楷体', family: '"KaiTi", "Kaiti SC", STKaiti, serif' },
    { key: 'hei', label: '黑体', family: 'SimHei, "Heiti SC", "Microsoft YaHei", sans-serif' },
    { key: 'yuan', label: '幼圆', family: '"YouYuan", "Yuanti SC", "Microsoft YaHei", sans-serif' },
    { key: 'fang', label: '仿宋', family: '"FangSong", STFangsong, serif' },
  ];

  // 预设纸感色板（浅色系，适配文字可读性）
  const COLOR_OPTIONS = [
    { value: '', label: '默认', bg: '#fffdf8' },
    { value: '#fdf6e3', label: '奶油', bg: '#fdf6e3' },
    { value: '#f1f5e4', label: '淡绿', bg: '#f1f5e4' },
    { value: '#e7f2f0', label: '浅青', bg: '#e7f2f0' },
    { value: '#eef1f8', label: '淡蓝', bg: '#eef1f8' },
    { value: '#f5eff6', label: '淡紫', bg: '#f5eff6' },
    { value: '#fdf0ee', label: '樱粉', bg: '#fdf0ee' },
    { value: '#f5f0e6', label: '暖灰', bg: '#f5f0e6' },
  ];

  function fontFamilyOf(key) {
    const f = FONT_OPTIONS.find((o) => o.key === key);
    return f ? f.family : FONT_OPTIONS[0].family;
  }

  // 判断背景色明暗，用于自动选择深/浅文字色
  function isLightColor(hex) {
    if (!hex) return true;
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
  }

  // 解析 Markdown 文件（支持本应用导出的 frontmatter 格式，也兼容普通 .md）
  function parseMarkdownFile(text, filename) {
    let meta = {};
    let body = String(text).replace(/^\uFEFF/, '');
    const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (fm) {
      fm[1].split(/\r?\n/).forEach((line) => {
        const m = line.match(/^([A-Za-z]+):\s*(.*)$/);
        if (m) meta[m[1].toLowerCase()] = m[2].trim().replace(/^"|"$/g, '');
      });
      body = body.slice(fm[0].length).replace(/^\s*\r?\n/, '');
    }
    let title = meta.title || '';
    let content = body.trim();
    if (!title) {
      const h = content.match(/^#\s+(.+?)\s*$/m);
      if (h) {
        title = h[1].trim();
        content = content.replace(h[0], '').trim();
      }
    }
    if (!title) {
      title =
        String(filename)
          .replace(/\.md$/i, '')
          .replace(/^[\d_\-]+\s*/, '') || '导入的笔记';
    }
    const tags = meta.tags
      ? String(meta.tags)
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const color = /^#[0-9a-fA-F]{3,6}$/.test(meta.color || '') ? meta.color : null;
    const fontKey = ['default', 'song', 'kai', 'hei', 'yuan', 'fang'].includes(meta.font)
      ? meta.font
      : 'default';
    return { title, content, tags, color, fontKey };
  }

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
    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    const tagsInput = document.getElementById('noteTags');
    const deleteBtn = document.getElementById('deleteBtn');
    const hint = document.getElementById('editorHint');
    const fontSelect = document.getElementById('noteFont');
    const paletteEl = document.getElementById('colorPalette');
    const colorCustom = document.getElementById('colorCustom');

    // 样式状态
    let selectedColor = '';
    let selectedFontKey = 'default';

    // 填充字体下拉（选项文字用对应字体显示，所见即所得）
    FONT_OPTIONS.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f.key;
      opt.textContent = f.label;
      opt.style.fontFamily = f.family;
      fontSelect.appendChild(opt);
    });

    // 渲染色板
    function syncPalette() {
      paletteEl.querySelectorAll('.color-swatch').forEach((el, i) => {
        el.classList.toggle('active', COLOR_OPTIONS[i].value === selectedColor);
      });
    }

    COLOR_OPTIONS.forEach((opt) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'color-swatch' + (opt.value === selectedColor ? ' active' : '');
      sw.style.background = opt.bg;
      sw.title = opt.label;
      sw.addEventListener('click', () => {
        selectedColor = opt.value;
        syncPalette();
        applyStylePreview();
      });
      paletteEl.appendChild(sw);
    });

    colorCustom.addEventListener('input', () => {
      selectedColor = colorCustom.value;
      syncPalette();
      applyStylePreview();
    });

    fontSelect.addEventListener('change', () => {
      selectedFontKey = fontSelect.value;
      applyStylePreview();
    });

    // 实时预览所选字体与颜色
    function applyStylePreview() {
      const wrap = document.querySelector('.editor-wrap');
      const family = fontFamilyOf(selectedFontKey);
      const darkMode = document.body.classList.contains('dark');
      // 已选颜色按背景明暗适配；未选颜色跟随当前主题
      const ink = selectedColor
        ? (isLightColor(selectedColor) ? '#38342c' : '#fffdf8')
        : (darkMode ? '#e8e2d6' : '#38342c');
      const soft = selectedColor
        ? (isLightColor(selectedColor) ? '#8a8375' : 'rgba(255,253,248,0.78)')
        : (darkMode ? '#a89f8e' : '#8a8375');

      wrap.style.background = selectedColor || '';
      wrap.style.color = ink;
      titleInput.style.color = ink;
      titleInput.style.fontFamily = family;
      contentInput.style.color = ink;
      contentInput.style.fontFamily = family;
      tagsInput.style.color = soft;
    }

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

        // 应用已保存的颜色与字体
        selectedColor = note.color || '';
        selectedFontKey = note.font_key || 'default';
        fontSelect.value = selectedFontKey;
        if (selectedColor) colorCustom.value = selectedColor;
        syncPalette();
        applyStylePreview();
      } catch (err) {
        showToast(err.message);
        hint.textContent = '加载失败';
      }
    } else {
      hint.textContent = '新建模式';
      applyStylePreview();
    }

    noteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: titleInput.value.trim(),
        content: contentInput.value,
        color: selectedColor || null,
        fontKey: selectedFontKey,
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
        showToast(err.message);
        btn.disabled = false;
        btn.textContent = '保存';
      }
    });

    deleteBtn.addEventListener('click', async () => {
      if (!note) return;
      const ok = await showConfirm('确定删除这条笔记吗？删除后无法恢复。', '删除笔记', '删除');
      if (!ok) return;
      try {
        await API.deleteNote(note.id);
        showToast('已删除', 'success');
        setTimeout(() => location.replace('index.html'), 400);
      } catch (err) {
        showToast(err.message);
      }
    });
  }

  // =========================================================
  // 列表页
  // =========================================================
  async function initList() {
    const noteListEl = document.getElementById('noteList');
    const emptyEl = document.getElementById('emptyState');
    const listTitle = document.getElementById('listTitle');
    const tagListEl = document.getElementById('tagList');
    const searchInput = document.getElementById('searchInput');
    const newTagInput = document.getElementById('newTagInput');
    const addTagBtn = document.getElementById('addTagBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const statsPrev = document.getElementById('statsPrev');
    const statsNext = document.getElementById('statsNext');
    const statsMonthEl = document.getElementById('statsMonth');
    const heatmapEl = document.getElementById('heatmap');
    const statsCountEl = document.getElementById('statsCount');
    const statsWordsEl = document.getElementById('statsWords');

    let currentTag = '';
    let currentKeyword = '';

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
            <button class="btn btn-small btn-ghost" data-action="export">导出</button>
            <button class="btn btn-small btn-danger" data-action="delete">删除</button>
          </div>
        `;

        // 应用笔记自定义颜色（自动适配深/浅文字色）
        if (note.color) {
          const light = isLightColor(note.color);
          card.style.setProperty('--card-bg', note.color);
          card.style.setProperty('--card-ink', light ? '#38342c' : '#fffdf8');
          card.style.setProperty('--card-ink-soft', light ? '#8a8375' : 'rgba(255,253,248,0.78)');
        }

        // 应用笔记自定义字体
        const fk = note.font_key || 'default';
        if (fk !== 'default') {
          card.style.fontFamily = fontFamilyOf(fk);
          card.querySelector('.note-card-title').style.fontFamily = fontFamilyOf(fk);
        }

        // 点击卡片主体进入编辑
        card.addEventListener('click', (e) => {
          if (e.target.closest('[data-action]')) return;
          location.href = `note-editor.html?id=${note.id}`;
        });

        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
          location.href = `note-editor.html?id=${note.id}`;
        });

        card.querySelector('[data-action="export"]').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const r = await API.exportNote(note.id);
            const f = r.files && r.files[0];
            showToast(f ? `已导出：${f.filename}` : '导出失败', 'success');
          } catch (err) {
            showToast(err.message);
          }
        });

        card.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await showConfirm('确定删除这条笔记吗？删除后无法恢复。', '删除笔记', '删除');
          if (!ok) return;
          try {
            await API.deleteNote(note.id);
            showToast('已删除', 'success');
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
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
          const newName = await showPrompt('重命名标签', tag.name, '保存');
          if (newName === null || newName.trim() === tag.name) return;
          if (!newName.trim()) {
            showToast('标签名不能为空');
            return;
          }
          try {
            await API.updateTag(tag.id, newName.trim());
            showToast('标签已重命名', 'success');
            if (currentTag === tag.name) currentTag = newName.trim();
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
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
          const ok = await showConfirm(
            `确定删除标签「${tag.name}」吗？该标签会从所有笔记中移除。`,
            '删除标签',
            '删除'
          );
          if (!ok) return;
          try {
            await API.deleteTag(tag.id);
            showToast('标签已删除', 'success');
            if (currentTag === tag.name) {
              currentTag = '';
              updateListTitle();
            }
            await Promise.all([loadTags(), loadNotes()]);
          } catch (err) {
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

    // =====================================================
    // 月度记录热力图（类似 GitHub 贡献图）
    // =====================================================
    const now = new Date();
    let statYear = now.getFullYear();
    let statMonth = now.getMonth() + 1; // 1-12

    // 按笔记数映射格子深浅（0/1-2/3-5/6-9/10+）
    function heatLevel(n) {
      if (n <= 0) return 0;
      if (n <= 2) return 1;
      if (n <= 5) return 2;
      if (n <= 9) return 3;
      return 4;
    }

    async function loadStats() {
      try {
        const monthStr = `${statYear}-${String(statMonth).padStart(2, '0')}`;
        const data = await API.calendarStats(monthStr);
        renderHeatmap(data);
      } catch (err) {
        heatmapEl.innerHTML = `<span class="stats-error">${esc(err.message)}</span>`;
      }
    }

    function renderHeatmap(data) {
      statsMonthEl.textContent = `${data.year}年${data.month}月`;

      const daysMap = new Map(data.days.map((d) => [d.date, d]));
      let totalNotes = 0;
      let totalWords = 0;
      data.days.forEach((d) => {
        totalNotes += d.notes;
        totalWords += d.words;
      });
      statsCountEl.textContent = totalNotes;
      statsWordsEl.textContent = totalWords.toLocaleString('zh-CN');

      const first = new Date(data.year, data.month - 1, 1);
      const last = new Date(data.year, data.month, 0);
      const start = new Date(first);
      start.setDate(1 - ((first.getDay() + 6) % 7)); // 当月1号所在周的周一
      const end = new Date(last);
      end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7))); // 当月最后一天所在周的周日

      const WEEK = ['一', '二', '三', '四', '五', '六', '日'];
      const cols = [];
      let col = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        col.push(new Date(d));
        if (col.length === 7) {
          cols.push(col);
          col = [];
        }
      }
      if (col.length) cols.push(col);

      const pad = (n) => String(n).padStart(2, '0');
      heatmapEl.innerHTML = '';
      const grid = document.createElement('div');
      grid.className = 'heatmap-grid';

      // 星期标签列
      const weekLabel = document.createElement('div');
      weekLabel.className = 'heatmap-week';
      WEEK.forEach((w, i) => {
        // 只显示部分行标签（第2、5行），避免拥挤
        const lab = document.createElement('span');
        lab.textContent = i === 1 || i === 4 ? w : '';
        weekLabel.appendChild(lab);
      });
      heatmapEl.appendChild(weekLabel);

      cols.forEach((weekDays) => {
        const colEl = document.createElement('div');
        colEl.className = 'heatmap-col';
        for (let i = 0; i < 7; i++) {
          const day = weekDays[i];
          const cell = document.createElement('span');
          cell.className = 'heatmap-cell';
          if (!day) {
            colEl.appendChild(cell);
            continue;
          }
          const inMonth = day.getMonth() === data.month - 1;
          if (!inMonth) {
            cell.classList.add('outside');
            colEl.appendChild(cell);
            continue;
          }
          const dateStr = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
          const info = daysMap.get(dateStr);
          const n = info ? info.notes : 0;
          const w = info ? info.words : 0;
          cell.classList.add('lvl' + heatLevel(n));
          cell.title = `${data.month}月${day.getDate()}日 · ${n} 篇 · ${w.toLocaleString('zh-CN')} 字`;
          colEl.appendChild(cell);
        }
        grid.appendChild(colEl);
      });
      heatmapEl.appendChild(grid);
    }

    if (statsPrev && statsNext) {
      statsPrev.addEventListener('click', () => {
        statMonth -= 1;
        if (statMonth < 1) {
          statMonth = 12;
          statYear -= 1;
        }
        loadStats();
      });
      statsNext.addEventListener('click', () => {
        statMonth += 1;
        if (statMonth > 12) {
          statMonth = 1;
          statYear += 1;
        }
        loadStats();
      });
    }
    loadStats();

    // =====================================================
    // Markdown 导入 / 导出全部
    // =====================================================
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', async () => {
        const files = Array.from(importFile.files || []);
        if (!files.length) return;
        let ok = 0;
        let fail = 0;
        for (const file of files) {
          try {
            const text = await file.text();
            const parsed = parseMarkdownFile(text, file.name);
            await API.createNote(parsed);
            ok += 1;
          } catch (err) {
            fail += 1;
            console.error('导入失败:', file.name, err);
          }
        }
        importFile.value = '';
        if (ok) {
          showToast(`成功导入 ${ok} 篇笔记${fail ? `，${fail} 篇失败` : ''}`, 'success');
          await Promise.all([loadTags(), loadNotes(), loadStats()]);
        } else {
          showToast(`导入失败 ${fail} 篇，请检查文件格式`);
        }
      });
    }

    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', async () => {
        try {
          const r = await API.exportAll();
          if (!r.count) {
            showToast('没有可导出的笔记');
            return;
          }
          showToast(`已导出 ${r.count} 篇 → 保存到程序旁的 exports 文件夹`, 'success');
        } catch (err) {
          showToast(err.message);
        }
      });
    }

    // 初始加载
    loadTags();
    loadNotes();
  }
})();
