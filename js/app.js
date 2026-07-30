// ==========================================================
// 家庭共享点菜 FamilyMenu - 主逻辑
// 数据存储：localStorage
// ==========================================================

const STORAGE_KEY = 'familyMenuData_v1';

const DEFAULT_DATA = {
  members: [
    { id: 'm1', name: '妈妈', avatar: '' },
    { id: 'm2', name: '爸爸', avatar: '' },
    { id: 'm3', name: '宝贝', avatar: '' },
  ],
  dishes: [
    { id: 'd1', name: '番茄炒蛋', cat: 'veg', price: 8.5, img: '', meal: 'lunch', likes: 3, note: '妈妈的拿手菜', createdAt: '2026-07-15T10:00:00' },
    { id: 'd2', name: '红烧肉', cat: 'meat', price: 18, img: '', meal: 'dinner', likes: 5, note: '爸爸最爱', createdAt: '2026-07-18T18:00:00' },
    { id: 'd3', name: '小米粥', cat: 'staple', price: 3, img: '', meal: 'breakfast', likes: 2, note: '', createdAt: '2026-07-20T07:00:00' },
    { id: 'd4', name: '紫菜蛋花汤', cat: 'soup', price: 5, img: '', meal: 'dinner', likes: 4, note: '', createdAt: '2026-07-22T18:00:00' },
    { id: 'd5', name: '草莓蛋糕', cat: 'dessert', price: 25, img: '', meal: 'dinner', likes: 8, note: '宝贝最爱', createdAt: '2026-07-25T20:00:00' },
    { id: 'd6', name: '清炒时蔬', cat: 'veg', price: 6, img: '', meal: 'lunch', likes: 1, note: '妈妈点的', createdAt: '2026-07-26T11:00:00' },
    { id: 'd7', name: '糖醋里脊', cat: 'meat', price: 15, img: '', meal: 'lunch', likes: 4, note: '宝贝最爱', createdAt: '2026-07-26T11:30:00' },
    { id: 'd8', name: '蛋炒饭', cat: 'staple', price: 4, img: '', meal: 'lunch', likes: 2, note: '', createdAt: '2026-07-28T11:00:00' },
    { id: 'd9', name: '皮蛋瘦肉粥', cat: 'staple', price: 5, img: '', meal: 'breakfast', likes: 3, note: '爸爸点的', createdAt: '2026-07-29T07:00:00' },
    { id: 'd10', name: '煎蛋三明治', cat: 'staple', price: 7, img: '', meal: 'breakfast', likes: 2, note: '', createdAt: '2026-07-30T07:30:00' },
  ],
  fridge: [
    { id: 'f1', name: '鸡蛋', cat: 'meat', qty: '10 个', price: 12, expire: addDays(15) },
    { id: 'f2', name: '西红柿', cat: 'veg', qty: '5 个', price: 8, expire: addDays(5) },
    { id: 'f3', name: '牛奶', cat: 'dairy', qty: '1L', price: 15, expire: addDays(7) },
    { id: 'f4', name: '草莓', cat: 'fruit', qty: '500g', price: 30, expire: addDays(1) },
    { id: 'f5', name: '酸奶', cat: 'dairy', qty: '4 杯', price: 18, expire: addDays(2) },
  ],
  qrImage: 'images/qrcode.jpg', // 月报中嵌入的收款二维码（用户本人的赞赏码）
  settings: {
    name: '家庭小管家',
    greet: '下午好，宝贝～',
    theme: 'pink',
    notify: true,
  },
};

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function uid() { return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000); }

// ===== 数据读写 =====
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // 如果已登录家庭云，同步到云端
  if (window.FamilyCloud && FamilyCloud.isLoggedIn()) {
    FamilyCloud.syncToCloud();
  }
}
let state = loadData();

// ===== 工具 =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1500);
}

function catLabel(c) {
  return { meat: '🥩 荤菜', veg: '🥗 素菜', soup: '🍲 汤品', staple: '🍚 主食', dessert: '🍰 甜点',
           fruit: '🍎 水果', dairy: '🥛 乳制品', other: '📦 其他' }[c] || c;
}

function mealLabel(m) {
  return { breakfast: '🌅 早餐', lunch: '🌞 午餐', dinner: '🌙 晚餐' }[m] || m;
}

// ===== 当前 UI 状态 =====
let currentMeal = 'lunch';
let currentDishCat = 'all';
let currentFridgeCat = 'all';
let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

