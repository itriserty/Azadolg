const Inventory = require('../models/Inventory');
const tg = require('../services/telegramService');

async function grantBattlePassReward(user, level) {
  let rewardText = '';
  const userId = user._id;

  try {
    if (level === 2) {
      await Inventory.findOneAndUpdate(
        { userId, itemId: 'neon_cyan_frame' },
        { $setOnInsert: { itemType: 'frame', itemId: 'neon_cyan_frame' }, $inc: { quantity: 1 } },
        { upsert: true }
      );
      rewardText = 'Неоново-Голубая Рамка';
    } else if (level === 3) {
      user.replenishBalance('elo', 20, 'battlepass_reward');
      rewardText = '+20 ELO-рейтинга';
    } else if (level === 4) {
      await Inventory.findOneAndUpdate(
        { userId, itemId: 'vaporwave_skin' },
        { $setOnInsert: { itemType: 'skin', itemId: 'vaporwave_skin' }, $inc: { quantity: 1 } },
        { upsert: true }
      );
      rewardText = 'Скин Vaporwave';
    } else if (level === 5) {
      user.replenishBalance('karma', 150, 'battlepass_reward');
      rewardText = '+150 ₸ Кармы';
    } else if (level === 6) {
      await Inventory.findOneAndUpdate(
        { userId, itemId: 'neon_red_frame' },
        { $setOnInsert: { itemType: 'frame', itemId: 'neon_red_frame' }, $inc: { quantity: 1 } },
        { upsert: true }
      );
      rewardText = 'Неоново-Красная Рамка';
    } else if (level === 7) {
      user.replenishBalance('elo', 50, 'battlepass_reward');
      rewardText = '+50 ELO-рейтинга';
    } else if (level === 8) {
      await Inventory.findOneAndUpdate(
        { userId, itemId: 'matrix_skin' },
        { $setOnInsert: { itemType: 'skin', itemId: 'matrix_skin' }, $inc: { quantity: 1 } },
        { upsert: true }
      );
      rewardText = 'Скин Матрица';
    } else if (level === 9) {
      user.replenishBalance('karma', 300, 'battlepass_reward');
      rewardText = '+300 ₸ Кармы';
    } else if (level === 10) {
      await Inventory.findOneAndUpdate(
        { userId, itemId: 'gold_frame' },
        { $setOnInsert: { itemType: 'frame', itemId: 'gold_frame' }, $inc: { quantity: 1 } },
        { upsert: true }
      );
      rewardText = 'Золотая Рамка';

    }

    if (rewardText) {
      tg.sendMessage(
        `🎒 <b>БОЕВОЙ ПРОПУСК: НОВЫЙ УРОВЕНЬ!</b> 🎒\n\n` +
        `👤 Игрок: <b>${user.name}</b>\n` +
        `⭐ Уровень: <b>Level ${level}</b>\n` +
        `🎁 Награда: <b>${rewardText}</b>`
      );
    }
  } catch (error) {
    console.error(`Ошибка при выдаче награды за уровень ${level}:`, error);
  }
}

async function addXP(user, amount) {
  try {
    const oldLevel = user.battlePassLevel;
    user.battlePassXP += amount;

    let leveledUp = false;
    while (user.battlePassXP >= 100) {
      user.battlePassXP -= 100;
      user.battlePassLevel += 1;
      leveledUp = true;
    }

    await user.save();

    if (leveledUp) {
      for (let lvl = oldLevel + 1; lvl <= user.battlePassLevel; lvl++) {
        await grantBattlePassReward(user, lvl);
      }
      await user.save();
    }

    return leveledUp;
  } catch (error) {
    console.error('Ошибка добавления XP Боевого Пропуска:', error);
    return false;
  }
}

module.exports = {
  addXP
};
