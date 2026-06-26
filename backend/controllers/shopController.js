const User = require('../models/User');
const Inventory = require('../models/Inventory');

const SHOP_ITEMS = {
  // Рамки
  'neon_red_frame': { id: 'neon_red_frame', name: 'Неоново-Красная Рамка', price: 150, type: 'frame', rarity: 'Запрещенное', description: 'Стильная красная неоновая рамка для аватара.' },
  'neon_cyan_frame': { id: 'neon_cyan_frame', name: 'Неоново-Голубая Рамка', price: 150, type: 'frame', rarity: 'Запрещенное', description: 'Свежая голубая неоновая рамка для аватара.' },
  'gold_frame': { id: 'gold_frame', name: 'Золотая Рамка', price: 300, type: 'frame', rarity: 'Тайное', description: 'Премиальная золотая рамка для чемпионов.' },
  
  // Скины / Обложки профиля
  'vaporwave_skin': { id: 'vaporwave_skin', name: 'Скин Vaporwave', price: 250, type: 'skin', rarity: 'Запрещенное', description: 'Фиолетово-розовая ретро-эстетика для профиля.' },
  'cyberpunk_skin': { id: 'cyberpunk_skin', name: 'Скин Киберпанк', price: 250, type: 'skin', rarity: 'Запрещенное', description: 'Темный хакерский скин с неоновыми деталями.' },
  'matrix_skin': { id: 'matrix_skin', name: 'Скин Матрица', price: 350, type: 'skin', rarity: 'Тайное', description: 'Зеленый цифровой дождь для истинных гиков.' },

  // Бустеры ELO (одноразовые)
  'elo_booster_10': { id: 'elo_booster_10', name: 'Буст +10 ELO', price: 100, type: 'boost', rarity: 'Ширпотреб', description: 'Одноразовое мгновенное начисление +10 ELO.', value: 10 },
  'elo_booster_50': { id: 'elo_booster_50', name: 'Буст +50 ELO', price: 400, type: 'boost', rarity: 'Армейское', description: 'Одноразовое мгновенное начисление +50 ELO.', value: 50 }
};

// Получить список товаров магазина
async function getShopItems(req, res) {
  res.status(200).json(Object.values(SHOP_ITEMS));
}

// Покупка товара
async function buyShopItem(req, res) {
  try {
    const { itemId } = req.body;
    const userId = req.user;

    const item = SHOP_ITEMS[itemId];
    if (!item) {
      return res.status(404).json({ error: 'Товар не найден в магазине' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.karma < item.price) {
      return res.status(400).json({ error: `Недостаточно Кармы. Требуется: ${item.price} ₸ Кармы, у вас: ${user.karma} ₸.` });
    }

    // Списываем Карму
    user.karma -= item.price;

    let invItem = null;

    if (item.type === 'boost') {
      // Бусты применяются мгновенно
      user.eloRating += item.value;
      await user.save();
    } else {
      // Косметику сохраняем в инвентарь
      invItem = await Inventory.findOne({ userId, itemId });
      if (invItem) {
        invItem.quantity += 1;
        await invItem.save();
      } else {
        invItem = new Inventory({
          userId,
          itemType: item.type,
          itemId: item.id
        });
        await invItem.save();
      }
      await user.save();
    }

    res.status(200).json({
      message: `Покупка "${item.name}" успешно совершена!`,
      user: { _id: user._id, name: user.name, eloRating: user.eloRating, karma: user.karma },
      inventoryItem: invItem
    });
  } catch (error) {
    console.error('Ошибка покупки в магазине:', error);
    res.status(500).json({ error: 'Ошибка сервера при покупке' });
  }
}

// Получить инвентарь пользователя
async function getUserInventory(req, res) {
  try {
    const userId = req.user;
    const inventory = await Inventory.find({ userId });

    // Обогащаем инвентарь деталями предметов из SHOP_ITEMS
    const enrichedInventory = inventory.map(inv => {
      const details = SHOP_ITEMS[inv.itemId];
      return {
        ...inv.toObject(),
        details: details || { name: 'Неизвестный предмет', description: 'Нет описания' }
      };
    });

    res.status(200).json(enrichedInventory);
  } catch (error) {
    console.error('Ошибка получения инвентаря:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении инвентаря' });
  }
}

// Активировать косметический предмет из инвентаря
async function activateCosmetic(req, res) {
  try {
    const { itemId, itemType } = req.body; // itemType: 'skin' | 'frame'
    const userId = req.user;

    if (!['skin', 'frame'].includes(itemType)) {
      return res.status(400).json({ error: 'Неверный тип косметики' });
    }

    // Если хотим снять рамку/скин
    if (itemId === 'none' || itemId === 'default') {
      const updateData = itemType === 'skin' ? { activeProfileSkin: 'default' } : { activeProfileFrame: 'none' };
      const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
      return res.status(200).json({ message: 'Косметика снята!', user });
    }

    // Проверяем наличие предмета в инвентаре
    const owned = await Inventory.findOne({ userId, itemId });
    if (!owned || owned.quantity <= 0) {
      return res.status(403).json({ error: 'У вас нет этого предмета в инвентаре' });
    }

    const updateData = itemType === 'skin' ? { activeProfileSkin: itemId } : { activeProfileFrame: itemId };
    const user = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

    res.status(200).json({
      message: 'Косметика успешно активирована!',
      user
    });
  } catch (error) {
    console.error('Ошибка активации косметики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  SHOP_ITEMS,
  getShopItems,
  buyShopItem,
  getUserInventory,
  activateCosmetic
};
