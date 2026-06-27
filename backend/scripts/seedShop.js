const mongoose = require('mongoose');
const ShopItem = require('../models/ShopItem');

const SEED_ITEMS = [
  // Рамки (Frames)
  { itemId: 'neon_red_frame', name: 'Неоново-Красная Рамка', price: 150, type: 'frame', rarity: 'rare', description: 'Стильная красная неоновая рамка для аватара.' },
  { itemId: 'neon_cyan_frame', name: 'Неоново-Голубая Рамка', price: 150, type: 'frame', rarity: 'rare', description: 'Свежая голубая неоновая рамка для аватара.' },
  { itemId: 'gold_frame', name: 'Золотая Рамка', price: 300, type: 'frame', rarity: 'legendary', description: 'Премиальная золотая рамка для чемпионов.' },
  { itemId: 'diamond_frame', name: 'Алмазная Рамка', price: 800, type: 'frame', rarity: 'immortal', description: 'Переливающаяся алмазная рамка для истинной элиты.' },
  { itemId: 'fire_frame', name: 'Огненная Рамка', price: 450, type: 'frame', rarity: 'legendary', description: 'Рамка с эффектом живого огня для горячих сделок.' },
  { itemId: 'toxic_frame', name: 'Кислотная Рамка', price: 200, type: 'frame', rarity: 'rare', description: 'Ядовито-зеленая неоновая рамка для токсичных должников.' },
  { itemId: 'matrix_frame', name: 'Рамка Матрица', price: 250, type: 'frame', rarity: 'rare', description: 'Цифровой зеленый код, обрамляющий ваш аватар.' },
  { itemId: 'shadow_frame', name: 'Теневая Рамка', price: 500, type: 'frame', rarity: 'legendary', description: 'Черная дымчатая рамка для скрытных воротил.' },

  // Скины (Skins)
  { itemId: 'vaporwave_skin', name: 'Скин Vaporwave', price: 250, type: 'skin', rarity: 'rare', description: 'Фиолетово-розовая ретро-эстетика для профиля.' },
  { itemId: 'cyberpunk_skin', name: 'Скин Киберпанк', price: 250, type: 'skin', rarity: 'rare', description: 'Темный хакерский скин с неоновыми деталями.' },
  { itemId: 'matrix_skin', name: 'Скин Матрица', price: 350, type: 'skin', rarity: 'legendary', description: 'Зеленый цифровой дождь для истинных гиков.' },
  { itemId: 'galaxy_skin', name: 'Скин Галактика', price: 1000, type: 'skin', rarity: 'immortal', description: 'Премиальный анимированный космический фон профиля.' },
  { itemId: 'neon_yellow_skin', name: 'Свечение Лимона', price: 200, type: 'skin', rarity: 'rare', description: 'Кислотно-желтый фон профиля.' },
  { itemId: 'toxic_waste_skin', name: 'Токсичный Сброс', price: 300, type: 'skin', rarity: 'legendary', description: 'Радиоактивно-зеленый фон с предупреждающими знаками.' },
  { itemId: 'dark_night_skin', name: 'Ночной Минимализм', price: 100, type: 'skin', rarity: 'common', description: 'Строгий минималистичный темно-серый фон.' },
  { itemId: 'crimson_sunset_skin', name: 'Багровый Закат', price: 400, type: 'skin', rarity: 'legendary', description: 'Плавный красно-черный градиент для профиля.' },

  // Бустеры (Boosters)
  { itemId: 'elo_booster_10', name: 'Буст +10 ELO', price: 100, type: 'boost', rarity: 'common', description: 'Одноразовое начисление +10 к вашему рейтингу.', value: 10 },
  { itemId: 'elo_booster_50', name: 'Буст +50 ELO', price: 400, type: 'boost', rarity: 'rare', description: 'Одноразовое начисление +50 к вашему рейтингу.', value: 50 },
  { itemId: 'elo_booster_100', name: 'Буст +100 ELO', price: 750, type: 'boost', rarity: 'legendary', description: 'Одноразовое начисление +100 к вашему рейтингу.', value: 100 },
  { itemId: 'karma_booster_50', name: 'Инъекция Кармы', price: 150, type: 'boost', rarity: 'common', description: 'Мгновенное восстановление +50 Кармы.', value: 50 },

  // Титулы и Цвета ников (Titles & Nick Colors)
  { itemId: 'title_debt_king', name: 'Титул «Король Долгов»', price: 500, type: 'title', rarity: 'legendary', description: 'Уникальная приписка к нику для авторитетных заемщиков.' },
  { itemId: 'color_nick_gold', name: 'Золотой Никнейм', price: 600, type: 'nick_color', rarity: 'legendary', description: 'Окрашивает ваш никнейм в золотой цвет в ленте и списках.' }
];

async function seedShop() {
  try {
    console.log('[SEED] Начало сидирования магазина...');
    for (const item of SEED_ITEMS) {
      await ShopItem.findOneAndUpdate(
        { itemId: item.itemId },
        item,
        { upsert: true, new: true }
      );
    }
    console.log(`[SEED] Успешно синхронизировано ${SEED_ITEMS.length} товаров магазина.`);
  } catch (err) {
    console.error('[SEED] Ошибка при сидировании магазина:', err);
  }
}

// Позволяет запускать скрипт напрямую
if (require.main === module) {
  const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/gamified-debt-tracker';
  mongoose.connect(dbUrl)
    .then(async () => {
      await seedShop();
      mongoose.connection.close();
    })
    .catch(err => {
      console.error('Ошибка подключения:', err);
    });
}

module.exports = { seedShop, SEED_ITEMS };
