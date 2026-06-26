const API_BASE_URL = '/api'; // Всегда относительный путь — работает и локально (через Vite proxy), и на Render

async function request(url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers,
    ...options
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

export const api = {
  // Авторизация
  register:          (name, username, email, password) => request('/users/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) }),
  login:             (username, password) => request('/users/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe:             () => request('/users/me'),
  updateTelegramId:  (telegramId) => request('/users/telegram', { method: 'PUT', body: JSON.stringify({ telegramId }) }),

  // Пользователи
  getUsers:       ()              => request('/users'),
  getLeaderboard: ()              => request('/leaderboard'),

  // Друзья
  getFriends:         () => request('/friends'),
  addFriend:          (username) => request('/friends/add', { method: 'POST', body: JSON.stringify({ username }) }),
  acceptFriend:       (requestId) => request('/friends/accept', { method: 'POST', body: JSON.stringify({ requestId }) }),
  getPendingRequests: () => request('/friends/requests'),

  // Долги
  getDebts:   (userId)        => request(`/debts/user/${userId}`),
  createDebt: (debtData)      => request('/debts/create', { method: 'POST', body: JSON.stringify(debtData) }),
  payDebt:    (transactionId) => request(`/debts/${transactionId}/pay`, { method: 'POST' }),

  // Кейсы
  openCase:   (userId)        => request('/open-case', { method: 'POST', body: JSON.stringify({ userId }) })
};
