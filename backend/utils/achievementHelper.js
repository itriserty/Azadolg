const User = require('../models/User');
const Achievement = require('../models/Achievement');
const Transaction = require('../models/Transaction');
const tg = require('../services/telegramService');

/**
 * Карма-награда по редкости достижения.
 * Начисляется при первом получении ачивки (и всегда для repeatable).
 */
const RARITY_KARMA = {
  COMMON:    50,
  RARE:     150,
  EPIC:     200,
  LEGENDARY:300,
};

/**
 * Проверяет и выдает ачивки пользователю по триггеру.
 * @param {string} userId - ID пользователя
 * @param {string} triggerType - Тип триггера
 * @param {number} [currentValue] - Текущее значение показателя (опционально)
 */
async function checkAndAward(userId, triggerType, currentValue = null) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Ищем активные достижения с этим триггером
    const achievements = await Achievement.find({ trigger: triggerType, isActive: true });
    if (achievements.length === 0) return;

    // Вычисляем значение, если оно не передано
    let val = currentValue;
    if (val === null) {
      if (triggerType === 'declined_loan_streak') {
        val = user.consecutiveDeclines || 0;
      } else if (triggerType === 'active_debts_count') {
        val = await Transaction.countDocuments({ debtor: userId, status: 'active' });
      } else if (triggerType === 'overdue_365') {
        const oneYearAgo = new Date();
        oneYearAgo.setDate(oneYearAgo.getDate() - 365);
        val = await Transaction.countDocuments({
          debtor: userId,
          status: 'active',
          dueDate: { $lt: oneYearAgo }
        });
      } else if (triggerType === 'debts_paid_count') {
        val = user.stats.totalDebtsPaid || 0;
      } else if (triggerType === 'forgiven_count') {
        val = user.stats.totalDebtsForgivenByMe || 0;
      } else if (triggerType === 'witnesses_count') {
        val = user.stats.totalDebtsWitnessed || 0;
      } else if (triggerType === 'empty_promises') {
        const now = new Date();
        val = await Transaction.countDocuments({
          debtor: userId,
          status: 'active',
          dueDate: { $lt: now }
        });
      } else if (triggerType === 'jackpot_winner') {
        val = 1;
      } else if (triggerType === 'self_borrow') {
        val = 1;
      } else if (triggerType === 'negative_karma') {
        val = user.karma < 0 ? 1 : 0;
      }
    }

    let changed = false;
    const newlyEarned = [];

    for (const ach of achievements) {
      // Проверяем, получена ли уже ачивка
      const alreadyEarned = user.achievements.some(a => a.achievement.toString() === ach._id.toString());
      if (alreadyEarned && !ach.isRepeatable) continue;

      // Проверяем порог
      if (val >= ach.threshold) {
        // Начисляем Карму за достижение
        const rarityKey = (ach.rarity || '').toUpperCase();
        const karmaReward = RARITY_KARMA[rarityKey] || 0;

        if (karmaReward > 0) {
          user.replenishBalance('karma', karmaReward, 'achievement_unlocked', ach._id);
        }


        // Выдаем ачивку
        user.achievements.push({ achievement: ach._id, earnedAt: new Date() });
        newlyEarned.push({
          ...ach.toObject(),
          karmaReward  // прокидываем на фронт чтобы показать в тосте
        });
        changed = true;

        // Telegram-уведомление
        const karmaLine = karmaReward > 0 ? `\n💠 Награда: +${karmaReward} Кармы` : '';
        const announceText =
          `🏆 <b>ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!</b> 🏆\n\n` +
          `👤 Игрок: <b>${user.name}</b> (@${user.username})\n` +
          `🎖️ Награда: <b>${ach.emoji} ${ach.title}</b> (${ach.rarity})` +
          karmaLine + `\n📝 <i>${ach.description}</i>`;

        tg.sendMessage(announceText);
        if (user.telegramId) {
          try {
            const personalMsg = `🎉 Вы получили достижение: <b>${ach.emoji} ${ach.title}</b>!` +
              (karmaReward > 0 ? `\n💠 +${karmaReward} Кармы зачислено!` : '');
            tg.sendMessage(personalMsg, user.telegramId);
          } catch (e) {
            console.error('Ошибка отправки уведомления в Telegram:', e.message);
          }
        }
      }
    }

    if (changed) {
      await user.save();
    }
    return newlyEarned;
  } catch (err) {
    console.error(`[checkAndAward] Ошибка проверки ачивок для ${userId}:`, err);
  }
}

module.exports = { checkAndAward, RARITY_KARMA };