// ==========================================================
// 1. 今日点菜
// ==========================================================
function renderDishes() {
  const list = $('#dish-list');
  const items = state.dishes.filter(d => d.meal === currentMeal &&
    (currentDishCat === 'all' || d.cat === currentDishCat));
  updateCounts();
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-hint" style="grid-column:1/-1;text-align:center;padding:30px 0;color:var(--text-3);font-size:13px;">还没有菜品，点击右下角 ＋ 添加吧～</div>';
    return;
  }
  list.innerHTML = items.map(d => {
    const liked = (d._likedByMe);
    const bg = d.img ? `style="background-image:url('${escapeAttr(d.img)}')"` : '';
    return `
    <div class="dish-card">
      <div class="dish-tag">${catLabel(d.cat)}</div>
      <button class="dish-delete" data-del="${d.id}">×</button>
      <div class="dish-img" ${bg}>${d.img ? '' : getDishEmoji(d.cat)}</div>
      <div class="dish-info">
        <div class="dish-name">${escapeHtml(d.name)}</div>
        <div class="dish-meta">
          <span class="dish-price">¥${Number(d.price || 0).toFixed(2)}</span>
          <button class="like-btn ${liked ? 'liked' : ''}" data-like="${d.id}">
            ${liked ? '❤' : '♡'} <span>${d.likes || 0}</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  // 绑定点赞 / 删除
  list.querySelectorAll('[data-like]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.like;
      const d = state.dishes.find(x => x.id === id);
      if (!d) return;
      if (d._likedByMe) { d._likedByMe = false; d.likes = Math.max(0, (d.likes || 0) - 1); }
      else { d._likedByMe = true; d.likes = (d.likes || 0) + 1; }
      saveData(); renderDishes(); updateCounts();
    });
  });
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('删除这个菜品？')) {
        state.dishes = state.dishes.filter(x => x.id !== btn.dataset.del);
        saveData(); renderDishes(); updateCounts();
      }
    });
  });
}

function getDishEmoji(c) {
  return ({ meat: '🍖', veg: '🥦', soup: '🍲', staple: '🍚', dessert: '🍰' })[c] || '🍽️';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

// ==========================================================
// 2. 家庭成员
// ==========================================================
function renderMembers() {
  const grid = $('#member-grid');
  updateCounts();
  grid.innerHTML = state.members.map(m => {
    const bg = m.avatar ? `style="background-image:url('${escapeAttr(m.avatar)}')"` : '';
    return `
    <div class="member-card">
      <button class="member-delete" data-mdel="${m.id}">×</button>
      <div class="member-avatar" ${bg}>${m.avatar ? '' : '👤'}</div>
      <div class="member-name">${escapeHtml(m.name)}</div>
    </div>`;
  }).join('');
  grid.querySelectorAll('[data-mdel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('删除该成员？')) {
        state.members = state.members.filter(x => x.id !== btn.dataset.mdel);
        saveData(); renderMembers(); updateCounts();
      }
    });
  });
}

// ==========================================================
// 3. 冰箱
// ==========================================================
function renderFridge() {
  const list = $('#fridge-list');
  const items = state.fridge.filter(f => currentFridgeCat === 'all' || f.cat === currentFridgeCat);
  updateCounts();
  if (items.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:30px 0;color:var(--text-3);font-size:13px;">冰箱空空如也，点击 ＋ 添加食材吧～</div>';
    return;
  }
  list.innerHTML = items.map(f => {
    const days = daysToExpire(f.expire);
    let cls = 'expiry-fresh', txt = `还有 ${days} 天到期`;
    if (days < 0) { cls = 'expiry-bad'; txt = `已过期 ${-days} 天`; }
    else if (days <= 3) { cls = 'expiry-bad'; txt = `仅剩 ${days} 天！`; }
    else if (days <= 7) { cls = 'expiry-soon'; txt = `还有 ${days} 天`; }
    return `
    <div class="fridge-item">
      <div class="fridge-icon">${getFridgeEmoji(f.cat)}</div>
      <div class="fridge-info">
        <div class="fridge-name">${escapeHtml(f.name)}</div>
        <div class="fridge-meta">${catLabel(f.cat)} · ${escapeHtml(f.qty || '')}</div>
        <div class="fridge-expiry ${cls}">⏰ ${txt}（${f.expire}）</div>
      </div>
      <div class="fridge-price">¥${Number(f.price || 0).toFixed(2)}</div>
      <button class="fridge-delete" data-fdel="${f.id}">×</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-fdel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('从冰箱中移除？')) {
        state.fridge = state.fridge.filter(x => x.id !== btn.dataset.fdel);
        saveData(); renderFridge(); updateCounts();
        setTimeout(checkExpiryBanner, 100);
      }
    });
  });
}

