import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Trophy, Award, Send, Users, Camera, Flame, Coins, ShieldAlert, ArrowLeft } from 'lucide-react';

const SKIN_STYLES = {
  default: 'bg-[#1b2838] border border-[#2a475e]/40 text-gray-200 shadow-xl',
  vaporwave_skin: 'bg-gradient-to-br from-[#1d102e] via-[#2d114d] to-[#4c165a] border border-[#e026fd]/30 text-purple-100 shadow-[0_0_20px_rgba(224,38,253,0.15)]',
  cyberpunk_skin: 'bg-gradient-to-br from-[#12141d] via-[#1b1c2b] to-[#121015] border border-[#fcee0a]/30 text-yellow-100 shadow-[0_0_20px_rgba(252,238,10,0.15)]',
  matrix_skin: 'bg-[#030c03] border border-green-500/30 text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.15)] font-mono',
  galaxy_skin: 'bg-gradient-to-br from-[#090b16] via-[#111326] to-[#1f1936] border border-[#6366f1]/30 text-indigo-100 shadow-[0_0_25px_rgba(99,102,241,0.2)]'
};

const FRAME_STYLES = {
  none: 'border-2 border-gray-600',
  neon_red_frame: 'border-4 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] ring-2 ring-red-300',
  neon_cyan_frame: 'border-4 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)] ring-2 ring-cyan-300',
  gold_frame: 'border-4 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.9)] ring-2 ring-yellow-300 ring-offset-1 ring-offset-black',
  diamond_frame: 'border-4 border-indigo-400 shadow-[0_0_25px_rgba(129,140,248,0.95)] ring-2 ring-sky-300 ring-offset-1 ring-offset-black border-double'
};

const getLevelBadgeStyles = (level) => {
  const tens = Math.floor((level || 1) / 10);
  switch (tens) {
    case 0:
      return 'border-slate-500 text-slate-300 shadow-[0_0_8px_rgba(148,163,184,0.2)] bg-slate-900/40';
    case 1:
      return 'border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] bg-cyan-950/40';
    case 2:
      return 'border-indigo-500 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] bg-indigo-950/40';
    case 3:
      return 'border-amber-500 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.6)] bg-amber-950/40';
    default:
      return 'border-rose-500 text-rose-400 shadow-[0_0_22px_rgba(244,63,94,0.7)] bg-rose-950/40';
  }
};

const getRankLabel = (eloRating) => {
  const elo = eloRating || 1000;
  if (elo < 1000) return 'Железо';
  if (elo < 1100) return 'Бронза';
  if (elo < 1200) return 'Серебро';
  if (elo < 1300) return 'Золото';
  if (elo < 1400) return 'Платина';
  if (elo < 1500) return 'Алмаз';
  return 'Global Elite';
};

