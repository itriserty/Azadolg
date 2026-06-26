import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Landmark, ArrowUpRight, ArrowDownLeft, Calendar, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function DebtList({ debts, currentUser, onPay }) {
  // Разделяем долги на категории
  const iOwe = debts.filter(d => d.debtor._id === currentUser?._id);
  const owesMe = debts.filter(d => d.creditor._id === currentUser?._id);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const DebtCard = ({ debt, direction }) => {
    const isOverdue = debt.isOverdue;
    const isOwe = direction === 'i-owe';
    const otherUser = isOwe ? debt.creditor : debt.debtor;

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        class={`p-4 rounded-xl border ${
          isOverdue 
            ? 'bg-neonRed/5 border-neonRed/35 shadow-neonRed/5 shadow-sm' 
            : 'bg-darkBg/80 border-gray-850 hover:border-gray-800'
        } transition-all flex flex-col md:flex-row md:items-center justify-between gap-4`}
      >
        <div class="flex items-start gap-3">
          {/* Иконка направления */}
          <div class={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isOverdue
              ? 'bg-neonRed/10 text-neonRed'
              : isOwe 
                ? 'bg-neonRed/10 text-neonRed' 
                : 'bg-neonGreen/10 text-neonGreen'
          }`}>
            {isOwe ? <ArrowDownLeft class="w-5 h-5" /> : <ArrowUpRight class="w-5 h-5" />}
          </div>

          <div>
            {/* Описание */}
            <div class="font-bold text-sm text-gray-200">{debt.description}</div>
            
            {/* Друг */}
            <div class="text-xs text-gray-400 mt-0.5">
              {isOwe ? 'Кредитор: ' : 'Должник: '} 
              <span class="font-medium text-gray-300">{otherUser.name}</span>
            </div>

            {/* Дата */}
            <div class="flex items-center gap-1.5 text-[10px] text-gray-500 mt-2">
              <Calendar class="w-3.5 h-3.5" />
              <span>Вернуть до: {formatDate(debt.dueDate)}</span>
              {isOverdue && (
                <span class="flex items-center gap-0.5 bg-neonRed/10 text-neonRed px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-[8px]">
                  <ShieldAlert class="w-2.5 h-2.5" />
                  Просрочен
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Сумма и Кнопка */}
        <div class="flex items-center justify-between md:justify-end gap-6 border-t border-gray-850/50 md:border-0 pt-3 md:pt-0">
          <div class="text-left md:text-right">
            {/* Актуальная сумма */}
            <div class={`text-base font-black ${
              isOwe ? 'text-neonRed' : 'text-neonGreen'
            }`}>
              {isOwe ? '-' : '+'}{debt.amount} ₽
            </div>

            {/* Пеня */}
            {debt.penaltyAccrued > 0 && (
              <div class="text-[10px] text-neonRed font-semibold flex items-center gap-0.5 justify-end">
                <span>(из них пеня: +{debt.penaltyAccrued} ₽)</span>
              </div>
            )}
            
            {/* Исходная сумма */}
            {debt.penaltyAccrued > 0 && (
              <div class="text-[9px] text-gray-500">
                Исходно: {debt.originalAmount} ₽
              </div>
            )}
          </div>

          {/* Кнопка оплаты (только для долгов, которые ДОЛЖЕН я) */}
          {isOwe && (
            <button
              onClick={() => onPay(debt._id)}
              class="bg-neonPurple hover:bg-neonPurple/90 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-neonPurple/20 shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
              Вернуть
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div class="space-y-6">
      {/* Я должен */}
      <div class="bg-darkCard border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
        <h2 class="text-xl font-bold flex items-center gap-2 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neonRed to-neonPurple">
          <Landmark class="w-5 h-5 text-neonRed" />
          Я должен ({iOwe.length})
        </h2>

        {iOwe.length === 0 ? (
          <div class="text-center py-8 text-gray-500 text-sm">
             Чисто! У вас нет активных долгов. Отличная карма! 🙌
          </div>
        ) : (
          <div class="space-y-3">
            <AnimatePresence>
              {iOwe.map(d => (
                <DebtCard key={d._id} debt={d} direction="i-owe" />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Мне должны */}
      <div class="bg-darkCard border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40">
        <h2 class="text-xl font-bold flex items-center gap-2 mb-6 text-transparent bg-clip-text bg-gradient-to-r from-neonGreen to-neonCyan">
          <Landmark class="w-5 h-5 text-neonGreen" />
          Мне должны ({owesMe.length})
        </h2>

        {owesMe.length === 0 ? (
          <div class="text-center py-8 text-gray-500 text-sm">
             Никто вам не должен. Либо вы очень щедрый, либо друзья бедные! 😉
          </div>
        ) : (
          <div class="space-y-3">
            <AnimatePresence>
              {owesMe.map(d => (
                <DebtCard key={d._id} debt={d} direction="owes-me" />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
