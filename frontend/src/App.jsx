import React, { useState, useEffect, useCallback } from 'react';
import { api } from './utils/api';
import Dashboard      from './components/Dashboard';
import Leaderboard    from './components/Leaderboard';
import DebtForm       from './components/DebtForm';
import DebtList       from './components/DebtList';
import CaseRoulette   from './components/CaseRoulette';
import Shop           from './components/Shop';
import DuelsAndBets   from './components/DuelsAndBets';
import SocialBoard    from './components/SocialBoard';
import BattlePass     from './components/BattlePass';
import AdminPanel     from './components/AdminPanel';
import Profile        from './components/Profile';
import Marketplace    from './components/Marketplace';
import { LogOut, Lock, Mail, User as UserIcon, HelpCircle, Shield } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); // Таблица лидеров
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('debts');
  const [viewingProfileId, setViewingProfileId] = useState(null);

  // Состояния для форм авторизации
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showRoulette, setShowRoulette] = useState(false);

  // ─── Загрузка всех данных (Вызывается после успешного входа) ────────────────

  const fetchAppData = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      setLoading(true);
      
      // 1. Профиль
      const me = await api.getMe();
      setCurrentUser(me);

      // 2. Лидерборд
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);

      // 3. Друзья и Запросы
      const friendsData = await api.getFriends();
      setFriends(friendsData);

      const requestsData = await api.getPendingRequests();
      setPendingRequests(requestsData);

      // 4. Долги
      const debtsData = await api.getDebts(me._id);
      setDebts(debtsData);

      setError('');
    } catch (err) {
      console.error(err);
      if (err.message?.includes('токен') || err.message?.includes('Unauthorized')) {
        handleLogout();
      } else {
        setError('Не удалось загрузить данные приложения. Проверьте подключение к серверу.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Первичная инициализация при наличии токена
  useEffect(() => {
    if (token) {
      fetchAppData();
    } else {
      setLoading(false);
    }
  }, [token, fetchAppData]);

  // ─── Авторизация ───────────────────────────────────────────────────────────

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        // Вход
        const data = await api.login(username, password);
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else if (authMode === 'register') {
        // Регистрация
        const data = await api.register(name, username, email, password);
        localStorage.setItem('token', data.token);
        setToken(data.token);
      } else if (authMode === 'forgot') {
        // Запрос кода
        const data = await api.forgotPassword(username);
        setAuthSuccess(data.message);
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        // Сброс
        const data = await api.resetPassword(username, resetCode, newPassword);
        setAuthSuccess(data.message);
        setAuthMode('login');
        setResetCode('');
        setNewPassword('');
        setPassword('');
      }
      setName('');
      setEmail('');
    } catch (err) {
      setAuthError(err.message || 'Ошибка авторизации');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setCurrentUser(null);
    setUsers([]);
    setFriends([]);
    setPendingRequests([]);
    setDebts([]);
    setShowRoulette(false);
  };

  // ─── Взаимодействие (Друзья, Долги, Кейсы) ─────────────────────────────────

  const handleAddFriend = async (friendUsername) => {
    const res = await api.addFriend(friendUsername);
    // Обновляем списки друзей и входящих запросов
    const friendsData = await api.getFriends();
    setFriends(friendsData);
    const requestsData = await api.getPendingRequests();
    setPendingRequests(requestsData);
    // Обновляем лидерборд
    const leaderData = await api.getLeaderboard();
    setUsers(leaderData);
    return res;
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await api.acceptFriend(requestId);
      // Обновляем данные
      const friendsData = await api.getFriends();
      setFriends(friendsData);
      const requestsData = await api.getPendingRequests();
      setPendingRequests(requestsData);
      
      const me = await api.getMe();
      setCurrentUser(me);
      
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.rejectFriend(requestId);
      const requestsData = await api.getPendingRequests();
      setPendingRequests(requestsData);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateTelegramId = async (telegramId) => {
    const res = await api.updateTelegramId(telegramId);
    setCurrentUser(res.user);
    // Обновляем лидерборд
    const leaderData = await api.getLeaderboard();
    setUsers(leaderData);
    alert(res.message || 'Telegram ID успешно обновлен!');
  };

  const handleUpdateAvatar = async (avatarBase64) => {
    try {
      const res = await api.updateAvatar(avatarBase64);
      setCurrentUser(res.user);
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message || 'Ошибка обновления аватара');
    }
  };

  const handleCreateDebt = async (debtData) => {
    try {
      await api.createDebt(debtData);
      if (currentUser) {
        const debtsData = await api.getDebts(currentUser._id);
        setDebts(debtsData);
      }
      // Обновляем балансы пользователей в лидерборде
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message || 'Ошибка создания долга');
    }
  };

  const handlePayDebt = async (transactionId) => {
    try {
      const res = await api.payDebt(transactionId);
      const { debtor: d, creditor: c } = res.rewards;
      alert(
        `✅ Долг закрыт!\n\n` +
        `${d.name}: ${d.eloChange >= 0 ? '+' : ''}${d.eloChange} ELO, +${d.coinsEarned} Coins\n` +
        `${c.name}: ${c.eloChange >= 0 ? '+' : ''}${c.eloChange} ELO`
      );
      if (currentUser) {
        const debtsData = await api.getDebts(currentUser._id);
        setDebts(debtsData);
        // Обновляем текущего пользователя (у него прибавились ELO/Coins)
        const me = await api.getMe();
        setCurrentUser(me);
      }
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message || 'Ошибка при оплате');
    }
  };

  const handleConfirmDebt = async (transactionId) => {
    try {
      const res = await api.confirmDebt(transactionId);
      alert(res.message || 'Долг успешно подтвержден!');
      if (currentUser) {
        const debtsData = await api.getDebts(currentUser._id);
        setDebts(debtsData);
      }
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message || 'Ошибка подтверждения');
    }
  };

  const handleDeclineDebt = async (transactionId) => {
    try {
      const res = await api.declineDebt(transactionId);
      alert(res.message || 'Долг успешно отклонен');
      if (currentUser) {
        const debtsData = await api.getDebts(currentUser._id);
        setDebts(debtsData);
      }
      const leaderData = await api.getLeaderboard();
      setUsers(leaderData);
    } catch (err) {
      alert(err.message || 'Ошибка отклонения');
    }
  };

  // ── Свидетель ────────────────────────────────────────────────────────────────
  const handleWitnessDecision = async (transactionId, action) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debts/${transactionId}/witness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
      if (currentUser) setDebts(await api.getDebts(currentUser._id));
    } catch (err) { alert(err.message); }
  };

  // ── Загрузка пруфа оплаты (FormData) ─────────────────────────────────────────
  const handlePayProof = async (transactionId, formData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debts/${transactionId}/pay-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }, // НЕ ставим Content-Type — multer сам определит
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка загрузки пруфа');
    alert(data.message);
    if (currentUser) {
      setDebts(await api.getDebts(currentUser._id));
      setCurrentUser(await api.getMe());
    }
    setUsers(await api.getLeaderboard());
    return data;
  };

  // ── Прощение долга ────────────────────────────────────────────────────────────
  const handleForgiveDebt = async (transactionId) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debts/${transactionId}/forgive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(data.message);
    if (currentUser) setDebts(await api.getDebts(currentUser._id));
    setCurrentUser(await api.getMe());
    setUsers(await api.getLeaderboard());
  };

  // ── Передача долга ────────────────────────────────────────────────────────────
  const handleTransferDebt = async (transactionId, newDebtorId) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/debts/${transactionId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newDebtorId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(data.message);
    if (currentUser) setDebts(await api.getDebts(currentUser._id));
  };

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u._id === updatedUser._id ? { ...u, ...updatedUser } : u));
    if (updatedUser._id) {
      api.getDebts(updatedUser._id).then(setDebts);
    }
  };

  const handleOpenCase = async () => {
    if (!currentUser) throw new Error('Пользователь не выбран');
    return await api.openCase(currentUser._id);
  };

  // ─── Баланс долгов ────────────────────────────────────────────────────────

  const totalOwesMe = debts
    .filter(d => d.creditor?._id === currentUser?._id)
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = debts
    .filter(d => d.debtor?._id === currentUser?._id)
    .reduce((sum, d) => sum + d.amount, 0);

  const netBalance = Number((totalOwesMe - totalIOwe).toFixed(2));

  // Список пользователей для формы создания долга (текущий пользователь + его друзья)
  const debtFormUsers = currentUser ? [currentUser, ...friends] : [];

  // ─── Рендер ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-gray-400 gap-4">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-800 rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-widest uppercase">Загрузка Azadolg...</p>
      </div>
    );
  }

  // Если не авторизован — показываем красивый экран входа / регистрации
  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center px-4 relative overflow-hidden">
        {/* Неоновые фоновые сферы */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-black relative z-10">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-black text-white text-3xl mx-auto shadow-purple-500/35 shadow-lg mb-3">
              A
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Добро пожаловать в Azadolg</h2>
            <p className="text-xs text-gray-400 mt-1">Закрытая финансовая ELO-система для друзей ⚔️</p>
          </div>

          {/* Переключатель вкладок (показываем только для Входа / Регистрации) */}
          {(authMode === 'login' || authMode === 'register') && (
            <div className="flex bg-[#0b0f19] p-1.5 rounded-xl border border-gray-850 mb-6">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  authMode === 'login' ? 'bg-[#151c2c] text-cyan-400 shadow-md border border-gray-800' : 'text-gray-400 hover:text-gray-255'
                }`}
              >
                Войти
              </button>
              <button
                onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                  authMode === 'register' ? 'bg-[#151c2c] text-cyan-400 shadow-md border border-gray-800' : 'text-gray-400 hover:text-gray-255'
                }`}
              >
                Регистрация
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="mb-6 text-center">
              <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">Восстановление доступа</h3>
              <p className="text-xs text-gray-400 mt-1">Код сброса пароля будет отправлен вашему Telegram-боту</p>
            </div>
          )}

          {authMode === 'reset' && (
            <div className="mb-6 text-center">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Ввод кода сброса</h3>
              <p className="text-xs text-gray-400 mt-1">Введите 6-значный код из Telegram и новый пароль</p>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-red-600/10 border border-red-600/30 rounded-xl text-xs text-red-400 mb-4 font-semibold text-center">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 mb-4 font-semibold text-center">
              {authSuccess}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4 text-sm">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Полное Имя</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Алексей Смирнов"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {(authMode === 'login' || authMode === 'register' || authMode === 'forgot' || authMode === 'reset') && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Username (Юзернейм)</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="alex_ninja"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {authMode === 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Код подтверждения (6 цифр)</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {(authMode === 'login' || authMode === 'register') && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Пароль</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                      className="text-[11px] text-cyan-400 hover:underline font-semibold"
                    >
                      Забыли пароль?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {authMode === 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Новый Пароль</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-purple-500/20 shadow-md hover:opacity-90 transition disabled:opacity-50 mt-4"
            >
              {authLoading ? 'Обработка...' 
                : authMode === 'login' ? 'Войти в игру' 
                : authMode === 'register' ? 'Зарегистрироваться' 
                : authMode === 'forgot' ? 'Отправить код на Telegram' 
                : 'Сохранить новый пароль'}
            </button>

            {(authMode === 'forgot' || authMode === 'reset') && (
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-300 mt-2 block hover:underline"
              >
                Вернуться к авторизации
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] pb-12">
      {/* ── Хедер ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-[#151c2c]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Логотип */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-black text-white text-xl shadow-purple-500/20 shadow-md">
              A
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Azadolg
                <span className="text-[9px] bg-cyan-400/15 text-cyan-400 border border-cyan-400/30 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  v3
                </span>
              </h1>
              <p className="text-[10px] text-gray-500">Закрытая финансовая ELO-система</p>
            </div>
          </div>

          {/* Панель текущего пользователя и Выход */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-gray-200">{currentUser.name}</div>
              <div className="text-[10px] text-gray-500">@{currentUser.username}</div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-gray-850 hover:bg-red-950/20 hover:text-red-400 text-gray-400 font-bold py-1.5 px-3 rounded-xl text-xs border border-gray-800 hover:border-red-900/30 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* ── Тело ──────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-400 mb-8 max-w-2xl mx-auto">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ── Левая колонка (Dashboard + Лидерборд + Рулетка) ─── */}
          <div className="lg:col-span-5 space-y-8">
            {/* Dashboard: профиль, ELO-виджет, баланс, кнопка кейса */}
            <Dashboard
              user={currentUser}
              netBalance={netBalance}
              totalOwesMe={totalOwesMe}
              totalIOwe={totalIOwe}
              friends={friends}
              pendingRequests={pendingRequests}
              onOpenCaseClick={() => setShowRoulette(prev => !prev)}
              onAddFriend={handleAddFriend}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
              onUpdateTelegramId={handleUpdateTelegramId}
              onUpdateAvatar={handleUpdateAvatar}
              isTop3={users.slice(0, 3).some(u => u._id === currentUser?._id)}
              onViewProfile={setViewingProfileId}
            />

            {/* Рулетка кейсов (показываем/скрываем по кнопке в Dashboard) */}
            {showRoulette && currentUser && (
              <CaseRoulette
                user={currentUser}
                onOpenCase={handleOpenCase}
                onUserUpdate={handleUserUpdate}
              />
            )}

            {/* ELO-лидерборд */}
            <Leaderboard users={users} currentUser={currentUser} onViewProfile={setViewingProfileId} />
          </div>

          {/* ── Правая колонка (Табы + Их контент) ───────────── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Панель вкладок */}
            <div className="flex flex-wrap bg-[#151c2c]/85 border border-gray-800 p-1.5 rounded-2xl gap-1">
              {[['profile','👤 Профиль'],['debts','💸 Долги'],['duels','⚔️ Дуэли и Ставки'],['social','🏺 Община'],['battlepass','🎒 BP'],['shop','🛒 Магазин'],['market','🛍️ Рынок']].map(([tab, label]) => (
                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'profile') setViewingProfileId(null); }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    (activeTab === tab && !viewingProfileId)
                      ? 'bg-gradient-to-r from-purple-600/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-extrabold shadow shadow-cyan-500/10'
                      : 'text-gray-400 hover:text-gray-250 border border-transparent'
                  }`}>{label}</button>
              ))}
              {currentUser?.role === 'admin' && (
                <button onClick={() => { setActiveTab('admin'); setViewingProfileId(null); }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ${
                    activeTab === 'admin' && !viewingProfileId
                      ? 'bg-purple-600/20 border border-purple-500/30 text-purple-400 font-extrabold shadow shadow-purple-500/10'
                      : 'text-gray-500 hover:text-purple-400 border border-transparent'
                  }`}>
                  <Shield className="w-3.5 h-3.5" /> Админ
                </button>
              )}
            </div>

            {/* Контент активной вкладки */}
            {viewingProfileId ? (
              <Profile
                userId={viewingProfileId}
                currentUser={currentUser}
                onBack={() => setViewingProfileId(null)}
              />
            ) : (
              <>
                {activeTab === 'profile' && (
                  <Profile
                    userId={currentUser._id}
                    currentUser={currentUser}
                    onBack={null}
                  />
                )}

                {activeTab === 'debts' && (
                  <div className="space-y-8 animate-fadeIn">
                    <DebtForm
                      users={debtFormUsers}
                      currentUser={currentUser}
                      onSubmit={handleCreateDebt}
                    />
                    <DebtList
                      debts={debts}
                      currentUser={currentUser}
                      onPay={handlePayDebt}
                      onConfirm={handleConfirmDebt}
                      onDecline={handleDeclineDebt}
                      onWitness={handleWitnessDecision}
                      onPayProof={handlePayProof}
                      onForgive={handleForgiveDebt}
                      onTransfer={handleTransferDebt}
                      friends={friends}
                    />
                  </div>
                )}

                {activeTab === 'duels' && (
                  <DuelsAndBets user={currentUser} onUpdateUser={handleUserUpdate} />
                )}

                {activeTab === 'social' && (
                  <SocialBoard user={currentUser} onUpdateUser={handleUserUpdate} />
                )}

                {activeTab === 'battlepass' && (
                  <BattlePass user={currentUser} />
                )}

                {activeTab === 'shop' && (
                  <Shop user={currentUser} onUpdateUser={handleUserUpdate} />
                )}

                {activeTab === 'market' && (
                  <Marketplace
                    user={currentUser}
                    onUpdateUser={handleUserUpdate}
                    onViewProfile={setViewingProfileId}
                  />
                )}

                {activeTab === 'admin' && currentUser?.role === 'admin' && (
                  <AdminPanel token={token} />
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
