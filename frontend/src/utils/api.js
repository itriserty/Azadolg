const API_BASE_URL = '/api'; // Всегда относительный путь — работает и локально (через Vite proxy), и на Render

async function request(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Что-то пошло не так');
  return data;
}

export const api = {
  // Пользователи
  getUsers:       ()              => request('/users'),
  getLeaderboard: ()              => request('/leaderboard'),
  createUser:     (name, email)   => request('/users/register', { method: 'POST', body: JSON.stringify({ name, email }) }),
  addFriend:      (userId, friendId) => request('/users/add-friend', { method: 'POST', body: JSON.stringify({ userId, friendId }) }),

  // Долги
  getDebts:   (userId)        => request(`/debts/user/${userId}`),
  createDebt: (debtData)      => request('/debts/create', { method: 'POST', body: JSON.stringify(debtData) }),
  payDebt:    (transactionId) => request(`/debts/${transactionId}/pay`, { method: 'POST' }),

  // Кейсы
  openCase:   (userId)        => request('/open-case', { method: 'POST', body: JSON.stringify({ userId }) })
};
