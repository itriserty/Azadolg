const User = require('../models/User');
const Transaction = require('../models/Transaction');
const tg = require('../services/telegramService');

const CASE_COST = 100;

const PRIZE_POOL = [
  { type: 'penalty',           value: -10,  weight: 20, label: '-10 ELO',    emoji: '🤬', rarity: 'Ширпотреб'   },
  { type: 'elo_bonus',         value:  50,  weight: 35, label: '+50 ELO',    emoji: '🔥', rarity: 'Запрещенное' },
  { type: 'karma_super_bonus', value: 300,  weight: 25, label: '+300 Кармы & +50 XP', emoji: '💎', rarity: 'Тайное' },
  { type: 'cashback',          value: 150,  weight: 20, label: '+150 Coins', emoji: '🪙', rarity: 'Армейское'   }
];

function selectWeightedPrize() {
  const total = PRIZE_POOL.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const prize of PRIZE_POOL) { r -= prize.weight; if (r <= 0) return prize; }
  return PRIZE_POOL[PRIZE_POOL.length - 1];
}

// POST /api/open-case
async function openCase(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.coins < CASE_COST)
      return res.status(400).json({ error: `Недостаточно монет. Нужно ${CASE_COST} Coins, у вас ${user.coins}.` });

    user.coins -= CASE_COST;

    const prize = selectWeightedPrize();
    let description = '';
    let detail = {};

    switch (prize.type) {
      case 'penalty': {
        const eloPenalty = Math.abs(prize.value);
        user.eloRating = Math.max(100, user.eloRating - eloPenalty);
        description = `Шуточный штраф: -${eloPenalty} ELO. Карма не одобряет!`;
        detail = { eloChange: -eloPenalty };
        break;
      }
      case 'elo_bonus': {
        user.eloRating += prize.value;
        description = `Благословение кармы! +${prize.value} ELO!`;
        detail = { eloChange: prize.value };
        break;
      }
      case 'cashback': {
        user.coins += prize.value;
        description = `Кэшбек! +${prize.value} Coins!`;
        detail = { coinsChange: prize.value };
        break;
      }
      case 'karma_super_bonus': {
        user.karma = (user.karma || 0) + prize.value;
        const { addXP } = require('../utils/battlePassHelper');
        await addXP(user, 50);
        description = `Супер-дроп! +300 Кармы и +50 XP Боевого Пропуска!`;
        detail = { karmaChange: 300, xpChange: 50 };
        break;
      }
    }

    await user.save();

    // 📣 Telegram: уведомление об открытии кейса
    tg.notifyCase({
      userName:    user.name,
      dropLabel:   prize.label,
      dropRarity:  prize.rarity,
      description,
      telegramId:  user.telegramId
    });

    res.status(200).json({
      message: 'Кейс успешно открыт!',
      drop: { type: prize.type, value: prize.value, label: prize.label, emoji: prize.emoji, rarity: prize.rarity, description, detail },
      user: { _id: user._id, name: user.name, coins: user.coins, eloRating: user.eloRating }
    });
  } catch (error) {
    console.error('Ошибка при открытии кейса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

module.exports = { openCase };
