const UserTask = require('../models/UserTask');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper to run in transaction with fallback
async function runInTransaction(callback) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (error.message && (error.message.includes('transaction') || error.message.includes('session') || error.message.includes('Transaction numbers'))) {
      return await callback(null);
    }
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

const getNextMonday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 is Sun, 1 is Mon...
  const diff = day === 0 ? 1 : 8 - day;
  const nextMonday = new Date(d.setDate(d.getDate() + diff));
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
};

// Shuffles an array in place
const shuffle = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const getTaskTemplates = (user, friends) => {
  const templates = [
    {
      task_type: 'lend_amount_2000',
      target_value: 1,
      reward_karma: 15,
      meta_data: {
        title: 'Щедрая душа',
        description: 'Выдать любой долг на сумму от 2 000 ₸.'
      }
    },
    {
      task_type: 'repay_debt',
      target_value: 1,
      reward_karma: 10,
      meta_data: {
        title: 'Честный человек',
        description: 'Полностью вернуть любой активный долг.'
      }
    },
    {
      task_type: 'spin_roulette_3',
      target_value: 3,
      reward_karma: 15,
      meta_data: {
        title: 'Святой рандом',
        description: 'Прокрутить рулетку (любой тир) 3 раза за неделю.'
      }
    },
    {
      task_type: 'witness_approve',
      target_value: 1,
      reward_karma: 10,
      meta_data: {
        title: 'Третий не лишний',
        description: 'Выступить свидетелем и успешно подтвердить чужой долг.'
      }
    },
    {
      task_type: 'forgive_debt',
      target_value: 1,
      reward_karma: 30,
      meta_data: {
        title: 'Грехи отпущены',
        description: 'Простить любой выданный долг.'
      }
    },
    {
      task_type: 'send_karma',
      target_value: 1,
      reward_karma: 10,
      meta_data: {
        title: 'Подогрев братвы',
        description: 'Отправить Карму любому другу через систему переводов.'
      }
    },
    {
      task_type: 'repay_on_time',
      target_value: 1,
      reward_karma: 20,
      meta_data: {
        title: 'Идеальная кредитная история',
        description: 'Вернуть долг без единого дня просрочки.'
      }
    },
    {
      task_type: 'borrow_amount_10000',
      target_value: 1,
      reward_karma: 15,
      meta_data: {
        title: 'Крупная рыба',
        description: 'Взять в долг на сумму от 10 000 ₸.'
      }
    },
    {
      task_type: 'spin_elite_roulette',
      target_value: 1,
      reward_karma: 10,
      meta_data: {
        title: 'Лудоман',
        description: 'Сыграть в Элитную рулетку (за 100 Кармы) хотя бы 1 раз.'
      }
    }
  ];

  if (friends && friends.length > 0) {
    const randomFriend = friends[Math.floor(Math.random() * friends.length)];
    templates.push({
      task_type: 'lend_to_specific_user',
      target_value: 1,
      reward_karma: 25,
      meta_data: {
        title: 'Целевая помощь',
        description: `Выдать долг конкретному пользователю: ${randomFriend.name} (@${randomFriend.username}).`,
        targetUserId: randomFriend._id,
        targetUsername: randomFriend.username,
        targetName: randomFriend.name
      }
    });
  }

  return templates;
};

/**
 * Generates 3 random tasks for a user
 */
async function generateQuestsForUser(userId) {
  try {
    const user = await User.findById(userId).populate('friends');
    if (!user) return [];

    // Delete existing active weekly quests for this user
    await UserTask.deleteMany({
      user_id: userId,
      expires_at: { $gt: new Date() }
    });

    const templates = getTaskTemplates(user, user.friends || []);
    const shuffled = shuffle(templates);
    const selected = shuffled.slice(0, 3);
    const expiresAt = getNextMonday();

    const createdTasks = [];
    for (const t of selected) {
      const task = new UserTask({
        user_id: userId,
        task_type: t.task_type,
        target_value: t.target_value,
        reward_karma: t.reward_karma,
        expires_at: expiresAt,
        meta_data: t.meta_data
      });
      await task.save();
      createdTasks.push(task);
    }
    console.log(`[QuestService] Generated 3 weekly quests for user ${user.name}`);
    return createdTasks;
  } catch (err) {
    console.error(`[QuestService] Error generating quests for user ${userId}:`, err);
    return [];
  }
}

