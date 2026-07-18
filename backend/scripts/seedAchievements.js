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
  },
  {
    slug: 'set_avatar',
    emoji: '👤',
    title: 'Своё лицо',
    description: 'Установил аватарку в профиле.',
    rarity: 'common',
    trigger: 'avatar_set',
    threshold: 1,
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

    // Проверка ачивок за аватарку для существующих пользователей
    const User = require('../models/User');
    const BalanceLog = require('../models/BalanceLog');
    const avatarAch = await Achievement.findOne({ slug: 'set_avatar' });
    if (avatarAch) {
      const usersWithAvatar = await User.find({
        avatar: { $ne: null, $exists: true, $ne: '' }
      });
      for (const u of usersWithAvatar) {
        const hasAch = u.achievements.some(a => a.achievement && a.achievement.toString() === avatarAch._id.toString());
        if (!hasAch) {
          // Начисляем 25 кармы
          u.replenishBalance('karma', 25, 'achievement_unlocked', avatarAch._id);
          u.achievements.push({ achievement: avatarAch._id, earnedAt: new Date() });
          await u.save();

          // Создаем прогресс
          const UserAchievementProgress = require('../models/UserAchievementProgress');
          let progress = await UserAchievementProgress.findOne({ userId: u._id, achievementId: avatarAch._id });
          if (!progress) {
            progress = new UserAchievementProgress({ userId: u._id, achievementId: avatarAch._id, currentValue: 1, isEarned: true });
            await progress.save();
          } else if (!progress.isEarned) {
            progress.isEarned = true;
            progress.currentValue = 1;
            await progress.save();
          }

          // Создаем пост в ленту
          const Post = require('../models/Post');
          const newPost = new Post({
            type: 'achievement_earned',
            author: u._id,
            content: `Пользователь @${u.username} получил достижение [${avatarAch.emoji} ${avatarAch.title}]!`
          });
          await newPost.save();

          console.log(`[SEED] Выдано достижение "set_avatar" пользователю ${u.username}`);
        }
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
