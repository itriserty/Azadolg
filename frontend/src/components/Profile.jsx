import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Shield, Eye, EyeOff, Trophy, Award, MessageSquare, Send, Trash2, Coins, Flame, Heart, DollarSign, Users, CheckCircle2, Lock, ChevronRight, Camera } from 'lucide-react';
import DebtList from './DebtList';

const SKIN_STYLES = {
  default: 'bg-[#151c2c]/80 text-white',
  vaporwave_skin: 'bg-gradient-to-br from-indigo-950 via-purple-900 to-pink-900 text-pink-100 border border-pink-500/20 shadow-pink-500/5 shadow-xl',
  cyberpunk_skin: 'bg-gradient-to-br from-gray-950 via-slate-900 to-black text-cyan-200 border border-yellow-500/20 shadow-yellow-500/5 shadow-xl',
  matrix_skin: 'bg-[#050c05] text-green-300 border border-green-500/20 shadow-green-500/5 shadow-xl font-mono',
  galaxy_skin: 'bg-gradient-to-br from-black via-slate-950 to-indigo-950 text-indigo-200 border border-indigo-500/20 shadow-indigo-500/5 shadow-xl animate-pulse-slow'
};

const FRAME_STYLES = {
  none: 'border-2 border-gray-700',
  neon_red_frame: 'border-4 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] ring-2 ring-red-300',
  neon_cyan_frame: 'border-4 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] ring-2 ring-cyan-300',
  gold_frame: 'border-4 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.9)] ring-2 ring-yellow-300 ring-offset-1 ring-offset-black',
  diamond_frame: 'border-4 border-indigo-400 shadow-[0_0_25px_rgba(129,140,248,0.95)] ring-2 ring-sky-300 ring-offset-1 ring-offset-black border-double'
};

