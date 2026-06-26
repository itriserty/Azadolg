const TelegramBot = require('node-telegram-bot-api');

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

let bot = null;

if (TOKEN) {
  // polling: false — мы только отправляем, не слушаем
  bot = new TelegramBot(TOKEN, { polling: false });
  console.log('[Telegram] Бот инициализирован.');
} else {
  console.warn('[Telegram] TELEGRAM_BOT_TOKEN не задан. Уведомления отключены.');
}

/**
 * Отправляет сообщение в Telegram-чат.
 * При отсутствии токена или chatId — тихо игнорирует.
 *
 * @param {string} text  - Текст сообщения (поддерживает HTML-разметку)
 * @param {string} [chatId] - ID чата (по умолчанию из .env)
 */
async function sendMessage(text, chatId = CHAT_ID) {
  if (!bot || !chatId) return;
  try {
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[Telegram] Ошибка отправки:', err.message);
  }
}

// ─── Шаблоны уведомлений ─────────────────────────────────────────────────────

/**
 * Уведомление о создании нового долга.
 */
function notifyDebtCreated({ creditorName, debtorName, amount, description, dueDate }) {
  const date = new Date(dueDate).toLocaleDateString('ru-RU');
  return sendMessage(
    `💸 <b>Новый долг зарегистрирован!</b>\n\n` +
    `👤 Кредитор: <b>${creditorName}</b>\n` +
    `🎯 Должник: <b>${debtorName}</b>\n` +
    `💰 Сумма: <b>${amount} ₽</b>\n` +
    `📝 Описание: ${description}\n` +
    `📅 Вернуть до: <b>${date}</b>\n\n` +
    `⚡ Открыто в <a href="https://azadolg.onrender.com">Azadolg</a>`
  );
}

/**
 * Уведомление об оплате (закрытии) долга.
 */
function notifyDebtPaid({ debtorName, creditorName, amount, eloChangeDebtor, coinsEarned, isOverdue }) {
  const icon = isOverdue ? '⚠️' : '✅';
  const eloEmoji = eloChangeDebtor >= 0 ? '📈' : '📉';
  return sendMessage(
    `${icon} <b>Долг закрыт${isOverdue ? ' (с просрочкой)' : ' вовремя'}!</b>\n\n` +
    `🎯 Должник: <b>${debtorName}</b>\n` +
    `👤 Кредитор: <b>${creditorName}</b>\n` +
    `💰 Сумма: <b>${amount} ₽</b>\n\n` +
    `${eloEmoji} ELO Должника: <b>${eloChangeDebtor >= 0 ? '+' : ''}${eloChangeDebtor}</b>\n` +
    `🪙 Coins получено: <b>+${coinsEarned}</b>`
  );
}

/**
 * Уведомление об открытии кейса.
 */
function notifyCase({ userName, dropLabel, dropRarity, description }) {
  return sendMessage(
    `🎲 <b>${userName}</b> открыл кейс!\n\n` +
    `🎁 Выпало: <b>${dropLabel}</b> [${dropRarity}]\n` +
    `📋 ${description}`
  );
}

/**
 * Уведомление о начисленном штрафе за просрочку (5% после 7 дней).
 */
function notifyPenaltyApplied({ debtorName, creditorName, originalAmount, newAmount }) {
  const penalty = Number((newAmount - originalAmount).toFixed(2));
  return sendMessage(
    `⏰ <b>Штраф за просрочку!</b>\n\n` +
    `🎯 Должник: <b>${debtorName}</b>\n` +
    `👤 Кредитор: <b>${creditorName}</b>\n` +
    `💸 Штраф +5%: <b>+${penalty} ₽</b>\n` +
    `💰 Новая сумма: <b>${newAmount} ₽</b>\n\n` +
    `❗ Закройте долг скорее в <a href="https://azadolg.onrender.com">Azadolg</a>!`
  );
}

module.exports = {
  sendMessage,
  notifyDebtCreated,
  notifyDebtPaid,
  notifyCase,
  notifyPenaltyApplied
};