function getFridgeEmoji(c) {
  return ({ veg: '🥬', fruit: '🍎', meat: '🥩', dairy: '🥛', other: '📦' })[c] || '🍱';
}

function daysToExpire(dateStr) {
  if (!dateStr) return 999;
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / 86400000);
}

// ==========================================================
// 4. 月度汇总
// ==========================================================
function renderReport() {
  $('#current-month').textContent = currentMonth;
  // 汇总当月菜品：包含 createdAt 在当月的，或无 createdAt（默认数据）的
  const list = state.dishes.filter(d => {
    if (!d.createdAt) return true; // 默认示例数据
    return d.createdAt.startsWith(currentMonth);
  });

  const total = list.reduce((s, d) => s + Number(d.price || 0), 0);
  const count = list.length;
  $('#total-amount').textContent = `¥${total.toFixed(2)}`;
  $('#total-dishes').textContent = count;
  $('#avg-amount').textContent = count ? `¥${(total / count).toFixed(2)}` : '¥0.00';

  // 好评 TOP 5
  const top = [...list].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5);
  $('#top-dishes').innerHTML = top.length ?
    top.map((d, i) => `<li><b>${i + 1}.</b> ${escapeHtml(d.name)} <span style="color:var(--pink-5);float:right;">❤ ${d.likes || 0}</span></li>`).join('') :
    '<li style="color:var(--text-3);">暂无数据</li>';

  // 成员贡献（按 note 包含成员名简单匹配）
  const rank = state.members.map(m => {
    const cnt = list.filter(d => (d.note || '').includes(m.name)).length;
    return { name: m.name, count: cnt };
  }).sort((a, b) => b.count - a.count);
  $('#member-rank').innerHTML = rank.length ?
    rank.map(r => `<li><span>👤 ${escapeHtml(r.name)}</span><span><b>${r.count}</b> 次</span></li>`).join('') :
    '<li style="color:var(--text-3);">暂无数据</li>';
}

// ==========================================================
// 图片上传 / 网络 URL 处理（用 FileReader 转 base64）
// ==========================================================
function bindImageUploader(fileInputId, urlInputId, previewId) {
  const fileInput = $('#' + fileInputId);
  const urlInput = $('#' + urlInputId);
  const preview = $('#' + previewId);
  let currentSrc = '';

  function setPreview(src) {
    currentSrc = src;
    if (src) {
      preview.style.backgroundImage = `url('${src}')`;
      preview.textContent = '';
    } else {
      preview.style.backgroundImage = '';
      preview.textContent = preview.classList.contains('round') ? '点击选择头像' : '点击选择图片';
    }
  }
  preview.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  });
  urlInput.addEventListener('input', e => {
    if (e.target.value) setPreview(e.target.value);
  });
  return { getSrc: () => currentSrc, reset: () => { setPreview(''); fileInput.value = ''; urlInput.value = ''; } };
}

let dishUploader, memberUploader;

function openModal(id) { $('#' + id).classList.add('show'); }
function closeModal(id) { $('#' + id).classList.remove('show'); }

