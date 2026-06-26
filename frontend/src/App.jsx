import React, { useState, useEffect, useCallback } from 'react';
import { api } from './utils/api';
import Dashboard      from './components/Dashboard';
import Leaderboard    from './components/Leaderboard';
import DebtForm       from './components/DebtForm';
import DebtList       from './components/DebtList';
import CaseRoulette   from './components/CaseRoulette';
import { LogIn } from 'lucide-react';

export default function App() {
  const [users,       setUsers]       = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [debts,       setDebts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showRoulette, setShowRoulette] = useState(false);

  // ─── Загрузка данных ──────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      // Используем /api/leaderboard для получения списка, отсортированного по eloRating
      const data = await api.getLeaderboard();
      setUsers(data);
      // Обновляем данные текущего пользователя из свежего списка
      setCurrentUser(prev => prev ? (data.find(u => u._id === prev._id) ?? prev) : (data[0] ?? null));
    } catch (err) {
      console.error(err);
      setError('Не удалось подключиться к бэкенду. Убедитесь, что сервер запущен на порту 5000.');
    }
  }, []);

  const fetchDebts = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const data = await api.getDebts(userId);
      setDebts(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Первичная инициализация
  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchUsers();
      setLoading(false);
    })();
  }, [fetchUsers]);

  // Обновляем долги при смене пользователя
  useEffect(() => {
    if (currentUser) fetchDebts(currentUser._id);
  }, [currentUser, fetchDebts]);

  // ─── Обработчики ─────────────────────────────────────────────────────────

  const handleUserChange = (userId) => {
    const user = users.find(u => u._id === userId);
    if (user) setCurrentUser(user);
  };

  const handleCreateDebt = async (debtData) => {
    await api.createDebt(debtData);
    await fetchUsers();
    if (currentUser) await fetchDebts(currentUser._id);
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
      await fetchUsers();
      if (currentUser) await fetchDebts(currentUser._id);
    } catch (err) {
      alert(err.message || 'Ошибка при оплате');
    }
  };

  // Коллбэк для CaseRoulette — мгновенно обновляет UI без лишних запросов
  const handleUserUpdate = (updatedUser) => {
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => u._id === updatedUser._id ? { ...u, ...updatedUser } : u));
    // Также обновляем долги (мог измениться долг при debt_reduction)
    if (updatedUser._id) fetchDebts(updatedUser._id);
  };

  // Открытие кейса — вызывается из Dashboard (кнопка) или раздела рулетки
  const handleOpenCase = async () => {
    if (!currentUser) throw new Error('Пользователь не выбран');
    return await api.openCase(currentUser._id);
  };

  // ─── Баланс долгов ────────────────────────────────────────────────────────

  const totalOwesMe = debts
    .filter(d => d.creditor._id === currentUser?._id)
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = debts
    .filter(d => d.debtor._id === currentUser?._id)
    .reduce((sum, d) => sum + d.amount, 0);

  const netBalance = Number((totalOwesMe - totalIOwe).toFixed(2));

  // ─── Рендер ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex flex-col items-center justify-center text-gray-400 gap-4">
        <div className="w-12 h-12 border-4 border-t-purple-500 border-gray-800 rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-widest uppercase">Загрузка Azadolg...</p>
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
                  v2
                </span>
              </h1>
              <p className="text-[10px] text-gray-500">Геймифицированный трекер долгов</p>
            </div>
          </div>

          {/* Селектор пользователя */}
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-gray-500 hidden sm:block" />
            <span className="text-xs text-gray-400 hidden sm:block">Играете за:</span>
            <select
              value={currentUser?._id || ''}
              onChange={(e) => handleUserChange(e.target.value)}
              className="bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-gray-200 font-bold focus:outline-none focus:border-purple-500/40"
            >
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.name} — {u.eloRating} ELO</option>
              ))}
            </select>
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
              onOpenCaseClick={() => setShowRoulette(prev => !prev)}
            />

            {/* Рулетка кейсов (показываем/скрываем по кнопке в Dashboard) */}
            {showRoulette && currentUser && (
              <CaseRoulette
                user={currentUser}
                onOpenCase={handleOpenCase}
                onUserUpdate={handleUserUpdate}
              />
            )}

            {/* ELO-лидерборд (использует /api/leaderboard) */}
            <Leaderboard users={users} currentUser={currentUser} />
          </div>

          {/* ── Правая колонка (Форма + Списки долгов) ───────────── */}
          <div className="lg:col-span-7 space-y-8">
            <DebtForm
              users={users}
              currentUser={currentUser}
              onSubmit={handleCreateDebt}
            />

            <DebtList
              debts={debts}
              currentUser={currentUser}
              onPay={handlePayDebt}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
