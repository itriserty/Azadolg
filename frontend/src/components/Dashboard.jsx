import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Coins, TrendingUp, TrendingDown, Package } from 'lucide-react';

/**
 * Dashboard.jsx — виджет профиля пользователя с ELO-рейтингом,
 * балансом Coins и кнопкой открытия Кейса.
 *
 * Props:
 *  - user            {Object} — текущий пользователь
 *  - netBalance      {number} — общий баланс долгов (плюс/минус)
 *  - totalOwesMe     {number} — сумма, которую должны мне
 *  - totalIOwe       {number} — сумма, которую должен я
 *  - onOpenCaseClick {Function} — коллбэк для открытия раздела кейсов
 */
export default function Dashboard({ user, netBalance, totalOwesMe, totalIOwe, onOpenCaseClick }) {
  if (!user) return null;

  // Определяем ELO-ранг
  const eloRank =
    user.eloRating >= 1200 ? { label: 'Легенда',    color: 'text-yellow-300 border-yellow-400/40 bg-yellow-950/30' }
    : user.eloRating >= 1100 ? { label: 'Грандмастер', color: 'text-purple-400 border-purple-500/40 bg-purple-950/30' }
    : user.eloRating >= 1000 ? { label: 'Адепт',       color: 'text-cyan-400   border-cyan-500/40   bg-cyan-950/30'   }
    :                          { label: 'Должник',      color: 'text-gray-400   border-gray-600/40   bg-gray-800/30'   };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40 relative overflow-hidden"
    >
      {/* Декоративный неоновый фон */}
      <div className="absolute -right-20 -top-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-12 w-32 h-32 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Верхняя строка: аватар + имя + ранг */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Аватар */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-purple-500/20 shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-gray-100">{user.name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
        </div>

        {/* ELO-виджет */}
        <div className={`flex flex-col items-end gap-1.5`}>
          <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${eloRank.color}`}>
            <Shield className="w-3.5 h-3.5" />
            {user.eloRating} ELO
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-wider ${eloRank.color.split(' ')[0]}`}>
            {eloRank.label}
          </div>
        </div>
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
            <div className="font-black text-yellow-300 text-sm">{user.coins} Coins</div>
          </div>
        </div>

        {/* Кнопка открытия кейса */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpenCaseClick}
          disabled={user.coins < 100}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm shadow-purple-500/20 shadow-md hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Package className="w-4 h-4" />
          Открыть кейс
          {user.coins >= 100 && <span className="text-[10px] opacity-75">(-100 Coins)</span>}
        </motion.button>
      </div>
    </motion.div>
  );
}