// ==========================================================
// 事件绑定
// ==========================================================
function bindEvents() {
  // Tab 切换（统一处理：侧边栏 + 底部 Tab）
  function switchPage(target) {
    $$('.tab').forEach(x => x.classList.remove('active'));
    $$('.side-item').forEach(x => x.classList.remove('active'));
    $$('.page').forEach(x => x.classList.remove('active'));
    const t = document.querySelector(`.tab[data-target="${target}"]`);
    const s = document.querySelector(`.side-item[data-target="${target}"]`);
    if (t) t.classList.add('active');
    if (s) s.classList.add('active');
    $('#' + target).classList.add('active');
    if (target === 'page-report') renderReport();
    if (target === 'page-family') { renderMembers(); updateCounts(); }
    if (target === 'page-fridge') { renderFridge(); updateCounts(); }
    if (target === 'page-menu') { renderDishes(); updateCounts(); }
    if (target === 'page-settings') renderSettings();
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => switchPage(t.dataset.target)));
  $$('.side-item').forEach(s => s.addEventListener('click', () => switchPage(s.dataset.target)));

  // 早中晚切换
  $$('.meal-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('.meal-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentMeal = b.dataset.meal;
      renderDishes();
    });
  });

  // 菜品分类
  $$('#page-menu .cat-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('#page-menu .cat-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentDishCat = b.dataset.cat;
      renderDishes();
    });
  });

  // 冰箱分类
  $$('#page-fridge .cat-btn').forEach(b => {
    b.addEventListener('click', () => {
      $$('#page-fridge .cat-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      currentFridgeCat = b.dataset.fridge;
      renderFridge();
    });
  });

  // 月份切换
  $('#prev-month').addEventListener('click', () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    currentMonth = d.toISOString().slice(0, 7);
    renderReport();
  });
  $('#next-month').addEventListener('click', () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    currentMonth = d.toISOString().slice(0, 7);
    renderReport();
  });

  // 弹窗关闭
  $$('.modal-close').forEach(c => {
    c.addEventListener('click', () => closeModal(c.dataset.close));
  });
  $$('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
  });

  // 添加菜品
  $('#add-dish-btn').addEventListener('click', () => {
    dishUploader.reset();
    $('#dish-name').value = '';
    $('#dish-price').value = '';
    $('#dish-note').value = '';
    $('#dish-cat').value = 'veg';
    openModal('modal-dish');
  });
  $('#save-dish').addEventListener('click', () => {
    const name = $('#dish-name').value.trim();
    if (!name) return toast('请输入菜品名称');
    state.dishes.push({
      id: uid(),
      name,
      cat: $('#dish-cat').value,
      price: Number($('#dish-price').value) || 0,
      img: dishUploader.getSrc(),
      meal: currentMeal,
      likes: 0,
      note: $('#dish-note').value.trim(),
      createdAt: new Date().toISOString(),
    });
    saveData(); closeModal('modal-dish'); renderDishes();
    toast('添加成功 ✨');
  });

  // 添加成员
  $('#add-member-btn').addEventListener('click', () => {
    memberUploader.reset();
    $('#member-name').value = '';
    openModal('modal-member');
  });
  $('#save-member').addEventListener('click', () => {
    const name = $('#member-name').value.trim();
    if (!name) return toast('请输入称呼');
    state.members.push({
      id: uid(),
      name,
      avatar: memberUploader.getSrc(),
    });
    saveData(); closeModal('modal-member'); renderMembers();
    toast('添加成功 💕');
  });

  // 添加冰箱食材
  $('#add-fridge-btn').addEventListener('click', () => {
    $('#fridge-name').value = '';
    $('#fridge-qty').value = '';
    $('#fridge-price').value = '';
    $('#fridge-expire').value = addDays(7);
    $('#fridge-cat').value = 'veg';
    openModal('modal-fridge');
  });
  $('#save-fridge').addEventListener('click', () => {
    const name = $('#fridge-name').value.trim();
    if (!name) return toast('请输入食材名称');
    state.fridge.push({
      id: uid(),
      name,
      cat: $('#fridge-cat').value,
      qty: $('#fridge-qty').value.trim(),
      price: Number($('#fridge-price').value) || 0,
      expire: $('#fridge-expire').value || addDays(7),
    });
    saveData(); closeModal('modal-fridge'); renderFridge();
    toast('已加入冰箱 🧊');
    setTimeout(checkExpiryBanner, 100);
  });

  // 横幅关闭按钮
  $('#banner-close').addEventListener('click', () => {
    $('#expiry-banner').hidden = true;
    document.body.classList.remove('has-banner');
  });

  // 导出月报：用 SVG foreignObject 截取月报卡片
  $('#export-btn').addEventListener('click', () => {
    const card = document.getElementById('report-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const w = card.offsetWidth, h = card.offsetHeight;
    // 构造 SVG
    const xml = new XMLSerializer().serializeToString(card);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff;font-family:system-ui;">
            ${xml}
          </div>
        </foreignObject>
      </svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FamilyMenu-月报-${currentMonth}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('月报已导出 ✨ 可用浏览器/微信打开');
  });
}

