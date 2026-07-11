import React, { useState, useEffect } from 'react';
import { PlusCircle, Calendar, ShieldAlert, Eye, UserCheck } from 'lucide-react';

const WITNESS_THRESHOLD = 10000;

export default function DebtForm({ users, currentUser, onSubmit }) {
  const [creditor,    setCreditor]    = useState('');
  const [debtor,      setDebtor]      = useState('');
  const [witnessId,   setWitnessId]   = useState('');
  const [amount,      setAmount]      = useState('');
  const [promisedReturnAmount, setPromisedReturnAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate,     setDueDate]     = useState('');
  const [incurredAt,  setIncurredAt]  = useState('');
  const [penaltyRate, setPenaltyRate] = useState(0.01);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [showRetro,   setShowRetro]   = useState(false);

  useEffect(() => {
    if (currentUser) setCreditor(currentUser._id);
  }, [currentUser]);

  const setQuickDueDate = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDueDate(d.toISOString().split('T')[0]);
  };

  const numAmount = parseFloat(amount) || 0;
  const witnessRequired = numAmount >= WITNESS_THRESHOLD;

  const witnessOptions = users.filter(u => u._id !== creditor && u._id !== debtor);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!creditor || !debtor || !amount || !description || !dueDate) {
      return setError('Заполните все обязательные поля');
    }
    if (witnessRequired && !witnessId) {
      return setError(`При сумме от ${WITNESS_THRESHOLD.toLocaleString('ru-RU')} ₸ свидетель обязателен`);
    }
    if (witnessId && (witnessId === creditor || witnessId === debtor)) {
      return setError('Свидетель не может быть кредитором или должником');
    }
    if (promisedReturnAmount && parseFloat(promisedReturnAmount) < parseFloat(amount)) {
      return setError('Обещанная сумма возврата не может быть меньше суммы займа');
    }

    setLoading(true);
    try {
      await onSubmit({
        creditor,
        debtor,
        witnessId: witnessId || null,
        amount:      parseFloat(amount),
        promisedReturnAmount: promisedReturnAmount ? parseFloat(promisedReturnAmount) : null,
        description,
        dueDate,
        penaltyRate: parseFloat(penaltyRate),
        ...(incurredAt ? { incurredAt } : {})
      });
      setAmount(''); setPromisedReturnAmount(''); setDescription(''); setDueDate('');
      setWitnessId(''); setIncurredAt('');
      setPenaltyRate(0.01); setShowRetro(false);
    } catch (err) {
      setError(err.message || 'Ошибка создания долга');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-[#0b0f19] border border-gray-800 rounded-xl p-3 text-gray-200 text-sm focus:outline-none focus:border-purple-500/60 transition';
  const labelCls = 'block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest';

  return (
    <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
      <h2 className="text-lg font-black flex items-center gap-2 mb-5 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
        <PlusCircle className="w-5 h-5 text-emerald-400" />
        Создать долг
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Кредитор + Должник */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Кто заплатил (Кредитор)</label>
            <select value={creditor} onChange={e => setCreditor(e.target.value)} className={inputCls}>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name}{u._id === currentUser?._id ? ' (Вы)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Кто должен (Должник)</label>
            <select value={debtor} onChange={e => setDebtor(e.target.value)} className={inputCls} required>
              <option value="">-- Выберите должника --</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name}{u._id === currentUser?._id ? ' (Вы)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Сумма, Обещано вернуть и Описание */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Сумма займа (₸)</label>
            <input
              type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Например: 5000 ₸" min="1" required className={inputCls}
            />
            {amount && numAmount < 500 && (
              <p className="text-[10px] text-yellow-500 mt-1">⚠️ Суммы менее 500 ₸ не дают ELO/Карму</p>
            )}
            {amount && numAmount >= WITNESS_THRESHOLD && (
              <p className="text-[10px] text-purple-400 mt-1">⚖️ Сумма ≥ {WITNESS_THRESHOLD.toLocaleString('ru-RU')} ₸ — нужен свидетель</p>
            )}
          </div>
          <div>
            <label className={`${labelCls} text-purple-400 flex items-center gap-1`}>
              Обещано вернуть (₸) <span className="text-[8px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 rounded-full font-bold">Оффер</span>
            </label>
            <input
              type="number" value={promisedReturnAmount} onChange={e => setPromisedReturnAmount(e.target.value)}
              placeholder="Опционально (больше займа)" min="1" className={inputCls}
            />
            {promisedReturnAmount && amount && Number(promisedReturnAmount) <= Number(amount) && (
              <p className="text-[10px] text-red-500 mt-1">Должно быть больше займа</p>
            )}
          </div>
          <div>
            <label className={labelCls}>За что (Описание)</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Такси, Пицца..." required className={inputCls}
            />
          </div>
        </div>

        {/* Свидетель — обязателен только при сумме ≥ 10 000 */}
        {witnessRequired ? (
          <div className="border border-purple-500/40 bg-purple-950/20 rounded-xl p-4">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-purple-400 mb-2 uppercase tracking-widest">
              <Eye className="w-3.5 h-3.5" />
              Свидетель
              <span className="ml-1 text-red-400 normal-case font-semibold">* обязателен при сумме ≥ {WITNESS_THRESHOLD.toLocaleString('ru-RU')} ₸</span>
            </label>
            <select value={witnessId} onChange={e => setWitnessId(e.target.value)} className={inputCls} required>
              <option value="">-- Выберите свидетеля --</option>
              {witnessOptions.map(u => (
                <option key={u._id} value={u._id}>{u.name} (@{u.username})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-500 mt-2">
              ⚖️ При крупных суммах свидетель подтверждает реальность долга перед активацией.
            </p>
          </div>
        ) : (
          <div className="border border-gray-800/40 bg-black/10 rounded-xl p-3">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">
              <Eye className="w-3.5 h-3.5" />
              Свидетель
              <span className="ml-1 text-gray-600 normal-case font-normal">(необязательно при сумме &lt; {WITNESS_THRESHOLD.toLocaleString('ru-RU')} ₸)</span>
            </label>
            <select value={witnessId} onChange={e => setWitnessId(e.target.value)} className={inputCls}>
              <option value="">-- Без свидетеля --</option>
              {witnessOptions.map(u => (
                <option key={u._id} value={u._id}>{u.name} (@{u.username})</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-2">
              💡 Добавьте свидетеля по желанию, чтобы повысить доверие к записи.
            </p>
          </div>
        )}

        {/* Дедлайн */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`${labelCls} flex items-center gap-1`}>
              <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Вернуть до (Дедлайн)
            </label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className={inputCls} />
            <div className="flex gap-2 mt-2">
              {[3, 7, 14, 30].map(d => (
                <button key={d} type="button" onClick={() => setQuickDueDate(d)}
                  className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 py-1 px-2 rounded-lg transition">
                  +{d}д
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Штраф за просрочку (% в день)</label>
            <select value={penaltyRate} onChange={e => setPenaltyRate(e.target.value)} className={inputCls}>
              <option value="0">Без штрафа (0%)</option>
              <option value="0.01">Лайт (1% в день)</option>
              <option value="0.02">Хардкор (2% в день)</option>
              <option value="0.05">Разбой (5% в день)</option>
            </select>
          </div>
        </div>

        {/* Ретроактивная дата (опционально) */}
        <div>
          <button type="button" onClick={() => setShowRetro(!showRetro)}
            className="text-[10px] text-gray-500 hover:text-purple-400 underline transition">
            {showRetro ? '▲ Скрыть' : '▼ Ретроактивный долг (дата возникновения в прошлом)'}
          </button>
          {showRetro && (
            <div className="mt-2 p-3 border border-amber-500/20 bg-amber-500/5 rounded-xl">
              <label className="flex items-center gap-1 text-[10px] font-bold text-amber-400 mb-1.5 uppercase tracking-widest">
                <UserCheck className="w-3.5 h-3.5" /> Фактическая дата возникновения долга
              </label>
              <input type="date" value={incurredAt} onChange={e => setIncurredAt(e.target.value)} className={inputCls} />
              <p className="text-[10px] text-gray-500 mt-1">
                ⚠️ Если дата уже просрочена — пеня будет начислена автоматически при создании.
              </p>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#0b0f19] font-black py-3 px-4 rounded-xl hover:opacity-90 shadow-emerald-500/20 shadow-md transition disabled:opacity-50 mt-1 text-sm">
          {loading ? 'Создание...' : witnessRequired ? '⚖️ Создать долг (со свидетелем)' : '✅ Создать долг'}
        </button>
      </form>
    </div>
  );
}
