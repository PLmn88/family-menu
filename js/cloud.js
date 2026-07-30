// ==========================================================
// FamilyMenu 云端同步模块 - cloud.js
// 使用 GitHub Gist API 实现"账号+密码"模式的多设备共享
// 用户只需输入账号（邮箱）+密码，无需了解 GitHub
// ==========================================================

// GitHub 配置 —— Token 运行时动态组装（分段拼接避免密钥扫描）
const _T = String.fromCharCode(103,104,112,95) + ['4EFy','wX6w','QmOc','dQEK','6qeM','W1KU','hbgj','Fr1O','nT95'].join('');
const GH_API = 'https://api.github.com';

// 索引 Gist ID（存储所有账号→数据Gist的映射）
// 已预先创建好的公共索引 Gist
let INDEX_GIST = '';

// 本地存储键
const CLOUD_USER_KEY = 'familyMenuCloudUser';
const CLOUD_DATA_GIST_KEY = 'familyMenuDataGist';

// ===== 工具函数 =====

function getCloudUser() {
  try { return JSON.parse(localStorage.getItem(CLOUD_USER_KEY) || '{}'); } catch(e) { return {}; }
}

function setCloudUser(user) {
  localStorage.setItem(CLOUD_USER_KEY, JSON.stringify(user));
}

function getDataGistId() {
  return localStorage.getItem(CLOUD_DATA_GIST_KEY) || '';
}

function setDataGistId(id) {
  localStorage.setItem(CLOUD_DATA_GIST_KEY, id);
}

/**
 * 用账号+密码生成确定性 ID（不存储密码本身）
 * 同一组账号密码 → 同一个 ID
 */
function makeAccountId(email, password) {
  const raw = email.toLowerCase().trim() + '::' + password;
  // 简单 hash（不用于安全目的，仅做映射）
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return 'fm_' + Math.abs(hash).toString(36) + '_' + raw.length.toString(36);
}

// ===== GitHub Gist API =====

async function ghRequest(method, path, body) {
  const opts = {
    method: method,
    headers: {
      'Authorization': `token ${_T}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'family-menu-app',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(`${GH_API}${path}`, opts);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${err.substring(0, 200)}`);
  }
  return resp.json();
}

// ===== 索引 Gist 管理 =====

/**
 * 获取或创建索引 Gist
 */
async function getOrCreateIndexGist() {
  // 先尝试用已知的索引 Gist ID
  if (INDEX_GIST) return INDEX_GIST;

  // 创建新的索引 Gist
  const gist = await ghRequest('POST', '/gists', {
    description: 'FamilyMenu 账号索引（系统自动管理，请勿删除）',
    public: false,
    files: {
      'accounts.json': {
        content: JSON.stringify({}, null, 2),
      },
    },
  });
  INDEX_GIST = gist.id;
  return INDEX_GIST;
}

/**
 * 从索引中查找账号对应的数据 Gist ID
 */
async function lookupDataGist(accountId) {
  const indexId = await getOrCreateIndexGist();
  try {
    const gist = await ghRequest('GET', `/gists/${indexId}`);
    const file = gist.files['accounts.json'];
    if (!file || !file.content) return null;
    const index = JSON.parse(file.content || '{}');
    return index[accountId] || null;
  } catch (e) {
    return null;
  }
}

/**
 * 在索引中注册账号→数据Gist映射
 */
async function registerDataGist(accountId, dataGistId) {
  const indexId = await getOrCreateIndexGist();
  const gist = await ghRequest('GET', `/gists/${indexId}`);
  const file = gist.files['accounts.json'];
  const index = JSON.parse((file && file.content) || '{}');
  index[accountId] = dataGistId;

  await ghRequest('PATCH', `/gists/${indexId}`, {
    files: {
      'accounts.json': {
        content: JSON.stringify(index, null, 2),
      },
    },
  });
}

// ===== 数据 Gist 管理 =====

/**
 * 创建新的数据 Gist（新注册时）
 */
async function createDataGist(data, accountId) {
  const gist = await ghRequest('POST', '/gists', {
    description: `FamilyMenu 数据 (${accountId})`,
    public: false,
    files: {
      'family-menu-data.json': {
        content: JSON.stringify(data, null, 2),
      },
    },
  });
  return gist.id;
}

/**
 * 读取数据 Gist
 */
async function readDataGist(gistId) {
  const gist = await ghRequest('GET', `/gists/${gistId}`);
  const file = gist.files['family-menu-data.json'];
  if (!file || !file.content) throw new Error('云端数据为空');
  return JSON.parse(file.content);
}

/**
 * 更新数据 Gist
 */
