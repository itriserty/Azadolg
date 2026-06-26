const Transaction = require('../models/Transaction');
const tg = require('./telegramService');

// Проверка просроченных долгов и рассылка напоминаний
async function checkOverdueDebts() {
  try {
    console.log('[ReminderService] Запуск проверки просроченных долгов...');
    const now = new Date();

    // Находим все активные долги, у которых срок прошел, а напоминание еще не было отправлено
    const overdueTransactions = await Transaction.find({
      status: 'active',
      dueDate: { $lt: now },
      overdueReminderSent: { $ne: true }
    }).populate('debtor creditor');

    console.log(`[ReminderService] Найдено просроченных долгов без напоминания: ${overdueTransactions.length}`);

    for (const tx of overdueTransactions) {
      if (tx.debtor) {
        const dateStr = new Date(tx.dueDate).toLocaleDateString('ru-RU');
        const text = `⚠️ <b>Внимание: Долг просрочен!</b>\n\n` +
          `👤 Кредитор: <b>${tx.creditor ? tx.creditor.name : 'Неизвестно'}</b>\n` +
          `💰 Оригинальная сумма: <b>${tx.originalAmount} ₸</b>\n` +
          `📝 Описание: ${tx.description}\n` +
          `📅 Срок возврата истек: <b>${dateStr}</b>\n\n` +
          `‼️ С 8-го дня просрочки начнет начисляться штраф 5%. Пожалуйста, верните долг как можно скорее!`;

        // Отправляем личное сообщение должнику (по его telegramId)
        if (tx.debtor.telegramId) {
          await tg.sendMessage(text, tx.debtor.telegramId);
        } else {
          // Если telegramId нет, дублируем уведомление в общий чат
          await tg.sendMessage(text);
        }

        // Помечаем, что напоминание отправлено
        tx.overdueReminderSent = true;
        await tx.save();
      }
    }
  } catch (error) {
    console.error('[ReminderService] Ошибка во время проверки просроченных долгов:', error);
  }
}

// Запуск планировщика напоминаний
function startReminderScheduler() {
  // Запускаем первую проверку при старте сервера через 5 секунд (чтобы БД успела подключиться)
  setTimeout(checkOverdueDebts, 5000);

  // Затем проверяем каждые 12 часов
  const INTERVAL_12_HOURS = 12 * 60 * 60 * 1000;
  setInterval(checkOverdueDebts, INTERVAL_12_HOURS);
}

module.exports = {
  checkOverdueDebts,
  startReminderScheduler
};
