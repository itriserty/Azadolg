const achievementService = require('./AchievementService');
const User = require('../models/User');
const Achievement = require('../models/Achievement');
const UserAchievementProgress = require('../models/UserAchievementProgress');
const Transaction = require('../models/Transaction');
const Post = require('../models/Post');
const tg = require('./telegramService');
const { RARITY_KARMA } = require('../utils/achievementHelper');

class AchievementObserver {
  init() {
    achievementService.on('debt_created', async ({ creditorId, debtorId, amount, hasWitness, isConfirmed, debt, newlyCompletedQuests, resultsRef }) => {
      try {
        // 1. active_debts_count (for debtor)
        await this.processProgress(debtorId, 'active_debts_count', async () => {
          return await Transaction.countDocuments({ debtor: debtorId, status: 'active' });
        }, resultsRef);

        // 2. self_borrow (for creditor if creditor === debtor)
        if (creditorId && debtorId && creditorId.toString() === debtorId.toString()) {
          await this.processProgress(creditorId, 'self_borrow', async () => 1, resultsRef);
        }

        // 3. blind_kitten (for creditor)
        if (amount > 5000 && !hasWitness) {
          await this.processProgress(creditorId, 'blind_kitten', async () => 1, resultsRef);
        }

        // 4. еженедельные задания для кредитора
        if (creditorId) {
          console.log('[AchievementObserver] Handling debt_created for quest. creditorId:', creditorId, 'debtorId:', debtorId);
          const questService = require('./questService');
          const quests = await questService.trackProgress(creditorId, 'lend_to_specific_user', 1, { debt });
          if (newlyCompletedQuests && quests && quests.length > 0) {
            newlyCompletedQuests.push(...quests);
          }
        }


        // Создаем системный пост в ленту при подтверждении долга
        if (isConfirmed) {
          const debtorUser = await User.findById(debtorId);
          const creditorUser = await User.findById(creditorId);
          if (debtorUser && creditorUser) {
            const content = `Пользователь @${debtorUser.username} занял ${amount} ₸ у @${creditorUser.username}`;
            const newPost = new Post({
              type: 'debt_created',
              author: debtorId,
              targetUser: creditorId,
              content: content
            });
            await newPost.save();
          }
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on debt_created listener:', err);
      }
    });

    achievementService.on('debt_paid', async ({ debtorId, creditorId, amount, isOverdue, resultsRef }) => {
      try {
        // 1. debts_paid_count (for debtor)
        const debtor = await User.findById(debtorId);
        if (debtor) {
          await this.processProgress(debtorId, 'debts_paid_count', async () => debtor.stats.totalDebtsPaid || 0, resultsRef);
        }

        // 2. empty_promises (for debtor)
        await this.processProgress(debtorId, 'empty_promises', async () => {
          const now = new Date();
          return await Transaction.countDocuments({ debtor: debtorId, status: 'active', dueDate: { $lt: now } });
        }, resultsRef);
      } catch (err) {
        console.error('[AchievementObserver] Error on debt_paid listener:', err);
      }
    });

    achievementService.on('debt_forgiven', async ({ creditorId, amount, resultsRef }) => {
      try {
        const creditor = await User.findById(creditorId);
        if (creditor) {
          await this.processProgress(creditorId, 'forgiven_count', async () => creditor.stats.totalDebtsForgivenByMe || 0, resultsRef);
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on debt_forgiven listener:', err);
      }
    });

    achievementService.on('karma_transferred', async ({ fromUserId, toUserId, amount, resultsRef }) => {
      try {
        // Cumulative: sugar_daddy (for sender)
        await this.processProgress(fromUserId, 'karma_transferred', async (currentVal) => {
          return (currentVal || 0) + amount;
        }, resultsRef, true);
      } catch (err) {
        console.error('[AchievementObserver] Error on karma_transferred listener:', err);
      }
    });

    achievementService.on('roulette_spun', async ({ userId, tierCost, winAmount, isJackpot, resultsRef }) => {
      try {
        if (isJackpot) {
          await this.processProgress(userId, 'jackpot_winner', async () => 1, resultsRef);
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on roulette_spun listener:', err);
      }
    });

    achievementService.on('debt_declined', async ({ debtorId, resultsRef }) => {
      try {
        const user = await User.findById(debtorId);
        if (user) {
          await this.processProgress(debtorId, 'declined_loan_streak', async () => user.consecutiveDeclines || 0, resultsRef);
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on debt_declined listener:', err);
      }
    });

    achievementService.on('witness_decision', async ({ witnessId, action, resultsRef }) => {
      try {
        if (action === 'approve') {
          const witness = await User.findById(witnessId);
          if (witness) {
            await this.processProgress(witnessId, 'witnesses_count', async () => witness.stats.totalDebtsWitnessed || 0, resultsRef);
          }
        } else if (action === 'reject') {
          // Cumulative: witness_decline
          await this.processProgress(witnessId, 'witness_decline', async (currentVal) => {
            return (currentVal || 0) + 1;
          }, resultsRef, true);
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on witness_decision listener:', err);
      }
    });

    achievementService.on('karma_changed', async ({ userId, resultsRef }) => {
      try {
        const user = await User.findById(userId);
        if (user) {
          await this.processProgress(userId, 'negative_karma', async () => user.karma < 0 ? 1 : 0, resultsRef);
        }
      } catch (err) {
        console.error('[AchievementObserver] Error on karma_changed listener:', err);
      }
    });

    achievementService.on('overdue_check', async ({ userId, resultsRef }) => {
      try {
        await this.processProgress(userId, 'overdue_365', async () => {
          const oneYearAgo = new Date();
          oneYearAgo.setDate(oneYearAgo.getDate() - 365);
          return await Transaction.countDocuments({
            debtor: userId,
            status: 'active',
            dueDate: { $lt: oneYearAgo }
          });
        }, resultsRef);
      } catch (err) {
        console.error('[AchievementObserver] Error on overdue_check listener:', err);
      }
    });

    achievementService.on('avatar_set', async ({ userId, resultsRef }) => {
      try {
        await this.processProgress(userId, 'avatar_set', async () => 1, resultsRef);
      } catch (err) {
        console.error('[AchievementObserver] Error on avatar_set listener:', err);
      }
    });
  }

  async processProgress(userId, triggerType, valCalculator, resultsRef, isIncremental = false) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const achievements = await Achievement.find({ trigger: triggerType, isActive: true });
      if (achievements.length === 0) return;

      let changed = false;

      for (const ach of achievements) {
        // Проверяем, получена ли уже ачивка пользователем
        const alreadyEarned = user.achievements.some(a => a.achievement.toString() === ach._id.toString());
        if (alreadyEarned && !ach.isRepeatable) continue;

        // Ищем/создаем запись о прогрессе в сводной таблице
        let progress = await UserAchievementProgress.findOne({ userId, achievementId: ach._id });
        if (!progress) {
          progress = new UserAchievementProgress({ userId, achievementId: ach._id, currentValue: 0, isEarned: false });
        }

        if (progress.isEarned && !ach.isRepeatable) continue;

        // Считаем новое значение
        let newVal;
        if (isIncremental) {
          newVal = await valCalculator(progress.currentValue);
        } else {
          newVal = await valCalculator();
        }

        progress.currentValue = newVal;

        // Если достигли порога
        if (newVal >= ach.threshold && (!progress.isEarned || ach.isRepeatable)) {
          progress.isEarned = true;

          // Начисляем Карму
          const rarityKey = (ach.rarity || '').toUpperCase();
          let karmaReward = ach.karmaReward > 0 ? ach.karmaReward : (RARITY_KARMA[rarityKey] || 0);

          if (ach.slug === 'set_avatar') {
            karmaReward = 25;
          }

          if (karmaReward > 0) {
            user.replenishBalance('karma', karmaReward, 'achievement_unlocked', ach._id);
          }


          // Выдаем ачивку
          user.achievements.push({ achievement: ach._id, earnedAt: new Date() });
          resultsRef.push({
            ...ach.toObject(),
            karmaReward
          });
          changed = true;

          // Создаем пост о получении ачивки в ленте
          const content = `Пользователь @${user.username} получил достижение [${ach.emoji} ${ach.title}]!`;
          const newPost = new Post({
            type: 'achievement_earned',
            author: user._id,
            content: content
          });
          await newPost.save();

          // Telegram-уведомление
          const karmaLine = karmaReward > 0 ? `\n💠 Награда: +${karmaReward} Кармы` : '';
          const announceText =
            `🏆 <b>ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!</b> 🏆\n\n` +
            `👤 Игрок: <b>${user.name}</b> (@${user.username})\n` +
            `🎖️ Награда: <b>${ach.emoji} ${ach.title}</b> (${ach.rarity})` +
            karmaLine + `\n📝 <i>${ach.description}</i>`;

          tg.sendMessage(announceText);
          if (user.telegramId) {
            try {
              const personalMsg = `🎉 Вы получили достижение: <b>${ach.emoji} ${ach.title}</b>!` +
                (karmaReward > 0 ? `\n💠 +${karmaReward} Кармы зачислено!` : '');
              tg.sendMessage(personalMsg, user.telegramId);
            } catch (e) {
              console.error('Ошибка отправки уведомления в Telegram:', e.message);
            }
          }
        }

        await progress.save();
      }

      if (changed) {
        await user.save();
      }
    } catch (err) {
      console.error(`[AchievementObserver.processProgress] Ошибка для ${userId} по триггеру ${triggerType}:`, err);
    }
  }
}

module.exports = new AchievementObserver();