/**
 * Increments progress on active quests of a given type.
 * Returns array of quests completed during this invocation.
 */
async function trackProgress(userId, taskType, increment = 1, checkMeta = {}) {
  const completedQuests = [];
  try {
    const tasks = await UserTask.find({
      user_id: userId,
      task_type: taskType,
      is_completed: false,
      expires_at: { $gt: new Date() }
    });

    for (const task of tasks) {
      if (taskType === 'lend_to_specific_user') {
        const targetUserId = task.meta_data?.targetUserId;
        const debt = checkMeta.debt;
        const debtorId = debt ? (debt.debtorId || debt.debtor) : checkMeta.targetUserId;

        const rawDebtorId = debtorId && debtorId._id ? debtorId._id : debtorId;
        const rawTargetUserId = targetUserId && targetUserId._id ? targetUserId._id : targetUserId;

        console.log('[QuestService] Checking quest lend_to_specific_user:');
        console.log(`- debtorId from event/meta: ${rawDebtorId} (${typeof rawDebtorId})`);
        console.log(`- targetUserId from task meta_data: ${rawTargetUserId} (${typeof rawTargetUserId})`);

        if (!rawTargetUserId || !rawDebtorId || String(rawDebtorId) !== String(rawTargetUserId)) {
          console.log('[QuestService] Quest match failed.');
          continue;
        }
        console.log('[QuestService] Quest match succeeded!');
      }


      await runInTransaction(async (session) => {
        const activeTask = await UserTask.findById(task._id).session(session);
        if (!activeTask || activeTask.is_completed) return;

        activeTask.current_value += increment;

        if (activeTask.current_value >= activeTask.target_value) {
          activeTask.is_completed = true;
          activeTask.current_value = activeTask.target_value;

          // Award reward_karma
          const user = await User.findById(userId).session(session);
          if (user) {
            user.replenishBalance('karma', activeTask.reward_karma, 'quest_completed', activeTask._id);
            user.stats.totalKarmaEarned = (user.stats.totalKarmaEarned || 0) + activeTask.reward_karma;
            await user.save({ session });


            // Create system transaction
            const Transaction = require('../models/Transaction');
            const admin = await User.findOne({ role: 'admin' }).session(session);
            const adminId = admin ? admin._id : userId;

            const tx = new Transaction({
              creditor: adminId,
              debtor: userId,
              amount: activeTask.reward_karma,
              originalAmount: activeTask.reward_karma,
              description: `🏆 Выполнение еженедельного квеста: ${activeTask.meta_data.title || activeTask.task_type}`,
              dueDate: new Date(),
              status: 'paid',
              resolvedAt: new Date(),
              createdBy: adminId
            });
            await tx.save({ session });

            // Send Telegram message
            const tg = require('./telegramService');
            if (user.telegramId) {
              tg.sendMessage(
                `🏆 <b>Еженедельное задание выполнено!</b>\n\n` +
                `✨ Задание: <b>${activeTask.meta_data.title}</b>\n` +
                `💰 Награда: <b>+${activeTask.reward_karma} Кармы</b> начислено на ваш баланс!`,
                user.telegramId
              );
            }

            completedQuests.push({
              title: activeTask.meta_data.title,
              reward_karma: activeTask.reward_karma
            });
          }
        }
        await activeTask.save({ session });
      });
    }
  } catch (err) {
    console.error(`[QuestService] Error tracking progress for ${taskType} / ${userId}:`, err);
  }
  return completedQuests;
}

module.exports = {
  generateQuestsForUser,
  trackProgress
};