// ==========================================================
// 初始化
// ==========================================================
// ==========================================================
// 到期预警横幅
// ==========================================================
function checkExpiryBanner() {
  const banner = $('#expiry-banner');
  if (!banner) return;

  const expired = [];   // 已过期
  const critical = [];  // 1-3 天
  const soon = [];      // 4-7 天

  state.fridge.forEach(f => {
    const days = daysToExpire(f.expire);
    if (days < 0) expired.push({ ...f, days });
    else if (days <= 3) critical.push({ ...f, days });
    else if (days <= 7) soon.push({ ...f, days });
  });

  const hasIssue = expired.length || critical.length || soon.length;
  if (!hasIssue) {
    banner.hidden = true;
    document.body.classList.remove('has-banner');
    return;
  }

  // 决定级别：有过期=danger，有紧急=warning，只有即将=info
  let level = 'level-info';
  let icon = '⏰';
  let title = '冰箱提醒';
  if (expired.length) {
    level = 'level-danger';
    icon = '🚨';
    title = `${expired.length} 件已过期！`;
  } else if (critical.length) {
    level = 'level-warning';
    icon = '⚠️';
    title = `${critical.length} 件即将到期`;
  } else {
    level = 'level-info';
    icon = '⏰';
    title = `${soon.length} 件本周到期`;
  }

  // 详情：拼接食材标签
  const parts = [];
  const fmtItem = (f) => `<span class="item">${escapeHtml(f.name)} · ${f.days < 0 ? '已过期 ' + (-f.days) + '天' : '剩 ' + f.days + '天'}</span>`;
  expired.forEach((f) => parts.push(fmtItem(f)));
  critical.forEach((f) => parts.push(fmtItem(f)));
  if (parts.length < 6) soon.forEach((f) => parts.push(fmtItem(f)));

  banner.className = 'expiry-banner ' + level;
  banner.hidden = false;
  banner.querySelector('.banner-icon').textContent = icon;
  $('#banner-title').textContent = title;
  $('#banner-detail').innerHTML = parts.join('') || '<span class="item">暂无</span>';

  document.body.classList.add('has-banner');

  // 自动消失（30 秒后），过期/紧急级别不自动消失
  clearTimeout(banner._timer);
  if (level === 'level-info') {
    banner._timer = setTimeout(() => {
      banner.hidden = true;
      document.body.classList.remove('has-banner');
    }, 30000);
  }
}

// ==========================================================
// 设置页
// ==========================================================
function renderSettings() {
  $('#setting-name').value = state.settings.name || '';
  $('#setting-greet').value = state.settings.greet || '';
  $('#setting-theme').value = state.settings.theme || 'pink';
  $('#setting-notify').checked = !!state.settings.notify;
}

function bindSettings() {
  $('#save-settings').addEventListener('click', () => {
    state.settings = {
      name: $('#setting-name').value.trim() || '家庭小管家',
      greet: $('#setting-greet').value.trim() || '宝贝～',
      theme: $('#setting-theme').value,
      notify: $('#setting-notify').checked,
    };
    saveData();
    updateHeader();
    updateGreeting();
    toast('设置已保存 ✨');
  });
  $('#reset-data').addEventListener('click', () => {
    if (!confirm('确定要重置全部数据吗？此操作不可恢复！')) return;
    localStorage.removeItem(STORAGE_KEY);
    state = JSON.parse(JSON.stringify(DEFAULT_DATA));
    state = { ...state, settings: state.settings || DEFAULT_DATA.settings };
    saveData();
    renderDishes(); renderMembers(); renderFridge();
    updateHeader(); updateGreeting(); updateCounts();
    setTimeout(checkExpiryBanner, 100);
    toast('数据已重置 🔄');
  });
}

// ==========================================================
// 家庭云（账号管理）
// ==========================================================
function bindSyncEvents() {
  // 注册
  $('#signup-btn')?.addEventListener('click', async () => {
    const email = $('#account-email').value.trim();
    const password = $('#account-password').value;
    if (!email || !password) { toast('请填写邮箱和密码'); return; }
    if (!email.includes('@')) { toast('请输入有效的邮箱'); return; }
    if (password.length < 6) { toast('密码至少 6 位'); return; }

    toast('正在注册...');
    try {
      await FamilyCloud.signUp(email, password);
      updateAccountPanel();
      FamilyCloud.refreshAll();
      toast('注册成功！数据已上传到家庭云 🎉');
    } catch (e) {
      toast(e.message);
    }
  });

  // 登录
  $('#signin-btn')?.addEventListener('click', async () => {
    const email = $('#account-email').value.trim();
    const password = $('#account-password').value;
    if (!email || !password) { toast('请填写邮箱和密码'); return; }

    toast('正在登录...');
    try {
      await FamilyCloud.signIn(email, password);
      updateAccountPanel();
      FamilyCloud.refreshAll();
      toast('登录成功！数据已同步 🎉');
    } catch (e) {
      toast(e.message);
    }
  });

  // 退出登录
  $('#signout-btn')?.addEventListener('click', () => {
    if (!confirm('退出登录后，本机数据将不再同步云端（云端数据不受影响）。继续？')) return;
    FamilyCloud.signOut();
    updateAccountPanel();
    toast('已退出登录');
  });

  // 立即同步
  $('#sync-now-btn')?.addEventListener('click', async () => {
    toast('正在同步...');
    const ok = await FamilyCloud.syncFromCloud();
    toast(ok ? '同步完成 ✅' : '同步失败，请稍后重试');
  });
}

