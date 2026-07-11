import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Sparkles, Trophy, Flame, HelpCircle } from 'lucide-react';
import CaseRoulette from './CaseRoulette';
import DuelsAndBets from './DuelsAndBets';

export default function Casino({ user, onUpdateUser }) {
  const [jackpot, setJackpot] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState('cases'); // 'cases' | 'duels'
  const [loading, setLoading] = useState(false);

  const fetchJackpot = async () => {
    try {
      const res = await api.request('/system/jackpot');
      setJackpot(res.jackpotPool || 0);
    } catch (err) {
      console.error('Ошибка получения джекпота:', err);
    }
  };

  useEffect(() => {
    fetchJackpot();
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* ── ВИДЖЕТ ДЖЕКПОТА ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#241a0d] via-[#151c2c] to-black border-2 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)] rounded-3xl p-6 text-center">
        {/* Glows */}
        <div className="absolute -left-10 -top-10 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="text-amber-400 font-extrabold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1 mb-2">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Накопительный Джекпот Azadolg <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        </div>

        <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(250,204,21,0.3)] animate-pulse">
          💠 {jackpot} <span className="text-amber-450 font-normal">✧</span>
        </h1>

        <p className="text-[10px] text-gray-400 max-w-md mx-auto mt-2 leading-relaxed">
          Джекпот разыгрывается каждое воскресенье в 23:59! 100% стоимости открытия всех кейсов и покупки вещей в магазине отправляются прямо в этот призовой фонд! 🚀
        </p>
      </div>

      {/* Переключатель вкладок внутри Казино */}
      <div className="flex bg-[#151c2c]/80 border border-gray-800 p-1.5 rounded-2xl gap-1.5 max-w-xs mx-auto">
        <button
          onClick={() => setActiveSubTab('cases')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'cases'
              ? 'bg-gradient-to-r from-amber-600/20 to-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-extrabold shadow'
              : 'text-gray-400 hover:text-gray-250 border border-transparent'
          }`}
        >
          🎟️ Кейсы
        </button>
        <button
          onClick={() => setActiveSubTab('duels')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'duels'
              ? 'bg-gradient-to-r from-purple-650/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-extrabold shadow'
              : 'text-gray-400 hover:text-gray-250 border border-transparent'
          }`}
        >
          ⚔️ Дуэли & Ставки
        </button>
      </div>

      {/* Контент */}
      <div>
        {activeSubTab === 'cases' ? (
          <CaseRoulette
            user={user}
            onUserUpdate={(updatedUser) => {
              fetchJackpot();
              if (onUpdateUser) onUpdateUser(updatedUser);
            }}
          />
        ) : (
          <DuelsAndBets
            user={user}
            onUpdateUser={(updatedUser) => {
              if (onUpdateUser) onUpdateUser(updatedUser);
              fetchJackpot(); // Пересчитываем джекпот при операциях дуэлей
            }}
          />
        )}
      </div>

    </div>
  );
}
