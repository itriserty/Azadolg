import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Coins, Award } from 'lucide-react';

export default function Leaderboard({ users, currentUser }) {
  const medals = ['🥇', '🥈', '🥉'];

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

          return (
            <motion.div
              key={user._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1,  x: 0  }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                isMe
                  ? 'bg-purple-500/10 border-purple-500/50 shadow-purple-500/10 shadow-md'
                  : 'bg-[#0b0f19]/60 border-gray-900 hover:border-gray-800'
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

                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                  isTop
                    ? 'bg-gradient-to-tr from-yellow-400 to-yellow-500 text-[#0b0f19]'
                    : 'bg-gray-800 text-gray-300'
                }`}>
                  {user.name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <div className="font-medium text-sm flex items-center gap-1.5">
                    {user.name}
                    {isMe && (
                      <span className="text-[10px] bg-purple-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase">
                        Вы
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 flex items-center gap-1">
                    <Coins className="w-3 h-3 text-yellow-400" />
                    {user.coins} Coins
                  </div>
                </div>
              </div>

              {/* ELO-рейтинг */}
              <div className="text-right">
                <div className="font-bold text-sm text-cyan-400 flex items-center gap-1 justify-end">
                  <Award className="w-4 h-4" />
                  {user.eloRating}   {/* ← используем eloRating */}
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                  {user.eloRating >= 1200 ? 'Легенда'
                   : user.eloRating >= 1100 ? 'Грандмастер'
                   : user.eloRating >= 1000 ? 'Адепт'
                   : 'Должник'}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