export default function Profile({ userId, currentUser, onBack, onViewProfile, onUpdateAvatar, onUpdateUser }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const targetUserId = id || userId;
  const isSelf = currentUser && currentUser._id === targetUserId;

  const avatarInputRef = useRef(null);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // Настройка витрины
  const [showcaseOpen, setShowcaseOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState([]);
  const [updatingShowcase, setUpdatingShowcase] = useState(false);

  // Перевод кармы
  const [transferAmount, setTransferAmount] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await api.request(`/users/${targetUserId}/profile`);
      setProfileData(data);
      setSelectedShowcase((data.user?.achievementShowcase || []).filter(Boolean).map(a => a?._id || a));
      setError('');
    } catch (err) {
      console.error('[Profile] fetch error:', err);
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

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setAvatarUploading(true);
      setAvatarError('');
      const data = await api.request('/users/avatar', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'none' }
      });
      if (onUpdateAvatar) onUpdateAvatar(data.avatar);
      fetchProfile();
    } catch (err) {
      console.error('[Profile] Avatar upload error:', err);
      setAvatarError(err.message || 'Ошибка загрузки аватара');
    } finally {
      setAvatarUploading(false);
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
      console.error(err);
      alert(err.message || 'Не удалось обновить витрину');
    } finally {
      setUpdatingShowcase(false);
    }
  };

  const toggleAchievementInShowcase = (achId) => {
    setSelectedShowcase(prev => {
      if (prev.includes(achId)) {
        return prev.filter(x => x !== achId);
      }
      if (prev.length >= 3) {
        alert('Максимальный размер витрины — 3 достижения');
        return prev;
      }
      return [...prev, achId];
    });
  };

  const handleTransferKarma = async (e) => {
    e.preventDefault();
    const amount = parseInt(transferAmount, 10);
    if (!amount || amount <= 0) {
      setTransferError('Введите корректную сумму');
      return;
    }
    if ((currentUser?.karma || 0) < amount) {
      setTransferError('Недостаточно Кармы для перевода');
      return;
    }

    setTransferLoading(true);
    setTransferError('');
    try {
      const res = await api.transferKarma(targetUserId, amount);
      alert(`Успешно переведено ${amount} Кармы! С учетом комиссии 10% получателю зачислено ${Math.floor(amount * 0.9)} Кармы.`);
      setTransferAmount('');
      fetchProfile();
      if (onUpdateUser) {
        onUpdateUser({ ...currentUser, karma: currentUser.karma - amount });
      }
    } catch (err) {
      console.error(err);
      setTransferError(err.message || 'Ошибка перевода Кармы');
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-400">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-bold uppercase tracking-wider text-[#3a80a7]">Синхронизация профиля...</span>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="max-w-md mx-auto p-6 bg-red-950/20 border border-red-900/30 rounded-2xl text-center space-y-4">
        <p className="text-red-400 font-bold">{error || 'Профиль недоступен'}</p>
        <button 
          onClick={() => onBack ? onBack() : navigate(-1)} 
          className="flex items-center justify-center gap-1 mx-auto px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-bold transition text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
      </div>
    );
  }

  const { user, friends = [], allAchievements = [] } = profileData;
  const currentSkin = user?.activeProfileSkin || 'default';
  const currentFrame = user?.activeProfileFrame || 'none';
  const elo = user?.eloRating || 1000;
  const bpLevel = user?.battlePassLevel || 1;

  // Витрина: берём отфильтрованные ачивки
  const showcaseItems = (user?.achievementShowcase || []).filter(Boolean);
  const earnedCount = allAchievements.filter(a => a.isEarned).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Кнопка назад */}
      {onBack && (
        <button 
          onClick={onBack}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1b2838]/85 hover:bg-[#203044] border border-[#2a475e]/40 rounded-xl text-xs font-bold text-gray-300 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Назад
        </button>
      )}

      {/* ── STEAM HEADER ── */}
      <div className={`p-6 rounded-2xl shadow-2xl relative overflow-hidden ${SKIN_STYLES[currentSkin] || SKIN_STYLES.default}`}>
        {/* Затемняющая вуаль для контрастности текста */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-0 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Аватар и Имя */}
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group shrink-0">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username}`}
                alt={user?.name}
                className={`w-24 h-24 rounded-2xl object-cover ${FRAME_STYLES[currentFrame] || FRAME_STYLES.none}`}
              />
              {isSelf && (
                <>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    title="Загрузить аватар"
                    className="absolute inset-0 rounded-2xl bg-black/65 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1 cursor-pointer border border-cyan-500/50"
                  >
                    {avatarUploading ? (
                      <div className="w-5 h-5 border-2 border-t-white border-cyan-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-cyan-400" />
                        <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">Изменить</span>
                      </>
                    )}
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                </>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center sm:justify-start gap-2">
                {user?.name}
                {user?.role === 'admin' && (
                  <span className="text-[9px] bg-red-500/20 border border-red-500/40 text-red-400 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded">
                    Admin
                  </span>
                )}
              </h1>
              <p className="text-sm text-cyan-400/90 font-bold">@{user?.username}</p>
              
              {/* Статус в стиле Steam */}
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-gray-400 mt-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-emerald-400">В сети</span>
              </div>
            </div>
          </div>

          {/* Steam Level и Баланс */}
          <div className="flex flex-row md:flex-col items-center md:items-end gap-4 shrink-0 text-center md:text-right">
            
            {/* Круглый бейдж уровня в стиле Steam */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Ранг</span>
              <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-sm transition-all duration-300 ${getLevelBadgeStyles(bpLevel)}`}>
                {bpLevel}
              </div>
            </div>

            {/* Карты ELO & Кармы */}
            <div className="space-y-1 bg-black/40 p-2.5 rounded-xl border border-white/5 backdrop-blur">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-bold justify-end">
                <Flame className="w-3.5 h-3.5 animate-pulse" />
                <span>{elo} ELO</span>
                <span className="text-[10px] text-gray-400 font-normal">({getRankLabel(elo)})</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold justify-end border-t border-white/5 pt-1">
                <Coins className="w-3.5 h-3.5" />
                <span>{user?.karma} ✧</span>
              </div>
            </div>

          </div>

        </div>

        {/* Аватар-ошибка */}
        {avatarError && (
          <div className="absolute bottom-2 left-6 right-6 p-2 bg-red-500/10 border border-red-500/25 rounded-xl text-center text-xs text-red-400 font-bold">
            {avatarError}
          </div>
        )}
      </div>

      {/* ── ДВУХКОЛОНОЧНЫЙ ГРИД (А-ЛЯ СТИМ) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ЛЕВАЯ КОЛОНКА: ВИТРИНА ДОСТИЖЕНИЙ + ВСЕ ДОСТИЖЕНИЯ (2/3) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* ВИТРИНА ДОСТИЖЕНИЙ */}
          <div className="bg-[#1b2838]/85 p-5 rounded-2xl border border-[#2a475e]/30 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#2a475e]/30 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-cyan-400 animate-pulse" /> Витрина достижений
              </h3>
              {isSelf && (
                <button
                  onClick={() => setShowcaseOpen(true)}
                  className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-cyan-600/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition"
                >
                  Редактировать
                </button>
              )}
            </div>

            {/* Сетка витрины */}
            <div className="grid grid-cols-3 gap-3">
              {showcaseItems.length > 0 ? (
                showcaseItems.map(ach => (
                  <div 
                    key={ach._key || ach._id} 
                    className="p-3 bg-black/30 border border-[#2a475e]/25 rounded-xl text-center flex flex-col items-center justify-center space-y-1.5"
                    title={ach.description}
                  >
                    <span className="text-3xl filter drop-shadow">{ach.emoji}</span>
                    <span className="text-[10px] font-black text-white leading-tight line-clamp-1">{ach.title}</span>
                    <span className="text-[8px] font-bold text-cyan-400 opacity-85">{ach.rarity}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-6 text-center text-xs text-gray-500 italic">
                  На этой витрине пока пусто. {isSelf && 'Настройте её, нажав кнопку «Редактировать»!'}
                </div>
              )}
            </div>

            {/* Прогресс-бар достижений */}
            <div className="bg-black/35 p-3 rounded-xl border border-white/5 space-y-1.5">
              <div className="flex justify-between text-[10px] font-bold text-gray-400">
                <span>Прогресс достижений</span>
                <span className="text-white">{earnedCount} из {allAchievements.length} ({allAchievements.length > 0 ? Math.round((earnedCount / allAchievements.length) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-[#121820] h-1.5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${allAchievements.length > 0 ? (earnedCount / allAchievements.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* ВСЕ ДОСТИЖЕНИЯ */}
          <div className="bg-[#1b2838]/85 p-5 rounded-2xl border border-[#2a475e]/30 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#2a475e]/30 pb-3">
              <Trophy className="w-4 h-4 text-amber-400" /> Доступные достижения
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allAchievements.map(ach => (
                <div 
                  key={ach._id} 
                  className={`p-3 rounded-xl border flex gap-3 items-center transition duration-200 ${
                    ach.isEarned 
                      ? 'bg-black/40 border-[#2a475e]/30' 
                      : 'bg-black/10 border-gray-900/40 opacity-55'
                  }`}
                >
                  <div className="text-3xl shrink-0 filter drop-shadow select-none">{ach.emoji}</div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[10px] font-black text-white truncate leading-none">{ach.title}</h4>
                      <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded leading-none ${
                        ach.rarity === 'LEGENDARY' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25' :
                        ach.rarity === 'EPIC' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/25' :
                        ach.rarity === 'RARE' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/25'
                      }`}>
                        {ach.rarity}
                      </span>
                    </div>
                    <p className="text-[8px] text-gray-400 leading-tight line-clamp-1">{ach.description}</p>
                    {ach.isEarned ? (
                      <p className="text-[7px] text-emerald-400 font-semibold italic">
                        Получено: {new Date(ach.earnedAt).toLocaleDateString('ru-RU')}
                      </p>
                    ) : (
                      <p className="text-[7px] text-gray-500 font-medium">
                        Прогресс: {ach.progress ?? 0}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ПРАВАЯ КОЛОНКА: ДРУЗЬЯ + ПЕРЕВОД (1/3) */}
        <div className="space-y-6">
          
          {/* СПИСОК ДРУЗЕЙ */}
          <div className="bg-[#1b2838]/85 p-5 rounded-2xl border border-[#2a475e]/30 shadow-xl space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-[#2a475e]/30 pb-3">
              <Users className="w-4 h-4 text-cyan-400" /> Друзья ({friends.length})
            </h3>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {friends.length > 0 ? (
                friends.map(friend => (
                  <div
                    key={friend._id}
                    onClick={() => onViewProfile ? onViewProfile(friend._id) : navigate(`/profile/${friend._id}`)}
                    className="p-2 bg-black/30 hover:bg-[#203044] border border-[#2a475e]/20 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img 
                        src={friend.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.username}`}
                        alt={friend.name}
                        className={`w-8 h-8 rounded-lg object-cover ${FRAME_STYLES[friend.activeProfileFrame] || FRAME_STYLES.none}`}
                      />
                      <div className="min-w-0 leading-tight">
                        <h4 className="text-[10px] font-black text-white truncate">{friend.name}</h4>
                        <span className="text-[8px] text-cyan-400">@{friend.username}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <div className="text-[8px] font-black bg-cyan-500/10 border border-cyan-500/35 text-cyan-400 rounded px-1">
                        LVL {friend.level || 1}
                      </div>
                      <span className="text-[9px] text-amber-500 font-bold">{friend.eloRating || 1000} ELO</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-gray-500 italic py-4">
                  Нет друзей.
                </div>
              )}
            </div>
          </div>

          {/* ПАНЕЛЬ ПЕРЕВОДА КАРМЫ (ТОЛЬКО ДЛЯ ДРУГИХ ПОЛЬЗОВАТЕЛЕЙ) */}
          {!isSelf && (
            <div className="bg-[#1b2838]/85 p-5 rounded-2xl border border-amber-500/20 shadow-xl space-y-4">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-500/20 pb-3">
                <Send className="w-4 h-4 text-amber-400" /> Отправить Карму
              </h3>
              
              <p className="text-[10px] text-gray-400 leading-normal">
                Вы можете отправить Карму напрямую на баланс пользователя <span className="font-bold text-white">@{user?.username}</span>.
              </p>

              <form onSubmit={handleTransferKarma} className="space-y-3.5">
                <div>
                  <label className="block text-[8px] uppercase tracking-wider text-gray-500 font-black mb-1">
                    Ваш баланс: <span className="text-white font-bold">{currentUser?.karma || 0} ✧</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder="Сумма (например: 100)"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-[#121820] border border-[#2a475e]/40 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                <div className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-center space-y-1">
                  <p className="text-[9px] text-amber-400 font-bold">
                    ⚠️ Комиссия системы — 10%
                  </p>
                  {transferAmount && !isNaN(transferAmount) && parseInt(transferAmount, 10) > 0 && (
                    <p className="text-[9px] text-gray-400">
                      Получатель зачислит: <span className="text-emerald-400 font-bold">{Math.floor(parseInt(transferAmount, 10) * 0.9)} ✧</span>
                    </p>
                  )}
                </div>

                {transferError && (
                  <div className="text-[10px] font-bold text-red-400 text-center bg-red-950/20 border border-red-900/30 p-2 rounded-xl">
                    {transferError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={transferLoading || !transferAmount}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 disabled:opacity-50 text-black font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {transferLoading ? 'Отправка...' : 'Отправить'}
                </button>
              </form>
            </div>
          )}

        </div>

      </div>

      {/* ── МОДАЛКА ВЫБОРА ДОСТИЖЕНИЙ НА ВИТРИНУ ── */}
      {showcaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1b2838] border border-[#2a475e]/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Настройка витрины
              </h3>
              <p className="text-[10px] text-gray-400">Выберите до 3 заработанных достижений для вашей витрины:</p>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {allAchievements
                .filter(a => a.isEarned)
                .map(ach => {
                  const isSelected = selectedShowcase.includes(ach._id);
                  return (
                    <div
                      key={ach._id}
                      onClick={() => toggleAchievementInShowcase(ach._id)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition duration-150 ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500 text-white'
                          : 'bg-black/35 border-[#2a475e]/30 hover:border-cyan-500/35 text-gray-400'
                      }`}
                    >
                      <span className="text-2xl filter drop-shadow select-none">{ach.emoji}</span>
                      <span className="text-[9px] font-black leading-tight line-clamp-1">{ach.title}</span>
                    </div>
                  );
                })}
              {allAchievements.filter(a => a.isEarned).length === 0 && (
                <div className="col-span-2 text-center text-xs text-gray-500 italic py-6">
                  У вас пока нет разблокированных достижений.
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[#2a475e]/20">
              <button
                type="button"
                onClick={() => {
                  setShowcaseOpen(false);
                  setSelectedShowcase((user?.achievementShowcase || []).filter(Boolean).map(a => a?._id || a));
                }}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveShowcase}
                disabled={updatingShowcase}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white font-bold rounded-xl text-xs transition"
              >
                {updatingShowcase ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
