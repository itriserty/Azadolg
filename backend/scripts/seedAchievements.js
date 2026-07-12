const mongoose = require('mongoose');
const Achievement = require('../models/Achievement');

const defaultAchievements = [
  {
    slug: 'empty_promises_5',
    emoji: '🤡',
    title: 'Сказочный пиздабол',
    description: 'Наобещал вернуть завтра, но просрочил 5 разных долгов.',
    rarity: 'epic',
    trigger: 'empty_promises',
    threshold: 5,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'jackpot_winner',
    emoji: '🎰',
    title: 'Везучий ублюдок',
    description: 'Сорвал Казин джекпот.',
    rarity: 'legendary',
    trigger: 'jackpot_winner',
    threshold: 1,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'self_borrow_1',
    emoji: '🪞',
    title: 'Шиза',
    description: 'Одолжил денег самому себе.',
    rarity: 'rare',
    trigger: 'self_borrow',
    threshold: 1,
    isSecret: true,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'negative_karma_reached',
    emoji: '📉',
    title: 'Опущенный',
    description: 'Довел свою карму до отрицательного значения.',
    rarity: 'rare',
    trigger: 'negative_karma',
    threshold: 1,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'sugar_daddy',
    emoji: '🤑',
    title: 'Сахарный папик',
    description: 'Перевел суммарно 1000 Кармы другим пользователям.',
    rarity: 'epic',
    trigger: 'karma_transferred',
    threshold: 1000,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'blind_kitten',
    emoji: '🙈',
    title: 'Слепой котёнок',
    description: 'Выдал долг без свидетеля на сумму больше 5000.',
    rarity: 'rare',
    trigger: 'blind_kitten',
    threshold: 1,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  },
  {
    slug: 'witness_declined_3',
    emoji: '🤓',
    title: 'Душнила',
    description: 'Трижды отказался быть свидетелем.',
    rarity: 'common',
    trigger: 'witness_decline',
    threshold: 3,
    isSecret: false,
    isRepeatable: false,
    isActive: true,
    createdByAdmin: false
  }
];

async function seedAchievements() {
  console.log('[SEED] Начало сидирования базовых достижений...');
  try {
    for (const data of defaultAchievements) {
      const existing = await Achievement.findOne({ slug: data.slug });
      if (!existing) {
        const ach = new Achievement(data);
        await ach.save();
        console.log(`[SEED] Достижение "${data.title}" (${data.slug}) добавлено.`);
      } else {
        // Убедимся, что свойства обновлены до корректных значений в случае изменения схемы
        existing.trigger = data.trigger;
        existing.threshold = data.threshold;
        existing.isSecret = data.isSecret;
        existing.rarity = data.rarity;
        await existing.save();
      }
    }
    console.log('[SEED] Сидирование базовых достижений завершено.');
  } catch (err) {
    console.error('[SEED] Ошибка при сидировании достижений:', err);
  }
}

module.exports = seedAchievements;

if (require.main === module) {
  // Запуск скрипта напрямую
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
  require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
  
  mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(async () => {
      await seedAchievements();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(err => {
      console.error('Ошибка подключения к MongoDB:', err);
      process.exit(1);
    });
}
