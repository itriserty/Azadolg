import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Coins, TrendingUp, TrendingDown, Package, UserPlus, Users, Bell, BellOff, Check, X } from 'lucide-react';

/**
 * Dashboard.jsx — виджет профиля пользователя с ELO-рейтингом,
 * балансом Coins, списком друзей, управлением Telegram-уведомлениями
 * и кнопкой открытия Кейса.
 */
export default function Dashboard({ 
  user, 
  netBalance, 
  totalOwesMe, 
  totalIOwe, 
  friends = [], 
  pendingRequests = [],
  onOpenCaseClick,
  onAddFriend,
  onAcceptRequest,
  onRejectRequest,
  onUpdateTelegramId
}) {
  const [friendUsername, setFriendUsername] = useState('');
  const [tgInput, setTgInput] = useState(user?.telegramId || '');
  const [isEditingTg, setIsEditingTg] = useState(false);
  const [friendError, setFriendError] = useState('');
  const [friendSuccess, setFriendSuccess] = useState('');

  if (!user) return null;

  // Определяем ELO-ранг
  const eloRank =
    user.eloRating >= 1200 ? { label: 'Легенда',    color: 'text-yellow-300 border-yellow-400/40 bg-yellow-950/30' }
    : user.eloRating >= 1100 ? { label: 'Грандмастер', color: 'text-purple-400 border-purple-500/40 bg-purple-950/30' }
    : user.eloRating >= 1000 ? { label: 'Адепт',       color: 'text-cyan-400   border-cyan-500/40   bg-cyan-950/30'   }
    :                          { label: 'Должник',      color: 'text-gray-400   border-gray-600/40   bg-gray-800/30'   };

  const handleAddFriendSubmit = async (e) => {
    e.preventDefault();
    setFriendError('');
    setFriendSuccess('');
    if (!friendUsername.trim()) return;

    try {
      const res = await onAddFriend(friendUsername.trim());
      setFriendSuccess(res.message || 'Запрос отправлен!');
      setFriendUsername('');
      setTimeout(() => setFriendSuccess(''), 4000);
    } catch (err) {
      setFriendError(err.message || 'Ошибка отправки запроса');
      setTimeout(() => setFriendError(''), 4000);
    }
  };

  const handleTgSubmit = async (e) => {
    e.preventDefault();
    try {
      await onUpdateTelegramId(tgInput.trim());
      setIsEditingTg(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* 1. КАРТОЧКА ПРОФИЛЯ */}
      <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40 relative overflow-hidden">
        {/* Декоративный неоновый фон */}
        <div className="absolute -right-20 -top-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-12 w-32 h-32 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

        {/* Верхняя строка: аватар + имя + ранг */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-purple-500/20 shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-100 flex items-center gap-1.5">
                {user.name}
                <span className="text-xs text-gray-500 font-normal">@{user.username}</span>
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </div>
          </div>

          {/* ELO-виджет */}
          <div className="flex flex-col items-end gap-1.5">
            <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${eloRank.color}`}>
              <Shield className="w-3.5 h-3.5" />
              {user.eloRating} ELO
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-wider ${eloRank.color.split(' ')[0]}`}>
              {eloRank.label}
            </div>
          </div>
        </div>

        {/* Статус Telegram-уведомлений */}
        <div className="mb-6 p-3 rounded-xl border border-gray-800/80 bg-[#0d1322] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {user.telegramId ? (
              <>
                <Bell className="w-4 h-4 text-green-400 shrink-0" />
                <div className="text-xs text-gray-300">
                  <span className="text-green-400 font-bold">Оповещения включены</span>
                  <div className="text-[10px] text-gray-500">ID: {user.telegramId}</div>
                </div>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 text-yellow-500 shrink-0" />
                <div className="text-xs text-gray-300">
                  <span className="text-yellow-500 font-bold">Оповещения отключены</span>
                  <div className="text-[9px] text-gray-500 leading-tight">Привяжите ID от @userinfobot</div>
                </div>
              </>
            )}
          </div>

          {isEditingTg ? (
            <form onSubmit={handleTgSubmit} className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Ваш ID"
                value={tgInput}
                onChange={(e) => setTgInput(e.target.value)}
                className="bg-[#151c2c] border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 w-24 focus:outline-none focus:border-cyan-500"
              />
              <button type="submit" className="p-1.5 bg-green-600/30 hover:bg-green-600/50 text-green-400 rounded transition">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setIsEditingTg(false)} className="p-1.5 bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => {
                setTgInput(user.telegramId || '');
                setIsEditingTg(true);
              }}
              className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-2 py-1 rounded-lg transition"
            >
              {user.telegramId ? 'Изм.' : 'Настроить'}
            </button>
          )}
        </div>

        {/* Баланс долгов — основной блок */}
        <div className="border border-gray-850/60 rounded-xl p-4 mb-4 bg-[#0b0f19]/60">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">
            Ваш баланс долгов
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-3xl font-black tracking-tight ${
              netBalance > 0 ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]'
              : netBalance < 0 ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]'
              : 'text-gray-400'
            }`}>
              {netBalance > 0 ? '+' : ''}{netBalance} ₽
            </span>
            {netBalance > 0 && <TrendingUp className="w-5 h-5 text-green-400" />}
            {netBalance < 0 && <TrendingDown className="w-5 h-5 text-red-400" />}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-green-500/5 border border-green-500/20 p-2.5 rounded-lg">
              <div className="text-gray-500 mb-0.5">Вам должны</div>
              <div className="font-bold text-green-400">+{totalOwesMe} ₽</div>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 p-2.5 rounded-lg">
              <div className="text-gray-500 mb-0.5">Вы должны</div>
              <div className="font-bold text-red-400">-{totalIOwe} ₽</div>
            </div>
          </div>
        </div>

        {/* Нижняя строка: Coins + кнопка кейса */}
        <div className="flex items-center justify-between gap-3">
          {/* Баланс монет */}
          <div className="flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/25 px-3 py-2 rounded-xl">
            <Coins className="w-4 h-4 text-yellow-300" />
            <div>
              <div className="text-[10px] text-gray-500 leading-none">Монеты</div>
              <div className="font-black text-yellow-300 text-sm leading-tight">{user.coins} Coins</div>
            </div>
          </div>

          {/* Кнопка открытия кейса */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCaseClick}
            disabled={user.coins < 100}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-purple-500/20 shadow-md hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Package className="w-4 h-4" />
            Открыть кейс
            {user.coins >= 100 && <span className="text-[10px] opacity-75">(-100 Coins)</span>}
          </motion.button>
        </div>
      </div>

      {/* 2. СОЦИАЛЬНАЯ ПАНЕЛЬ (ДРУЗЬЯ И ЗАПРОСЫ) */}
      <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 font-black text-gray-100 mb-4 uppercase tracking-wider text-sm border-b border-gray-800 pb-2.5">
          <Users className="w-4 h-4 text-cyan-400" />
          Друзья ({friends.length})
        </div>

        {/* Форма добавления по username */}
        <form onSubmit={handleAddFriendSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Добавить по @username..."
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              className="flex-1 bg-[#0b0f19] border border-gray-850 text-xs text-gray-100 rounded-xl px-4 py-2.5 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 rounded-xl text-xs flex items-center gap-1.5 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Добавить
            </button>
          </div>
          {friendError && <div className="text-red-400 text-[10px] mt-1.5 font-bold">{friendError}</div>}
          {friendSuccess && <div className="text-green-400 text-[10px] mt-1.5 font-bold">{friendSuccess}</div>}
        </form>

        {/* Входящие запросы в друзья */}
        <AnimatePresence>
          {pendingRequests.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                Входящие запросы в друзья:
              </div>
              {pendingRequests.map((req) => (
                <motion.div
                  key={req._id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-2.5 bg-cyan-950/20 border border-cyan-800/40 rounded-xl"
                >
                  <div className="text-xs">
                    <span className="font-bold text-gray-200">{req.sender?.name}</span>
                    <span className="text-gray-500 text-[10px] ml-1">@{req.sender?.username}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onAcceptRequest(req._id)}
                      className="bg-green-600 hover:bg-green-500 text-white font-bold px-2 py-1 rounded text-[10px] transition"
                    >
                      Принять
                    </button>
                    <button
                      onClick={() => onRejectRequest(req._id)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded text-[10px] transition"
                    >
                      Отклонить
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Список друзей */}
        {friends.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-500">
            У вас пока нет друзей. Добавьте кого-нибудь, чтобы играть и создавать долги!
          </div>
        ) : (
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {friends.map((friend) => {
              const rank =
                friend.eloRating >= 1200 ? 'text-yellow-300'
                : friend.eloRating >= 1100 ? 'text-purple-400'
                : friend.eloRating >= 1000 ? 'text-cyan-400'
                : 'text-gray-400';

              return (
                <div
                  key={friend._id}
                  className="flex items-center justify-between p-2.5 bg-[#0b0f19]/40 border border-gray-850/40 rounded-xl hover:border-gray-800/80 transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-xs text-gray-300">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-200">{friend.name}</div>
                      <div className="text-[10px] text-gray-500 leading-none">@{friend.username}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold ${rank}`}>{friend.eloRating} ELO</div>
                    <div className="text-[9px] text-gray-500 font-mono">{friend.coins} Coins</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
