import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, FileText, Trash2, Ban, RotateCcw,
  Key, Star, AlertTriangle, CheckCircle, X, RefreshCw,
  Search, ChevronDown, ChevronUp, Activity, Plus, Edit2, ListTodo
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function AdminPanel({ token }) {
  const [tab,      setTab]      = useState('users');   // 'users' | 'debts' | 'achievements' | 'logs' | 'quests'
  const [users,    setUsers]    = useState([]);
  const [usersWithQuests, setUsersWithQuests] = useState([]);
  const [debts,    setDebts]    = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [msg,      setMsg]      = useState({ text: '', type: 'ok' });
  
  const [distKarmaAmt,    setDistKarmaAmt]    = useState('');
  const [distKarmaReason, setDistKarmaReason] = useState('');
  
  // Модальные окна
  const [banModal, setBanModal] = useState(null);   // userId
  const [banReason,setBanReason]= useState('');
  const [pwModal,  setPwModal]  = useState(null);   // userId
  const [newPw,    setNewPw]    = useState('');
  
  // Выдача средств (карма)
  const [grantModal,      setGrantModal]      = useState(null); // null | { userId, name, type }
  const [stats,           setStats]           = useState(null);
  const [grantAmt,        setGrantAmt]        = useState('');
  const [grantReason,     setGrantReason]     = useState('');
  
  // Достижения
  const [achModal, setAchModal] = useState(null);   // null | 'create' | achievementObject
  const [achForm,  setAchForm]  = useState({
    slug: '', title: '', description: '', emoji: '🏆', rarity: 'common',
    trigger: 'custom', threshold: 1, isSecret: false, isRepeatable: false, isActive: true
  });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const flash = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000); };

  const fetchStats = async () => {
    try {
      const r = await fetch(`${API}/api/admin/stats`, { headers });
      const d = await r.json();
      if (r.ok) {
        setStats(d);
      }
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    }
  };

  const doResetJackpot = async () => {
    if (!window.confirm('Вы действительно хотите обнулить глобальный джекпот?')) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/system/jackpot/reset`, {
        method: 'POST',
        headers
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || 'Ошибка', 'err');
      flash(d.message);
      fetchStats();
    } catch (err) {
      flash('Ошибка при обнулении джекпота', 'err');
    } finally {
      setLoading(false);
    }
  };

  const doDistributeJackpot = async () => {
    if (!window.confirm('Вы действительно хотите принудительно разыграть джекпот?')) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/jackpot/distribute`, {
        method: 'POST',
        headers
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || d.message || 'Ошибка при розыгрыше джекпота', 'err');
      
      const winnerName = d.winner ? `${d.winner.name} (@${d.winner.username})` : 'кто-то';
      flash(`🎉 Джекпот разыгран! Победитель: ${winnerName}, Сумма: ${d.jackpotAmount} ✧`);
      fetchStats();
    } catch (err) {
      flash('Ошибка при принудительном розыгрыше джекпота', 'err');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users`, { headers });
      setUsers(await r.json());
      fetchStats();
    } finally { setLoading(false); }
  };

  const fetchUsersWithQuests = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users/quests`, { headers });
      setUsersWithQuests(await r.json());
      fetchStats();
    } finally { setLoading(false); }
  };

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/debts`, { headers });
      setDebts(await r.json());
      fetchStats();
    } finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/logs`, { headers });
      setLogs(await r.json());
    } finally { setLoading(false); }
  };

  const fetchAchievements = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/achievements`, { headers });
      setAchievements(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStats();
    if (tab === 'users') fetchUsers();
    else if (tab === 'debts') fetchDebts();
    else if (tab === 'achievements') fetchAchievements();
    else if (tab === 'logs') fetchLogs();
    else if (tab === 'quests') fetchUsersWithQuests();
  }, [tab]);

  // ── Действия ─────────────────────────────────────────────────────────────────
  const doBan = async () => {
    const r = await fetch(`${API}/api/admin/users/${banModal}/ban`, {
      method: 'POST', headers, body: JSON.stringify({ reason: banReason })
    });
    const d = await r.json();
    if (!r.ok) return flash(d.error, 'err');
    flash(d.message);
    setBanModal(null); setBanReason('');
    fetchUsers();
  };

  const doUnban = async (id) => {
    const r = await fetch(`${API}/api/admin/users/${id}/unban`, { method: 'POST', headers });
    const d = await r.json();
    flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
    if (r.ok) fetchUsers();
  };

  const doDeleteUser = async (id, name) => {
    if (!window.confirm(`Удалить пользователя "${name}"? Все его долги тоже удалятся!`)) return;
    const r = await fetch(`${API}/api/admin/users/${id}`, { method: 'DELETE', headers });
    const d = await r.json();
    flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
    if (r.ok) fetchUsers();
  };

  const doDeleteDebt = async (id) => {
    if (!window.confirm('Удалить этот долг навсегда?')) return;
    const r = await fetch(`${API}/api/admin/debts/${id}`, { method: 'DELETE', headers });
    const d = await r.json();
    flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
    if (r.ok) fetchDebts();
  };

  const doCancelTransaction = async (id) => {
    if (!window.confirm('Сделать РЕВЕРС (откат) этой транзакции? Балансы, ELO и Карма участников вернутся в исходное состояние.')) return;
    const r = await fetch(`${API}/api/admin/debts/${id}/cancel`, { method: 'POST', headers });
    const d = await r.json();
    flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
    if (r.ok) fetchDebts();
  };

  const doResetPw = async () => {
    if (!newPw || newPw.length < 6) return flash('Минимум 6 символов', 'err');
    const r = await fetch(`${API}/api/admin/users/${pwModal}/reset-password`, {
      method: 'POST', headers, body: JSON.stringify({ newPassword: newPw })
    });
    const d = await r.json();
    flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
    if (r.ok) { setPwModal(null); setNewPw(''); }
  };

  const doDistributeKarma = async () => {
    if (!distKarmaAmt || Number(distKarmaAmt) <= 0) {
      return flash('Укажите корректную сумму Кармы', 'err');
    }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users/distribute-karma`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: distKarmaAmt, reason: distKarmaReason })
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || 'Ошибка', 'err');
      flash(d.message);
      setDistKarmaAmt('');
      setDistKarmaReason('');
      fetchUsers();
    } catch (err) {
      flash('Ошибка при массовой раздаче', 'err');
    } finally {
      setLoading(false);
    }
  };

  const doGrantFunds = async () => {
    const amount = Number(grantAmt);
    if (!grantAmt || isNaN(amount) || amount === 0) {
      return flash('Укажите корректное количество (ненулевое число)', 'err');
    }
    setLoading(true);
    const modalType = grantModal.type || 'karma';
    const endpoint = modalType === 'elo' ? 'adjust-elo' : 'adjust-karma';
    try {
      const r = await fetch(`${API}/api/admin/users/${grantModal.userId}/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, reason: grantReason })
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || 'Ошибка', 'err');
      flash(d.message);
      setGrantModal(null);
      setGrantAmt('');
      setGrantReason('');
      fetchUsers();
    } catch (err) {
      flash(`Ошибка при изменении баланса ${modalType === 'elo' ? 'ELO' : 'Кармы'}`, 'err');
    } finally {
      setLoading(false);
    }
  };

  // CRUD Достижений
  const openCreateAchModal = () => {
    setAchForm({
      slug: '', title: '', description: '', emoji: '🏆', rarity: 'common',
      trigger: 'custom', threshold: 1, isSecret: false, isRepeatable: false, isActive: true
    });
    setAchModal('create');
  };

  const openEditAchModal = (ach) => {
    setAchForm({
      slug: ach.slug, title: ach.title, description: ach.description, emoji: ach.emoji, rarity: ach.rarity,
      trigger: ach.trigger, threshold: ach.threshold, isSecret: ach.isSecret, isRepeatable: ach.isRepeatable, isActive: ach.isActive
    });
    setAchModal(ach);
  };

  const doSaveAchievement = async (e) => {
    e.preventDefault();
    try {
      const isEdit = achModal !== 'create';
      const url = isEdit ? `${API}/api/admin/achievements/${achModal._id}` : `${API}/api/admin/achievements`;
      const method = isEdit ? 'PUT' : 'POST';

      const r = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(achForm)
      });
      const d = await r.json();
      if (!r.ok) return flash(d.error || 'Ошибка сохранения', 'err');

      flash(isEdit ? 'Достижение успешно обновлено!' : 'Достижение успешно создано!');
      setAchModal(null);
      fetchAchievements();
    } catch (err) {
      flash('Ошибка сервера при сохранении ачивки', 'err');
    }
  };

  const doDeleteAchievement = async (id) => {
    if (!window.confirm('Удалить это достижение? Прогресс игроков останется, но ачивка исчезнет из списков.')) return;
    try {
      const r = await fetch(`${API}/api/admin/achievements/${id}`, { method: 'DELETE', headers });
      const d = await r.json();
      flash(r.ok ? d.message : d.error, r.ok ? 'ok' : 'err');
      if (r.ok) fetchAchievements();
    } catch (err) {
      flash('Ошибка сервера при удалении', 'err');
    }
  };

  // ── Фильтрация ────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u._id.toString().includes(search)
  );

  const btn = 'px-3 py-1.5 rounded-lg text-[10px] font-bold transition';
  const tabBtn = (t) => `px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${tab === t ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;

  return (
    <div className="space-y-5 text-xs text-gray-300">
      
      {/* Заголовок */}
      <div className="bg-gradient-to-br from-[#1a0a2e] to-[#151c2c] border border-purple-500/30 rounded-2xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="font-black text-white text-lg">Панель администратора</h1>
          <p className="text-xs text-gray-400">Управление пользователями, ачивками, долгами и реверсы транзакций</p>
        </div>
      </div>

      {/* Flash-сообщение */}
      <AnimatePresence>
        {msg.text && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'ok' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {msg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Виджеты глобальной статистики и управление Джекпотом */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Кармы на руках */}
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Всего Кармы у пользователей</div>
            <div className="text-2xl font-black text-amber-400 mt-1">{stats ? stats.totalKarma.toLocaleString('ru') : '...'} ✧</div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Суммарный объем экономики Azadolg</p>
        </div>

        {/* Джекпот пул */}
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Глобальный Джекпот</div>
            <div className="text-2xl font-black text-cyan-400 mt-1">{stats ? stats.jackpotPool.toLocaleString('ru') : '...'} ✧</div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Накапливаемый пул системы</p>
        </div>

        {/* Управление Джекпотом */}
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Действия системы</div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={doDistributeJackpot}
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-black py-2.5 px-3 rounded-xl text-xs transition duration-200 uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-98"
              >
                Разыграть джекпот принудительно
              </button>
              <button
                onClick={doResetJackpot}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-2 rounded-xl text-xs transition"
              >
                Обнулить Джекпот
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">Управление еженедельным пулом розыгрыша</p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTab('users')} className={tabBtn('users')}><Users className="w-3.5 h-3.5" />Пользователи</button>
        <button onClick={() => setTab('debts')} className={tabBtn('debts')}><FileText className="w-3.5 h-3.5" />Транзакции и Реверсы</button>
        <button onClick={() => setTab('achievements')} className={tabBtn('achievements')}><Star className="w-3.5 h-3.5 text-yellow-500" />Achievements CRUD</button>
        <button onClick={() => setTab('quests')} className={tabBtn('quests')}><ListTodo className="w-3.5 h-3.5" />Квесты Игроков</button>
        <button onClick={() => setTab('logs')} className={tabBtn('logs')}><Activity className="w-3.5 h-3.5" />Лог действий</button>
        <button onClick={() => { 
            if (tab === 'users') fetchUsers(); 
            else if (tab === 'debts') fetchDebts(); 
            else if (tab === 'achievements') fetchAchievements();
            else if (tab === 'quests') fetchUsersWithQuests();
            else fetchLogs(); 
          }}
          className={`${btn} bg-gray-800 text-gray-400 hover:bg-gray-700 ml-auto`}
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── ПОЛЬЗОВАТЕЛИ ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Блок массовой раздачи Кармы */}
          <div className="bg-gradient-to-br from-[#111827] to-[#1f2937] border border-cyan-500/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-white flex items-center gap-1.5 text-sm">
                <span>🎁 Массовая раздача Кармы</span>
              </h3>
              <p className="text-gray-400 text-[10px]">Начислить Карму всем незаблокированным пользователям одновременно</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <input 
                type="number" 
                placeholder="Сумма Кармы" 
                value={distKarmaAmt}
                onChange={e => setDistKarmaAmt(e.target.value)}
                className="bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 w-32" 
              />
              <input 
                type="text" 
                placeholder="Причина раздачи..." 
                value={distKarmaReason}
                onChange={e => setDistKarmaReason(e.target.value)}
                className="bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 w-48" 
              />
              <button 
                onClick={doDistributeKarma}
                className="bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-black px-4 py-2 rounded-xl transition text-xs"
              >
                Раздать всем
              </button>
            </div>
          </div>

          <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Поиск пользователя..." value={search} onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none text-white focus:outline-none text-xs w-full" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Имя / Юзернейм</th>
                    <th className="px-4 py-3 text-left">Балансы</th>
                    <th className="px-4 py-3 text-left">Роль</th>
                    <th className="px-4 py-3 text-left">Статус</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u._id} className="border-t border-gray-800/50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-200">{u.name}</div>
                        <div className="text-gray-500 text-[10px]">@{u.username} | {u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>🔥 {u.eloRating} ELO</div>
                        <div className="text-[10px] text-emerald-400">✧ {u.karma} Карма</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : 'bg-gray-800 text-gray-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.isBanned ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                            🔨 БАН
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✅ Активен
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {u.role !== 'admin' && (
                            <>
                              {u.isBanned ? (
                                <button onClick={() => doUnban(u._id)} className={`${btn} bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/40`}>
                                  ✅ Разбан
                                </button>
                              ) : (
                                <button onClick={() => { setBanModal(u._id); setBanReason(''); }} className={`${btn} bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/40`}>
                                  <Ban className="w-3 h-3 inline" /> Бан
                                </button>
                              )}
                              <button onClick={() => { setGrantModal({ userId: u._id, name: u.name, type: 'karma' }); setGrantAmt(''); setGrantReason(''); }} className={`${btn} bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/40`}>
                                ✧ Карма
                              </button>
                              <button onClick={() => { setGrantModal({ userId: u._id, name: u.name, type: 'elo' }); setGrantAmt(''); setGrantReason(''); }} className={`${btn} bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/30`}>
                                🔥 ELO
                              </button>
                              <button onClick={() => { setPwModal(u._id); setNewPw(''); }} className={`${btn} bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/40`}>
                                <Key className="w-3 h-3 inline" /> Пароль
                              </button>
                              <button onClick={() => doDeleteUser(u._id, u.name)} className={`${btn} bg-gray-800 text-gray-500 hover:bg-red-900/30 hover:text-red-400`}>
                                <Trash2 className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500 text-sm">Нет пользователей</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ТРАНЗАКЦИИ И РЕВЕРСЫ ── */}
      {tab === 'debts' && (
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Участники / Описание</th>
                  <th className="px-4 py-3 text-left">Сумма</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-left">Дата</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {debts.map(d => (
                  <tr key={d._id} className="border-t border-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="text-gray-200 font-bold">{d.creditor?.name} <span className="text-gray-650">→</span> {d.debtor?.name}</div>
                      <div className="text-gray-500 text-[10px] mt-0.5">{d.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-red-400">{d.amount} ₸</div>
                      {d.promisedReturnAmount && (
                        <div className="text-[9px] text-purple-400">Оффер: {d.promisedReturnAmount} ₸</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        d.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : d.status === 'paid' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-gray-800 text-gray-500'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        {d.status === 'paid' && (
                          <button onClick={() => doCancelTransaction(d._id)} className={`${btn} bg-purple-650/20 text-purple-400 border border-purple-500/30 hover:bg-purple-650/40 flex items-center gap-1`}>
                            <RotateCcw className="w-3 h-3" /> Реверс
                          </button>
                        )}
                        <button onClick={() => doDeleteDebt(d._id)} className={`${btn} bg-red-650/15 text-red-400 border border-red-500/20 hover:bg-red-650/30`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {debts.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500 text-sm">Нет долгов</div>
            )}
          </div>
        </div>
      )}

      {/* ── CRUD ДОСТИЖЕНИЙ ── */}
      {tab === 'achievements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#151c2c] border border-gray-800 rounded-2xl p-4">
            <span className="text-gray-400 font-bold">Список игровых достижений</span>
            <button onClick={openCreateAchModal} className="bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Создать ачивку
            </button>
          </div>

          <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Ачивка</th>
                  <th className="px-4 py-3 text-left">Событие / Триггер</th>
                  <th className="px-4 py-3 text-left">Редкость</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {achievements.map(ach => (
                  <tr key={ach._id} className="border-t border-gray-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{ach.emoji}</span>
                        <div>
                          <div className="font-bold text-gray-200">{ach.title}</div>
                          <div className="text-gray-500 text-[10px] mt-0.5">{ach.description}</div>
                          {ach.isSecret && (
                            <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 py-0.5 rounded uppercase font-extrabold tracking-widest mt-1 inline-block">Секретно</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400 text-[10px]">
                      <div>{ach.trigger}</div>
                      <div className="text-gray-500">Порог: {ach.threshold}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        ach.rarity === 'legendary' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                        ach.rarity === 'rare' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                        'bg-gray-800 text-gray-400'
                      }`}>{ach.rarity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ach.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {ach.isActive ? 'Активна' : 'Выключена'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={() => openEditAchModal(ach)} className={`${btn} bg-cyan-600/10 text-cyan-400 hover:bg-cyan-600/20 border border-cyan-500/20`}>
                          <Edit2 className="w-3 h-3 inline" /> Изменить
                        </button>
                        <button onClick={() => doDeleteAchievement(ach._id)} className={`${btn} bg-red-600/15 text-red-400 hover:bg-red-600/30`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {achievements.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">Достижения не созданы</div>
            )}
          </div>
        </div>
      )}

      {/* ── КВЕСТЫ ИГРОКОВ ── */}
      {tab === 'quests' && (
        <div className="space-y-6">
          {/* Поиск и статистика */}
          <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus-within:border-cyan-500 w-full max-w-md">
              <Search className="w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Поиск игрока по имени/юзернейму..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none text-white focus:outline-none text-xs w-full" 
              />
            </div>
            <div className="text-gray-400 text-xs">
              Всего игроков с заданиями: <span className="font-bold text-cyan-400">{usersWithQuests.length}</span>
            </div>
          </div>

          {/* Сетка игроков */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {usersWithQuests
              .filter(u => 
                u.name.toLowerCase().includes(search.toLowerCase()) || 
                u.username.toLowerCase().includes(search.toLowerCase())
              )
              .map(u => (
                <div 
                  key={u._id} 
                  className="bg-[#151c2c] border border-gray-800 hover:border-gray-700 rounded-2xl p-5 shadow-xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    {/* Информация об игроке */}
                    <div className="flex items-center gap-3 border-b border-gray-800/50 pb-4 mb-4">
                      {u.avatar_url ? (
                        <img 
                          src={u.avatar_url} 
                          alt={u.name} 
                          className="w-10 h-10 rounded-full border border-gray-700 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-cyan-900/30 text-cyan-400 font-bold flex items-center justify-center text-sm border border-cyan-800/30">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
                          {u.name}
                          {u.role === 'admin' && (
                            <span className="bg-purple-600/10 text-purple-400 border border-purple-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">
                              Admin
                            </span>
                          )}
                        </h4>
                        <p className="text-gray-500 text-[10px]">@{u.username}</p>
                      </div>
                    </div>

                    {/* Раздел квестов */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        <span>Активные задания</span>
                        <span className="text-gray-500">{(u.tasks || []).length} / 3</span>
                      </div>

                      {(u.tasks || []).length === 0 ? (
                        <p className="text-gray-600 text-xs italic py-2">Нет активных заданий на этой неделе</p>
                      ) : (
                        (u.tasks || []).map(task => {
                          const percent = Math.min(100, Math.round((task.current_value / task.target_value) * 100));
                          const isCompleted = task.is_completed || task.current_value >= task.target_value;

                          return (
                            <div 
                              key={task._id} 
                              className={`p-3 rounded-xl border transition-colors ${
                                isCompleted 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100' 
                                  : 'bg-[#0b0f19]/40 border-gray-800 text-gray-300'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <div>
                                  <h5 className="font-bold text-xs flex items-center gap-1">
                                    {task.meta_data?.title || 'Задание'}
                                    {isCompleted && <span className="text-emerald-400 text-xs">✓</span>}
                                  </h5>
                                  <p className="text-gray-400 text-[10px] leading-relaxed mt-0.5">
                                    {task.meta_data?.description || 'Описание отсутствует'}
                                  </p>
                                </div>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                }`}>
                                  +{task.reward_karma} ✧
                                </span>
                              </div>

                              {/* Прогресс-бар */}
                              <div className="mt-2.5">
                                <div className="flex justify-between text-[9px] font-medium text-gray-400 mb-1">
                                  <span>Прогресс</span>
                                  <span>{task.current_value} / {task.target_value}</span>
                                </div>
                                <div className="w-full bg-[#0b0f19] h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isCompleted 
                                        ? 'bg-emerald-500' 
                                        : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-800/40 flex justify-between items-center text-[10px] text-gray-500">
                    <span>🔥 ELO: {u.eloRating}</span>
                    <span>✧ Карма: {u.karma}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── ЛОГ ДЕЙСТВИЙ ── */}
      {tab === 'logs' && (
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Дата</th>
                  <th className="px-4 py-3 text-left">Администратор</th>
                  <th className="px-4 py-3 text-left">Действие</th>
                  <th className="px-4 py-3 text-left">Причина / Подробности</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l._id} className="border-t border-gray-800/50">
                    <td className="px-4 py-3 text-gray-500">{new Date(l.createdAt).toLocaleString('ru-RU')}</td>
                    <td className="px-4 py-3 text-gray-300 font-bold">{l.admin?.name || '?'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-bold uppercase">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{l.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500 text-sm">Лог пуст</div>
            )}
          </div>
        </div>
      )}

      {/* ── Модал БАН ── */}
      <AnimatePresence>
        {banModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#151c2c] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-black text-white mb-4 flex items-center gap-2"><Ban className="w-4 h-4 text-red-400" /> Заблокировать пользователя</h3>
              <textarea value={banReason} onChange={e => setBanReason(e.target.value)} rows={3}
                placeholder="Причина бана (необязательно)..."
                className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-red-500/60 mb-4 resize-none" />
              <div className="flex gap-2">
                <button onClick={doBan} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 rounded-xl text-sm transition">Заблокировать</button>
                <button onClick={() => setBanModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition">Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Модал СБРОС ПАРОЛЯ ── */}
      <AnimatePresence>
        {pwModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#151c2c] border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-black text-white mb-4 flex items-center gap-2"><Key className="w-4 h-4 text-amber-400" /> Сброс пароля</h3>
              <input type="text" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="Новый временный пароль (мин. 6 символов)"
                className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:border-amber-500/60 mb-4" />
              <div className="flex gap-2">
                <button onClick={doResetPw} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl text-sm transition">Сбросить пароль</button>
                <button onClick={() => setPwModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition">Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Модал НАЧИСЛЕНИЯ КАРМЫ ИЛИ ELO ── */}
      <AnimatePresence>
        {grantModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#151c2c] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-black text-white mb-4 flex items-center gap-2">
                {grantModal.type === 'elo' ? '🔥 Редактировать ELO' : '💰 Редактировать Карму'}
              </h3>
              <p className="text-gray-400 text-[10px] mb-3">Пользователь: <span className="text-white font-bold">{grantModal.name}</span></p>

              <div className="mb-4">
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                  {grantModal.type === 'elo' ? 'Изменение рейтинга ELO (число)' : 'Изменение Кармы (число)'}
                </label>
                <input type="number" value={grantAmt} onChange={e => setGrantAmt(e.target.value)}
                  placeholder={grantModal.type === 'elo' ? 'Например, +50 или -100' : 'Например, +1000 или -500'}
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>

              <div className="mb-4">
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Причина</label>
                <input type="text" value={grantReason} onChange={e => setGrantReason(e.target.value)}
                  placeholder="Причина изменения..."
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500" />
              </div>

              <div className="flex gap-2">
                <button onClick={doGrantFunds} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-black py-2.5 rounded-xl text-sm transition">
                  {grantModal.type === 'elo' ? 'Изменить ELO' : 'Изменить Карму'}
                </button>
                <button onClick={() => setGrantModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition">Отмена</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Модал Создания/Редактирования Ачивки ── */}
      <AnimatePresence>
        {achModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-[#151c2c] border border-cyan-550/30 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  {achModal === 'create' ? 'Создать Достижение' : 'Редактировать Достижение'}
                </h3>
                <button onClick={() => setAchModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={doSaveAchievement} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Уникальный Slug (индификатор в коде)</label>
                  <input
                    type="text"
                    disabled={achModal !== 'create'}
                    required
                    value={achForm.slug}
                    onChange={e => setAchForm({ ...achForm, slug: e.target.value })}
                    placeholder="Например: declined_loan_streak"
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Emoji</label>
                    <input
                      type="text"
                      required
                      value={achForm.emoji}
                      onChange={e => setAchForm({ ...achForm, emoji: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-center text-lg focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Название ачивки</label>
                    <input
                      type="text"
                      required
                      value={achForm.title}
                      onChange={e => setAchForm({ ...achForm, title: e.target.value })}
                      placeholder="Например: ПИДАРАС НЕ ДАЮЩИЙ"
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Описание / Суть выполнения</label>
                  <textarea
                    required
                    value={achForm.description}
                    onChange={e => setAchForm({ ...achForm, description: e.target.value })}
                    rows={2}
                    placeholder="Описание за что выдается ачивка"
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-250 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Редкость</label>
                    <select
                      value={achForm.rarity}
                      onChange={e => setAchForm({ ...achForm, rarity: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="common">Common (Обычное)</option>
                      <option value="rare">Rare (Редкое)</option>
                      <option value="legendary">Legendary (Легендарное)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Триггер (автоматический код)</label>
                    <select
                      value={achForm.trigger}
                      onChange={e => setAchForm({ ...achForm, trigger: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="custom">Ручное награждение</option>
                      <option value="declined_loan_streak">Серия отклонений долгов</option>
                      <option value="overdue_365">Просрочка более 365 дней</option>
                      <option value="active_debts_count">Счётчик активных долгов</option>
                      <option value="debts_paid_count">Счётчик выплаченных долгов</option>
                      <option value="forgiven_count">Счётчик прощенных долгов</option>
                      <option value="witnesses_count">Счётчик свидетельских решений</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Порог для выполнения (число)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={achForm.threshold}
                    onChange={e => setAchForm({ ...achForm, threshold: Number(e.target.value) })}
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-between items-center gap-4 bg-black/20 p-3 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={achForm.isSecret} onChange={e => setAchForm({ ...achForm, isSecret: e.target.checked })} />
                    <span>Секретная</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={achForm.isRepeatable} onChange={e => setAchForm({ ...achForm, isRepeatable: e.target.checked })} />
                    <span>Многократная</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={achForm.isActive} onChange={e => setAchForm({ ...achForm, isActive: e.target.checked })} />
                    <span>Активная</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-black py-2.5 rounded-xl text-sm transition">Сохранить</button>
                  <button type="button" onClick={() => setAchModal(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-2.5 rounded-xl text-sm transition">Отмена</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
