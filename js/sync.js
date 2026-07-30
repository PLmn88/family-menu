// ==========================================================
// FamilyMenu 云端同步模块 - sync.js
// 使用 GitHub Gist API 实现多设备数据共享
// 优势：免费、国内可访问、无需额外注册服务
// ==========================================================

// GitHub 配置 —— Token 从用户输入获取（保存在 localStorage）
// 用户需在设置页输入自己的 GitHub Personal Access Token（需 gist 权限）
const GITHUB_API = 'https://api.github.com';

function getGitHubToken() {
  return localStorage.getItem('familyMenuGitHubToken') || '';
}

function setGitHubToken(token) {
  localStorage.setItem('familyMenuGitHubToken', token);
}

function getGitHubUser() {
  return localStorage.getItem('familyMenuGitHubUser') || '';
}

function setGitHubUser(user) {
  localStorage.setItem('familyMenuGitHubUser', user);
}

// 本地存储键
const ROOM_KEY = 'familyMenuRoom_v1';
const GIST_ID_KEY = 'familyMenuGistId_v1';

// ===== 房间管理 =====

function getRoomId() {
  return localStorage.getItem(ROOM_KEY) || '';
}

function setRoomId(id) {
  localStorage.setItem(ROOM_KEY, id);
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room') || '';
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

// ===== Gist ID 本地缓存 =====

let currentGistId = '';

function getGistId() {
  return currentGistId || localStorage.getItem(GIST_ID_KEY) || '';
}

function setGistId(id) {
  currentGistId = id;
  localStorage.setItem(GIST_ID_KEY, id);
}

// ===== GitHub Gist API 封装 =====

/**
 * 创建新的 Gist（创建新房间时调用）
 * 每个房间 = 一个 Gist，文件名为 family-menu-data.json
 */
async function createGist(data, roomId) {
  const token = getGitHubToken();
  if (!token) throw new Error('请先在设置中填写 GitHub Token');
  const resp = await fetch(`${GITHUB_API}/gists`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'family-menu-app',
    },
    body: JSON.stringify({
      description: `FamilyMenu 房间 ${roomId}`,
      public: false,
      files: {
        'family-menu-data.json': {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`创建云端房间失败 (${resp.status}): ${err.substring(0, 200)}`);
  }
  const json = await resp.json();
  return json.id;
}

/**
 * 读取 Gist 数据
 */
async function readGist(gistId) {
  const token = getGitHubToken();
  if (!token) throw new Error('请先在设置中填写 GitHub Token');
  const resp = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'family-menu-app',
    },
  });
  if (!resp.ok) {
    throw new Error(`读取云端数据失败 (${resp.status})`);
  }
  const json = await resp.json();
  const file = json.files['family-menu-data.json'];
  if (!file || !file.content) {
    throw new Error('云端数据为空');
  }
  return JSON.parse(file.content);
}

/**
 * 更新 Gist 数据
 */
async function updateGist(gistId, data) {
  const token = getGitHubToken();
  if (!token) throw new Error('请先在设置中填写 GitHub Token');
  const resp = await fetch(`${GITHUB_API}/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'family-menu-app',
    },
    body: JSON.stringify({
      files: {
        'family-menu-data.json': {
          content: JSON.stringify(data, null, 2),
        },
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`同步到云端失败 (${resp.status}): ${err.substring(0, 100)}`);
  }
  return true;
}

// ===== 房间号 ↔ Gist ID 映射 =====
// 使用一个"索引 Gist"来存储所有 room → gistId 的映射
// 这样家人只需输入 6 位房间号就能找到对应数据

const INDEX_GIST_ID_KEY = 'familyMenuIndexGistId';

/**
 * 获取或创建索引 Gist
 */
async function getOrCreateIndexGist() {
  const token = getGitHubToken();
  if (!token) throw new Error('请先在设置中填写 GitHub Token');
  // 先从 localStorage 读缓存的 index gist ID
  let indexId = localStorage.getItem(INDEX_GIST_ID_KEY);
  if (indexId) {
    // 验证是否还存在
    try {
      const resp = await fetch(`${GITHUB_API}/gists/${indexId}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'family-menu-app',
        },
      });
      if (resp.ok) return indexId;
    } catch (e) { /* ignore */ }
  }

  // 创建新的索引 Gist
  const resp = await fetch(`${GITHUB_API}/gists`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'family-menu-app',
    },
    body: JSON.stringify({
      description: 'FamilyMenu 房间索引（勿删）',
      public: false,
      files: {
        'room-index.json': {
          content: JSON.stringify({}, null, 2),
        },
      },
    }),
  });
  if (!resp.ok) throw new Error('创建房间索引失败');
  const json = await resp.json();
  indexId = json.id;
  localStorage.setItem(INDEX_GIST_ID_KEY, indexId);
  return indexId;
}

