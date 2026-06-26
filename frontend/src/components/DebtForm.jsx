import React, { useState, useEffect } from 'react';
import { PlusCircle, Calendar, ShieldAlert } from 'lucide-react';

export default function DebtForm({ users, currentUser, onSubmit }) {
  const [creditor, setCreditor] = useState('');
  const [debtor, setDebtor] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [penaltyRate, setPenaltyRate] = useState(0.01); // 1% в день по умолчанию
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setCreditor(currentUser._id);
    }
  }, [currentUser]);

  // Быстрая установка даты
  const setQuickDueDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setDueDate(date.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!creditor || !debtor || !amount || !description || !dueDate) {
      setError('Пожалуйста, заполните все обязательные поля');
      setLoading(false);
      return;
    }

    if (creditor === debtor) {
      setError('Нельзя создать долг самому себе');
      setLoading(false);
      return;
    }

    try {
      await onSubmit({
        creditor,
        debtor,
        amount: parseFloat(amount),
        description,
        dueDate,
        penaltyRate: parseFloat(penaltyRate)
      });

      // Очистка полей кроме кредитора
      setAmount('');
      setDescription('');
      setDueDate('');
      setPenaltyRate(0.01);
    } catch (err) {
      setError(err.message || 'Ошибка создания транзакции');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="bg-darkCard border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
      <h2 class="text-xl font-bold flex items-center gap-2 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neonGreen to-neonCyan">
        <PlusCircle class="w-5 h-5 text-neonGreen" />
        Создать долг / Транзакцию
      </h2>

      {error && (
        <div class="mb-4 p-3 bg-neonRed/10 border border-neonRed/30 rounded-xl text-xs text-neonRed flex items-center gap-2">
          <ShieldAlert class="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4 text-sm">
        {/* Кто заплатил */}
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Кто заплатил (Кредитор)</label>
          <select
            value={creditor}
            onChange={(e) => setCreditor(e.target.value)}
            class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
          >
            {users.map(u => (
              <option key={u._id} value={u._id}>{u.name} {u._id === currentUser?._id ? '(Вы)' : ''}</option>
            ))}
          </select>
        </div>

        {/* За кого */}
        <div>
          <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Кто должен (Должник)</label>
          <select
            value={debtor}
            onChange={(e) => setDebtor(e.target.value)}
            class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
            required
          >
            <option value="">-- Выберите должника --</option>
            {users.filter(u => u._id !== creditor).map(u => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* Сумма и Описание */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Сумма (₸)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Сумма"
              min="1"
              required
              class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">За что (Описание)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Например: Такси, Пицца..."
              required
              class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
            />
          </div>
        </div>

        {/* Срок оплаты и Пени */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <Calendar class="w-3.5 h-3.5 text-neonCyan" />
              Вернуть до (Дедлайн)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
            />
            {/* Быстрые кнопки установки даты */}
            <div class="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setQuickDueDate(3)}
                class="text-[10px] bg-gray-850 hover:bg-gray-800 text-gray-400 py-1 px-2.5 rounded-lg font-medium transition"
              >
                +3 дня
              </button>
              <button
                type="button"
                onClick={() => setQuickDueDate(7)}
                class="text-[10px] bg-gray-850 hover:bg-gray-800 text-gray-400 py-1 px-2.5 rounded-lg font-medium transition"
              >
                +1 неделя
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
              Штраф за просрочку (% в день)
            </label>
            <select
              value={penaltyRate}
              onChange={(e) => setPenaltyRate(e.target.value)}
              class="w-full bg-darkBg border border-gray-850 rounded-xl p-3 text-gray-250 focus:outline-none focus:border-neonPurple/50 transition"
            >
              <option value="0">Без штрафа (0%)</option>
              <option value="0.01">Лайт (1% в день)</option>
              <option value="0.02">Хардкор (2% в день)</option>
              <option value="0.05">Разбой (5% в день)</option>
            </select>
          </div>
        </div>

        {/* Кнопка отправки */}
        <button
          type="submit"
          disabled={loading}
          class="w-full bg-gradient-to-r from-neonGreen to-neonCyan text-darkBg font-bold py-3 px-4 rounded-xl hover:opacity-90 shadow-neonGreen/20 shadow-md transition disabled:opacity-50 mt-2 text-sm"
        >
          {loading ? 'Создание...' : 'Добавить транзакцию'}
        </button>
      </form>
    </div>
  );
}
