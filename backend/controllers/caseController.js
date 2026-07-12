const User = require('../models/User');
const Inventory = require('../models/Inventory');
const tg = require('../services/telegramService');
const { SHOP_ITEMS } = require('./shopController');

const COMMON_CASE_COST = 100;
const COSMETIC_CASE_COST = 250;

// Обычный кейс (Содержит ELO-изменения и Карму, а также мелкий 2% шанс на базовую косметику)
const COMMON_PRIZE_POOL = [
  { type: 'penalty',           value: -10,  weight: 25, label: '-10 ELO',    emoji: '🤬', rarity: 'Ширпотреб'   },
  { type: 'elo_bonus',         value:  15,  weight: 35, label: '+15 ELO',    emoji: '🔥', rarity: 'Запрещенное' }, // ELO НЕРФ (макс +15 ELO)
  { type: 'karma_super_bonus', value: 300,  weight: 20, label: '+300 Кармы & +50 XP', emoji: '💎', rarity: 'Тайное' },
  { type: 'cashback',          value: 150,  weight: 18, label: '+150 Кармы', emoji: '🪙', rarity: 'Армейское'   },
  { type: 'cosmetic_common',   value: 0,    weight: 2,  label: 'Косметический Дроп', emoji: '🎁', rarity: 'Тайное' } // 2% шанс выпадения предметов
];

// Косметический кейс (Содержит рамки и скины с 2% шансом на Rare/Immortal предметы)
const COSMETIC_PRIZE_POOL = [
  { itemId: 'neon_red_frame',  weight: 30 },
  { itemId: 'neon_cyan_frame', weight: 30 },
  { itemId: 'vaporwave_skin',  weight: 19 },
  { itemId: 'cyberpunk_skin',  weight: 19 },
  // Rare/Immortal (2% суммарный шанс)
  { itemId: 'gold_frame',      weight: 1.0 },  // 1%
  { itemId: 'matrix_skin',     weight: 0.5 },  // 0.5%
  { itemId: 'diamond_frame',   weight: 0.25 }, // 0.25%
  { itemId: 'galaxy_skin',     weight: 0.25 }  // 0.25%
];

function selectWeightedPrize(pool) {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const prize of pool) {
    r -= prize.weight;
    if (r <= 0) return prize;
  }
  return pool[pool.length - 1];
}

// POST /api/cases/open
async function openCase(req, res) {
  try {
    const userId = req.user || req.body.userId;
    const caseType = req.body.caseType || 'common'; // 'common' | 'cosmetic'

    if (!userId) return res.status(400).json({ error: 'Не указан ID пользователя' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const cost = caseType === 'cosmetic' ? COSMETIC_CASE_COST : COMMON_CASE_COST;

    if (user.karma < cost) {
      return res.status(400).json({ error: `Недостаточно Кармы. Нужно ${cost} Кармы, у вас ${user.karma}.` });
    }

    // Списываем Карму
    user.karma -= cost;

    // НАПОЛНЕНИЕ ДЖЕКПОТА: 100% от траты Кармы на кейсы переходит в Джекпот
    const SystemState = require('../models/SystemState');
    let systemState = await SystemState.findOne();
    if (!systemState) {
      systemState = new SystemState();
    }
    systemState.jackpotPool += cost;
    await systemState.save();

    let dropLabel = '';
    let dropRarity = '';
    let dropEmoji = '🎁';
    let description = '';
    let detail = {};
    let inventoryItem = null;

    if (caseType === 'common') {
      const prize = selectWeightedPrize(COMMON_PRIZE_POOL);
      dropLabel = prize.label;
      dropRarity = prize.rarity;
      dropEmoji = prize.emoji;

      if (prize.type === 'penalty') {
        user.eloRating = Math.max(100, user.eloRating - 10);
        description = `Шуточный штраф: -10 ELO. Карма не одобряет!`;
        detail = { eloChange: -10 };
      } else if (prize.type === 'elo_bonus') {
        user.eloRating += 15;
        description = `Благословение кармы! +15 ELO!`;
        detail = { eloChange: 15 };
      } else if (prize.type === 'cashback') {
        user.karma += 150;
        description = `Кэшбек! +150 Кармы!`;
        detail = { karmaChange: 150 };
      } else if (prize.type === 'karma_super_bonus') {
        user.karma += 300;
        const { addXP } = require('../utils/battlePassHelper');
        await addXP(user, 50);
        description = `Супер-дроп! +300 Кармы и +50 XP Боевого Пропуска!`;
        detail = { karmaChange: 300, xpChange: 50 };
      } else if (prize.type === 'cosmetic_common') {
        // Выпадение случайного базового предмета
        const baseItems = ['neon_red_frame', 'neon_cyan_frame', 'vaporwave_skin', 'cyberpunk_skin'];
        const randomItem = baseItems[Math.floor(Math.random() * baseItems.length)];
        const item = SHOP_ITEMS[randomItem];
        
        dropLabel = item.name;
        dropRarity = item.rarity;
        description = `Сверхвезение! Вы выбили предмет: ${item.name}!`;
        
        inventoryItem = await Inventory.findOne({ userId, itemId: item.id });
        if (inventoryItem) {
          inventoryItem.quantity += 1;
          await inventoryItem.save();
        } else {
          inventoryItem = new Inventory({ userId, itemType: item.type, itemId: item.id, quantity: 1 });
          await inventoryItem.save();
        }
      }
    } else {
      // Косметический кейс
      const prize = selectWeightedPrize(COSMETIC_PRIZE_POOL);
      const item = SHOP_ITEMS[prize.itemId];

      dropLabel = item.name;
      dropRarity = item.rarity;
      dropEmoji = item.type === 'skin' ? '🎨' : '🖼️';
      description = `Вы выиграли косметический предмет: ${item.name}! [Ранг: ${item.rarity}]`;

      inventoryItem = await Inventory.findOne({ userId, itemId: item.id });
      if (inventoryItem) {
        inventoryItem.quantity += 1;
        await inventoryItem.save();
      } else {
        inventoryItem = new Inventory({ userId, itemType: item.type, itemId: item.id, quantity: 1 });
        await inventoryItem.save();
      }
    }

    user._karmaReason = 'case_open';
    user._eloReason = 'case_open';
    await user.save();


    // 📣 Telegram: уведомление об открытии кейса
    tg.notifyCase({
      userName:    user.name,
      dropLabel,
      dropRarity,
      description,
      telegramId:  user.telegramId
    });

    res.status(200).json({
      message: 'Кейс успешно открыт!',
      drop: { label: dropLabel, rarity: dropRarity, emoji: dropEmoji, description, detail },
      user: { _id: user._id, name: user.name, karma: user.karma, eloRating: user.eloRating },
      inventoryItem
    });
  } catch (error) {
    console.error('Ошибка при открытии кейса:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

module.exports = { openCase };
