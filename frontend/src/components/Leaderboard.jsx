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

export default function Leaderboard({ users, currentUser }) {
  const medals = ['🥇', '🥈', '🥉'];
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDebts, setUserDebts] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const handleRowClick = async (user) => {
    try {
      setSelectedUser(user);
      setModalLoading(true);
      setUserDebts([]);
      // Загружаем долги выбранного пользователя
      const debtsData = await api.getDebts(user._id);
      setUserDebts(debtsData);
    } catch (err) {
      console.error('Ошибка загрузки долгов профиля:', err);
    } finally {
      setModalLoading(false);
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
                    {user.karma !== undefined ? user.karma : user.coins} ₸ Кармы
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

      {/* Модальное окно просмотра профиля */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-lg border rounded-2xl overflow-hidden relative ${SKIN_STYLES[selectedUser.activeProfileSkin] || SKIN_STYLES.default}`}
            >
              {/* Кнопка закрытия */}
              <button
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-black/40 text-slate-400 hover:text-white transition-all hover:bg-black/60 z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="p-6 space-y-6">
                
                {/* Шапка профиля */}
                <div className="flex items-center space-x-4 pt-2">
                  <div className={`w-16 h-16 rounded-full overflow-hidden shrink-0 ${FRAME_STYLES[selectedUser.activeProfileFrame] || ''}`}>
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} className="w-16 h-16 object-cover" />
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center font-black text-2xl bg-slate-800 text-gray-300">
                        {selectedUser.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">{selectedUser.name}</h3>
                    <p className="text-xs text-slate-400">@{selectedUser.username || 'username'}</p>
                    
                    <div className="flex items-center space-x-2 mt-1.5">
                      <span className="text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                        {selectedUser.rank || 'Iron'}
                      </span>
                      <span className="text-xs text-slate-400">• ELO: {selectedUser.eloRating}</span>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-800" />

                {/* Баланс сборов */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Должен вернуть</div>
                    <div className="text-xl font-black text-red-400 mt-1">{totalOwesOthers} ₸</div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl text-center">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Должны вернуть ему</div>
                    <div className="text-xl font-black text-emerald-400 mt-1">{totalOthersOweHim} ₸</div>
                  </div>
                </div>

                {/* Детализация долгов */}
                {modalLoading ? (
                  <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center justify-center space-y-3">
                    <div className="w-8 h-8 border-2 border-t-indigo-500 border-slate-800 rounded-full animate-spin" />
                    <span>Загрузка финансовых связей...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    
                    {/* Список: Кому должен */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Кому должен:</h4>
                      {debtsHeOwes.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-slate-950/30 p-3 rounded-lg border border-slate-900/50">
                          Чист! Не должен ни копейки. 🎉
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                          {debtsHeOwes.map(d => (
                            <div key={d._id} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 text-xs">
                              <span className="text-white">Кредитор: <b>{d.creditor.name}</b> <span className="text-slate-500">({d.description})</span></span>
                              <span className="text-red-400 font-bold">{d.amount} ₸</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Список: Кто должен ему */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Кто должен ему:</h4>
                      {debtsOwedToHim.length === 0 ? (
                        <div className="text-xs text-slate-500 bg-slate-950/30 p-3 rounded-lg border border-slate-900/50">
                          Никто не должен этому игроку.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                          {debtsOwedToHim.map(d => (
                            <div key={d._id} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 text-xs">
                              <span className="text-white">Должник: <b>{d.debtor.name}</b> <span className="text-slate-500">({d.description})</span></span>
                              <span className="text-emerald-400 font-bold">{d.amount} ₸</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
