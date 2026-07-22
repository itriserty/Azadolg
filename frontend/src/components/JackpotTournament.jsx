import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const calcEloProb = (elo1 = 1000, elo2 = 1000) => {
  const diff = (Number(elo1) || 1000) - (Number(elo2) || 1000);
  const prob = 0.5 + (diff / 4000);
  const clamped = Math.max(0.10, Math.min(0.90, prob));
  return Math.round(clamped * 100);
};

export default function JackpotTournament({ currentUser }) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'matches' | 'playoffs' | 'prizes'
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedH2H, setSelectedH2H] = useState(null);

  const fetchTournament = async () => {
    try {
      setLoading(true);
      const res = await api.getActiveTournament();
      if (res && res._id) {
        setTournament(res);
      } else {
        setTournament(null);
      }
    } catch (err) {
      console.error('[JackpotTournament] Error fetching tournament:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournament();
  }, []);

  const handleStartMatch = async (matchId) => {
    if (!tournament) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.startTournamentMatch(tournament._id, matchId);
      setMessage({ type: 'success', text: res.message || 'Вызов на дуэль отправлен сопернику!' });
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка вызова' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptMatch = async (matchId) => {
    if (!tournament) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.acceptTournamentMatch(tournament._id, matchId);
      setMessage({ type: 'success', text: res.message || 'Дуэль принята! Математический жребий сыгран.' });
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка принятия дуэли' });
    } finally {
      setActionLoading(false);
    }
  };

  const [customPoolInput, setCustomPoolInput] = useState('');

  const handleStartTournament = async () => {
    try {
      setActionLoading(true);
      setMessage(null);
      const poolVal = customPoolInput ? Number(customPoolInput) : null;
      const res = await api.startTournamentAdmin(null, poolVal);
      setMessage({ type: 'success', text: res.message || 'Турнир успешно запущен!' });
      setCustomPoolInput('');
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка запуска турнира' });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-cyan-400 font-bold animate-pulse">
        🏆 Загрузка Турнирного Джекпота...
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'admin';

  if (!tournament) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center text-slate-300 space-y-4">
        <div className="text-4xl mb-1">🎰</div>
        <h3 className="text-lg font-black text-white">Турнирный Джекпот не запущен</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Администратор запустит турнир на 6 обычных игроков (без админов), где участники сразятся в групповом этапе (до 2 побед, Bo3) и ФИНАЛЕ (до 3 побед, Bo5) за призовой фонд!
        </p>

        {message && (
          <div className={`p-3 rounded-xl text-xs font-bold ${
            message.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
          }`}>
            {message.text}
          </div>
        )}

        {isAdmin && (
          <div className="pt-2 max-w-xs mx-auto space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Выделить сумму из Джекпота (опционально):</label>
              <input
                type="number"
                placeholder="Вся сумма джекпота или укажите число (например 5000)"
                value={customPoolInput}
                onChange={e => setCustomPoolInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white text-center font-bold focus:outline-none focus:border-amber-400"
              />
            </div>
            <button
              onClick={handleStartTournament}
              disabled={actionLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition disabled:opacity-50"
            >
              {actionLoading ? 'Запуск...' : '🏆 Запустить Турнирный Джекпот (6 игроков)'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const currentUserId = currentUser?._id || currentUser?.id;

  const stageLabels = {
    group_A: 'Группа A',
    group_B: 'Группа B',
    group_A_tiebreak: '⚡ ТАЙ-БРЕЙК Группа A',
    group_B_tiebreak: '⚡ ТАЙ-БРЕЙК Группа B',
    semi_final_1: 'Полуфинал 1 (1A vs 2B)',
    semi_final_2: 'Полуфинал 2 (1B vs 2A)',
    third_place: 'Матч за 3-е место',
    final: '🏆 ФИНАЛ'
  };

  const handleCancelTournament = async () => {
    if (!window.confirm('Вы действительно хотите отменить активный турнир? Выделенный призовой фонд будет возвращен в накопительный джекпот-пул.')) {
      return;
    }
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.cancelTournamentAdmin();
      setMessage({ type: 'success', text: res.message || 'Турнир отменен, средства возвращены в джекпот!' });
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка отмены турнира' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-100 space-y-6">
      {/* Header / Pool Banner */}
      <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-slate-900 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-black text-amber-400 mb-1">
            <span>🏆 {tournament.title || 'Еженедельный Турнир'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              tournament.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
              tournament.status === 'playoffs' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
              'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            }`}>
              {tournament.status === 'completed' ? 'ЗАВЕРШЁН' : tournament.status === 'playoffs' ? 'ПЛЕЙ-ОФФ' : 'ГРУППОВОЙ ЭТАП'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
            <span>Призовой фонд:</span>
            <span className="text-amber-400 font-extrabold">{tournament.jackpotPool.toLocaleString('ru')} ✧</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            6 обычных игроков • 2 группы по 3 человека • Bo3 в группах • Bo5 в Финале
          </p>
        </div>

        {isAdmin && tournament.status !== 'completed' && (
          <button
            onClick={handleCancelTournament}
            disabled={actionLoading}
            className="bg-rose-600/90 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider shadow transition active:scale-95 disabled:opacity-40"
          >
            🛑 Отменить турнир (Откат)
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold ${
          message.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border border-rose-500/50 text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
            activeTab === 'groups' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          📊 Групповой этап
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition relative ${
            activeTab === 'matches' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          ⚔️ Матчи и Дуэли
        </button>
        <button
          onClick={() => setActiveTab('playoffs')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
            activeTab === 'playoffs' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          🔥 Сетка Плей-офф
        </button>
        <button
          onClick={() => setActiveTab('prizes')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
            activeTab === 'prizes' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          🎁 Призы (40%/25%/10%)
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition ${
            activeTab === 'rules' ? 'bg-amber-500 text-slate-950 shadow-lg' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          📜 Правила и Математика
        </button>
      </div>

      {/* TAB 1: GROUP STANDINGS */}
      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* GROUP A */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>🅰️ Группа A</span>
              <span className="text-[10px] text-slate-400 font-normal">Топ-2 проходят в Плей-офф</span>
            </h3>
            <div className="space-y-2">
              {tournament.standings?.groupA?.map((item, idx) => {
                const isPass = idx < 2;
                return (
                  <div key={item.user?._id || idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                    isPass ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-white">{item.user?.name || 'Игрок'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400"><b className="text-emerald-400">{item.wins} В</b> / <b className="text-rose-400">{item.losses} П</b></span>
                      <span className="font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">{item.points} Очков</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GROUP B */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>🅱️ Группа B</span>
              <span className="text-[10px] text-slate-400 font-normal">Топ-2 проходят в Плей-офф</span>
            </h3>
            <div className="space-y-2">
              {tournament.standings?.groupB?.map((item, idx) => {
                const isPass = idx < 2;
                return (
                  <div key={item.user?._id || idx} className={`flex items-center justify-between p-3 rounded-xl border ${
                    isPass ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === 0 ? 'bg-amber-500 text-slate-950' : idx === 1 ? 'bg-slate-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-white">{item.user?.name || 'Игрок'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-400"><b className="text-emerald-400">{item.wins} В</b> / <b className="text-rose-400">{item.losses} П</b></span>
                      <span className="font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg">{item.points} Очков</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MATCHES & DUELS */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            💡 Оба игрока проводят дуэль и должны подтвердить результат в приложении. Результаты мгновенно обновляют таблицу и публикуются в группу!
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournament.matches?.map((match) => {
              const p1 = match.player1;
              const p2 = match.player2;
              const isParticipant = currentUserId && (p1?._id === currentUserId || p2?._id === currentUserId);
              const isConfirmed = match.status === 'confirmed';
              const isReported = match.status === 'reported';
              const hasUserConfirmed = currentUserId && match.confirmedBy?.includes(currentUserId);

              const prob1 = calcEloProb(p1?.eloRating, p2?.eloRating);
              const prob2 = 100 - prob1;

              return (
                <div key={match._id} className={`p-4 rounded-2xl border transition ${
                  isConfirmed ? 'bg-slate-900/40 border-slate-800 opacity-80' :
                  isReported ? 'bg-purple-950/30 border-purple-500/40' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 mb-2">
                    <span className="text-amber-400">{stageLabels[match.stage] || match.stage}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-[10px]" title="Математический шанс на победу по ELO">
                        Шанс ELO: <b className="text-amber-300">{prob1}% / {prob2}%</b>
                      </span>
                      <span className="bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {match.winsRequired === 3 ? 'Bo5 (до 3 побед)' : 'Bo3 (до 2 побед)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center my-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className={`font-bold text-xs flex items-center gap-1.5 ${match.winner?._id === p1?._id ? 'text-emerald-400 font-extrabold' : 'text-white'}`}>
                      <span>{p1?.name || 'Игрок 1'}</span>
                      {match.winner?._id === p1?._id && '🏆'}
                      <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-black text-xs">{match.winsP1 || 0}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-black px-1">:</span>
                    <div className={`font-bold text-xs flex items-center gap-1.5 ${match.winner?._id === p2?._id ? 'text-emerald-400 font-extrabold' : 'text-white'}`}>
                      <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded font-black text-xs">{match.winsP2 || 0}</span>
                      <span>{p2?.name || 'Игрок 2'}</span>
                      {match.winner?._id === p2?._id && '🏆'}
                    </div>
                  </div>

                  {/* H2H Head-to-Head Statistics Widget */}
                  {match.h2h && (
                    <div className="flex justify-between items-center bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] my-2">
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        <span className="font-bold text-amber-400">⚔️ H2H:</span>
                        <span className="text-slate-300">
                          <b className="text-white font-bold">{p1?.name}</b> <b className="text-emerald-400 font-extrabold">{match.h2h.winsP1}В</b> ({match.h2h.winrateP1}%)
                        </span>
                        <span className="text-slate-600 font-black">vs</span>
                        <span className="text-slate-300">
                          ({match.h2h.winrateP2}%) <b className="text-emerald-400 font-extrabold">{match.h2h.winsP2}В</b> <b className="text-white font-bold">{p2?.name}</b>
                        </span>
                      </div>
                      <button 
                        onClick={() => setSelectedH2H(match.h2h)}
                        className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/30 font-bold transition flex-shrink-0 ml-2"
                      >
                        История ({match.h2h.totalMatches}) 📜
                      </button>
                    </div>
                  )}

                  {/* Actions for players */}
                  {isParticipant && !isConfirmed && (
                    <div className="space-y-2 mt-3 pt-2 border-t border-slate-800/60">
                      {match.status === 'pending' && (
                        <button
                          onClick={() => handleStartMatch(match._id)}
                          disabled={actionLoading}
                          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs py-2.5 rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
                        >
                          🎲 Начать партию (Шансы: {prob1}% / {prob2}%)
                        </button>
                      )}

                      {(match.status === 'requested' || match.currentLegStatus === 'requested') && (
                        <div>
                          {match.requestedBy?._id === currentUserId || match.requestedBy === currentUserId ? (
                            <div className="text-center text-[11px] font-bold text-amber-400 animate-pulse bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                              ⏳ Вы бросили вызов! Ожидается подтверждение соперника...
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAcceptMatch(match._id)}
                              disabled={actionLoading}
                              className="w-full bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
                            >
                              ⚡ Принять вызов и бросить жребий ELO ({prob1}% / {prob2}%)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PLAYOFF BRACKET */}
      {activeTab === 'playoffs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3">⚔️ Полуфинал 1 (1A vs 2B)</h4>
              {tournament.matches?.filter(m => m.stage === 'semi_final_1').map(m => (
                <div key={m._id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span>{m.player1?.name} vs {m.player2?.name}</span>
                  <span className="font-bold text-amber-400">{m.winner?.name ? `Победитель: ${m.winner.name}` : m.status}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3">⚔️ Полуфинал 2 (1B vs 2A)</h4>
              {tournament.matches?.filter(m => m.stage === 'semi_final_2').map(m => (
                <div key={m._id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span>{m.player1?.name} vs {m.player2?.name}</span>
                  <span className="font-bold text-amber-400">{m.winner?.name ? `Победитель: ${m.winner.name}` : m.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3">🥉 Матч за 3-е место</h4>
              {tournament.matches?.filter(m => m.stage === 'third_place').map(m => (
                <div key={m._id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span>{m.player1?.name} vs {m.player2?.name}</span>
                  <span className="font-bold text-amber-400">{m.winner?.name ? `3-е место: ${m.winner.name}` : m.status}</span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 border-amber-500/30">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider mb-3">👑 ФИНАЛ</h4>
              {tournament.matches?.filter(m => m.stage === 'final').map(m => (
                <div key={m._id} className="bg-slate-950 p-3 rounded-xl border border-amber-500/40 flex justify-between items-center text-xs">
                  <span>{m.player1?.name} vs {m.player2?.name}</span>
                  <span className="font-black text-emerald-400">{m.winner?.name ? `🏆 Победитель: ${m.winner.name}` : m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PRIZE BREAKDOWN */}
      {activeTab === 'prizes' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">💰 Распределение призового фонда</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            <div className="bg-amber-950/40 border border-amber-500/50 p-4 rounded-xl">
              <div className="text-amber-400 font-black">🥇 1-е место — 40%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.40)} ✧</div>
            </div>
            <div className="bg-slate-950 border border-slate-700 p-4 rounded-xl">
              <div className="text-slate-300 font-black">🥈 2-е место — 25%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.25)} ✧</div>
            </div>
            <div className="bg-slate-950 border border-amber-800/40 p-4 rounded-xl">
              <div className="text-amber-600 font-black">🥉 3-е место — 10%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.10)} ✧</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-slate-400 font-black">🏅 4-е место — 10%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.10)} ✧</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-slate-400 font-black">🎗 5-е место — 7.5%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.075)} ✧</div>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="text-slate-400 font-black">🎗 6-е место — 7.5%</div>
              <div className="text-white text-lg font-black mt-1">{Math.round(tournament.jackpotPool * 0.075)} ✧</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RULES & ELO MATH COMMENTARY */}
      {activeTab === 'rules' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-6">
          <div>
            <h3 className="text-base font-black text-amber-400 uppercase tracking-wider flex items-center gap-2 mb-1">
              <span>📜 Правила Турнирного Джекпота и Математика Вероятностей</span>
            </h3>
            <p className="text-xs text-slate-400">
              Пожалуйста, ознакомьтесь с правилами проведения матчей, форматом серий и формулой расчета шансов на победу.
            </p>
          </div>

          {/* Section 1: Elo Math Formula */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>🧮 Математическая формула вероятностей (ELO)</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              В основе исхода партий лежит базовая вероятность <b>50% на 50%</b>, которая корректируется в зависимости от рейтинга ELO каждого игрока. Чем выше ваш ELO по сравнению с соперником, тем выше ваш шанс на победу в партии.
            </p>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg text-center font-mono text-xs text-amber-400 font-bold">
              Шанс победы P₁ = 50% + (ELO₁ - ELO₂) / 40% &nbsp; [Ограничение: от 10% до 90%]
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-center">
                <div className="text-slate-400 font-bold text-[11px]">Равный ELO (1000 vs 1000)</div>
                <div className="text-amber-400 font-black text-sm mt-1">50% vs 50%</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Абсолютно равные шансы</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-center">
                <div className="text-slate-400 font-bold text-[11px]">Разница 500 ELO (1500 vs 1000)</div>
                <div className="text-amber-400 font-black text-sm mt-1">62.5% vs 37.5%</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Умеренное преимущество</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-center">
                <div className="text-slate-400 font-bold text-[11px]">Разница 1000 ELO (2000 vs 1000)</div>
                <div className="text-amber-400 font-black text-sm mt-1">75.0% vs 25.0%</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Высокий шанс фаворита</div>
              </div>
            </div>
          </div>

          {/* Section 2: Tournament Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-bold text-amber-400 uppercase text-[11px]">⚔️ Формат серий матчей</div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                <li><b>Групповой этап, 1/2 и 3-е место:</b> серии до 2-х побед (<b>Bo3</b>).</li>
                <li><b>🏆 ФИНАЛ:</b> серия до 3-х побед (<b>Bo5</b>).</li>
                <li>Турнирные дуэли абсолютно бесплатны (0 кармы на входе).</li>
              </ul>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-bold text-amber-400 uppercase text-[11px]">🤝 Проведение партий</div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                <li>Игрок бросает вызов на партию <b>«🎲 Начать партию»</b>.</li>
                <li>Соперник подтверждает дуэль <b>«⚡ Принять вызов»</b>.</li>
                <li>Система автоматически бросает математический жребий по ELO!</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC TOURNAMENT WIN PROBABILITY WIDGET (AT BOTTOM) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <span>📊 Динамический Шанс на Занятие 1-го Места</span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Вероятность победы рассчитывается в реальном времени на основе ELO рейтинга, очков в группе и побед
            </p>
          </div>
          <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
            Live Аналитика
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(() => {
            if (!tournament || !tournament.participants) return null;
            const statsMap = {};
            tournament.participants.forEach(p => {
              statsMap[p._id] = { user: p, wins: 0, points: 0, elo: p.eloRating || 1000 };
            });

            ['groupA', 'groupB'].forEach(gKey => {
              tournament.standings?.[gKey]?.forEach(item => {
                const uId = item.user?._id || item.user;
                if (statsMap[uId]) {
                  statsMap[uId].wins = item.wins || 0;
                  statsMap[uId].points = item.points || 0;
                }
              });
            });

            const items = Object.values(statsMap);
            let totalWeight = 0;
            const scored = items.map(it => {
              const w = it.elo + (it.points * 150) + (it.wins * 100);
              totalWeight += w;
              return { ...it, weight: w };
            });

            const ranked = scored.map(it => ({
              ...it,
              chance: totalWeight > 0 ? Math.round((it.weight / totalWeight) * 100) : 16
            })).sort((a, b) => b.chance - a.chance);

            return ranked.map((item, idx) => (
              <div key={item.user?._id || idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400 text-[11px]">#{idx + 1}</span>
                    <span className="font-bold text-white text-xs">{item.user?.name || 'Игрок'}</span>
                  </div>
                  <span className="text-amber-400 font-extrabold text-xs">{item.chance}%</span>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.chance}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500">
                  <span>{item.elo} ELO</span>
                  <span>{item.points} Очков ({item.wins} Побед)</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* HEAD-TO-HEAD RIVALRY MODAL */}
      {selectedH2H && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                <span>⚔️ История Личных Встреч (Head-to-Head)</span>
              </h3>
              <button 
                onClick={() => setSelectedH2H(null)}
                className="text-slate-400 hover:text-white font-black text-lg p-1 transition"
              >
                ✕
              </button>
            </div>

            {/* Winrate Stats Header */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="text-left">
                  <div className="text-white text-sm font-black">{selectedH2H.userA?.name}</div>
                  <div className="text-emerald-400 text-xs font-extrabold">{selectedH2H.winsP1} Побед ({selectedH2H.winrateP1}%)</div>
                </div>
                <div className="text-center bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-400 text-[11px]">
                  Всего встреч: <b className="text-white font-black">{selectedH2H.totalMatches}</b>
                </div>
                <div className="text-right">
                  <div className="text-white text-sm font-black">{selectedH2H.userB?.name}</div>
                  <div className="text-cyan-400 text-xs font-extrabold">{selectedH2H.winsP2} Побед ({selectedH2H.winrateP2}%)</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-900 rounded-full h-3 flex overflow-hidden border border-slate-800">
                <div 
                  className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-500"
                  style={{ width: `${selectedH2H.winrateP1}%` }}
                />
                <div 
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-500"
                  style={{ width: `${selectedH2H.winrateP2}%` }}
                />
              </div>
            </div>

            {/* History List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Хронология всех дуэлей и матчей:</h4>
              {selectedH2H.history?.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-4 text-center bg-slate-950 rounded-xl border border-slate-800">
                  Игроки еще не встречались на арене. Это их первое принципиальное противостояние! ⚔️
                </div>
              ) : (
                selectedH2H.history?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        item.type === 'tournament' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                      }`}>
                        {item.type === 'tournament' ? '🏆 Турнир' : '⚔️ Дуэль'}
                      </span>
                      <span className="text-slate-300">Победил: <b className="text-emerald-400 font-bold">{item.winnerName}</b></span>
                    </div>
                    <div className="text-right text-[11px] text-amber-400 font-mono font-bold">
                      {item.score || (item.wager ? `+${item.wager} ✧` : '1 : 0')}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setSelectedH2H(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl border border-slate-700 transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
