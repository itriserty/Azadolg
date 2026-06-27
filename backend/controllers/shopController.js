const User = require('../models/User');
const Inventory = require('../models/Inventory');
const ShopItem = require('../models/ShopItem');
const SystemState = require('../models/SystemState');

// Статический реестр для мгновенного импорта в других контроллерах (как fallback)
const SHOP_ITEMS = {
  // Рамки
  'neon_red_frame': { id: 'neon_red_frame', name: 'Неоново-Красная Рамка', price: 150, type: 'frame', rarity: 'rare', description: 'Стильная красная неоновая рамка для аватара.' },
  'neon_cyan_frame': { id: 'neon_cyan_frame', name: 'Неоново-Голубая Рамка', price: 150, type: 'frame', rarity: 'rare', description: 'Свежая голубая неоновая рамка для аватара.' },
  'gold_frame': { id: 'gold_frame', name: 'Золотая Рамка', price: 300, type: 'frame', rarity: 'legendary', description: 'Премиальная золотая рамка для чемпионов.' },
  'diamond_frame': { id: 'diamond_frame', name: 'Алмазная Рамка', price: 800, type: 'frame', rarity: 'immortal', description: 'Переливающаяся алмазная рамка для истинной элиты.' },
  'fire_frame': { id: 'fire_frame', name: 'Огненная Рамка', price: 450, type: 'frame', rarity: 'legendary', description: 'Рамка с эффектом живого огня для горячих сделок.' },
  'toxic_frame': { id: 'toxic_frame', name: 'Кислотная Рамка', price: 200, type: 'frame', rarity: 'rare', description: 'Ядовито-зеленая неоновая рамка для токсичных должников.' },
  'matrix_frame': { id: 'matrix_frame', name: 'Рамка Матрица', price: 250, type: 'frame', rarity: 'rare', description: 'Цифровой зеленый код, обрамляющий ваш аватар.' },
  'shadow_frame': { id: 'shadow_frame', name: 'Теневая Рамка', price: 500, type: 'frame', rarity: 'legendary', description: 'Черная дымчатая рамка для скрытных воротил.' },

  // Скины
  'vaporwave_skin': { id: 'vaporwave_skin', name: 'Скин Vaporwave', price: 250, type: 'skin', rarity: 'rare', description: 'Фиолетово-розовая ретро-эстетика для профиля.' },
  'cyberpunk_skin': { id: 'cyberpunk_skin', name: 'Скин Киберпанк', price: 250, type: 'skin', rarity: 'rare', description: 'Темный хакерский скин с неоновыми деталями.' },
  'matrix_skin': { id: 'matrix_skin', name: 'Скин Матрица', price: 350, type: 'skin', rarity: 'legendary', description: 'Зеленый цифровой дождь для истинных гиков.' },
  'galaxy_skin': { id: 'galaxy_skin', name: 'Скин Галактика', price: 1000, type: 'skin', rarity: 'immortal', description: 'Премиальный анимированный космический фон профиля.' },
  'neon_yellow_skin': { id: 'neon_yellow_skin', name: 'Свечение Лимона', price: 200, type: 'skin', rarity: 'rare', description: 'Кислотно-желтый фон профиля.' },
  'toxic_waste_skin': { id: 'toxic_waste_skin', name: 'Токсичный Сброс', price: 300, type: 'skin', rarity: 'legendary', description: 'Радиоактивно-зеленый фон с предупреждающими знаками.' },
  'dark_night_skin': { id: 'dark_night_skin', name: 'Ночной Минимализм', price: 100, type: 'skin', rarity: 'common', description: 'Строгий минималистичный темно-серый фон.' },
  'crimson_sunset_skin': { id: 'crimson_sunset_skin', name: 'Багровый Закат', price: 400, type: 'skin', rarity: 'legendary', description: 'Плавный красно-черный градиент для профиля.' },

  // Бустеры
  'elo_booster_10': { id: 'elo_booster_10', name: 'Буст +10 ELO', price: 100, type: 'boost', rarity: 'common', description: 'Одноразовое начисление +10 к вашему рейтингу.', value: 10 },
  'elo_booster_50': { id: 'elo_booster_50', name: 'Буст +50 ELO', price: 400, type: 'boost', rarity: 'rare', description: 'Одноразовое начисление +50 к вашему рейтингу.', value: 50 },
  'elo_booster_100': { id: 'elo_booster_100', name: 'Буст +100 ELO', price: 750, type: 'boost', rarity: 'legendary', description: 'Одноразовое начисление +100 к вашему рейтингу.', value: 100 },
  'karma_booster_50': { id: 'karma_booster_50', name: 'Инъекция Кармы', price: 150, type: 'boost', rarity: 'common', description: 'Мгновенное восстановление +50 Кармы.', value: 50 },

  // Титулы и цвета ников
  'title_debt_king': { id: 'title_debt_king', name: 'Титул «Король Долгов»', price: 500, type: 'title', rarity: 'legendary', description: 'Уникальная приписка к нику для авторитетных заемщиков.' },
  'color_nick_gold': { id: 'color_nick_gold', name: 'Золотой Никнейм', price: 600, type: 'nick_color', rarity: 'legendary', description: 'Окрашивает ваш никнейм в золотой цвет в ленте и списках.' }
};