export default function Profile({ userId, currentUser, onBack, onViewProfile, onUpdateAvatar, onUpdateUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const targetUserId = id || userId;
  const avatarInputRef = useRef(null);

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  
  // Активная подвкладка профиля
  const [activeTab, setActiveTab] = useState('debts');
  
  // Комментарии
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Витрина и приватность
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState([]);
  const [updatingShowcase, setUpdatingShowcase] = useState(false);
  
  // Продажа предмета
  const [sellItem, setSellItem] = useState(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellingLoading, setSellingLoading] = useState(false);

  // Перевод кармы
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  // История баланса (Elo/Karma)
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchBalanceHistory = async (page = 1) => {
    try {
      setHistoryLoading(true);
      const data = await api.request(`/users/me/balance-history?page=${page}&limit=10`);
      setBalanceHistory(data.logs || []);
      setHistoryPage(data.pagination?.page || 1);
      setHistoryTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      console.error('Ошибка загрузки истории баланса:', err);
    } finally {
      setHistoryLoading(false);
    }
  };


  const getAchievementProgress = (ach) => {
    if (!profileData || !profileData.user) return 0;
    const user = profileData.user;
    const debts = profileData.debts || [];
    const triggerType = ach.trigger;
    
    if (triggerType === 'declined_loan_streak') {
      return user.consecutiveDeclines || 0;
    }
    if (triggerType === 'active_debts_count') {
      return debts.filter(d => d.debtor?._id?.toString() === user._id?.toString() && d.status === 'active').length;
    }
    if (triggerType === 'overdue_365') {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      return debts.filter(d => d.debtor?._id?.toString() === user._id?.toString() && d.status === 'active' && new Date(d.dueDate) < oneYearAgo).length;
    }
    if (triggerType === 'debts_paid_count') {
      return user.stats?.totalDebtsPaid || 0;
    }
    if (triggerType === 'forgiven_count') {
      return user.stats?.totalDebtsForgivenByMe || 0;
    }
    if (triggerType === 'witnesses_count') {
      return user.stats?.totalDebtsWitnessed || 0;
    }
    if (triggerType === 'empty_promises') {
      const now = new Date();
      return debts.filter(d => d.debtor?._id?.toString() === user._id?.toString() && d.status === 'active' && new Date(d.dueDate) < now).length;
    }
    return 0;
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.request(`/users/${targetUserId}/profile`);
      setProfileData(data);
      setSelectedShowcase((data.user?.achievementShowcase || []).map(a => a._id || a));
      setError('');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) {
      fetchProfile();
    }
  }, [targetUserId]);

  useEffect(() => {
    if (activeTab === 'balance_history' && isSelf) {
      fetchBalanceHistory(1);
    }
  }, [activeTab, isSelf]);


  const isSelf = currentUser && currentUser._id === targetUserId;

  const handleTogglePrivacy = async () => {
    try {
      const data = await api.request('/users/profile/privacy', { method: 'POST' });
      setProfileData(prev => ({
        ...prev,
        user: { ...prev.user, isPrivateProfile: data.isPrivateProfile }
      }));
    } catch (err) {
      alert(err.message || 'Ошибка изменения настроек приватности');
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const newComment = await api.request(`/users/${targetUserId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: commentText })
      });
      setProfileData(prev => ({
        ...prev,
        comments: [newComment, ...prev.comments]
      }));
      setCommentText('');
    } catch (err) {
      alert(err.message || 'Не удалось отправить комментарий');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Удалить этот комментарий со стены?')) return;
    try {
      await api.request(`/users/${targetUserId}/comments/${commentId}`, { method: 'DELETE' });
      setProfileData(prev => ({
        ...prev,
        comments: prev.comments.filter(c => c._id !== commentId)
      }));
    } catch (err) {
      alert(err.message || 'Не удалось удалить комментарий');
    }
  };

  const handleSaveShowcase = async () => {
    setUpdatingShowcase(true);
    try {
      const data = await api.request('/users/profile/showcase', {
        method: 'POST',
        body: JSON.stringify({ achievementIds: selectedShowcase })
      });
      setProfileData(prev => ({
        ...prev,
        user: { ...prev.user, achievementShowcase: data.user.achievementShowcase }
      }));
      setShowcaseOpen(false);
    } catch (err) {
      alert(err.message || 'Не удалось обновить витрину');
    } finally {
      setUpdatingShowcase(false);
    }
  };

  const toggleAchievementInShowcase = (id) => {
    setSelectedShowcase(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 4) {
        alert('Максимальный размер витрины — 4 достижения');
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleListMarketItem = async () => {
    if (!sellPrice || Number(sellPrice) <= 0) {
      alert('Укажите корректную цену в Карме');
      return;
    }
    setSellingLoading(true);
    try {
      await api.request('/market/sell', {
        method: 'POST',
        body: JSON.stringify({ itemId: sellItem.itemId, price: Math.round(Number(sellPrice)) })
      });
      alert('Предмет успешно выставлен на торговую площадку!');
      setSellItem(null);
      setSellPrice('');
      fetchProfile(); // Перезагружаем профиль
    } catch (err) {
      alert(err.message || 'Ошибка продажи предмета');
    } finally {
      setSellingLoading(false);
    }
  };

  const handleTransferKarma = async (e) => {
    e.preventDefault();
    const amount = parseInt(transferAmount, 10);
    if (!amount || amount <= 0) {
      setTransferError('Сумма перевода должна быть целым положительным числом');
      return;
    }
    setTransferLoading(true);
    setTransferError('');
    try {
      await api.transferKarma(targetUserId, amount);
      alert(`Вы успешно перевели ${amount} Кармы! С учетом комиссии 10% получателю зачислено ${Math.floor(amount * 0.9)} Кармы.`);
      setTransferModalOpen(false);
      setTransferAmount('');
      fetchProfile();
      if (onUpdateUser) {
        onUpdateUser({ ...currentUser, karma: currentUser.karma - amount });
      }
    } catch (err) {
      setTransferError(err.message || 'Ошибка при переводе Кармы');
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        Загрузка Steam-профиля...
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-2xl text-center">
        <p className="text-red-400 font-bold mb-4">{error || 'Профиль недоступен'}</p>
        <button onClick={onBack} className="px-4 py-2 bg-gray-800 text-gray-200 rounded-xl font-bold">Назад</button>
      </div>
    );
  }

  const { user, canView, comments, debts, inventory, allAchievements = [] } = profileData || {};
  const currentSkin = user?.activeProfileSkin || 'default';
  const currentFrame = user?.activeProfileFrame || 'none';
  const elo = user?.eloRating || 1000;

  const getRankLabel = (eloRating) => {
    if (eloRating < 1000) return 'Железо';
    if (eloRating < 1100) return 'Бронза';
    if (eloRating < 1200) return 'Серебро';
    if (eloRating < 1300) return 'Золото';
    if (eloRating < 1400) return 'Платина';
    if (eloRating < 1500) return 'Алмаз';
    return 'Global Elite';
  };

  return (
    <div className={`rounded-3xl p-6 transition-all duration-500 ${SKIN_STYLES[currentSkin] || SKIN_STYLES.default}`}>
      
      {/* Шапка профиля */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-gray-800/40">
        <div className="flex flex-col md:flex-row items-center gap-5">
          {/* Аватар в рамке */}
          <div className="relative shrink-0 group">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
              alt={user.name}
              className={`w-24 h-24 rounded-2xl object-cover ${FRAME_STYLES[currentFrame] || FRAME_STYLES.none}`}
            />
            {isSelf && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  title="Изменить аватар"
                  className="absolute inset-0 rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
                >
                  {avatarUploading ? (
                    <div className="w-5 h-5 border-2 border-t-white border-gray-600 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-white" />
                      <span className="text-[9px] text-white font-bold">Изменить</span>
                    </>
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      setAvatarError('Файл слишком большой. Максимум 2 МБ.');
                      return;
                    }
                    setAvatarUploading(true);
                    setAvatarError('');
                    try {
                      const formData = new FormData();
                      formData.append('avatar', file);

                      const data = await api.updateAvatar(formData);
                      if (onUpdateAvatar) onUpdateAvatar(data.user);
                      fetchProfile();
                    } catch (err) {
                      setAvatarError(err.message || 'Ошибка загрузки аватара');
                    } finally {
                      setAvatarUploading(false);
                    }
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>

          {avatarError && (
            <p className="text-[10px] text-red-400 font-bold mt-1 text-center">{avatarError}</p>
          )}

          <div className="text-center md:text-left">
            <h1 className="text-2xl font-black tracking-tight">{user.name}</h1>
            <p className="text-sm opacity-60">@{user.username}</p>

            {/* Уровень и полоска опыта */}
            <div className="mt-2.5 flex flex-col sm:flex-row items-center gap-2 justify-center md:justify-start">
              <span className="bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider">
                LVL {user.level || 1}
              </span>
              <div className="w-28 bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50 relative" title={`${user.exp || 0} / ${(user.level || 1) * 100} EXP`}>
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, ((user.exp || 0) / ((user.level || 1) * 100)) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 font-bold">
                {user.exp || 0} / {(user.level || 1) * 100} EXP
              </span>
            </div>
            
            {/* Значки/Ачивки рядом с аватаркой */}
            {user?.badges && user.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 justify-center md:justify-start">
                {user.badges.map((badge, idx) => {
                  let badgeLabel = 'Участник';
                  let badgeColor = 'bg-gray-800/50 border-gray-700 text-gray-300';
                  if (badge.includes('gold')) {
                    badgeLabel = 'Чемпион 🥇';
                    badgeColor = 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
                  } else if (badge.includes('silver')) {
                    badgeLabel = 'Топ-2 🥈';
                    badgeColor = 'bg-gray-300/10 border-gray-300/30 text-gray-300';
                  } else if (badge.includes('bronze')) {
                    badgeLabel = 'Топ-3 🥉';
                    badgeColor = 'bg-amber-600/10 border-amber-600/30 text-amber-500';
                  }
                  return (
                    <span key={idx} className={`text-[9px] border px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeColor}`}>
                      {badgeLabel}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ELO и кнопки приватности */}
        <div className="flex flex-col items-center md:items-end gap-3">
          <div className="text-center md:text-right">
            <div className="text-2xl font-black flex items-center gap-1.5 justify-center md:justify-end text-cyan-400">
              <Flame className="w-6 h-6 animate-pulse" /> {elo} ELO
            </div>
            <div className="text-xs font-bold opacity-75">{getRankLabel(elo)}</div>
          </div>

          <div className="flex gap-2">
            {isSelf && (
              <button
                onClick={handleTogglePrivacy}
                className="flex items-center gap-1 text-[11px] font-bold py-1.5 px-3 rounded-xl border border-gray-800 bg-[#0b0f19]/80 hover:bg-[#151c2c] transition"
              >
                {user.isPrivateProfile ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    Только для друзей
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    Публичный
                  </>
                )}
              </button>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="text-[11px] font-bold py-1.5 px-3 rounded-xl border border-gray-800 bg-[#0b0f19]/80 hover:bg-gray-800 transition"
              >
                Назад
              </button>
            )}
            {!isSelf && (
              <button
                onClick={() => setTransferModalOpen(true)}
                className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 transition"
              >
                <Send className="w-3.5 h-3.5 animate-pulse" />
                Отправить Карму
              </button>
            )}
          </div>
        </div>
      </div>

      {!canView ? (
        /* Закрытый профиль */
        <div className="mt-8 bg-gradient-to-br from-[#151c2c]/85 to-black/80 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-44 h-44 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-44 h-44 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <Lock className="w-16 h-16 text-red-400 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-bounce" />
          <h2 className="text-xl font-black text-white tracking-tight uppercase">Профиль скрыт</h2>
          <p className="text-xs text-gray-405 max-w-md mx-auto mt-3 leading-relaxed">
            Вы должны находиться в <b>списке друзей</b> этого игрока, чтобы просматривать его достижения, инвентарь, список друзей и историю долгов.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => {
                if (onBack) onBack();
                else navigate('/feed');
              }}
              className="bg-gradient-to-r from-purple-650 to-cyan-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg hover:opacity-90 transition text-xs uppercase tracking-wider"
            >
              Вернуться в ленту
            </button>
          </div>
        </div>
      ) : (
        /* Открытый профиль */
        <div className="mt-6 space-y-6">
          
          {/* Игровые метрики */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-4 text-center">
              <div className="text-xs opacity-50 uppercase tracking-widest text-[9px] font-bold">Карма</div>
              <div className="text-lg font-black text-amber-400 mt-1">{user.karma || 0} ✧</div>
            </div>
            <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-4 text-center">
              <div className="text-xs opacity-50 uppercase tracking-widest text-[9px] font-bold">Стрик Побед</div>
              <div className="text-lg font-black text-red-400 mt-1">{user.winStreak || 0} 🔥</div>
            </div>
            <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-4 text-center">
              <div className="text-xs opacity-50 uppercase tracking-widest text-[9px] font-bold">Закрыто долгов</div>
              <div className="text-lg font-black text-emerald-400 mt-1">{user.stats?.totalDebtsPaid || 0}</div>
            </div>
          </div>

          {/* Вкладки меню */}
          <div className="flex flex-wrap gap-2 border-b border-gray-800/60 pb-3 mt-4">
            {[
              { id: 'debts', label: 'История долгов', icon: DollarSign },
              isSelf && { id: 'balance_history', label: 'История рейтинга', icon: Coins },
              { id: 'inventory', label: 'Инвентарь', icon: Award },
              { id: 'achievements', label: 'Достижения', icon: Trophy },
              {id: 'friends', label: `Друзья (${user?.friends?.length || 0})`, icon: Users },
              { id: 'comments', label: 'Стена', icon: MessageSquare }
            ].filter(Boolean).map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-purple-650/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-400 shadow-md'
                      : 'bg-[#0b0f19]/40 border border-transparent text-gray-400 hover:text-white hover:bg-gray-800/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>


          {/* Контент активной вкладки */}
          <div className="mt-4">
            {activeTab === 'debts' && (
              <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-3xl p-5">
                <h2 className="text-sm font-black uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  История долгов (Граф Друзей)
                </h2>
                {debts && debts.length > 0 ? (
                  <DebtList
                    debts={debts}
                    currentUser={currentUser}
                    onPayProof={async (debtId, fd) => {
                      await api.request(`/debts/${debtId}/pay-proof`, {
                        method: 'POST',
                        body: fd,
                        headers: {
                          'Content-Type': 'none'
                        }
                      });
                      fetchProfile();
                    }}
                    onConfirm={async (id) => { await api.confirmDebt(id); fetchProfile(); }}
                    onDecline={async (id) => { await api.declineDebt(id); fetchProfile(); }}
                    onWitness={async (id, action) => { await api.request(`/debts/${id}/witness`, { method: 'POST', body: JSON.stringify({ action }) }); fetchProfile(); }}
                    onForgive={async (id) => { await api.request(`/debts/${id}/forgive`, { method: 'POST' }); fetchProfile(); }}
                    onTransfer={async (id, target) => { await api.request(`/debts/${id}/transfer`, { method: 'POST', body: JSON.stringify({ newDebtorId: target }) }); fetchProfile(); }}
                    friends={currentUser?.friends || []}
                  />
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">Нет доступных записей о долгах с этим пользователем.</p>
                )}
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                <h2 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider text-cyan-400 mb-4">
                  <Award className="w-4 h-4 text-purple-400" />
                  Инвентарь Cosmetics
                </h2>

                {sellItem && (
                  <div className="mb-4 p-4 bg-[#0b0f19] border border-purple-500/30 rounded-xl space-y-3">
                    <div className="text-xs font-bold text-purple-400">Продать предмет: {sellItem.details?.name}</div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Цена в Карме (₸)"
                        value={sellPrice}
                        onChange={e => setSellPrice(e.target.value)}
                        className="bg-black/60 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500 flex-1"
                      />
                      <button
                        onClick={handleListMarketItem}
                        disabled={sellingLoading}
                        className="bg-purple-650 text-white font-bold text-xs py-2 px-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                      >
                        Выставить
                      </button>
                      <button onClick={() => setSellItem(null)} className="bg-gray-800 text-gray-300 text-xs py-2 px-3 rounded-lg">Отмена</button>
                    </div>
                  </div>
                )}

                {inventory && inventory.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {inventory.map((item, idx) => (
                      <div key={idx} className="bg-black/20 border border-gray-800/40 rounded-xl p-3 flex flex-col justify-between">
                        <div>
                          <div className="text-xs font-bold truncate">{item.details?.name}</div>
                          <div className="text-[10px] text-gray-500 capitalize">{item.itemType}</div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-1.5">
                          <span className="text-[10px] text-cyan-400 font-bold">Qty: {item.quantity}</span>
                          {isSelf && item.itemType !== 'boost' && (
                            <button
                              onClick={() => { setSellItem(item); setSellPrice(''); }}
                              className="bg-purple-600/10 border border-purple-500/30 hover:bg-purple-600/30 text-purple-400 text-[9px] font-black uppercase tracking-wider py-1 px-2 rounded-lg transition"
                            >
                              Продать
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-6">В инвентаре пока нет предметов</p>
                )}
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="space-y-6">
                {/* Витрина достижений (Showcase) */}
                <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider text-cyan-400">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      Витрина достижений
                    </h2>
                    {isSelf && (
                      <button
                        onClick={() => setShowcaseOpen(!showcaseOpen)}
                        className="text-[10px] font-bold text-gray-400 hover:text-cyan-400 transition"
                      >
                        Настроить
                      </button>
                    )}
                  </div>

                  {showcaseOpen && (
                    <div className="mb-5 p-4 bg-[#0b0f19]/90 border border-cyan-500/20 rounded-xl space-y-4">
                      <p className="text-[11px] text-gray-300">Выберите до 4-х достижений для вашей витрины:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                        {user?.achievements && user.achievements.length > 0 ? (
                          user.achievements.map((ach, idx) => {
                            const item = ach.achievement;
                            const selected = selectedShowcase.includes(item._id);
                            return (
                              <div
                                key={idx}
                                onClick={() => toggleAchievementInShowcase(item._id)}
                                className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition ${
                                  selected ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-800 bg-black/40 hover:border-gray-700'
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  <span>{item.emoji}</span>
                                  <span className="font-semibold">{item.title}</span>
                                </span>
                                <span className="text-[9px] uppercase tracking-wider text-gray-500">{item.rarity}</span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-[11px] text-gray-500 col-span-2">У вас еще нет разблокированных достижений</p>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowcaseOpen(false)} className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs font-bold">Отмена</button>
                        <button onClick={handleSaveShowcase} disabled={updatingShowcase} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-bold">Сохранить</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {user?.achievementShowcase && user.achievementShowcase.filter(Boolean).length > 0 ? (
                      user.achievementShowcase.filter(Boolean).map((ach) => (
                        <div key={ach._id} className="relative p-3 bg-black/30 border border-gray-800/30 rounded-xl flex flex-col items-center text-center group">
                          <div className="text-3xl mb-1.5">{ach.emoji}</div>
                          <div className="text-xs font-bold text-gray-200">{ach.title}</div>
                          <div className="text-[10px] text-gray-500 mt-1 line-clamp-2">{ach.description}</div>
                          <span className={`text-[8px] uppercase tracking-widest font-extrabold mt-2 px-1.5 py-0.5 rounded-full ${
                            ach.rarity === 'legendary' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                            ach.rarity === 'rare' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                            'bg-gray-800/30 text-gray-400 border border-gray-700/20'
                          }`}>
                            {ach.rarity}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-4 text-center py-4 text-xs text-gray-500 font-semibold">
                        Витрина достижений не заполнена.
                      </div>
                    )}
                  </div>
                </div>

                {/* Все достижения: полученные и неполученные */}
                <div className="space-y-6">
                  {/* Разблокированные достижения */}
                  <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                    <h2 className="text-sm font-black uppercase tracking-wider text-cyan-400 mb-4 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Разблокированные достижения ({user?.achievements?.length || 0})
                    </h2>
                    {user?.achievements && user.achievements.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {user.achievements.map((userAch, idx) => {
                          const ach = userAch.achievement;
                          if (!ach) return null;
                          const rarityStyle = 
                            ach.rarity === 'legendary' ? 'border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)] text-amber-400' :
                            ach.rarity === 'epic' ? 'border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.15)] text-purple-400' :
                            ach.rarity === 'rare' ? 'border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)] text-cyan-400' :
                            'border-gray-800 text-gray-400';

                          return (
                            <div key={idx} className={`p-3 bg-black/40 border ${rarityStyle} rounded-xl flex items-center gap-3 relative overflow-hidden group`}>
                              <div className="text-3xl shrink-0 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">{ach.emoji}</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-black text-gray-250 truncate">{ach.title}</div>
                                <div className="text-[9px] text-gray-400 mt-0.5 line-clamp-2">{ach.description}</div>
                                <div className="text-[8px] text-gray-500 mt-1 uppercase tracking-wider">
                                  Получено: {(() => {
                                    const d = new Date(userAch.earnedAt || userAch.awardedAt);
                                    return isNaN(d.getTime()) ? 'Неизвестно' : d.toLocaleDateString('ru-RU');
                                  })()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 text-center py-6">У этого игрока пока нет разблокированных достижений.</p>
                    )}
                  </div>

                  {/* Еще не полученные достижения */}
                  <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                    <h2 className="text-sm font-black uppercase tracking-wider text-purple-400 mb-4 flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-purple-400" />
                      Неполученные достижения ({allAchievements.length - (user.achievements?.length || 0)})
                    </h2>
                    {(() => {
                      const earnedIds = (user?.achievements || []).map(a => (a.achievement?._id || a.achievement || '').toString());
                      const unearned = allAchievements.filter(ach => !earnedIds.includes(ach._id.toString()));

                      if (unearned.length > 0) {
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {unearned.map((ach) => {
                              const isSecret = ach.isSecret;
                              const title = isSecret ? '???' : ach.title;
                              const desc = isSecret ? 'Секретное достижение' : ach.description;
                              const emoji = isSecret ? '🔒' : ach.emoji;
                              const rarityText = isSecret ? '???' : ach.rarity;

                              // Calculate progress for progress bar
                              const progressVal = getAchievementProgress(ach);
                              const progressPercent = Math.min(100, Math.floor((progressVal / ach.threshold) * 100));

                              return (
                                <div key={ach._id} className="p-3 bg-black/20 border border-gray-900/65 rounded-xl flex flex-col justify-between opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300">
                                  <div className="flex items-start gap-3">
                                    <div className="text-3xl shrink-0">{emoji}</div>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-gray-300 truncate">{title}</div>
                                      <div className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{desc}</div>
                                      {!isSecret && (
                                        <span className="text-[7px] font-extrabold uppercase px-1.5 py-0.2 bg-gray-800/50 rounded-full border border-gray-700/30 text-gray-400 inline-block mt-1">
                                          {rarityText}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Progress Bar */}
                                  {!isSecret && ach.threshold > 1 && (
                                    <div className="mt-3">
                                      <div className="flex justify-between items-center text-[8px] font-bold text-gray-500 mb-1">
                                        <span>Прогресс</span>
                                        <span>{progressVal} / {ach.threshold}</span>
                                      </div>
                                      <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden border border-gray-850">
                                        <div 
                                          className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 transition-all duration-500"
                                          style={{ width: `${progressPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      return <p className="text-xs text-gray-500 text-center py-6">Все достижения разблокированы! Вы легенда! 🏆</p>;
                    })()}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'friends' && (
              <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                <h2 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider text-cyan-400 mb-4">
                  <Users className="w-4 h-4 text-purple-400" />
                  Список друзей ({user?.friends?.length || 0})
                </h2>
                {user?.friends && user.friends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {user.friends.map(friend => (
                      <div
                        key={friend._id}
                        onClick={() => {
                          if (onViewProfile) onViewProfile(friend._id);
                          else navigate(`/profile/${friend._id}`);
                        }}
                        className="bg-black/20 hover:bg-[#151c2c]/40 border border-gray-850 hover:border-slate-800 rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all"
                      >
                        <img
                          src={friend.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.username}`}
                          alt={friend.name}
                          className="w-10 h-10 rounded-xl border border-gray-850"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-gray-250 truncate">{friend.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">@{friend.username}</div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] font-black text-cyan-400">🔥 {friend.eloRating || 1000} ELO</span>
                            <span className="text-[10px] font-black text-amber-400">✧ {friend.karma || 0}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-8">У этого игрока пока нет друзей.</p>
                )}
              </div>
            )}

            {activeTab === 'balance_history' && isSelf && (
              <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                <h2 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider text-cyan-400 mb-4">
                  <Coins className="w-4 h-4 text-cyan-400" />
                  История рейтинга и транзакций
                </h2>

                {historyLoading ? (
                  <div className="text-center py-8 text-xs text-gray-500">Загрузка истории...</div>
                ) : (balanceHistory || []).length > 0 ? (
                  <div className="space-y-3">
                    {(balanceHistory || []).map((log) => {
                      const isPositive = log.amount >= 0;
                      const badgeColor = isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10';
                      const badgePrefix = isPositive ? '+' : '';
                      const currencySymbol = log.currency === 'elo' ? 'ELO' : '✧ Кармы';
                      
                      return (
                        <div key={log._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-black/20 border border-gray-850 hover:border-gray-800 transition rounded-xl gap-2">
                          <div className="flex items-start sm:items-center gap-3">
                            <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {log.currency === 'elo' ? 'E' : 'K'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-205">{log.description}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {(() => {
                                  const d = new Date(log.created_at);
                                  return isNaN(d.getTime()) ? 'Неизвестно' : d.toLocaleString('ru-RU');
                                })()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${badgeColor}`}>
                              {badgePrefix}{log.amount} {currencySymbol}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Пагинация */}
                    {historyTotalPages > 1 && (
                      <div className="flex justify-center items-center gap-2 mt-4 pt-2">
                        <button
                          disabled={historyPage === 1}
                          onClick={() => fetchBalanceHistory(historyPage - 1)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 text-gray-300 rounded-lg text-[10px] font-bold uppercase transition"
                        >
                          Назад
                        </button>
                        <span className="text-[10px] text-gray-500 font-bold">
                          {historyPage} / {historyTotalPages}
                        </span>
                        <button
                          disabled={historyPage === historyTotalPages}
                          onClick={() => fetchBalanceHistory(historyPage + 1)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 text-gray-300 rounded-lg text-[10px] font-bold uppercase transition"
                        >
                          Вперед
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-8">История начислений пока пуста.</p>
                )}
              </div>
            )}

            {activeTab === 'comments' && (

              <div className="bg-[#0b0f19]/40 backdrop-blur border border-gray-800/30 rounded-2xl p-5">
                <h2 className="text-sm font-black flex items-center gap-1.5 uppercase tracking-wider text-cyan-400 mb-4">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Стена комментариев
                </h2>

                <form onSubmit={handlePostComment} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Оставьте комментарий на этой стене..."
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    className="bg-[#0b0f19]/80 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 flex-1 transition"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submittingComment}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold p-2.5 rounded-xl transition disabled:opacity-50 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {comments && comments.length > 0 ? (
                    (comments || []).map((c) => {
                      const isCommentAuthor = currentUser && c.authorId?._id === currentUser._id;
                      const canDelete = isSelf || isCommentAuthor || (currentUser && currentUser.role === 'admin');
                      return (
                        <div key={c._id} className="p-3 bg-black/20 border border-gray-800/30 rounded-xl flex items-start gap-2.5 group">
                          <img
                            src={c.authorId?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.authorId?.username}`}
                            alt={c.authorId?.name}
                            className="w-8 h-8 rounded-lg border border-gray-800/50 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black text-cyan-400">
                                {c.authorId?.name || 'Пользователь'}
                              </span>
                              <span className="text-[9px] text-gray-500">
                                {(() => {
                                  const d = new Date(c.createdAt);
                                  return isNaN(d.getTime()) ? 'Неизвестно' : d.toLocaleDateString('ru-RU');
                                })()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300 mt-1 break-words">{c.text}</p>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(c._id)}
                              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition shrink-0 p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-6">Пока никто не оставил комментариев.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальное окно перевода Кармы */}
      {transferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#151c2c] border border-amber-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-lg font-black text-amber-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
              <Send className="w-5 h-5 text-amber-400" />
              Перевод Кармы
            </h3>
            
            <p className="text-xs text-gray-300 mb-4">
              Вы переводите Карму пользователю <span className="font-bold text-white">@{user.username}</span>.
            </p>
            
            <form onSubmit={handleTransferKarma} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">
                  Сумма перевода (целое число)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="Введите сумму"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-black/60 border border-gray-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <p className="text-[11px] text-amber-400 font-bold">
                  ⚠️ Комиссия системы — 10%
                </p>
                {transferAmount && !isNaN(transferAmount) && parseInt(transferAmount, 10) > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Получатель получит: <span className="text-emerald-400 font-bold">{Math.floor(parseInt(transferAmount, 10) * 0.9)} ✧</span>
                  </p>
                )}
              </div>

              {transferError && (
                <div className="text-[11px] font-bold text-red-400 text-center bg-red-950/20 border border-red-900/30 p-2 rounded-xl">
                  {transferError}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTransferModalOpen(false);
                    setTransferAmount('');
                    setTransferError('');
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !transferAmount}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-bold rounded-xl text-xs transition"
                >
                  {transferLoading ? 'Перевод...' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
