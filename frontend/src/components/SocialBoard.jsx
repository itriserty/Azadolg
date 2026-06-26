import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function SocialBoard({ user, onUpdateUser }) {
  const [funds, setFunds] = useState([]);
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Форма краудфандинга
  const [fundTitle, setFundTitle] = useState('');
  const [fundTarget, setFundTarget] = useState(1000);
  const [contributionAmounts, setContributionAmounts] = useState({}); // { fundId: amount }

  // Форма квестов
  const [questTitle, setQuestTitle] = useState('');
  const [questDesc, setQuestDesc] = useState('');
  const [questReward, setQuestReward] = useState(100);

  useEffect(() => {
    fetchBoardData();
  }, []);

  const fetchBoardData = async () => {
    try {
      setLoading(true);
      const [fundsList, questsList] = await Promise.all([
        api.getFunds(),
        api.getQuests()
      ]);
      setFunds(fundsList);
      setQuests(questsList);
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки социальных механик');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFund = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!fundTitle.trim()) return setError('Назовите сбор');

    try {
      setLoading(true);
      const res = await api.createFund(fundTitle.trim(), Number(fundTarget));
      setSuccess(res.message);
      setFundTitle('');
      setFundTarget(1000);
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка создания сбора');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (fundId) => {
    setError('');
    setSuccess('');
    const amt = Number(contributionAmounts[fundId]);
    if (!amt || amt <= 0) return setError('Введите сумму взноса больше 0');

    try {
      setLoading(true);
      const res = await api.contributeToFund(fundId, amt);
      setSuccess(res.message);
      
      if (res.userKarma !== undefined) {
        onUpdateUser({ ...user, karma: res.userKarma });
      }
      
      setContributionAmounts({ ...contributionAmounts, [fundId]: '' });
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка совершения взноса');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!questTitle.trim() || !questDesc.trim()) return setError('Заполните название и суть поручения');

    try {
      setLoading(true);
      const res = await api.createQuest(
        questTitle.trim(),
        questDesc.trim(),
        Number(questReward)
      );
      setSuccess(res.message);
      
      if (res.creatorKarma !== undefined) {
        onUpdateUser({ ...user, karma: res.creatorKarma });
      }

      setQuestTitle('');
      setQuestDesc('');
      setQuestReward(100);
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка создания квеста');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeQuest = async (questId) => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const res = await api.takeQuest(questId);
      setSuccess(res.message);
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteQuest = async (questId) => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const res = await api.completeQuest(questId);
      setSuccess(res.message);
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка отправки квеста');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyQuest = async (questId, action) => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const res = await api.verifyQuest(questId, action);
      setSuccess(res.message);

      // Если квест подтвержден — обновляем баланс (могли начислиться ELO/XP/Карма)
      const profile = await api.getMe();
      onUpdateUser(profile);

      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка проверки');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelQuest = async (questId) => {
    setError('');
    setSuccess('');
    try {
      setLoading(true);
      const res = await api.cancelQuest(questId);
      setSuccess(res.message);
      
      if (res.creatorKarma !== undefined) {
        onUpdateUser({ ...user, karma: res.creatorKarma });
      }
      
      await fetchBoardData();
    } catch (err) {
      setError(err.message || 'Ошибка отмены квеста');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Личный баланс */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-wide">Община: Котлы и Поручения</h2>
          <p className="text-slate-400 mt-1">Организовывайте совместные сборы на общие нужды и помогайте друзьям за Карму.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center bg-slate-800/50 px-6 py-3 rounded-xl border border-slate-700/50">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Ваш Баланс</div>
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

      {/* Сетка: Котлы (Краудфандинг) и Квесты */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* ================= КРАУДФАНДИНГ (ОБЩИЕ КОТЛЫ) ================= */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
              <span>🏺</span>
              <span>Создать Общий Котёл</span>
            </h3>

            <form onSubmit={handleCreateFund} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Название сбора / цель</label>
                <input
                  type="text"
                  value={fundTitle}
                  onChange={(e) => setFundTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Например, На пиццу к выходным 🍕"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Целевая сумма (Карма)</label>
                <input
                  type="number"
                  value={fundTarget}
                  onChange={(e) => setFundTarget(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  min="100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5"
              >
                Организовать сбор 📢
              </button>
            </form>
          </div>

          {/* Список сборов */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Активные сборы</h3>
            
            {funds.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm border border-slate-800/80 rounded-xl bg-slate-950/20">
                Нет запущенных краудфандинг-кампаний.
              </div>
            ) : (
              funds.map(f => {
                const percent = Math.min(100, Math.round((f.currentAmount / f.targetAmount) * 100));
                
                return (
                  <div key={f._id} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-white">{f.title}</h4>
                        <div className="text-xs text-slate-500 mt-0.5">Организатор: {f.creator.name}</div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${f.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'}`}>
                        {f.status === 'completed' ? 'Собрано 🎉' : 'Сбор активен'}
                      </span>
                    </div>

                    {/* Шкала прогресса */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Прогресс: {percent}%</span>
                        <span className="text-white">{f.currentAmount} / {f.targetAmount} ₸</span>
                      </div>
                      <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-indigo-500 h-full transition-all duration-500" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {f.status === 'active' && (
                      <div className="flex items-center space-x-2 pt-2">
                        <input
                          type="number"
                          value={contributionAmounts[f._id] || ''}
                          onChange={(e) => setContributionAmounts({ ...contributionAmounts, [f._id]: e.target.value })}
                          className="w-24 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none"
                          placeholder="Сумма"
                          min="10"
                        />
                        <button
                          onClick={() => handleContribute(f._id)}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                        >
                          Поддержать котёл 🪙
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= ДОСКА КВЕСТОВ (ПОРУЧЕНИЙ) ================= */}
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center space-x-2">
              <span>🎯</span>
              <span>Разместить Поручение</span>
            </h3>

            <form onSubmit={handleCreateQuest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Название поручения / Краткая суть</label>
                <input
                  type="text"
                  value={questTitle}
                  onChange={(e) => setQuestTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Например, Купить батон хлеба 🍞"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Детальное описание / Условия</label>
                <textarea
                  value={questDesc}
                  onChange={(e) => setQuestDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Купить батон нарезного, принести в кабинет 305 до обеда..."
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Награда исполнителю (Карма)</label>
                <input
                  type="number"
                  value={questReward}
                  onChange={(e) => setQuestReward(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  min="20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5"
              >
                Опубликовать квест 🎯
              </button>
            </form>
          </div>

          {/* Список квестов */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Доска Поручений</h3>

            {quests.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm border border-slate-800/80 rounded-xl bg-slate-950/20">
                Доска квестов пока пуста. Задайте первое поручение!
              </div>
            ) : (
              quests.map(q => {
                const isMyCreated = q.creator._id === user._id;
                const isMyAssigned = q.assignee && q.assignee._id === user._id;
                
                return (
                  <div key={q._id} className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-bold text-white">{q.title}</h4>
                        <div className="text-xs text-slate-500">Заказчик: {q.creator.name}</div>
                      </div>
                      <span className="text-emerald-400 font-extrabold text-sm bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                        +{q.karmaReward} ₸
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50 leading-relaxed">
                      {q.description}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                        Статус: {' '}
                        {q.status === 'available' && <span className="text-blue-400">Доступен</span>}
                        {q.status === 'in_progress' && <span className="text-yellow-400">В работе ({q.assignee?.name})</span>}
                        {q.status === 'completed' && <span className="text-purple-400">На проверке ({q.assignee?.name})</span>}
                        {q.status === 'verified' && <span className="text-emerald-400">Завершен ✅</span>}
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Логика доступных кнопок в зависимости от статуса */}
                        {q.status === 'available' && !isMyCreated && (
                          <button
                            onClick={() => handleTakeQuest(q._id)}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all"
                          >
                            Взять квест ⚔️
                          </button>
                        )}

                        {q.status === 'available' && isMyCreated && (
                          <button
                            onClick={() => handleCancelQuest(q._id)}
                            className="px-3.5 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-lg hover:bg-red-600/30 transition-all"
                          >
                            Отменить
                          </button>
                        )}

                        {q.status === 'in_progress' && isMyAssigned && (
                          <button
                            onClick={() => handleCompleteQuest(q._id)}
                            className="px-3.5 py-1.5 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-500 transition-all"
                          >
                            Сдать выполнение 📥
                          </button>
                        )}

                        {q.status === 'completed' && isMyCreated && (
                          <>
                            <button
                              onClick={() => handleVerifyQuest(q._id, 'approve')}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-500 transition-all"
                            >
                              Одобрить ✅
                            </button>
                            <button
                              onClick={() => handleVerifyQuest(q._id, 'reject')}
                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-500 transition-all"
                            >
                              Отклонить
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