/**
 * 注册房间号到索引
 */
async function registerRoom(roomId, gistId) {
  const token = getGitHubToken();
  const indexId = await getOrCreateIndexGist();
  const resp = await fetch(`${GITHUB_API}/gists/${indexId}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'family-menu-app',
    },
  });
  if (!resp.ok) throw new Error('读取房间索引失败');
  const json = await resp.json();
  const index = JSON.parse(json.files['room-index.json'].content || '{}');
  index[roomId] = gistId;

  await fetch(`${GITHUB_API}/gists/${indexId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'family-menu-app',
    },
    body: JSON.stringify({
      files: {
        'room-index.json': {
          content: JSON.stringify(index, null, 2),
        },
      },
    }),
  });
}

/**
 * 通过房间号查找 Gist ID
 */
async function lookupGistByRoom(roomId) {
  const token = getGitHubToken();
  const indexId = await getOrCreateIndexGist();
  const resp = await fetch(`${GITHUB_API}/gists/${indexId}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'family-menu-app',
    },
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  const file = json.files['room-index.json'];
  if (!file || !file.content) return null;
  const index = JSON.parse(file.content || '{}');
  return index[roomId] || null;
}

// ===== 高层同步接口 =====

let syncTimer = null;
let isSyncing = false;
let pendingSync = false;

/**
 * 创建新房间
 */
async function createRoom() {
  const roomId = generateRoomId();
  const gistId = await createGist(state, roomId);
  await registerRoom(roomId, gistId);
  setRoomId(roomId);
  setGistId(gistId);
  return roomId;
}

/**
 * 加入已有房间
 */
async function joinRoom(roomId) {
  roomId = roomId.trim().toUpperCase();
  const gistId = await lookupGistByRoom(roomId);
  if (!gistId) {
    throw new Error('房间号不存在，请检查后重试');
  }
  setRoomId(roomId);
  setGistId(gistId);
  // 拉取云端数据
  const cloudData = await readGist(gistId);
  state = cloudData;
  saveData(); // 同时保存到本地
  return true;
}

/**
 * 退出房间
 */
function leaveRoom() {
  localStorage.removeItem(ROOM_KEY);
  localStorage.removeItem(GIST_ID_KEY);
}

/**
 * 同步数据到云端（防抖：3秒内多次修改只上传一次）
 */
function syncToCloud() {
  if (!getRoomId() || !getGistId()) return;
  if (isSyncing) {
    pendingSync = true;
    return;
  }
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    isSyncing = true;
    try {
      await updateGist(getGistId(), state);
      updateSyncStatus('synced');
    } catch (e) {
      console.error('同步失败:', e);
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
  if (!getRoomId() || !getGistId()) return false;
  updateSyncStatus('syncing');
  try {
    const cloudData = await readGist(getGistId());
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

/**
 * 更新同步状态指示器
 */
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

/**
 * 初始化同步模块
 */
async function initSync() {
  // 检查 URL 中是否有房间号（通过分享链接加入）
  const urlRoom = getRoomFromUrl();
  if (urlRoom) {
    try {
      await joinRoom(urlRoom);
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());
      refreshAll();
      updateSyncPanel && updateSyncPanel();
      toast('已加入家庭房间 🏠');
    } catch (e) {
      toast('加入房间失败：' + e.message);
    }
    // 无论是否成功都启动定时同步
    setInterval(syncFromCloud, 30000);
    return;
  }

  // 检查本地是否有房间号
  const localRoom = getRoomId();
  if (localRoom && getGistId()) {
    updateSyncStatus('synced');
    await syncFromCloud();
    setInterval(syncFromCloud, 30000);
  } else {
    updateSyncStatus('offline');
  }
}

/**
 * 刷新所有页面渲染
 */
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

// 导出给 app.js 使用
window.FamilySync = {
  createRoom,
  joinRoom,
  leaveRoom,
  syncToCloud,
  syncFromCloud,
  initSync,
  getRoomId,
  updateSyncStatus,
  refreshAll,
};
