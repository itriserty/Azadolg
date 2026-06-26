const User = require('../models/User');
const Inventory = require('../models/Inventory');
const { SHOP_ITEMS } = require('./shopController');
const tg = require('../services/telegramService');

const GACHA_COST = 100;

// Определение пула наград Гачи с весами
const GACHA_POOL = [
  // Ширпотреб (Бустер +10) - 40%
  { itemId: 'elo_booster_10', weight: 40 },
  // Армейское (Бустер +50) - 15%
  { itemId: 'elo_booster_50', weight: 15 },
  // Запрещенное (Рамки и базовые скины) - 35%
  { itemId: 'neon_red_frame',  weight: 12 },
  { itemId: 'neon_cyan_frame', weight: 12 },
  { itemId: 'vaporwave_skin',  weight: 6 },
  { itemId: 'cyberpunk_skin',  weight: 5 },
  // Тайное (Легендарные скины/рамки) - 10%
  { itemId: 'gold_frame',      weight: 6 },
  { itemId: 'matrix_skin',     weight: 4 }
];

function selectGachaDrop() {
  const totalWeight = GACHA_POOL.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const drop of GACHA_POOL) {
    random -= drop.weight;
    if (random <= 0) {
      return SHOP_ITEMS[drop.itemId];
    }
  }
  return SHOP_ITEMS['elo_booster_10']; // Фолбэк
}

// POST /api/gacha/pull
async function pullGacha(req, res) {
  try {
    const userId = req.user;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.karma < GACHA_COST) {
      return res.status(450).json({ error: `Недостаточно Кармы для крутки. Требуется: ${GACHA_COST} ₸ Кармы, у вас: ${user.karma} ₸.` });
    }

    // Списание стоимости крутки
    user.karma -= GACHA_COST;

    const drop = selectGachaDrop();
    let inventoryItem = null;

    if (drop.type === 'boost') {
      // Бусты применяются на месте
      user.eloRating += drop.value;
    } else {
      // Косметика падает в инвентарь
      inventoryItem = await Inventory.findOne({ userId, itemId: drop.id });
      if (inventoryItem) {
        inventoryItem.quantity += 1;
        await inventoryItem.save();
      } else {
        inventoryItem = new Inventory({
          userId,
          itemType: drop.type,
          itemId: drop.id
        });
        await inventoryItem.save();
      }
    }

    await user.save();

    // 📣 Telegram: уведомление о Гача-крутке
    tg.notifyCase({
      userName: user.name,
      dropLabel: drop.name,
      dropRarity: drop.rarity,
      description: `Выиграно в Гаче за 100 Кармы! Карма пользователя теперь: ${user.karma} ₸.`,
      telegramId: user.telegramId
    });

    res.status(200).json({
      message: 'Гача успешно прокручена!',
      drop,
      user: {
        _id: user._id,
        name: user.name,
        eloRating: user.eloRating,
        karma: user.karma,
        coins: user.coins
      },
      inventoryItem
    });
  } catch (error) {
    console.error('Ошибка в Гаче:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при запуске Гачи' });
  }
}

module.exports = {
  pullGacha
};