/**
 * 更新账号面板显示
 */
function updateAccountPanel() {
  const loggedIn = FamilyCloud.isLoggedIn();
  const panelLogout = $('#account-panel-logout');
  const panelLogin = $('#account-panel-login');
  const emailDisplay = $('#account-email-display');

  if (loggedIn) {
    if (panelLogout) panelLogout.hidden = true;
    if (panelLogin) panelLogin.hidden = false;
    const user = FamilyCloud.getCloudUser();
    if (emailDisplay) emailDisplay.textContent = '👤 ' + (user.email || '已登录');
  } else {
    if (panelLogout) panelLogout.hidden = false;
    if (panelLogin) panelLogin.hidden = true;
  }
}

// ==========================================================
// 顶部：问候语、日期、用户名
// ==========================================================
function updateGreeting() {
  const h = new Date().getHours();
  let prefix = '您好';
  if (h < 6) prefix = '凌晨好';
  else if (h < 11) prefix = '早上好';
  else if (h < 14) prefix = '中午好';
  else if (h < 18) prefix = '下午好';
  else if (h < 22) prefix = '晚上好';
  else prefix = '夜深了';
  const greet = (state.settings && state.settings.greet) || '宝贝～';
  const txt = `${prefix}，${greet}`;
  const els = ['#greet-pill', '#greet-pill-2'];
  els.forEach(s => { const el = $(s); if (el) el.textContent = txt; });
}

function updateDate() {
  const d = new Date();
  const txt = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  const el = $('#side-date');
  if (el) el.textContent = txt;
}

function updateHeader() {
  const name = (state.settings && state.settings.name) || '家庭小管家';
  $$('.user-name').forEach(el => {
    el.innerHTML = `${escapeHtml(name)} <span class="user-tag">v1.0</span>`;
  });
  // 顶部标题色按主题切换
  if (state.settings && state.settings.theme === 'blue') {
    document.documentElement.style.setProperty('--pink-deep', 'var(--baby-blue-deep)');
  } else {
    document.documentElement.style.setProperty('--pink-deep', '#c66b8a');
  }
}

// ==========================================================
// 渲染计数（更新卡片副标题）
// ==========================================================
function updateCounts() {
  const fc = $('#fridge-count'); if (fc) fc.textContent = `${state.fridge.length} 件食材`;
  const mc = $('#member-count'); if (mc) mc.textContent = `${state.members.length} 位成员`;
  const today = state.dishes.filter(d => d.meal === currentMeal).length;
  const tms = $('#today-meal-sub'); if (tms) tms.textContent = `${mealLabel(currentMeal)} · ${today} 道`;
}

// 数据迁移：老数据没有 settings 字段时补上
function migrateData() {
  if (!state.settings) {
    state.settings = { name: '家庭小管家', greet: '下午好，宝贝～', theme: 'pink', notify: true };
    saveData();
  }
}

function init() {
  migrateData();
  dishUploader = bindImageUploader('dish-img-file', 'dish-img-url', 'dish-img-preview');
  memberUploader = bindImageUploader('member-avatar-file', 'member-avatar-url', 'member-avatar-preview');
  bindEvents();
  bindSettings();
  bindSyncEvents();
  updateAccountPanel();
  updateGreeting();
  updateDate();
  updateHeader();
  renderDishes();
  renderMembers();
  renderFridge();
  updateCounts();
  // 打开 App 时检查冰箱到期情况
  setTimeout(checkExpiryBanner, 500);
  // 每分钟刷新问候语
  setInterval(() => { updateGreeting(); updateDate(); }, 60000);
  // 初始化家庭云同步
  if (window.FamilyCloud) {
    FamilyCloud.initCloud();
  }
}
document.addEventListener('DOMContentLoaded', init);