// GET /api/shop/items
async function getShopItems(req, res) {
  try {
    const items = await ShopItem.find({ isActive: true });
    res.status(200).json(items);
  } catch (error) {
    console.error('Ошибка получения товаров:', error);
    res.status(500).json({ error: 'Ошибка сервера при загрузке магазина' });
  }
}

// POST /api/shop/buy
async function buyShopItem(req, res) {
  try {
    const { itemId } = req.body;
    const userId = req.user;

    const item = await ShopItem.findOne({ itemId, isActive: true });
    if (!item) {
      return res.status(404).json({ error: 'Товар не найден в магазине' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.karma < item.price) {
      return res.status(400).json({ error: `Недостаточно Кармы. Требуется: ${item.price} ✧, у вас: ${user.karma} ✧.` });
    }

    // Списываем Карму
    user.karma -= item.price;

    // НАПОЛНЕНИЕ ДЖЕКПОТА: 100% от траты Кармы идет в джекпот
    let systemState = await SystemState.findOne();
    if (!systemState) {
      systemState = new SystemState();
    }
    systemState.jackpotPool += item.price;
    await systemState.save();

    let invItem = null;

    if (item.type === 'boost') {
      // Бусты применяются мгновенно
      if (item.itemId.includes('elo')) {
        user.eloRating += item.value;
      } else if (item.itemId.includes('karma')) {
        // Восстановление кармы (уже куплено, добавляем обратно)
        user.karma = Math.min(100000, user.karma + item.value);
      }
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
          itemId: item.itemId,
          quantity: 1
        });
        await invItem.save();
      }
      await user.save();
    }

    res.status(200).json({
      message: `Покупка "${item.name}" успешно совершена! 100% стоимости перечислено в Джекпот!`,
      user: { _id: user._id, name: user.name, eloRating: user.eloRating, karma: user.karma },
      inventoryItem: invItem
    });
  } catch (error) {
    console.error('Ошибка покупки в магазине:', error);
    res.status(500).json({ error: 'Ошибка сервера при покупке' });
  }
}

// GET /api/shop/inventory
async function getUserInventory(req, res) {
  try {
    const userId = req.user;
    const inventory = await Inventory.find({ userId });

    const items = await ShopItem.find();
    const itemsMap = {};
    items.forEach(i => { itemsMap[i.itemId] = i; });

    // Обогащаем инвентарь деталями
    const enrichedInventory = inventory.map(inv => {
      const details = itemsMap[inv.itemId] || SHOP_ITEMS[inv.itemId];
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

// POST /api/shop/activate
async function activateCosmetic(req, res) {
  try {
    const { itemId, itemType } = req.body; // itemType: 'skin' | 'frame'
    const userId = req.user;

    if (!['skin', 'frame', 'title', 'nick_color'].includes(itemType)) {
      return res.status(400).json({ error: 'Неверный тип косметики' });
    }

    // Если хотим снять
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
