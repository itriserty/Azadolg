import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api } from './utils/api';
import Layout         from './components/Layout';
import Feed           from './components/Feed';
import Casino         from './components/Casino';
import Shop           from './components/Shop';
import Profile        from './components/Profile';
import DebtForm       from './components/DebtForm';
import DebtList       from './components/DebtList';
import BattlePass     from './components/BattlePass';
import AdminPanel     from './components/AdminPanel';
import { LogOut, Lock, Mail, User as UserIcon, Shield } from 'lucide-react';

function AppRoutes({
  token,
  setToken,
  currentUser,
  setCurrentUser,
  users,
  friends,
  pendingRequests,
  debts,
  loading,
  error,
  fetchAppData,
  handleCreateDebt,
  handlePayDebt,
  handleConfirmDebt,
  handleDeclineDebt,
  handleWitnessDecision,
  handlePayProof,
  handleForgiveDebt,
  handleTransferDebt,
  handleAddFriend,
  handleAcceptRequest,
  handleRejectRequest,
  handleUpdateTelegramId,
  handleUpdateAvatar,
  handleUserUpdate,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  authSuccess,
  setAuthSuccess,
  authLoading,
  setAuthLoading,
  name,
  setName,
  username,
  setUsername,
  email,
  setEmail,
  password,
  setPassword,
  resetCode,
  setResetCode,
  newPassword,
  setNewPassword,
  handleAuthSubmit,
  handleLogout
}) {
  const navigate = useNavigate();

  // Редирект в случае успешной авторизации
  useEffect(() => {
    if (token && currentUser) {
      // Автоматически направляем на ленту при входе
      if (window.location.pathname === '/' || window.location.pathname === '/login') {
        navigate('/feed');
      }
    }
  }, [token, currentUser, navigate]);

  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-[#070b13] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131a2e] via-[#070b13] to-black flex items-center justify-center p-4 selection:bg-purple-650/40">
        <div className="w-full max-w-md bg-[#151c2c]/75 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Декор */}
          <div className="absolute -right-16 -top-16 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-16 -bottom-16 w-36 h-36 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Логотип */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-3xl shadow-xl shadow-purple-500/20 mb-3 animate-pulse-slow">
              AD
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Вход в Azadolg</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Закрытая финансовая ELO-система</p>
          </div>

          {authError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 mb-6 font-bold">
              ⚠️ {authError}
            </div>
          )}
          {authSuccess && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 mb-6 font-bold">
              ✅ {authSuccess}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Имя в игре</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Например, Роман"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {(authMode === 'login' || authMode === 'register') && (
              <>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Игровой Юзернейм (@username)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3.5 text-xs text-gray-500 font-bold">@</span>
                    <input
                      type="text"
                      required
                      placeholder="roman"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-9 pr-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition font-mono"
                    />
                  </div>
                </div>

                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                      <input
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500">Пароль</label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccess(''); }}
                        className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline"
                      >
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-10 pr-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                </div>
              </>
            )}

            {authMode === 'forgot' && (
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Укажите ваш @username</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-xs text-gray-500 font-bold">@</span>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl pl-9 pr-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            {authMode === 'reset' && (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Одноразовый код из Telegram-бота</label>
                  <input
                    type="text"
                    required
                    placeholder="Код подтверждения"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl px-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition text-center font-bold tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Новый надежный пароль</label>
                  <input
                    type="password"
                    required
                    placeholder="Новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl px-4 py-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-gradient-to-r from-purple-650 to-cyan-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-purple-500/20 shadow-md hover:opacity-90 transition disabled:opacity-50 mt-4 text-xs uppercase tracking-wider"
            >
              {authLoading ? 'Обработка...' 
                : authMode === 'login' ? 'Войти в игру' 
                : authMode === 'register' ? 'Создать аккаунт' 
                : authMode === 'forgot' ? 'Отправить код восстановления' 
                : 'Сохранить новый пароль'}
            </button>

            {authMode === 'login' && (
              <div className="text-center pt-2">
                <span className="text-[10px] text-gray-500">Еще нет аккаунта? </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccess(''); }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  Создать аккаунт
                </button>
              </div>
            )}

            {authMode === 'register' && (
              <div className="text-center pt-2">
                <span className="text-[10px] text-gray-500">Уже зарегистрированы? </span>
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-bold"
                >
                  Войти в аккаунт
                </button>
              </div>
            )}

            {(authMode === 'forgot' || authMode === 'reset') && (
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 mt-2 block hover:underline"
              >
                Вернуться на страницу входа
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  const debtFormUsers = users.filter(u => u._id !== currentUser._id);

  return (
    <Routes>
      <Route path="/" element={<Layout user={currentUser} onLogout={handleLogout} />}>
        {/* Дефолтный редирект */}
        <Route index element={<Navigate to="/feed" replace />} />
        
        <Route 
          path="feed" 
          element={
            <Feed
              user={currentUser}
              onUpdateUser={handleUserUpdate}
              onViewProfile={(id) => navigate(`/profile/${id}`)}
              leaderboardUsers={users}
              friends={friends}
              pendingRequests={pendingRequests}
              onAddFriend={handleAddFriend}
              onAcceptRequest={handleAcceptRequest}
              onRejectRequest={handleRejectRequest}
            />
          }
        />

        <Route 
          path="debts" 
          element={
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
          }
        />

        <Route 
          path="casino" 
          element={
            <Casino 
              user={currentUser} 
              onUpdateUser={handleUserUpdate} 
            />
          }
        />

        <Route 
          path="battlepass" 
          element={
            <BattlePass 
              user={currentUser} 
            />
          }
        />

        <Route 
          path="shop" 
          element={
            <Shop 
              user={currentUser} 
              onUpdateUser={handleUserUpdate} 
              onViewProfile={(id) => navigate(`/profile/${id}`)}
            />
          }
        />

        <Route 
          path="profile" 
          element={
            <Profile 
              userId={currentUser._id} 
              currentUser={currentUser} 
              onBack={null} 
            />
          }
        />

        <Route 
          path="profile/:id" 
          element={
            <Profile 
              userId={null} 
              currentUser={currentUser} 
              onBack={() => navigate(-1)} 
            />
          }
        />

        <Route 
          path="admin" 
          element={
            currentUser.role === 'admin' 
              ? <AdminPanel token={token} /> 
              : <Navigate to="/feed" replace />
          }
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); // Таблица лидеров
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fetchAppData = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      setLoading(true);
      const profile = await api.getMe();
      setCurrentUser(profile);

      const [lb, fList, reqList, debtsList] = await Promise.all([
        api.getLeaderboard(),
        api.getFriends(),
        api.getPendingFriendRequests(),
        api.getDebts(profile._id)
      ]);
      setUsers(lb);
      setFriends(fList);
      setPendingRequests(reqList);
      setDebts(debtsList);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка загрузки данных');
      if (err.message?.includes('401') || err.message?.includes('token')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchAppData();
    }
  }, [token, fetchAppData]);

  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    try {
      if (authMode === 'login') {
        const data = await api.login(username.trim(), password);
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setAuthMode('login');
      } else if (authMode === 'register') {
        await api.register(name.trim(), username.trim(), email.trim(), password);
        setAuthSuccess('Регистрация прошла успешно! Теперь вы можете войти.');
        setAuthMode('login');
        setPassword('');
      } else if (authMode === 'forgot') {
        const res = await api.request('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim() })
        });
        setAuthSuccess(res.message || 'Код отправлен в Telegram!');
        setAuthMode('reset');
      } else if (authMode === 'reset') {
        const res = await api.request('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), code: resetCode.trim(), newPassword })
        });
        setAuthSuccess(res.message || 'Пароль успешно сброшен!');
        setAuthMode('login');
        setPassword('');
        setResetCode('');
        setNewPassword('');
      }
    } catch (err) {
      setAuthError(err.message || 'Ошибка выполнения действия');
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
  };

  // ── Финансовые методы ──
  const handleCreateDebt = async (debtData) => {
    await api.createDebt(debtData);
    fetchAppData();
  };

  const handlePayDebt = async (debtId, amount) => {
    await api.payDebt(debtId, amount);
    fetchAppData();
  };

  const handleConfirmDebt = async (debtId) => {
    await api.confirmDebt(debtId);
    fetchAppData();
  };

  const handleDeclineDebt = async (debtId) => {
    await api.declineDebt(debtId);
    fetchAppData();
  };

  const handleForgiveDebt = async (debtId) => {
    await api.request(`/debts/${debtId}/forgive`, { method: 'POST' });
    fetchAppData();
  };

  const handleTransferDebt = async (debtId, targetDebtorId) => {
    await api.request(`/debts/${debtId}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ newDebtorId: targetDebtorId })
    });
    fetchAppData();
  };

  const handleWitnessDecision = async (debtId, action) => {
    await api.request(`/debts/${debtId}/witness`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    fetchAppData();
  };

  const handlePayProof = async (debtId, formData) => {
    await api.request(`/debts/${debtId}/pay-proof`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'none'
      }
    });
    fetchAppData();
  };

  // ── Социальные методы ──
  const handleAddFriend = async (friendUsername) => {
    const res = await api.addFriend(friendUsername);
    fetchAppData();
    return res;
  };

  const handleAcceptRequest = async (requestId) => {
    await api.acceptFriendRequest(requestId);
    fetchAppData();
  };

  const handleRejectRequest = async (requestId) => {
    await api.rejectFriendRequest(requestId);
    fetchAppData();
  };

  const handleUpdateTelegramId = async (telegramId) => {
    const updated = await api.updateTelegramId(telegramId);
    setCurrentUser(updated);
  };

  const handleUpdateAvatar = async (base64Avatar) => {
    const updated = await api.updateAvatar(base64Avatar);
    setCurrentUser(updated);
  };

  return (
    <BrowserRouter>
      <AppRoutes
        token={token}
        setToken={setToken}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        friends={friends}
        pendingRequests={pendingRequests}
        debts={debts}
        loading={loading}
        error={error}
        fetchAppData={fetchAppData}
        handleCreateDebt={handleCreateDebt}
        handlePayDebt={handlePayDebt}
        handleConfirmDebt={handleConfirmDebt}
        handleDeclineDebt={handleDeclineDebt}
        handleWitnessDecision={handleWitnessDecision}
        handlePayProof={handlePayProof}
        handleForgiveDebt={handleForgiveDebt}
        handleTransferDebt={handleTransferDebt}
        handleAddFriend={handleAddFriend}
        handleAcceptRequest={handleAcceptRequest}
        handleRejectRequest={handleRejectRequest}
        handleUpdateTelegramId={handleUpdateTelegramId}
        handleUpdateAvatar={handleUpdateAvatar}
        handleUserUpdate={handleUserUpdate}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        authSuccess={authSuccess}
        setAuthSuccess={setAuthSuccess}
        authLoading={authLoading}
        setAuthLoading={setAuthLoading}
        name={name}
        setName={setName}
        username={username}
        setUsername={setUsername}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        resetCode={resetCode}
        setResetCode={setResetCode}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        handleAuthSubmit={handleAuthSubmit}
        handleLogout={handleLogout}
      />
    </BrowserRouter>
  );
}
