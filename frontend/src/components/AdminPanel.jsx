import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, FileText, Trash2, Ban, RotateCcw,
  Key, Star, AlertTriangle, CheckCircle, X, RefreshCw,
  Search, ChevronDown, ChevronUp, Activity, Plus, Edit2, ListTodo
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function AdminPanel({ token }) {
  const [tab, setTab] = useState('users'); // 'users' | 'debts' | 'achievements' | 'logs' | 'quests'
  const [users, setUsers] = useState([]);
  const [usersWithQuests, setUsersWithQuests] = useState([]);
  const [debts, setDebts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ text: '', type: 'ok' });

  const [distKarmaAmt, setDistKarmaAmt] = useState('');
  const [distKarmaReason, setDistKarmaReason] = useState('');

  // Modals
  const [banModal, setBanModal] = useState(null); // userId
  const [banReason, setBanReason] = useState('');
  const [pwModal, setPwModal] = useState(null); // userId
  const [newPw, setNewPw] = useState('');
  const [grantModal, setGrantModal] = useState(null); // null | { userId, name, type }
  const [grantAmt, setGrantAmt] = useState('');
  const [grantReason, setGrantReason] = useState('');

  const [stats, setStats] = useState(null);

  // Achievements form
  const [achModal, setAchModal] = useState(null); // null | 'create' | achievementObject
  const [achForm, setAchForm] = useState({
    slug: '', title: '', description: '', emoji: '🏆', rarity: 'common',
    trigger: 'custom', threshold: 1, isSecret: false, isRepeatable: false, isActive: true
  });

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const flash = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000);
  };

  // Safe fetch helper that catches exceptions and prevents JSON parsing issues
  const safeFetch = async (url, options = {}) => {
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } else {
        const text = await res.text();
        return { ok: res.ok, status: res.status, error: text || 'Неизвестная ошибка сервера' };
      }
    } catch (err) {
      console.error(`[safeFetch] Error requesting ${url}:`, err);
      return { ok: false, error: err.message || 'Ошибка сети' };
    }
  };

  const fetchStats = async () => {
    const res = await safeFetch(`${API}/api/admin/stats`);
    if (res.ok && res.data) {
      setStats(res.data);
    } else {
      console.error('Ошибка загрузки статистики:', res.error);
    }
  };

  const doResetJackpot = async () => {
    if (!window.confirm('Вы действительно хотите обнулить глобальный джекпот?')) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/system/jackpot/reset`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Джекпот успешно обнулен');
      fetchStats();
    } else {
      flash(res.data?.error || res.error || 'Ошибка при обнулении джекпота', 'err');
    }
  };

  const doDistributeJackpot = async () => {
    if (!window.confirm('Вы действительно хотите принудительно разыграть джекпот?')) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/jackpot/distribute`, { method: 'POST' });
    setLoading(false);
    if (res.ok && res.data) {
      const winnerName = res.data.winner ? `${res.data.winner.name} (@${res.data.winner.username})` : 'кто-то';
      flash(`🎉 Джекпот разыгран! Победитель: ${winnerName}, Сумма: ${res.data.jackpotAmount} ✧`);
      fetchStats();
    } else {
      flash(res.data?.error || res.data?.message || res.error || 'Ошибка при розыгрыше джекпота', 'err');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setUsers(res.data);
      fetchStats();
    } else {
      setUsers([]);
      flash(res.data?.error || res.error || 'Ошибка получения списка пользователей', 'err');
    }
  };

  const fetchUsersWithQuests = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/quests`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setUsersWithQuests(res.data);
      fetchStats();
    } else {
      setUsersWithQuests([]);
      flash(res.data?.error || res.error || 'Ошибка получения квестов игроков', 'err');
    }
  };

  const fetchDebts = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/debts`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setDebts(res.data);
      fetchStats();
    } else {
      setDebts([]);
      flash(res.data?.error || res.error || 'Ошибка получения транзакций', 'err');
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/logs`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setLogs(res.data);
    } else {
      setLogs([]);
      flash(res.data?.error || res.error || 'Ошибка получения логов', 'err');
    }
  };

  const fetchAchievements = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/achievements`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setAchievements(res.data);
    } else {
      setAchievements([]);
      flash(res.data?.error || res.error || 'Ошибка получения достижений', 'err');
    }
  };

  useEffect(() => {
    fetchStats();
    if (tab === 'users') fetchUsers();
    else if (tab === 'debts') fetchDebts();
    else if (tab === 'achievements') fetchAchievements();
    else if (tab === 'logs') fetchLogs();
    else if (tab === 'quests') fetchUsersWithQuests();
  }, [tab]);

  // Actions
  const doBan = async () => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/${banModal}/ban`, {
      method: 'POST',
      body: JSON.stringify({ reason: banReason })
    });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Пользователь успешно заблокирован');
      setBanModal(null);
      setBanReason('');
      fetchUsers();
    } else {
      flash(res.data?.error || res.error || 'Ошибка при блокировке пользователя', 'err');
    }
  };

  const doUnban = async (id) => {
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/${id}/unban`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Пользователь разблокирован');
      fetchUsers();
    } else {
      flash(res.data?.error || res.error || 'Ошибка при разблокировке пользователя', 'err');
    }
  };

  const doDeleteUser = async (id, name) => {
    if (!window.confirm(`Удалить пользователя "${name}"? Все его долги тоже удалятся!`)) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/${id}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Пользователь успешно удален');
      fetchUsers();
    } else {
      flash(res.data?.error || res.error || 'Ошибка при удалении пользователя', 'err');
    }
  };

  const doDeleteDebt = async (id) => {
    if (!window.confirm('Удалить этот долг навсегда?')) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/debts/${id}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Транзакция успешно удалена');
      fetchDebts();
    } else {
      flash(res.data?.error || res.error || 'Ошибка при удалении транзакции', 'err');
    }
  };

  const doCancelTransaction = async (id) => {
    if (!window.confirm('Сделать РЕВЕРС (откат) этой транзакции? Балансы, ELO и Карма участников вернутся в исходное состояние.')) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/debts/${id}/cancel`, { method: 'POST' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Реверс транзакции успешно произведен');
      fetchDebts();
    } else {
      flash(res.data?.error || res.error || 'Ошибка реверса транзакции', 'err');
    }
  };

  const doResetPw = async () => {
    if (!newPw || newPw.length < 6) return flash('Минимум 6 символов', 'err');
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/${pwModal}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: newPw })
    });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Пароль успешно изменен');
      setPwModal(null);
      setNewPw('');
    } else {
      flash(res.data?.error || res.error || 'Ошибка сброса пароля', 'err');
    }
  };

  const doDistributeKarma = async () => {
    if (!distKarmaAmt || Number(distKarmaAmt) <= 0) {
      return flash('Укажите корректную сумму Кармы', 'err');
    }
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/users/distribute-karma`, {
      method: 'POST',
      body: JSON.stringify({ amount: Number(distKarmaAmt), reason: distKarmaReason })
    });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Карма распределена');
      setDistKarmaAmt('');
      setDistKarmaReason('');
      fetchUsers();
    } else {
      flash(res.data?.error || res.error || 'Ошибка массовой раздачи кармы', 'err');
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
    const res = await safeFetch(`${API}/api/admin/users/${grantModal.userId}/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ amount, reason: grantReason })
    });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Баланс успешно изменен');
      setGrantModal(null);
      setGrantAmt('');
      setGrantReason('');
      fetchUsers();
    } else {
      flash(res.data?.error || res.error || 'Ошибка изменения баланса', 'err');
    }
  };

  const openCreateAchModal = () => {
    setAchForm({
      slug: '', title: '', description: '', emoji: '🏆', rarity: 'common',
      trigger: 'custom', threshold: 1, isSecret: false, isRepeatable: false, isActive: true
    });
    setAchModal('create');
  };

  const openEditAchModal = (ach) => {
    setAchForm({
      slug: ach.slug || '',
      title: ach.title || '',
      description: ach.description || '',
      emoji: ach.emoji || '🏆',
      rarity: ach.rarity || 'common',
      trigger: ach.trigger || 'custom',
      threshold: ach.threshold || 1,
      isSecret: !!ach.isSecret,
      isRepeatable: !!ach.isRepeatable,
      isActive: ach.isActive !== false
    });
    setAchModal(ach);
  };

  const doSaveAchievement = async (e) => {
    e.preventDefault();
    setLoading(true);
    const isEdit = achModal !== 'create';
    const url = isEdit ? `${API}/api/admin/achievements/${achModal._id}` : `${API}/api/admin/achievements`;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await safeFetch(url, {
      method,
      body: JSON.stringify(achForm)
    });
    setLoading(false);
    if (res.ok) {
      flash(isEdit ? 'Достижение обновлено!' : 'Достижение создано!');
      setAchModal(null);
      fetchAchievements();
    } else {
      flash(res.data?.error || res.error || 'Ошибка сохранения достижения', 'err');
    }
  };

  const doDeleteAchievement = async (id) => {
    if (!window.confirm('Удалить это достижение? Прогресс игроков останется, но ачивка исчезнет из списков.')) return;
    setLoading(true);
    const res = await safeFetch(`${API}/api/admin/achievements/${id}`, { method: 'DELETE' });
    setLoading(false);
    if (res.ok) {
      flash(res.data?.message || 'Достижение удалено');
      fetchAchievements();
    } else {
      flash(res.data?.error || res.error || 'Ошибка удаления достижения', 'err');
    }
  };

  // Safe filtration to prevent TypeErrors on null/undefined fields
  const filteredUsers = (Array.isArray(users) ? users : []).filter(u => {
    if (!u) return false;
    const nameStr = (u.name || '').toLowerCase();
    const userStr = (u.username || '').toLowerCase();
    const emailStr = (u.email || '').toLowerCase();
    const idStr = (u._id || '').toString();
    const q = search.toLowerCase();

    return !search || nameStr.includes(q) || userStr.includes(q) || emailStr.includes(q) || idStr.includes(q);
  });

  const btn = 'px-3 py-1.5 rounded-lg text-[10px] font-bold transition select-none flex items-center justify-center gap-1 active:scale-95';
  const tabBtn = (t) => `px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
    tab === t 
      ? 'bg-gradient-to-r from-purple-650 to-indigo-650 text-white border-purple-500 shadow-lg shadow-purple-500/10' 
      : 'bg-[#151c2c]/40 text-gray-400 border-gray-800 hover:bg-[#151c2c]/80 hover:text-white'
  }`;

  return (
    <div className="space-y-6 text-xs text-gray-300">
      {/* Header card with glassmorphism */}
      <div className="bg-gradient-to-br from-[#1a0a2e]/60 via-[#151c2c]/40 to-black/30 border border-purple-500/20 rounded-2xl p-5 flex items-center gap-3 backdrop-blur-md relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="w-11 h-11 bg-purple-600/15 border border-purple-500/35 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/5">
          <Shield className="w-5 h-5 text-purple-400 animate-pulse-slow" />
        </div>
        <div>
          <h1 className="font-black text-white text-lg tracking-tight">Панель администратора</h1>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-bold">Система центрального управления Azadolg</p>
        </div>
      </div>

      {/* Floating Status Notification */}
      <AnimatePresence>
        {msg.text && (
          <motion.div 
            initial={{ opacity: 0, y: -15, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-xl ${
              msg.type === 'ok' 
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' 
                : 'bg-red-500/15 border border-red-500/30 text-red-400'
            }`}
          >
            {msg.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{msg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Economy stats with glassmorphic cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Karma supply card */}
        <div className="bg-[#151c2c]/50 backdrop-blur-sm border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Всего Кармы в игре</div>
            <div className="text-3xl font-black text-amber-400 mt-1 select-all">
              {stats ? stats.totalKarma.toLocaleString('ru') : '...'} <span className="text-lg font-normal">✧</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 border-t border-gray-800/30 pt-2">Суммарный объем экономики Azadolg</p>
        </div>

        {/* Global Jackpot card */}
        <div className="bg-[#151c2c]/50 backdrop-blur-sm border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Глобальный Джекпот</div>
            <div className="text-3xl font-black text-cyan-400 mt-1 select-all">
              {stats ? stats.jackpotPool.toLocaleString('ru') : '...'} <span className="text-lg font-normal">✧</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 border-t border-gray-800/30 pt-2">Накапливаемый пул еженедельного розыгрыша</p>
        </div>

        {/* Actions panel card */}
        <div className="bg-[#151c2c]/50 backdrop-blur-sm border border-gray-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div>
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">Оперативные действия</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={doDistributeJackpot}
                disabled={loading}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black py-2.5 px-3 rounded-xl text-[10px] transition duration-200 uppercase tracking-wider shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-40"
              >
                Разыграть
              </button>
              <button
                onClick={doResetJackpot}
                disabled={loading}
                className="bg-red-650/20 border border-red-500/30 hover:bg-red-650/40 text-red-400 font-bold py-2 px-3 rounded-xl text-[10px] transition uppercase tracking-wider active:scale-95 disabled:opacity-40"
              >
                Обнулить пул
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 border-t border-gray-800/30 pt-2">Управление джекпотом системы</p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex flex-wrap gap-2 border-b border-gray-850 pb-3">
        <button onClick={() => setTab('users')} className={tabBtn('users')}><Users className="w-3.5 h-3.5" />Пользователи</button>
        <button onClick={() => setTab('debts')} className={tabBtn('debts')}><FileText className="w-3.5 h-3.5" />Транзакции и Реверсы</button>
        <button onClick={() => setTab('achievements')} className={tabBtn('achievements')}><Star className="w-3.5 h-3.5 text-yellow-500" />Достижения CRUD</button>
        <button onClick={() => setTab('quests')} className={tabBtn('quests')}><ListTodo className="w-3.5 h-3.5" />Квесты Игроков</button>
        <button onClick={() => setTab('logs')} className={tabBtn('logs')}><Activity className="w-3.5 h-3.5" />Лог действий</button>
        
        <button onClick={() => { 
            if (tab === 'users') fetchUsers(); 
            else if (tab === 'debts') fetchDebts(); 
            else if (tab === 'achievements') fetchAchievements();
            else if (tab === 'quests') fetchUsersWithQuests();
            else fetchLogs(); 
          }}
          disabled={loading}
          className={`${btn} bg-slate-800 border border-slate-700/80 text-gray-400 hover:bg-slate-700 ml-auto h-[34px] w-[34px]`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
        </button>
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          {/* Mass Karma Distribution banner */}
          <div className="bg-gradient-to-br from-[#131b2e] to-[#151c2c] border border-cyan-500/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div>
              <h3 className="font-black text-cyan-400 flex items-center gap-1.5 text-sm uppercase tracking-wide">
                <span>🎁 Массовая раздача Кармы</span>
              </h3>
              <p className="text-gray-400 text-[10px] mt-0.5">Равномерно начислить Карму всем активным (незабаненным) игрокам</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <input 
                type="number" 
                placeholder="Сумма Кармы" 
                value={distKarmaAmt}
                onChange={e => setDistKarmaAmt(e.target.value)}
                className="bg-[#0b0f19] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 w-32 font-bold" 
              />
              <input 
                type="text" 
                placeholder="Укажите причину..." 
                value={distKarmaReason}
                onChange={e => setDistKarmaReason(e.target.value)}
                className="bg-[#0b0f19] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 w-48" 
              />
              <button 
                onClick={doDistributeKarma}
                disabled={loading}
                className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-4 py-2.5 rounded-xl transition text-xs uppercase tracking-wider active:scale-95 disabled:opacity-40"
              >
                Раздать
              </button>
            </div>
          </div>

          <div className="bg-[#151c2c]/40 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-800/80 flex items-center gap-2 bg-[#151c2c]/10">
              <Search className="w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Поиск игрока по имени, логину, e-mail или ID..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none text-white focus:outline-none text-xs w-full placeholder-gray-600 font-medium" 
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0b0f19]/40 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Имя / Юзернейм</th>
                    <th className="px-4 py-3 text-left font-bold">Балансы</th>
                    <th className="px-4 py-3 text-left font-bold">Роль</th>
                    <th className="px-4 py-3 text-left font-bold">Статус</th>
                    <th className="px-4 py-3 text-right font-bold">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u._id} className="border-t border-gray-800/40 hover:bg-[#151c2c]/20 transition">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-200">{u.name}</div>
                        <div className="text-gray-500 text-[10px] font-mono mt-0.5">@{u.username} | {u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <div className="text-amber-400 font-bold">🔥 {u.eloRating || 1000} ELO</div>
                        <div className="text-cyan-400 text-[10px] mt-0.5">✧ {u.karma || 0} Карма</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          u.role === 'admin' 
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                            : 'bg-slate-800 text-gray-400 border border-slate-700/50'
                        }`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.isBanned ? (
                          <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm shadow-red-500/5">
                            🔨 БАН
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ✅ Активен
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {u.role !== 'admin' && (
                            <>
                              {u.isBanned ? (
                                <button 
                                  onClick={() => doUnban(u._id)} 
                                  className={`${btn} bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20`}
                                >
                                  Разбан
                                </button>
                              ) : (
                                <button 
                                  onClick={() => { setBanModal(u._id); setBanReason(''); }} 
                                  className={`${btn} bg-red-650/15 text-red-400 border border-red-500/20 hover:bg-red-650/25`}
                                >
                                  <Ban className="w-3 h-3" /> Бан
                                </button>
                              )}
                              <button 
                                onClick={() => { setGrantModal({ userId: u._id, name: u.name, type: 'karma' }); setGrantAmt(''); setGrantReason(''); }} 
                                className={`${btn} bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-600/20`}
                              >
                                ✧ Карма
                              </button>
                              <button 
                                onClick={() => { setGrantModal({ userId: u._id, name: u.name, type: 'elo' }); setGrantAmt(''); setGrantReason(''); }} 
                                className={`${btn} bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20`}
                              >
                                🔥 ELO
                              </button>
                              <button 
                                onClick={() => { setPwModal(u._id); setNewPw(''); }} 
                                className={`${btn} bg-slate-800 text-gray-300 border border-slate-700/80 hover:bg-slate-700`}
                              >
                                <Key className="w-3 h-3" /> Пароль
                              </button>
                              <button 
                                onClick={() => doDeleteUser(u._id, u.name)} 
                                className={`${btn} bg-slate-800 text-gray-500 hover:bg-red-950/20 hover:text-red-400 border border-transparent hover:border-red-900/35`}
                              >
                                <Trash2 className="w-3 h-3" />
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
                <div className="text-center py-10 text-gray-500 text-xs font-semibold">Пользователи не найдены</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {tab === 'debts' && (
        <div className="bg-[#151c2c]/40 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/40 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Участники / Описание</th>
                  <th className="px-4 py-3 text-left font-bold">Сумма</th>
                  <th className="px-4 py-3 text-left font-bold">Статус</th>
                  <th className="px-4 py-3 text-left font-bold">Дата создания</th>
                  <th className="px-4 py-3 text-right font-bold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(debts) ? debts : []).map(d => {
                  if (!d) return null;
                  return (
                    <tr key={d._id} className="border-t border-gray-800/40 hover:bg-[#151c2c]/20 transition">
                      <td className="px-4 py-3">
                        <div className="text-gray-200 font-bold">
                          {d.creditor?.name || 'Удален'} <span className="text-gray-650 mx-1">→</span> {d.debtor?.name || 'Удален'}
                        </div>
                        <div className="text-gray-500 text-[10px] mt-0.5 font-medium">{d.description || 'Без описания'}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <div className="text-red-400 font-bold">{d.amount} ₸</div>
                        {d.promisedReturnAmount && d.promisedReturnAmount !== d.amount && (
                          <div className="text-[9px] text-purple-400 mt-0.5">Оффер: {d.promisedReturnAmount} ₸</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          d.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : d.status === 'paid' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-slate-800 text-gray-500 border border-slate-700/50'
                        }`}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-medium">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('ru-RU') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          {d.status === 'paid' && (
                            <button 
                              onClick={() => doCancelTransaction(d._id)} 
                              className={`${btn} bg-purple-650/15 text-purple-400 border border-purple-500/20 hover:bg-purple-650/25`}
                            >
                              <RotateCcw className="w-3 h-3" /> Реверс
                            </button>
                          )}
                          <button 
                            onClick={() => doDeleteDebt(d._id)} 
                            className={`${btn} bg-red-650/15 text-red-400 border border-red-500/20 hover:bg-red-650/25`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(Array.isArray(debts) ? debts : []).length === 0 && !loading && (
              <div className="text-center py-10 text-gray-500 font-semibold">Список транзакций пуст</div>
            )}
          </div>
        </div>
      )}

      {/* ── ACHIEVEMENTS TAB ── */}
      {tab === 'achievements' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#151c2c]/40 border border-gray-800 rounded-2xl p-4 shadow-xl">
            <span className="text-gray-300 font-black uppercase tracking-wider text-[10px]">Список игровых достижений</span>
            <button 
              onClick={openCreateAchModal} 
              className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black px-3.5 py-2 rounded-xl flex items-center gap-1 text-xs uppercase tracking-wider"
            >
              <Plus className="w-3.5 h-3.5" /> Создать ачивку
            </button>
          </div>

          <div className="bg-[#151c2c]/40 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/40 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Ачивка / Описание</th>
                  <th className="px-4 py-3 text-left font-bold">Триггер события</th>
                  <th className="px-4 py-3 text-left font-bold">Редкость</th>
                  <th className="px-4 py-3 text-left font-bold">Статус</th>
                  <th className="px-4 py-3 text-right font-bold">Действия</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(achievements) ? achievements : []).map(ach => {
                  if (!ach) return null;
                  return (
                    <tr key={ach._id} className="border-t border-gray-800/40 hover:bg-[#151c2c]/20 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl select-none filter drop-shadow-[0_0_4px_rgba(255,255,255,0.1)]">{ach.emoji}</span>
                          <div>
                            <div className="font-bold text-gray-200">{ach.title}</div>
                            <div className="text-gray-500 text-[10px] mt-0.5 font-medium">{ach.description}</div>
                            {ach.isSecret && (
                              <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-black tracking-widest uppercase mt-1 inline-block">Секретно</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-400 text-[10px]">
                        <div className="font-bold">{ach.trigger}</div>
                        <div className="text-gray-500 mt-0.5">Порог: {ach.threshold}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          ach.rarity === 'legendary' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          ach.rarity === 'rare' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                          'bg-slate-850 text-gray-400 border border-slate-700/50'
                        }`}>{ach.rarity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider ${
                          ach.isActive 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {ach.isActive ? 'Активна' : 'Выкл'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 justify-end">
                          <button 
                            onClick={() => openEditAchModal(ach)} 
                            className={`${btn} bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-600/20`}
                          >
                            <Edit2 className="w-3 h-3" /> Редактировать
                          </button>
                          <button 
                            onClick={() => doDeleteAchievement(ach._id)} 
                            className={`${btn} bg-red-650/15 text-red-400 border border-red-500/20 hover:bg-red-650/25`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(Array.isArray(achievements) ? achievements : []).length === 0 && !loading && (
              <div className="text-center py-10 text-gray-500 font-semibold">Список достижений пуст</div>
            )}
          </div>
        </div>
      )}

      {/* ── QUESTS TAB ── */}
      {tab === 'quests' && (
        <div className="space-y-5">
          <div className="bg-[#151c2c]/40 border border-gray-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-2 bg-[#0b0f19] border border-gray-850 rounded-xl px-3.5 py-2.5 text-xs text-white focus-within:border-cyan-500 w-full max-w-md">
              <Search className="w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Поиск игрока по имени или юзернейму..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent border-none text-white focus:outline-none text-xs w-full placeholder-gray-600 font-medium" 
              />
            </div>
            <div className="text-gray-400 text-xs font-bold">
              Всего игроков с заданиями: <span className="text-cyan-400 font-bold">{(Array.isArray(usersWithQuests) ? usersWithQuests : []).length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(Array.isArray(usersWithQuests) ? usersWithQuests : [])
              .filter(u => {
                if (!u) return false;
                const nameStr = (u.name || '').toLowerCase();
                const userStr = (u.username || '').toLowerCase();
                const q = search.toLowerCase();
                return !search || nameStr.includes(q) || userStr.includes(q);
              })
              .map(u => (
                <div 
                  key={u._id} 
                  className="bg-[#151c2c]/40 border border-gray-800/80 hover:border-gray-700/80 rounded-2xl p-5 shadow-xl transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    {/* User short info */}
                    <div className="flex items-center gap-3 border-b border-gray-800/40 pb-3 mb-3">
                      {u.avatar_url ? (
                        <img 
                          src={u.avatar_url} 
                          alt={u.name} 
                          className="w-9 h-9 rounded-full border border-gray-700 object-cover select-none"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-cyan-950/20 text-cyan-400 font-bold flex items-center justify-center text-xs border border-cyan-800/30 select-none">
                          {(u.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-gray-200 text-sm flex items-center gap-1.5 leading-none">
                          {u.name}
                          {u.role === 'admin' && (
                            <span className="bg-purple-600/10 text-purple-400 border border-purple-500/20 text-[7px] px-1.5 py-0.5 rounded font-black uppercase">
                              Admin
                            </span>
                          )}
                        </h4>
                        <p className="text-gray-500 text-[10px] mt-0.5">@{u.username}</p>
                      </div>
                    </div>

                    {/* Active tasks list */}
                    <div className="space-y-3.5">
                      <div className="flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                        <span>Активные квесты</span>
                        <span>{(Array.isArray(u.tasks) ? u.tasks : []).length} / 3</span>
                      </div>

                      {(Array.isArray(u.tasks) ? u.tasks : []).length === 0 ? (
                        <p className="text-gray-650 text-xs italic py-2">Нет активных квестов на текущую неделю</p>
                      ) : (
                        (Array.isArray(u.tasks) ? u.tasks : []).map(task => {
                          if (!task) return null;
                          const percent = Math.min(100, Math.round(((task.current_value || 0) / (task.target_value || 1)) * 100));
                          const isCompleted = !!task.is_completed || (task.current_value >= task.target_value);

                          return (
                            <div 
                              key={task._id} 
                              className={`p-3 rounded-xl border transition-colors ${
                                isCompleted 
                                  ? 'bg-emerald-950/15 border-emerald-500/30 text-emerald-100' 
                                  : 'bg-[#0b0f19]/30 border-gray-800 text-gray-300'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2 mb-1.5">
                                <div>
                                  <h5 className="font-bold text-xs flex items-center gap-1">
                                    {task.meta_data?.title || 'Задание'}
                                    {isCompleted && <span className="text-emerald-400 text-xs font-bold">✓</span>}
                                  </h5>
                                  <p className="text-gray-400 text-[10px] leading-tight mt-0.5">
                                    {task.meta_data?.description || 'Нет описания'}
                                  </p>
                                </div>
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                  isCompleted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-yellow-400 border border-slate-700/60'
                                }`}>
                                  +{task.reward_karma || 0} ✧
                                </span>
                              </div>

                              <div className="mt-2.5">
                                <div className="flex justify-between text-[8px] font-bold text-gray-400 mb-1">
                                  <span>Выполнено</span>
                                  <span>{task.current_value || 0} / {task.target_value || 1}</span>
                                </div>
                                <div className="w-full bg-[#0b0f19] h-1 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${
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

                  <div className="mt-4 pt-3 border-t border-gray-850 flex justify-between items-center text-[9px] text-gray-500 font-bold uppercase">
                    <span>🔥 ELO: {u.eloRating}</span>
                    <span>✧ Карма: {u.karma}</span>
                  </div>
                </div>
              ))}
          </div>
          {(Array.isArray(usersWithQuests) ? usersWithQuests : []).length === 0 && !loading && (
            <div className="text-center py-10 text-gray-500 font-semibold">Список квестов пуст</div>
          )}
        </div>
      )}

      {/* ── ACTION LOGS TAB ── */}
      {tab === 'logs' && (
        <div className="bg-[#151c2c]/40 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/40 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Дата / Время</th>
                  <th className="px-4 py-3 text-left font-bold">Администратор</th>
                  <th className="px-4 py-3 text-left font-bold">Действие</th>
                  <th className="px-4 py-3 text-left font-bold">Причина / Метаданные</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(logs) ? logs : []).map(l => {
                  if (!l) return null;
                  return (
                    <tr key={l._id} className="border-t border-gray-800/40 hover:bg-[#151c2c]/20 transition">
                      <td className="px-4 py-3 text-gray-500 font-medium">
                        {l.createdAt ? new Date(l.createdAt).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-bold">
                        {l.admin?.name || '—'} <span className="text-[10px] text-gray-500 font-mono">@{l.admin?.username}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[9px] font-black uppercase tracking-wide">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-medium">{l.reason || 'Причина не указана'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(Array.isArray(logs) ? logs : []).length === 0 && !loading && (
              <div className="text-center py-10 text-gray-500 font-semibold">Журнал логов действий пуст</div>
            )}
          </div>
        </div>
      )}

      {/* ── BAN MODAL ── */}
      <AnimatePresence>
        {banModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#151c2c] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                <Ban className="w-4 h-4 text-red-400" /> Блокировка игрока
              </h3>
              <textarea 
                value={banReason} 
                onChange={e => setBanReason(e.target.value)} 
                rows={3}
                placeholder="Укажите подробную причину блокировки..."
                className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-gray-250 focus:outline-none focus:border-red-500/50 mb-4 resize-none placeholder-gray-600 focus:ring-1 focus:ring-red-500/10" 
              />
              <div className="flex gap-2">
                <button 
                  onClick={doBan} 
                  disabled={loading}
                  className="flex-1 bg-red-650 hover:bg-red-500 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 disabled:opacity-40"
                >
                  Блокировать
                </button>
                <button 
                  onClick={() => setBanModal(null)} 
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition uppercase active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PASSWORD RESET MODAL ── */}
      <AnimatePresence>
        {pwModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#151c2c] border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                <Key className="w-4 h-4 text-amber-400" /> Задать временный пароль
              </h3>
              <input 
                type="text" 
                value={newPw} 
                onChange={e => setNewPw(e.target.value)}
                placeholder="Минимум 6 символов..."
                className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-amber-500/60 mb-4 placeholder-gray-600 focus:ring-1 focus:ring-amber-500/10 font-bold" 
              />
              <div className="flex gap-2">
                <button 
                  onClick={doResetPw} 
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 disabled:opacity-40"
                >
                  Сбросить
                </button>
                <button 
                  onClick={() => setPwModal(null)} 
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition uppercase active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FUNDS ADJUST MODAL ── */}
      <AnimatePresence>
        {grantModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 10 }}
              className="bg-[#151c2c] border border-cyan-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
            >
              <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wide border-b border-gray-800 pb-3">
                {grantModal.type === 'elo' ? '🔥 Изменить рейтинг ELO' : '💰 Изменить баланс Кармы'}
              </h3>
              <p className="text-gray-400 text-[10px] mb-4">Игрок: <span className="text-white font-bold">{grantModal.name}</span></p>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Сумма / Количество (со знаком + или -)</label>
                  <input 
                    type="number" 
                    value={grantAmt} 
                    onChange={e => setGrantAmt(e.target.value)}
                    placeholder={grantModal.type === 'elo' ? 'Например, +50 или -20' : 'Например, +1000 или -250'}
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold" 
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Обоснование начисления</label>
                  <input 
                    type="text" 
                    value={grantReason} 
                    onChange={e => setGrantReason(e.target.value)}
                    placeholder="Укажите причину для аудита..."
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500" 
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={doGrantFunds} 
                  disabled={loading}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 disabled:opacity-40"
                >
                  Выполнить
                </button>
                <button 
                  onClick={() => setGrantModal(null)} 
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition uppercase active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ACHIEVEMENT SAVE MODAL ── */}
      <AnimatePresence>
        {achModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#151c2c] border border-cyan-500/20 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <div className="flex justify-between items-center mb-5 border-b border-gray-850 pb-3">
                <h3 className="font-black text-white text-sm flex items-center gap-2 uppercase tracking-wide">
                  <Star className="w-5 h-5 text-yellow-500" />
                  {achModal === 'create' ? 'Создать Достижение' : 'Редактировать Достижение'}
                </h3>
                <button onClick={() => setAchModal(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={doSaveAchievement} className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Уникальный Slug-код (API-идентификатор)</label>
                  <input
                    type="text"
                    disabled={achModal !== 'create'}
                    required
                    value={achForm.slug}
                    onChange={e => setAchForm({ ...achForm, slug: e.target.value })}
                    placeholder="Например: empty_promises_5"
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-40"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Emoji</label>
                    <input
                      type="text"
                      required
                      value={achForm.emoji}
                      onChange={e => setAchForm({ ...achForm, emoji: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-center text-lg focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Название достижения</label>
                    <input
                      type="text"
                      required
                      value={achForm.title}
                      onChange={e => setAchForm({ ...achForm, title: e.target.value })}
                      placeholder="Например: Сказочный пиздабол"
                      className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Описание / Условия получения</label>
                  <textarea
                    required
                    value={achForm.description}
                    onChange={e => setAchForm({ ...achForm, description: e.target.value })}
                    rows={2}
                    placeholder="Коротко опишите условия выдачи..."
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Редкость</label>
                    <select
                      value={achForm.rarity}
                      onChange={e => setAchForm({ ...achForm, rarity: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl p-3.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="common">Common (Обычное)</option>
                      <option value="rare">Rare (Редкое)</option>
                      <option value="epic">Epic (Эпическое)</option>
                      <option value="legendary">Legendary (Легендарное)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Системный триггер</label>
                    <select
                      value={achForm.trigger}
                      onChange={e => setAchForm({ ...achForm, trigger: e.target.value })}
                      className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl p-3.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="custom">Ручная выдача</option>
                      <option value="declined_loan_streak">Серия отклонений</option>
                      <option value="overdue_365">Просрочка 365+ дней</option>
                      <option value="active_debts_count">Кол-во активных долгов</option>
                      <option value="debts_paid_count">Кол-во выплаченных долгов</option>
                      <option value="forgiven_count">Кол-во прощенных долгов</option>
                      <option value="witnesses_count">Кол-во подтверждений</option>
                      <option value="karma_transferred">Перевод кармы (сумма)</option>
                      <option value="negative_karma">Отрицательная карма</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-gray-500 block mb-1">Количественный порог для триггера</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={achForm.threshold}
                    onChange={e => setAchForm({ ...achForm, threshold: Number(e.target.value) })}
                    className="w-full bg-[#0b0f19] border border-gray-850 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                  />
                </div>

                <div className="flex justify-between items-center gap-3 bg-[#0b0f19]/80 p-3 rounded-xl border border-gray-850">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-gray-400">
                    <input 
                      type="checkbox" 
                      className="rounded bg-[#0b0f19] border-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                      checked={achForm.isSecret} 
                      onChange={e => setAchForm({ ...achForm, isSecret: e.target.checked })} 
                    />
                    <span>Секретная</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-gray-400">
                    <input 
                      type="checkbox" 
                      className="rounded bg-[#0b0f19] border-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                      checked={achForm.isRepeatable} 
                      onChange={e => setAchForm({ ...achForm, isRepeatable: e.target.checked })} 
                    />
                    <span>Повторяемая</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-gray-400">
                    <input 
                      type="checkbox" 
                      className="rounded bg-[#0b0f19] border-gray-800 text-cyan-500 focus:ring-0 focus:ring-offset-0"
                      checked={achForm.isActive} 
                      onChange={e => setAchForm({ ...achForm, isActive: e.target.checked })} 
                    />
                    <span>Активна</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 disabled:opacity-40"
                  >
                    Сохранить
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setAchModal(null)} 
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold py-2.5 rounded-xl text-xs transition uppercase active:scale-95"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
