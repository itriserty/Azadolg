import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function DuelsAndBets({ user, onUpdateUser }) {
  const [friends, setFriends] = useState([]);
  const [myDebts, setMyDebts] = useState([]);
  const [friendsDebts, setFriendsDebts] = useState([]);
  const [myDuels, setMyDuels] = useState([]);
  const [myBets, setMyBets] = useState([]);
  
  // Состояния форм
  const [selectedOpponent, setSelectedOpponent] = useState('');
  const [wagerType, setWagerType] = useState('karma'); // 'karma' | 'debt'
  const [karmaWager, setKarmaWager] = useState(50);
  const [selectedDebtId, setSelectedDebtId] = useState('');
  
  // Состояния для ставок (тотализатора)
  const [bettingWager, setBettingWager] = useState(50);
  const [bettingPredictions, setBettingPredictions] = useState({}); // { debtId: true/false }

  // Анимация дуэли
  const [activeDuelId, setActiveDuelId] = useState(null);
  const [coinFlipped, setCoinFlipped] = useState(false);
  const [duelWinnerId, setDuelWinnerId] = useState(null);
  const [duelResultText, setDuelResultText] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [friendsList, ownDebts, pendingDuels, activeBets] = await Promise.all([
        api.getFriends(),
        api.getDebts(user._id),
        api.getMyDuels(),
        api.getMyBets()
      ]);

      setFriends(friendsList);
      setMyDebts(ownDebts);
      setMyDuels(pendingDuels);
      setMyBets(activeBets);

      // Загружаем активные долги друзей для ставок (тотализатор)
      const debtsPromises = friendsList.map(friend => 
        api.getDebts(friend._id).catch(() => [])
      );
      const debtsResults = await Promise.all(debtsPromises);
      const allDebts = debtsResults.flat();
      
      const uniqueDebts = [];
      const seenIds = new Set();
      for (const d of allDebts) {
        if (!seenIds.has(d._id)) {
          seenIds.add(d._id);
          // Игрок может ставить только на долги своих друзей, в которых сам не участвует
          const isParticipant = d.debtor._id === user._id || d.creditor._id === user._id;
          if (!isParticipant) {
            uniqueDebts.push(d);
          }
        }
      }
      setFriendsDebts(uniqueDebts);
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки данных дуэлей и ставок');
    } finally {
      setLoading(false);
    }
  };

  const handleChallenge = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedOpponent) return setError('Выберите оппонента');

    try {
      setLoading(true);
      const wagerValue = wagerType === 'karma' ? Number(karmaWager) : 0;
      const debtValue = wagerType === 'debt' ? selectedDebtId : null;

      if (wagerType === 'karma' && wagerValue <= 0) {
        return setError('Ставка кармы должна быть больше нуля');
      }
      if (wagerType === 'debt' && !debtValue) {
        return setError('Выберите долг для розыгрыша');
      }

      const res = await api.createDuelChallenge(
        selectedOpponent,
        debtValue,
        wagerValue
      );
      setSuccess(res.message);
      
      // Сброс формы
      setKarmaWager(50);
      setSelectedDebtId('');
      
      await fetchInitialData();
    } catch (err) {
      setError(err.message || 'Ошибка отправки вызова');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToDuel = async (duelId, action) => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      if (action === 'reject') {
        const res = await api.respondToDuel(duelId, 'reject');
        setSuccess(res.message);
        await fetchInitialData();
      } else {
        // Запуск анимации Coinflip перед вызовом API
        setActiveDuelId(duelId);
        setCoinFlipped(true);
        setDuelWinnerId(null);
        setDuelResultText('');

        // Ждем 2.5 секунды анимации
        await new Promise(resolve => setTimeout(resolve, 2500));

        const res = await api.respondToDuel(duelId, 'accept');
        setDuelWinnerId(res.winner);
        setDuelResultText(res.duelResult);
        
        // Обновляем текущий баланс пользователя
        const profile = await api.getMe();
        onUpdateUser(profile);

        // Ждем еще 3 секунды, чтобы показать результат
        await new Promise(resolve => setTimeout(resolve, 3500));
        
        // Сброс анимации
        setActiveDuelId(null);
        setCoinFlipped(false);
        
        await fetchInitialData();
      }
    } catch (err) {
      setError(err.message || 'Ошибка обработки дуэли');
      setActiveDuelId(null);
      setCoinFlipped(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceBet = async (debtId) => {
    setError('');
    setSuccess('');
    const pred = bettingPredictions[debtId];
    if (pred === undefined) return setError('Выберите ваш прогноз на долг');
    
    try {
      setLoading(true);
      const wager = Number(bettingWager);
      if (wager <= 0) return setError('Ставка должна быть больше нуля');

      const res = await api.placeBet(debtId, pred, wager);
      setSuccess(res.message);
      
      if (res.userKarma !== undefined) {
        onUpdateUser({ ...user, karma: res.userKarma });
      }

      await fetchInitialData();
    } catch (err) {
      setError(err.message || 'Ошибка при совершении ставки');
    } finally {
      setLoading(false);
    }
  };

  // Фильтруем долги пользователя с конкретным выбранным другом для дуэли
  const duelDebts = myDebts.filter(d => 
    selectedOpponent && 
    (d.debtor._id === selectedOpponent || d.creditor._id === selectedOpponent)
  );

  return (
    <div className="space-y-8 pb-12 animate-fadeIn relative">
      
      {/* Overlay Анимации Подбрасывания Монетки */}
      {activeDuelId && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center">
          <div className="text-center space-y-8 max-w-md px-6">
            <h3 className="text-3xl font-extrabold text-white tracking-widest uppercase">Coinflip Duel 🪙</h3>
            
            <div className={`w-36 h-36 mx-auto rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 border-4 border-yellow-200 flex items-center justify-center text-6xl shadow-2xl shadow-yellow-500/20 ${coinFlipped && !duelWinnerId ? 'animate-bounce animate-spin' : ''}`}>
              {duelWinnerId ? (duelWinnerId === user._id ? '👑' : '💀') : '💰'}
            </div>

            {!duelWinnerId ? (
              <div className="text-yellow-400 font-bold text-xl animate-pulse">Монетка крутится...</div>
            ) : (
              <div className="space-y-4 animate-scaleUp">
                <div className="text-2xl font-black text-white">
                  {duelWinnerId === user._id ? '🎉 ВЫ ВЫИГРАЛИ! 🎉' : '😢 ВЫ ПРОИГРАЛИ!'}
                </div>
                <div 
                  className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-slate-300 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: duelResultText }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Личный баланс */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-wide">Арена: Дуэли и Ставки</h2>
          <p className="text-slate-400 mt-1">Подбрасывайте монетку на карму или долги, ставьте на своевременность возврата чужих долгов.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-4 bg-slate-800/50 px-6 py-3 rounded-xl border border-slate-700/50">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Игровая Валюта</div>
            <div className="text-2xl font-black text-emerald-400">{user.karma} ₸ Кармы</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm">
          ✅ {success}
        </div>
      )}

      {/* Сетка: Дуэли и Тотализатор */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ================= ДУЭЛИ ================= */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
              <span>⚔️</span>
              <span>Бросить вызов другу</span>
            </h3>

            <form onSubmit={handleChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Оппонент (Друг)</label>
                <select
                  value={selectedOpponent}
                  onChange={(e) => {
                    setSelectedOpponent(e.target.value);
                    setSelectedDebtId('');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Выберите из списка друзей...</option>
                  {friends.map(friend => (
                    <option key={friend._id} value={friend._id}>{friend.name} (@{friend.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Тип ставки</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setWagerType('karma')}
                    className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                      wagerType === 'karma'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    🪙 Карма
                  </button>
                  <button
                    type="button"
                    onClick={() => setWagerType('debt')}
                    className={`py-3 rounded-xl font-bold text-sm transition-all border ${
                      wagerType === 'debt'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    💸 Долг
                  </button>
                </div>
              </div>

              {wagerType === 'karma' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Размер ставки (Карма)</label>
                  <input
                    type="number"
                    value={karmaWager}
                    onChange={(e) => setKarmaWager(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="Например, 100"
                    min="1"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Связанный долг</label>
                  {duelDebts.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-950/60 p-3 border border-slate-800 rounded-xl">
                      У вас нет активных взаимных долгов с этим другом.
                    </div>
                  ) : (
                    <select
                      value={selectedDebtId}
                      onChange={(e) => setSelectedDebtId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">Выберите долг...</option>
                      {duelDebts.map(d => (
                        <option key={d._id} value={d._id}>
                          {d.description} ({d.amount} ₸)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5"
              >
                Отправить вызов ⚔️
              </button>
            </form>
          </div>

          {/* Список дуэлей */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Активные вызовы</h3>
            
            {myDuels.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Нет активных предложений дуэли.
              </div>
            ) : (
              <div className="space-y-3">
                {myDuels.map(duel => {
                  const isChallenger = duel.challenger._id === user._id;
                  const otherUser = isChallenger ? duel.opponent : duel.challenger;
                  
                  return (
                    <div key={duel._id} className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          {isChallenger ? 'Вы вызвали:' : 'Вас вызвал:'}
                        </div>
                        <div className="font-bold text-white mt-0.5">
                          {otherUser.name} (@{otherUser.username})
                        </div>
                        <div className="text-xs text-indigo-400 mt-1">
                          {duel.wager > 0 ? `Ставка: ${duel.wager} ₸ Кармы` : `Ставка: Розыгрыш долга "${duel.debtId?.description || 'Долг'}"`}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {!isChallenger ? (
                          <>
                            <button
                              onClick={() => handleRespondToDuel(duel._id, 'accept')}
                              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all"
                            >
                              Принять 🪙
                            </button>
                            <button
                              onClick={() => handleRespondToDuel(duel._id, 'reject')}
                              className="px-4 py-2 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg hover:bg-red-600/30 transition-all"
                            >
                              Отклонить
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 uppercase tracking-widest animate-pulse">Ожидание...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================= СТАВКИ / ТОТАЛИЗАТОР ================= */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                <span>🎰</span>
                <span>Тотализатор</span>
              </h3>
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-slate-400">Ставка:</span>
                <input
                  type="number"
                  value={bettingWager}
                  onChange={(e) => setBettingWager(e.target.value)}
                  className="w-16 bg-transparent text-center font-bold text-white text-sm focus:outline-none"
                  min="10"
                />
                <span className="text-xs text-emerald-400">₸</span>
              </div>
            </div>

            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Вы можете сделать ставку Кармы на долги ваших друзей. Прогнозы на своевременность возврата рассчитываются по коэффициентам, а 1% комиссии со всех ставок идет в еженедельный лотерейный Джекпот!
            </p>

            {friendsDebts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm border border-slate-800/80 rounded-xl bg-slate-950/20">
                Нет активных долгов друзей для совершения ставок.
              </div>
            ) : (
              <div className="space-y-4">
                {friendsDebts.map(d => {
                  const hasBetOnThis = myBets.some(b => b.debtId?._id === d._id);
                  
                  return (
                    <div key={d._id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs text-slate-500">Долг друга:</div>
                          <h4 className="text-sm font-bold text-white mt-0.5">
                            {d.debtor.name} → {d.creditor.name}
                          </h4>
                          <p className="text-xs text-slate-400 italic mt-0.5">"{d.description}"</p>
                        </div>
                        <span className="text-emerald-400 font-extrabold text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {d.amount} ₸
                        </span>
                      </div>

                      {/* Лимиты по ELO коэффициентов */}
                      <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/50">
                        <span>Должник ELO: <b className="text-slate-300">{d.debtor.eloRating}</b></span>
                        <span>Кредитор ELO: <b className="text-slate-300">{d.creditor.eloRating}</b></span>
                      </div>

                      {hasBetOnThis ? (
                        <div className="text-center py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 text-xs font-semibold">
                          Ставка на этот долг уже принята
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 pt-2">
                          <button
                            onClick={() => {
                              setBettingPredictions({ ...bettingPredictions, [d._id]: true });
                              // Триггерим ставку мгновенно после выбора
                              setTimeout(() => handlePlaceBet(d._id), 100);
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                              bettingPredictions[d._id] === true
                                ? 'bg-emerald-600 border-emerald-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-emerald-400 hover:border-slate-700'
                            }`}
                          >
                            Вернет вовремя
                          </button>
                          <button
                            onClick={() => {
                              setBettingPredictions({ ...bettingPredictions, [d._id]: false });
                              setTimeout(() => handlePlaceBet(d._id), 100);
                            }}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                              bettingPredictions[d._id] === false
                                ? 'bg-red-600 border-red-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-red-400 hover:border-slate-700'
                            }`}
                          >
                            Просрочит
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Мои ставки */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">История ваших ставок</h3>

            {myBets.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Вы еще не делали ставок.
              </div>
            ) : (
              <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                {myBets.map(b => (
                  <div key={b._id} className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">
                        {b.debtId?.debtor?.name} vs {b.debtId?.creditor?.name}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        Прогноз: <b className={b.prediction ? 'text-emerald-400' : 'text-red-400'}>{b.prediction ? 'Вовремя' : 'С просрочкой'}</b>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-slate-300 font-bold">{b.wager} ₸ Кармы</div>
                      <div className="mt-1">
                        {b.status === 'pending' && <span className="text-yellow-400 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-[10px]">В игре</span>}
                        {b.status === 'won' && <span className="text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px]">Выиграл</span>}
                        {b.status === 'lost' && <span className="text-red-400 px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-[10px]">Проиграл</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
