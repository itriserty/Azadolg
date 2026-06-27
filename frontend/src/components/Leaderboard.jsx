import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Coins, Award, X, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

const SKIN_STYLES = {
  'vaporwave_skin': 'bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 border-purple-500 shadow-lg shadow-purple-500/20',
  'cyberpunk_skin': 'bg-gradient-to-br from-slate-950 via-slate-900 to-yellow-950 border-yellow-500 shadow-lg shadow-yellow-500/20',
  'matrix_skin': 'bg-gradient-to-br from-slate-950 via-emerald-950 to-black border-emerald-500 shadow-lg shadow-emerald-500/20',
  'default': 'bg-[#151c2c] border-gray-850 shadow-2xl'
};

const FRAME_STYLES = {
  'neon_red_frame': 'ring-4 ring-red-500 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(239,68,68,0.7)]',
  'neon_cyan_frame': 'ring-4 ring-cyan-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.7)]',
  'gold_frame': 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-pulse',
  'none': ''
};

export default function Leaderboard({ users, currentUser, onViewProfile }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  const handleRowClick = (user) => {
    if (onViewProfile) {
      onViewProfile(user._id);
    }
  };

  // Вычисления долгов для профиля
  const debtsHeOwes = userDebts.filter(d => d.debtor._id === selectedUser?._id && d.status === 'active');
  const debtsOwedToHim = userDebts.filter(d => d.creditor._id === selectedUser?._id && d.status === 'active');

  const totalOwesOthers = debtsHeOwes.reduce((sum, d) => sum + d.amount, 0);
  const totalOthersOweHim = debtsOwedToHim.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
          <Shield className="w-5 h-5 text-purple-400" />
          ELO-Лидерборд
        </h2>
        <span className="text-xs text-gray-500 uppercase tracking-widest">Сезон 1</span>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {users.map((user, index) => {
          const isMe  = currentUser && currentUser._id === user._id;
          const isTop = index < 3;
          const activeFrame = user.activeProfileFrame || 'none';

          return (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1,  x: 0  }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleRowClick(user)}
              className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all ${
                isMe
                  ? 'bg-purple-500/10 border-purple-500/50 shadow-purple-500/10 shadow-md'
                  : 'bg-[#0b0f19]/60 border-gray-900 hover:border-slate-800'
              }`}
            >
              {/* Место + аватар + имя */}
              <div className="flex items-center gap-3">
                <div className="w-7 text-center font-bold text-sm shrink-0">
                  {isTop
                    ? <span className="text-xl">{medals[index]}</span>
                    : <span className="text-gray-500">#{index + 1}</span>
                  }
                </div>

                {/* Аватар с учетом рамки профиля */}
                <div className="relative shrink-0">
                  <div className={`w-8 h-8 rounded-full overflow-hidden ${FRAME_STYLES[activeFrame] || ''}`}>
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 object-cover" />
                    ) : (
                      <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm ${
                        isTop
                          ? 'bg-gradient-to-tr from-yellow-400 to-yellow-500 text-[#0b0f19]'
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="ml-1">
                  <div className="font-medium text-sm flex items-center gap-1.5 text-white">
                    {user.name}
                    {isMe && (
                      <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">
                        Вы
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" />
                    {user.karma} Карма
                  </div>
                </div>
              </div>

              {/* ELO-рейтинг */}
              <div className="text-right">
                <div className="font-bold text-sm text-cyan-400 flex items-center gap-1 justify-end">
                  <Award className="w-4 h-4" />
                  {user.eloRating}
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                  {user.rank || 'Должник'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
