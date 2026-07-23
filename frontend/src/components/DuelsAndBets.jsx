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
  const gameType = 'twenty_one';
  const [karmaWager, setKarmaWager] = useState(0);
  
  // Состояния для 21 Очко
  const [activeTwentyOneDuel, setActiveTwentyOneDuel] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Состояния для ставок (тотализатора)
  const [bettingWager, setBettingWager] = useState(50);
  const [bettingPredictions, setBettingPredictions] = useState({}); // { debtId: true/false }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [friendsList, ownDebts, pendingDuels, activeBets, allUsersList] = await Promise.all([
        api.getFriends().catch(() => []),
        api.getDebts(user._id).catch(() => []),
        api.getMyDuels().catch(() => []),
        api.getMyBets().catch(() => []),
        api.getUsers().catch(() => [])
      ]);

      const friendsSet = new Set((friendsList || []).map(f => f._id));
      const combinedOpponents = (allUsersList || [])
        .filter(u => u._id !== user._id && u.username !== 'dealer_bot')
        .map(u => ({
          ...u,
          isFriend: friendsSet.has(u._id)
        }));

      setFriends(combinedOpponents.length > 0 ? combinedOpponents : (friendsList || []));
      setMyDebts(ownDebts || []);
      setMyDuels(pendingDuels || []);
      setMyBets(activeBets || []);

      // Проверяем, есть ли текущая активная игра 21 Очко
      const active21 = (pendingDuels || []).find(d => d.gameType === 'twenty_one' && d.status === 'accepted');
      if (active21) {
        setActiveTwentyOneDuel(active21);
      }

      // Загружаем активные долги пользователей для ставок (тотализатор)
      const targetList = combinedOpponents.length > 0 ? combinedOpponents : (friendsList || []);
      const debtsPromises = targetList.map(friend => 
        api.getDebts(friend._id).catch(() => [])
      );
      const debtsResults = await Promise.all(debtsPromises);
      const allDebts = debtsResults.flat();
      
      const uniqueDebts = [];
      const seenIds = new Set();
      for (const d of allDebts) {
        if (d && d._id && !seenIds.has(d._id)) {
          seenIds.add(d._id);
          const isParticipant = d.debtor?._id === user._id || d.creditor?._id === user._id;
          if (!isParticipant) {
            uniqueDebts.push(d);
          }
        }
      }
      setFriendsDebts(uniqueDebts);
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
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
      const wagerValue = Number(karmaWager);

      const res = await api.createDuelChallenge(
        selectedOpponent,
        null,
        wagerValue,
        'twenty_one'
      );
      setSuccess(res.message);
      setKarmaWager(0);
      
      await fetchInitialData();
    } catch (err) {
      setError(err.message || 'Ошибка отправки вызова');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBotMatch = async () => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const res = await api.createTwentyOneBotDuel();
      setSuccess(res.message);
      setActiveTwentyOneDuel(res.duel);
      await fetchInitialData();
    } catch (err) {
      setError(err.message || 'Ошибка создания матча с ботом');
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
        const res = await api.respondToDuel(duelId, 'accept');
        setSuccess(res.message || 'Дуэль 21 Очко началась!');
        setActiveTwentyOneDuel(res.duel);
        await fetchInitialData();
      }
    } catch (err) {
      setError(err.message || 'Ошибка обработки дуэли');
    } finally {
      setLoading(false);
    }
  };

  const handleTwentyOneMove = async (action) => {
    if (!activeTwentyOneDuel || actionLoading) return;
    setError('');
    setActionLoading(true);
    try {
      const res = await api.twentyOneAction(activeTwentyOneDuel._id, action);
      setActiveTwentyOneDuel(res.duel);
      if (res.duel.status === 'finished') {
        const profile = await api.getMe();
        onUpdateUser(profile);
      }
    } catch (err) {
      setError(err.message || 'Ошибка совершения хода');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceBet = async (debtId, customPrediction) => {
    setError('');
    setSuccess('');
    const pred = customPrediction !== undefined ? customPrediction : bettingPredictions[debtId];
    if (pred === undefined) return setError('Выберите ваш прогноз на долг');
    
    const wager = Number(bettingWager);
    if (wager <= 0) return setError('Ставка должна быть больше нуля');

    const confirmed = window.confirm(`Разместить ставку ${wager} ✧ на прогноз "${pred ? 'Вернет вовремя' : 'Просрочит'}"? Это действие сработает мгновенно.`);
    if (!confirmed) return;

    try {
      setLoading(true);
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

  // Вспомогательный подсчет суммы
  const calcSum = (hand) => (hand || []).reduce((acc, c) => acc + (c?.value || 0), 0);

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

      {/* MODAL: АКТИВНАЯ ИГРА 21 ОЧКО */}
      {activeTwentyOneDuel && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md overflow-y-auto p-4 sm:p-6 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative border-t-4 border-t-indigo-500">
            
            {/* Кнопка закрытия если игра завершена */}
            <button
              onClick={() => setActiveTwentyOneDuel(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold"
            >
              ✕
            </button>

            {/* Шапка 21 Очко */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-2xl font-black text-white tracking-wide flex items-center space-x-2">
                  <span>🃏</span>
                  <span>Дуэль: 21 Очко</span>
                  <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">БЕСПЛАТНО</span>
                </h3>
                <p className="text-slate-400 text-xs mt-1">В колоде 18 карт от 3 до 11 (Красные 🔴 и Синие 🔵). Цель: набрать близко к 21.</p>
              </div>

              <div className="text-right">
                <div className="text-xs text-slate-400">Остаток колоды</div>
                <div className="text-xl font-black text-indigo-400">{activeTwentyOneDuel.gameState?.deck?.length || 0} карт</div>
              </div>
            </div>

            {/* Сообщение переигровки */}
            {activeTwentyOneDuel.gameState?.replayMessage && (
              <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-center text-sm font-bold animate-bounce">
                {activeTwentyOneDuel.gameState.replayMessage}
              </div>
            )}

            {/* Игровое поле: Руки игроков */}
            {(() => {
              const challengerId = activeTwentyOneDuel.challenger?._id || activeTwentyOneDuel.challenger;
              const isChallenger = challengerId?.toString() === user._id.toString();
              const myHand = isChallenger ? activeTwentyOneDuel.gameState?.challengerHand : activeTwentyOneDuel.gameState?.opponentHand;
              const oppHand = isChallenger ? activeTwentyOneDuel.gameState?.opponentHand : activeTwentyOneDuel.gameState?.challengerHand;

              const myPassed = isChallenger ? activeTwentyOneDuel.gameState?.challengerPassed : activeTwentyOneDuel.gameState?.opponentPassed;
              const oppPassed = isChallenger ? activeTwentyOneDuel.gameState?.opponentPassed : activeTwentyOneDuel.gameState?.challengerPassed;

              const oppUser = isChallenger ? activeTwentyOneDuel.opponent : activeTwentyOneDuel.challenger;
              const oppName = oppUser?.name || 'Соперник';
              const mySum = calcSum(myHand);
              const oppSum = calcSum(oppHand);

              const isMyTurn = activeTwentyOneDuel.gameState?.currentTurn === user._id && activeTwentyOneDuel.status === 'accepted';
              const isFinished = activeTwentyOneDuel.status === 'finished';

              return (
                <div className="space-y-6">

                  {/* Рука соперника */}
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">👤</span>
                        <span className="font-bold text-white text-sm">{oppName}</span>
                        {oppPassed && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">ПАС</span>}
                        {oppSum > 21 && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">ПЕРЕБОР</span>}
                      </div>
                      <div className="text-sm font-extrabold text-slate-300">
                        Сумма: <span className={oppSum > 21 ? 'text-red-400' : 'text-amber-400'}>{oppSum}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[70px]">
                      {oppHand?.map((card, idx) => (
                        <div
                          key={card.id || idx}
                          className={`w-16 h-20 rounded-xl flex flex-col items-center justify-between p-2 shadow-lg select-none transition-transform transform hover:scale-105 ${
                            card.suit === 'red'
                              ? 'bg-gradient-to-br from-red-600 to-rose-800 border-2 border-red-400/50 text-white'
                              : 'bg-gradient-to-br from-blue-600 to-cyan-800 border-2 border-blue-400/50 text-white'
                          }`}
                        >
                          <span className="text-xs">{card.suit === 'red' ? '🔴' : '🔵'}</span>
                          <span className="text-2xl font-black">{card.value}</span>
                          <span className="text-[9px] opacity-70 uppercase tracking-tighter">{card.suit === 'red' ? 'Красная' : 'Синяя'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Разделитель / Статус хода */}
                  <div className="text-center">
                    {isFinished ? (
                      <div className="bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border border-yellow-500/40 text-yellow-300 p-4 rounded-2xl space-y-2">
                        <div className="text-xl font-black uppercase tracking-wider">
                          {activeTwentyOneDuel.winner?._id === user._id || activeTwentyOneDuel.winner === user._id
                            ? '🎉 ВЫ ПОБЕДИЛИ В ДУЭЛИ! 🎉'
                            : '💀 ВЫ ПРОИГРАЛИ В ДУЭЛИ!'}
                        </div>
                        <div className="text-xs text-slate-300">{activeTwentyOneDuel.gameState?.lastAction}</div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700 text-xs font-bold">
                        {isMyTurn ? (
                          <span className="text-emerald-400 animate-pulse">👉 ВАШ ХОД! Выберите действие ниже.</span>
                        ) : (
                          <span className="text-slate-400">⏳ Ход соперника ({oppUser.name})...</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Рука Игрока (Вы) */}
                  <div className="bg-slate-950/80 border border-indigo-900/40 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">👑</span>
                        <span className="font-bold text-white text-sm">ВЫ ({user.name})</span>
                        {myPassed && <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">ПАС</span>}
                        {mySum > 21 && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold">ПЕРЕБОР</span>}
                      </div>
                      <div className="text-sm font-extrabold text-white">
                        Сумма: <span className={mySum > 21 ? 'text-red-400 font-black' : 'text-emerald-400 font-black'}>{mySum}</span> / 21
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[70px]">
                      {myHand?.map((card, idx) => (
                        <div
                          key={card.id || idx}
                          className={`w-16 h-20 rounded-xl flex flex-col items-center justify-between p-2 shadow-lg select-none transition-transform transform hover:scale-105 ${
                            card.suit === 'red'
                              ? 'bg-gradient-to-br from-red-600 to-rose-800 border-2 border-red-400/50 text-white'
                              : 'bg-gradient-to-br from-blue-600 to-cyan-800 border-2 border-blue-400/50 text-white'
                          }`}
                        >
                          <span className="text-xs">{card.suit === 'red' ? '🔴' : '🔵'}</span>
                          <span className="text-2xl font-black">{card.value}</span>
                          <span className="text-[9px] opacity-70 uppercase tracking-tighter">{card.suit === 'red' ? 'Красная' : 'Синяя'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Кнопки Действий */}
                  {!isFinished && (
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <button
                        onClick={() => handleTwentyOneMove('hit')}
                        disabled={!isMyTurn || myPassed || actionLoading}
                        className="py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                      >
                        {actionLoading ? 'Обработка...' : '🃏 Вытащить ещё'}
                      </button>

                      <button
                        onClick={() => handleTwentyOneMove('pass')}
                        disabled={!isMyTurn || myPassed || actionLoading}
                        className="py-4 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
                      >
                        ✋ Пас (Хватит)
                      </button>
                    </div>
                  )}

                  {/* Лог последнего действия */}
                  {activeTwentyOneDuel.gameState?.lastAction && (
                    <div className="text-center text-xs text-slate-400 italic">
                      {activeTwentyOneDuel.gameState.lastAction}
                    </div>
                  )}

                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* Личный баланс */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-wide">Арена: Дуэли 21 Очко и Ставки</h2>
          <p className="text-slate-400 mt-1">Вызывайте друзей на дуэль в 21 Очко, а также играйте против Дилер Бота.</p>
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
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg space-y-6">
            
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white flex items-center space-x-2">
                <span>⚔️</span>
                <span>Бросить вызов в 21 Очко</span>
              </h3>

              {/* Кнопка Бот-Матча для быстрого теста */}
              <button
                onClick={handleStartBotMatch}
                disabled={loading}
                className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1.5"
              >
                <span>🤖</span>
                <span>Сыграть с Ботом (21 Очко)</span>
              </button>
            </div>

            <form onSubmit={handleChallenge} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Оппонент (Друг)</label>
                <select
                  value={selectedOpponent}
                  onChange={(e) => setSelectedOpponent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Выберите оппонента для дуэли...</option>
                  {friends.map(friend => (
                    <option key={friend._id} value={friend._id}>
                      {friend.name} (@{friend.username}){friend.isFriend ? ' ⭐ Друг' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5 shadow-lg"
              >
                Бросить вызов в 21 Очко 🃏
              </button>
            </form>
          </div>

          {/* Список дуэлей */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Активные и текущие вызовы</h3>
            
            {myDuels.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-sm">
                Нет активных дуэлей.
              </div>
            ) : (
              <div className="space-y-3">
                {myDuels.map(duel => {
                  if (!duel || !duel.challenger || !duel.opponent) return null;
                  const challengerId = duel.challenger._id || duel.challenger;
                  const isChallenger = challengerId?.toString() === user._id.toString();
                  const otherUser = isChallenger ? duel.opponent : duel.challenger;
                  if (!otherUser) return null;
                  const otherName = otherUser.name || 'Пользователь';
                  const otherUsername = otherUser.username || 'user';
                  const is21 = duel.gameType === 'twenty_one';
                  const isAccepted = duel.status === 'accepted';
                  
                  return (
                    <div key={duel._id} className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-500">
                            {isChallenger ? 'Вы вызвали:' : 'Вас вызвал:'}
                          </span>
                          <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-bold uppercase">
                            {is21 ? '🃏 21 Очко' : '🪙 Монетка'}
                          </span>
                        </div>

                        <div className="font-bold text-white mt-1">
                          {otherName} (@{otherUsername})
                        </div>

                        <div className="text-xs text-indigo-400 mt-0.5">
                          {is21 ? 'Бесплатный тестовый матч' : `Ставка: ${duel.wager} ₸ Кармы`}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isAccepted && is21 ? (
                          <button
                            onClick={() => setActiveTwentyOneDuel(duel)}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-lg animate-pulse"
                          >
                            Открыть стол 🃏
                          </button>
                        ) : !isChallenger ? (
                          <>
                            <button
                              onClick={() => handleRespondToDuel(duel._id, 'accept')}
                              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all"
                            >
                              Принять {is21 ? '🃏' : '🪙'}
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
