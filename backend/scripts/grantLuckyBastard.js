const User = require('../models/User');
const Achievement = require('../models/Achievement');

async function grantLuckyBastard() {
  try {
    const targetUsernames = ['itriserty', 'kuzya', 'mag1sterss'];
    const ach = await Achievement.findOne({ slug: 'jackpot_winner' });
    if (!ach) {
      console.warn('[LuckyBastard] Достижение "jackpot_winner" не найдено в БД.');
      return;
    }

    for (const username of targetUsernames) {
      const user = await User.findOne({ username: username.toLowerCase() });
      if (user) {
        const hasAch = user.achievements.some(ua => ua.achievement && ua.achievement.toString() === ach._id.toString());
        if (!hasAch) {
          user.achievements.push({
            achievement: ach._id,
            earnedAt: new Date()
          });

          // Добавим в витрину достижений, если есть место
          if (!user.achievementShowcase.includes(ach._id) && user.achievementShowcase.length < 3) {
            user.achievementShowcase.push(ach._id);
          }

          await user.save();
          console.log(`[LuckyBastard] Достижение "Везучий ублюдок" успешно выдано пользователю ${user.username}.`);
        }
      }
    }
  } catch (err) {
    console.error('[LuckyBastard] Ошибка автоматической выдачи достижения:', err);
  }
}

module.exports = grantLuckyBastard;
