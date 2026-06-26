import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, FileText, Trash2, Ban, RotateCcw,
  Key, Star, AlertTriangle, CheckCircle, X, RefreshCw,
  Search, ChevronDown, ChevronUp, Activity
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

export default function AdminPanel({ token }) {
  const [tab,      setTab]      = useState('users');   // 'users' | 'debts' | 'logs'
  const [users,    setUsers]    = useState([]);
  const [debts,    setDebts]    = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [msg,      setMsg]      = useState({ text: '', type: 'ok' });
  const [banModal, setBanModal] = useState(null);   // userId
  const [banReason,setBanReason]= useState('');
  const [pwModal,  setPwModal]  = useState(null);   // userId
  const [newPw,    setNewPw]    = useState('');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const flash = (text, type = 'ok') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: 'ok' }), 4000); };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users`, { headers });
      setUsers(await r.json());
    } finally { setLoading(false); }
  };

  const fetchDebts = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/debts`, { headers });
      setDebts(await r.json());
    } finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/logs`, { headers });
      setLogs(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    else if (tab === 'debts') fetchDebts();
    else fetchLogs();
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
    if (!window.confirm('Удалить этот долг?')) return;
    const r = await fetch(`${API}/api/admin/debts/${id}`, { method: 'DELETE', headers });
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

  // ── Фильтрация ────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const btn = 'px-3 py-1.5 rounded-lg text-[10px] font-bold transition';
  const tabBtn = (t) => `px-4 py-2 rounded-xl text-xs font-bold transition ${tab === t ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`;

  return (
    <div className="space-y-5">
      {/* Заголовок */}
      <div className="bg-gradient-to-br from-[#1a0a2e] to-[#151c2c] border border-purple-500/30 rounded-2xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="font-black text-white text-lg">Панель администратора</h1>
          <p className="text-xs text-gray-400">Управление пользователями, долгами и аудит действий</p>
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

      {/* Вкладки */}
      <div className="flex gap-2">
        <button onClick={() => setTab('users')} className={tabBtn('users')}><Users className="w-3.5 h-3.5 inline mr-1" />Пользователи</button>
        <button onClick={() => setTab('debts')} className={tabBtn('debts')}><FileText className="w-3.5 h-3.5 inline mr-1" />Долги</button>
        <button onClick={() => setTab('logs')} className={tabBtn('logs')}><Activity className="w-3.5 h-3.5 inline mr-1" />Лог действий</button>
        <button onClick={() => { if (tab === 'users') fetchUsers(); else if (tab === 'debts') fetchDebts(); else fetchLogs(); }}
          className={`${btn} bg-gray-800 text-gray-400 hover:bg-gray-700 ml-auto`}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* ── ПОЛЬЗОВАТЕЛИ ── */}
      {tab === 'users' && (
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input type="text" placeholder="Поиск по имени, @username, email..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-gray-200 focus:outline-none placeholder-gray-600" />
            <span className="text-[10px] text-gray-600">{filteredUsers.length} из {users.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Пользователь</th>
                  <th className="px-4 py-3 text-left">ELO / Карма</th>
                  <th className="px-4 py-3 text-left">Роль</th>
                  <th className="px-4 py-3 text-left">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u._id} className={`border-t border-gray-800/50 ${u.isBanned ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-200">{u.name}</div>
                      <div className="text-gray-500">@{u.username} · {u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="text-yellow-400 font-bold">{u.eloRating} ELO</span>
                      <br /><span className="text-emerald-400">{u.karma} ₸</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-gray-800 text-gray-400'}`}>
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
      )}

      {/* ── ДОЛГИ ── */}
      {tab === 'debts' && (
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#0b0f19]/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">Участники</th>
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
                      <div className="text-gray-200">{d.creditor?.name} <span className="text-gray-600">→</span> {d.debtor?.name}</div>
                      <div className="text-gray-600 text-[10px]">{d.description}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-red-400">{d.originalAmount} ₸</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        d.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : d.status === 'paid' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                        : 'bg-gray-800 text-gray-500'
                      }`}>{d.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(d.createdAt).toLocaleDateString('ru-RU')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => doDeleteDebt(d._id)} className={`${btn} bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/40`}>
                          <Trash2 className="w-3 h-3 inline" /> Удалить
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
                  <th className="px-4 py-3 text-left">Причина</th>
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
    </div>
  );
}
