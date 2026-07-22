import React, { useState, useEffect } from 'react';
import api from '../utils/api';

export default function JackpotTournament({ currentUser }) {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'matches' | 'playoffs' | 'prizes'
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);

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

  const handleReportMatch = async (matchId, winnerId) => {
    if (!tournament) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.reportTournamentMatch(tournament._id, matchId, winnerId);
      setMessage({ type: 'success', text: res.message || 'Результат отправлен на подтверждение!' });
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка отправки результата' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmMatch = async (matchId) => {
    if (!tournament) return;
    try {
      setActionLoading(true);
      setMessage(null);
      const res = await api.confirmTournamentMatch(tournament._id, matchId);
      setMessage({ type: 'success', text: res.message || 'Результат дуэли подтверждён!' });
      await fetchTournament();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Ошибка подтверждения' });
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

  if (!tournament) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center text-slate-300">
        <div className="text-4xl mb-3">🎰</div>
        <h3 className="text-lg font-black text-white mb-2">Турнирный Джекпот не запущен</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Администратор запустит еженедельный турнир на 6 игроков, где участники сразятся в групповом этапе и Плей-офф за призовой фонд!
        </p>
      </div>
    );
  }

  const currentUserId = currentUser?._id || currentUser?.id;

  const stageLabels = {
    group_A: 'Группа A',
    group_B: 'Группа B',
    semi_final_1: 'Полуфинал 1 (1A vs 2B)',
    semi_final_2: 'Полуфинал 2 (1B vs 2A)',
    third_place: 'Матч за 3-е место',
    final: '🏆 ФИНАЛ'
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
            6 игроков • 2 группы по 3 человека • 2 круга дуэлей • Плей-офф & Финал
          </p>
        </div>
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

              return (
                <div key={match._id} className={`p-4 rounded-2xl border transition ${
                  isConfirmed ? 'bg-slate-900/40 border-slate-800 opacity-80' :
                  isReported ? 'bg-purple-950/30 border-purple-500/40' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400 mb-2">
                    <span className="text-amber-400">{stageLabels[match.stage] || match.stage}</span>
                    <span>Круг {match.round}</span>
                  </div>

                  <div className="flex justify-between items-center my-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <div className={`font-bold text-xs ${match.winner?._id === p1?._id ? 'text-emerald-400 font-extrabold' : 'text-white'}`}>
                      {p1?.name || 'Игрок 1'}
                      {match.winner?._id === p1?._id && ' 🏆'}
                    </div>
                    <span className="text-xs text-slate-500 font-black px-2">VS</span>
                    <div className={`font-bold text-xs ${match.winner?._id === p2?._id ? 'text-emerald-400 font-extrabold' : 'text-white'}`}>
                      {p2?.name || 'Игрок 2'}
                      {match.winner?._id === p2?._id && ' 🏆'}
                    </div>
                  </div>

                  {/* Actions for players */}
                  {isParticipant && !isConfirmed && (
                    <div className="space-y-2 mt-3 pt-2 border-t border-slate-800/60">
                      {match.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReportMatch(match._id, p1._id)}
                            disabled={actionLoading}
                            className="flex-1 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-bold py-2 rounded-xl transition"
                          >
                            Победил {p1?.name}
                          </button>
                          <button
                            onClick={() => handleReportMatch(match._id, p2._id)}
                            disabled={actionLoading}
                            className="flex-1 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-300 text-[11px] font-bold py-2 rounded-xl transition"
                          >
                            Победил {p2?.name}
                          </button>
                        </div>
                      )}

                      {isReported && !hasUserConfirmed && (
                        <button
                          onClick={() => handleConfirmMatch(match._id)}
                          disabled={actionLoading}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs py-2.5 rounded-xl shadow-lg transition active:scale-95"
                        >
                          ✅ Подтвердить победу: {match.reportedWinner?.name}
                        </button>
                      )}

                      {isReported && hasUserConfirmed && (
                        <div className="text-center text-[11px] font-bold text-amber-400 animate-pulse">
                          ⏳ Ожидается подтверждение соперника...
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
    </div>
  );
}