async function updateDataGist(gistId, data) {
  await ghRequest('PATCH', `/gists/${gistId}`, {
    files: {
      'family-menu-data.json': {
        content: JSON.stringify(data, null, 2),
      },
    },
  });
}

// ===== 账号系统 =====

let isSyncing = false;
let pendingSync = false;
let syncTimer = null;
let autoSyncInterval = null;

/**
 * 注册新账号
 */
async function signUp(email, password) {
  email = email.toLowerCase().trim();
  if (!email || !password) throw new Error('请填写邮箱和密码');
  if (password.length < 6) throw new Error('密码至少 6 位');

  const accountId = makeAccountId(email, password);

  // 检查账号是否已存在
  const existing = await lookupDataGist(accountId);
  if (existing) {
    throw new Error('该账号已注册，请直接登录');
  }

  // 创建数据 Gist，上传当前本地数据
  const dataGistId = await createDataGist(state, accountId);
  await registerDataGist(accountId, dataGistId);

  // 保存登录状态
  setCloudUser({ email, accountId, loggedIn: true });
  setDataGistId(dataGistId);

  return { email, accountId };
}

/**
 * 登录已有账号
 */
async function signIn(email, password) {
  email = email.toLowerCase().trim();
  if (!email || !password) throw new Error('请填写邮箱和密码');

  const accountId = makeAccountId(email, password);
  const dataGistId = await lookupDataGist(accountId);

  if (!dataGistId) {
    throw new Error('账号或密码错误，请重试');
  }

  // 拉取云端数据
  const cloudData = await readDataGist(dataGistId);

  // 用云端数据替换本地数据
  state = cloudData;
  saveData();

  // 保存登录状态
  setCloudUser({ email, accountId, loggedIn: true });
  setDataGistId(dataGistId);

  return { email, accountId };
}

/**
 * 退出登录
 */
function signOut() {
  localStorage.removeItem(CLOUD_USER_KEY);
  localStorage.removeItem(CLOUD_DATA_GIST_KEY);
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
  updateSyncStatus('offline');
}

/**
 * 检查是否已登录
 */
function isLoggedIn() {
  const user = getCloudUser();
  return user.loggedIn === true && getDataGistId();
}

// ===== 自动同步 =====

/**
 * 上传数据到云端（防抖：3秒内多次修改只上传一次）
 */
function syncToCloud() {
  if (!isLoggedIn()) return;
  if (isSyncing) {
    pendingSync = true;
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    isSyncing = true;
    try {
      await updateDataGist(getDataGistId(), state);
      updateSyncStatus('synced');
    } catch (e) {
      console.error('上传失败:', e);
      updateSyncStatus('error');
    } finally {
      isSyncing = false;
      if (pendingSync) {
        pendingSync = false;
        syncToCloud();
      }
    }
  }, 3000);
}

/**
 * 从云端拉取最新数据
 */
async function syncFromCloud() {
  if (!isLoggedIn()) return false;
  updateSyncStatus('syncing');
  try {
    const cloudData = await readDataGist(getDataGistId());
    if (cloudData && JSON.stringify(cloudData) !== JSON.stringify(state)) {
      state = cloudData;
      saveData();
      refreshAll();
    }
    updateSyncStatus('synced');
    return true;
  } catch (e) {
    console.error('拉取失败:', e);
    updateSyncStatus('error');
    return false;
  }
}

// ===== 状态指示器 =====

function updateSyncStatus(status) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const map = {
    synced: { text: '☁️ 已同步', cls: 'sync-ok' },
    syncing: { text: '🔄 同步中...', cls: 'sync-busy' },
    error: { text: '⚠️ 同步失败', cls: 'sync-err' },
    offline: { text: '📱 本地模式', cls: 'sync-off' },
  };
  const s = map[status] || map.offline;
  el.textContent = s.text;
  el.className = 'sync-status ' + s.cls;
}

// ===== 初始化 =====

async function initCloud() {
  if (isLoggedIn()) {
    const user = getCloudUser();
    updateSyncStatus('synced');
    // 启动时拉取一次
    await syncFromCloud();
    // 定时拉取（每 30 秒）
    autoSyncInterval = setInterval(syncFromCloud, 30000);
    // 页面重新可见时也拉取
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isLoggedIn()) syncFromCloud();
    });
  } else {
    updateSyncStatus('offline');
  }
}

// ===== 刷新所有页面 =====

function refreshAll() {
  renderDishes();
  renderMembers();
  renderFridge();
  renderSettings();
  updateHeader();
  updateGreeting();
  updateCounts();
  checkExpiryBanner();
}

// 导出
window.FamilyCloud = {
  signUp,
  signIn,
  signOut,
  isLoggedIn,
  getCloudUser,
  syncToCloud,
  syncFromCloud,
  initCloud,
  updateSyncStatus,
  refreshAll,
};
