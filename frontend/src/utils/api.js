const API_BASE_URL = '/api';
let successCallback = null;
let unauthorizedCallback = null;

export const setSuccessCallback = (cb) => {
  successCallback = cb;
};

export const setUnauthorizedCallback = (cb) => {
  unauthorizedCallback = cb;
};

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (headers['Content-Type'] === 'none') {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers,
    ...options
  });
  
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      if (unauthorizedCallback) {
        unauthorizedCallback(data.error || 'Сессия истекла');
      }
    }
    throw new Error(data.error || 'Что-то пошло не так');
  }
  
  if (successCallback) {
    try {
      successCallback(data);
    } catch (e) {
      console.error('[API Success Callback Error]:', e);
    }
  }

  return data;
}

export const api = {
  request,
  // Авторизация
  register:          (name, username, email, password) => request('/users/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) }),
  login:             (username, password) => request('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  forgotPassword:    (username) => request('/users/forgot-password', { method: 'POST', body: JSON.stringify({ username }) }),
  resetPassword:     (username, code, newPassword) => request('/users/reset-password', { method: 'POST', body: JSON.stringify({ username, code, newPassword }) }),
  getMe:             () => request('/users/me'),
  updateTelegramId:  (telegramId) => request('/users/telegram', { method: 'PUT', body: JSON.stringify({ telegramId }) }),
  updateAvatar:      (formData) => request('/users/avatar', { method: 'PUT', headers: { 'Content-Type': 'none' }, body: formData }),

  // Пользователи
  getUsers:       ()              => request('/users'),
  getLeaderboard: ()              => request('/leaderboard'),
  transferKarma:  (toUserId, amount) => request('/users/transfer', { method: 'POST', body: JSON.stringify({ toUserId, amount }) }),
  getWeeklyQuests:()              => request('/users/me/weekly-quests'),

  // Администрирование
  adjustKarma:    (userId, amount, reason) => request(`/admin/users/${userId}/adjust-karma`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),
  adjustElo:      (userId, amount, reason) => request(`/admin/users/${userId}/adjust-elo`, { method: 'POST', body: JSON.stringify({ amount, reason }) }),
  resetJackpot:   () => request('/admin/system/jackpot/reset', { method: 'POST' }),
  distributeJackpot: () => request('/admin/jackpot/distribute', { method: 'POST' }),
  getGlobalStats: () => request('/admin/stats'),

  // Друзья
  getFriends:               () => request('/friends'),
  addFriend:                (username) => request('/friends/add', { method: 'POST', body: JSON.stringify({ username }) }),
  acceptFriend:             (requestId) => request('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),
  acceptFriendRequest:      (requestId) => request('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),
  rejectFriendRequest:      (requestId) => request('/friends/reject', { method: 'POST', body: JSON.stringify({ requestId }) }),
  getPendingRequests:       () => request('/friends/requests'),
  getPendingFriendRequests: () => request('/friends/requests'),

  // Долги
  getDebts:    (userId)        => request(`/debts/user/${userId}`),
  createDebt:  (debtData)      => request('/debts/create', { method: 'POST', body: JSON.stringify(debtData) }),
  payDebt:     (transactionId) => request(`/debts/${transactionId}/pay`, { method: 'POST' }),
  confirmDebt: (transactionId) => request(`/debts/${transactionId}/confirm`, { method: 'POST' }),
  declineDebt: (transactionId) => request(`/debts/${transactionId}/decline`, { method: 'POST' }),

  // Кейсы
  openCase:   (userId)        => request('/open-case', { method: 'POST', body: JSON.stringify({ userId }) }),

  // Магазин и Гача
  getShopItems:      () => request('/shop/items'),
  buyShopItem:       (itemId) => request('/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) }),
  getUserInventory:  () => request('/shop/inventory'),
  activateCosmetic:  (itemId, itemType) => request('/shop/activate', { method: 'POST', body: JSON.stringify({ itemId, itemType }) }),
  pullGacha:         () => request('/gacha/pull', { method: 'POST' }),

  // Дуэли и Ставки
  createDuelChallenge: (opponentId, debtId, wager) => request('/duel/challenge', { method: 'POST', body: JSON.stringify({ opponentId, debtId, wager }) }),
  respondToDuel:       (duelId, action) => request('/duel/respond', { method: 'POST', body: JSON.stringify({ duelId, action }) }),
  getMyDuels:          () => request('/duel/my'),
  placeBet:            (debtId, prediction, wager) => request('/bets/create', { method: 'POST', body: JSON.stringify({ debtId, prediction, wager }) }),
  getMyBets:           () => request('/bets/my'),

  // Краудфандинг и Квесты
  createFund:       (title, targetAmount) => request('/fund/create', { method: 'POST', body: JSON.stringify({ title, targetAmount }) }),
  contributeToFund: (fundId, amount) => request('/fund/contribute', { method: 'POST', body: JSON.stringify({ fundId, amount }) }),
  getFunds:         () => request('/fund'),
  createQuest:      (title, description, karmaReward) => request('/quests/create', { method: 'POST', body: JSON.stringify({ title, description, karmaReward }) }),
  takeQuest:        (questId) => request('/quests/take', { method: 'POST', body: JSON.stringify({ questId }) }),
  completeQuest:    (questId) => request('/quests/complete', { method: 'POST', body: JSON.stringify({ questId }) }),
  verifyQuest:      (questId, action) => request('/quests/verify', { method: 'POST', body: JSON.stringify({ questId, action }) }),
  cancelQuest:      (questId) => request('/quests/cancel', { method: 'POST', body: JSON.stringify({ questId }) }),
  getQuests:        () => request('/quests'),
  getSeason:        () => request('/system/season')
};
