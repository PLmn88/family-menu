// preview-screenshots.js - 自动化 4 页面截图（仅用于本地预览）
// 用法：在 URL 加 ?screen=1 自动点击 Tab 后截图
(function () {
  const url = new URL(location.href);
  if (url.searchParams.get('screen') === '1') {
    if (url.searchParams.get('fresh') === '1') {
      try { localStorage.removeItem('familyMenuData_v1'); } catch (e) {}
    }
    const target = url.searchParams.get('tab') || 'page-menu';
    setTimeout(() => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.target === target);
      });
      document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === target);
      });
      if (target === 'page-report') {
        document.getElementById('current-month').textContent = '2026-07';
        // 重新加载 + 重新渲染月报
        if (typeof loadData === 'function') {
          window.state = loadData();
          renderReport();
        }
      } else if (target === 'page-menu' && typeof renderDishes === 'function') {
        renderDishes();
      } else if (target === 'page-family' && typeof renderMembers === 'function') {
        renderMembers();
      } else if (target === 'page-fridge' && typeof renderFridge === 'function') {
        renderFridge();
      }
      document.body.dataset.ready = '1';
    }, 400);
  }
})();
