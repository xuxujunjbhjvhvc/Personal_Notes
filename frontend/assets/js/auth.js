// =========================================================
// 登录 / 注册页逻辑（login.html 与 register.html 共用）
// =========================================================

(function () {
  const form = document.getElementById('loginForm') || document.getElementById('registerForm');
  if (!form) return;

  const isLogin = form.id === 'loginForm';
  const btnLabel = isLogin ? '登 录' : '注 册';

  // 已登录则直接进入首页
  if (API.getToken()) {
    location.replace('index.html');
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.textContent = '请稍候…';

    try {
      let data;
      if (isLogin) {
        data = await API.login(username, password);
        API.setToken(data.token);
        showToast('登录成功', 'success');
      } else {
        data = await API.register(username, password);
        API.setToken(data.token);
        showToast('注册成功，正在进入…', 'success');
      }
      setTimeout(() => location.replace('index.html'), 500);
    } catch (err) {
      showToast(err.message);
      btn.disabled = false;
      btn.textContent = btnLabel;
    }
  });
})();
