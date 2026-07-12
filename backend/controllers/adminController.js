const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const Quest       = require('../models/Quest');
const AdminLog    = require('../models/AdminLog');
const bcrypt      = require('bcryptjs');
const tg          = require('../services/telegramService');

// Вспомогательная функция — логирование действий
async function logAction(adminId, action, targetId, targetModel, reason = '', meta = {}) {
  try {
    await AdminLog.create({ admin: adminId, action, targetId, targetModel, reason, meta });
  } catch (e) {
    console.error('[AdminLog] Ошибка записи лога:', e);
  }
}

// ── Список всех пользователей ────────────────────────────────────────────────
async function getUsers(req, res) {
  try {
    const users = await User.find()
      .select('-password -resetCode -resetCodeExpires')
      .sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error('[admin/getUsers]', err);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
}

// ── Бан пользователя ─────────────────────────────────────────────────────────
async function banUser(req, res) {
  try {
    const { id }     = req.params;
    const { reason } = req.body;
    const adminId    = req.user;

    if (id === adminId.toString())
      return res.status(400).json({ error: 'Нельзя забанить самого себя' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.role === 'admin')
      return res.status(400).json({ error: 'Нельзя забанить другого администратора' });

    user.isBanned    = true;
    user.bannedReason = reason || 'Нарушение правил платформы';
    user.bannedAt    = new Date();
    await user.save();

    await logAction(adminId, 'ban_user', id, 'User', reason);

    tg.sendMessage(
      `🔨 <b>Пользователь заблокирован администратором</b>\n` +
      `👤 ${user.name} (@${user.username})\n` +
      `📝 Причина: ${reason || 'не указана'}`
    );

    res.status(200).json({ message: `Пользователь ${user.name} заблокирован`, user });
  } catch (err) {
    console.error('[admin/banUser]', err);
    res.status(500).json({ error: 'Ошибка бана пользователя' });
  }
}

// ── Разбан пользователя ───────────────────────────────────────────────────────
async function unbanUser(req, res) {
  try {
    const { id }  = req.params;
    const adminId = req.user;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.isBanned     = false;
    user.bannedReason = null;
    user.bannedAt     = null;
    await user.save();

    await logAction(adminId, 'unban_user', id, 'User');
    res.status(200).json({ message: `Пользователь ${user.name} разблокирован`, user });
  } catch (err) {
    console.error('[admin/unbanUser]', err);
    res.status(500).json({ error: 'Ошибка разбана' });
  }
}

// ── Удаление пользователя ─────────────────────────────────────────────────────
async function deleteUser(req, res) {
  try {
    const { id }     = req.params;
    const { reason } = req.body;
    const adminId    = req.user;

    if (id === adminId.toString())
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    await Promise.all([
      User.findByIdAndDelete(id),
      Transaction.deleteMany({ $or: [{ creditor: id }, { debtor: id }] })
    ]);

    await logAction(adminId, 'delete_user', id, 'User', reason, { username: user.username });
    res.status(200).json({ message: `Пользователь ${user.name} удалён` });
  } catch (err) {
    console.error('[admin/deleteUser]', err);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
}

// ── Получить все долги ────────────────────────────────────────────────────────
async function getAllDebts(req, res) {
  try {
    const debts = await Transaction.find()
      .populate('creditor debtor witness', 'name username eloRating')
      .sort({ createdAt: -1 })
      .limit(200);
    res.status(200).json(debts);
  } catch (err) {
    console.error('[admin/getAllDebts]', err);
    res.status(500).json({ error: 'Ошибка получения долгов' });
  }
}

// ── Удаление долга ────────────────────────────────────────────────────────────
async function deleteDebt(req, res) {
  try {
    const { id }     = req.params;
    const { reason } = req.body;
    const adminId    = req.user;

    const tx = await Transaction.findById(id).populate('creditor debtor', 'name');
    if (!tx) return res.status(404).json({ error: 'Долг не найден' });

    await Transaction.findByIdAndDelete(id);
    await logAction(adminId, 'delete_debt', id, 'Transaction', reason, {
      creditor: tx.creditor?.name, debtor: tx.debtor?.name, amount: tx.originalAmount
    });

    res.status(200).json({ message: 'Долг удалён' });
  } catch (err) {
    console.error('[admin/deleteDebt]', err);
    res.status(500).json({ error: 'Ошибка удаления долга' });
  }
}

// ── Аннулирование транзакции (с возвратом кармы) ─────────────────────────────
async function cancelTransaction(req, res) {
  try {
    const { id }     = req.params;
    const { reason } = req.body;
    const adminId    = req.user;

    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ error: 'Транзакция не найдена' });

    // Возврат Кармы, если уже списывалась (для квестов)
    tx.status = 'declined';
    await tx.save();

    await logAction(adminId, 'cancel_transaction', id, 'Transaction', reason);
    res.status(200).json({ message: 'Транзакция аннулирована', transaction: tx });
  } catch (err) {
    console.error('[admin/cancelTransaction]', err);
    res.status(500).json({ error: 'Ошибка аннулирования' });
  }
}

// ── Сброс пароля (admin → задаёт временный пароль) ───────────────────────────
async function resetUserPassword(req, res) {
  try {
    const { id }          = req.params;
    const { newPassword } = req.body;
    const adminId         = req.user;

    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ error: 'Новый пароль должен содержать минимум 6 символов' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.password            = await bcrypt.hash(newPassword, 10);
    user.resetCode           = null;
    user.resetCodeExpires    = null;
    await user.save();

    await logAction(adminId, 'reset_password', id, 'User', 'Сброс пароля администратором');

    if (user.telegramId) {
      tg.sendMessage(
        `🔑 <b>Ваш пароль был сброшен администратором</b>\n` +
        `Временный пароль: <code>${newPassword}</code>\n` +
        `Войдите и смените пароль в настройках.`,
        user.telegramId
      );
    }

    res.status(200).json({ message: `Пароль пользователя ${user.name} успешно сброшен` });
  } catch (err) {
    console.error('[admin/resetPassword]', err);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
}

// ── Лог действий администратора ────────────────────────────────────────────────
async function getAdminLogs(req, res) {
  try {
    const logs = await AdminLog.find()
      .populate('admin', 'name username')
      .sort({ createdAt: -1 })
      .limit(500);
    res.status(200).json(logs);
  } catch (err) {
    console.error('[admin/getLogs]', err);
    res.status(500).json({ error: 'Ошибка получения логов' });
  }
}

// ── Ручное начисление Кармы пользователю ─────────────────────────────────────
async function grantKarma(req, res) {
  try {
    const { id }     = req.params;
    const { amount, reason } = req.body;
    const adminId    = req.user;

    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ error: 'Укажите корректную сумму Кармы' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.karma += Number(amount);
    await user.save();

    await logAction(adminId, 'manual_karma_grant', id, 'User', reason, { amount });
    res.status(200).json({ message: `+${amount} Кармы начислено ${user.name}`, newKarma: user.karma });
  } catch (err) {
    console.error('[admin/grantKarma]', err);
    res.status(500).json({ error: 'Ошибка начисления кармы' });
  }
}

// ── CRUD Достижений ──────────────────────────────────────────────────────────
async function getAchievements(req, res) {
  try {
    const Achievement = require('../models/Achievement');
    const achievements = await Achievement.find().sort({ createdAt: -1 });
    res.status(200).json(achievements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка получения достижений' });
  }
}

async function createAchievement(req, res) {
  try {
    const { slug, title, description, emoji, rarity, trigger, threshold, isSecret, isRepeatable } = req.body;
    const adminId = req.user;

    if (!slug || !title || !description) {
      return res.status(400).json({ error: 'Slug, title, description обязательны' });
    }

    const Achievement = require('../models/Achievement');
    const existing = await Achievement.findOne({ slug: slug.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ error: 'Достижение с таким slug уже существует' });
    }

    const ach = new Achievement({
      slug: slug.toLowerCase().trim(),
      title,
      description,
      emoji: emoji || '🏆',
      rarity: rarity || 'common',
      trigger: trigger || 'custom',
      threshold: threshold !== undefined ? Number(threshold) : 1,
      isSecret: !!isSecret,
      isRepeatable: !!isRepeatable,
      createdByAdmin: true
    });
    await ach.save();

    await logAction(adminId, 'create_achievement', ach._id, 'Achievement', `Создана ачивка: ${title}`);
    res.status(201).json(ach);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка создания достижения' });
  }
}

async function updateAchievement(req, res) {
  try {
    const { id } = req.params;
    const { title, description, emoji, rarity, trigger, threshold, isSecret, isRepeatable, isActive } = req.body;
    const adminId = req.user;

    const Achievement = require('../models/Achievement');
    const ach = await Achievement.findById(id);
    if (!ach) return res.status(404).json({ error: 'Достижение не найдено' });

    if (title) ach.title = title;
    if (description) ach.description = description;
    if (emoji) ach.emoji = emoji;
    if (rarity) ach.rarity = rarity;
    if (trigger) ach.trigger = trigger;
    if (threshold !== undefined) ach.threshold = Number(threshold);
    if (isSecret !== undefined) ach.isSecret = !!isSecret;
    if (isRepeatable !== undefined) ach.isRepeatable = !!isRepeatable;
    if (isActive !== undefined) ach.isActive = !!isActive;

    await ach.save();
    await logAction(adminId, 'update_achievement', id, 'Achievement', `Обновлена ачивка: ${ach.title}`);
    
    res.status(200).json(ach);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка обновления достижения' });
  }
}

async function deleteAchievement(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user;

    const Achievement = require('../models/Achievement');
    const ach = await Achievement.findById(id);
    if (!ach) return res.status(404).json({ error: 'Достижение не найдено' });

    await Achievement.findByIdAndDelete(id);
    await logAction(adminId, 'delete_achievement', id, 'Achievement', `Удалена ачивка: ${ach.title}`);

    res.status(200).json({ message: 'Достижение успешно удалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка удаления достижения' });
  }
}

// ── Массовая раздача Кармы всем пользователям ─────────────────────────────────
async function distributeKarma(req, res) {
  try {
    const { amount, reason } = req.body;
    const adminId = req.user;

    const karmaAmount = Math.round(Number(amount));
    if (isNaN(karmaAmount) || karmaAmount <= 0)
      return res.status(400).json({ error: 'Укажите корректное количество Кармы' });

    // Массово начисляем карму всем активным (незаблокированным) пользователям
    const result = await User.updateMany(
      { isBanned: { $ne: true } },
      { $inc: { karma: karmaAmount, "stats.totalKarmaEarned": karmaAmount } }
    );

    await logAction(adminId, 'distribute_karma', adminId, 'User', reason || 'Массовая раздача кармы', { amount: karmaAmount, modifiedCount: result.modifiedCount });

    tg.sendMessage(
      `🎁 <b>Массовая раздача Кармы!</b>\n\n` +
      `✧ Всем пользователям начислено по <b>${karmaAmount} Кармы</b>.\n` +
      `📝 Описание: ${reason || 'Подарок от администрации'}`
    );

    res.status(200).json({
      message: `Успешно начислено по ${karmaAmount} Кармы для ${result.modifiedCount} пользователей.`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    console.error('[admin/distributeKarma]', err);
    res.status(500).json({ error: 'Ошибка раздачи кармы' });
  }
}

// ── Редактирование баланса Кармы (прибавить/убавить) ───────────────────────
async function adjustKarma(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.user;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0)
      return res.status(400).json({ error: 'Укажите корректную сумму изменения Кармы (ненулевое число)' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.karma = (user.karma || 0) + numAmount;
    if (user.karma < 0) user.karma = 0;
    
    await user.save();

    await logAction(adminId, 'manual_karma_grant', id, 'User', reason || 'Корректировка баланса', { amount: numAmount });
    res.status(200).json({ message: `Баланс Кармы изменен на ${numAmount}. Текущий: ${user.karma}`, newKarma: user.karma });
  } catch (err) {
    console.error('[admin/adjustKarma]', err);
    res.status(500).json({ error: 'Ошибка изменения баланса Кармы' });
  }
}

// ── Редактирование ELO (прибавить/убавить) ──────────────────────────────────
async function adjustElo(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const adminId = req.user;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount === 0)
      return res.status(400).json({ error: 'Укажите корректную сумму изменения ELO (ненулевое число)' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.eloRating = (user.eloRating || 1000) + numAmount;
    if (user.eloRating < 0) user.eloRating = 0;
    
    await user.save();

    await logAction(adminId, 'manual_elo_adjust', id, 'User', reason || 'Корректировка ELO', { amount: numAmount });
    res.status(200).json({ message: `Рейтинг ELO изменен на ${numAmount}. Текущий: ${user.eloRating}`, newElo: user.eloRating });
  } catch (err) {
    console.error('[admin/adjustElo]', err);
    res.status(500).json({ error: 'Ошибка изменения рейтинга ELO' });
  }
}

// ── Обнуление Джекпота ────────────────────────────────────────────────────────
async function resetJackpot(req, res) {
  try {
    const SystemState = require('../models/SystemState');
    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
    }
    state.jackpotPool = 0;
    await state.save();

    const adminId = req.user;
    await logAction(adminId, 'cancel_transaction', state._id, 'Transaction', 'Обнуление джекпота администратором');

    res.status(200).json({ message: 'Джекпот успешно обнулен', jackpotPool: state.jackpotPool });
  } catch (err) {
    console.error('[admin/resetJackpot]', err);
    res.status(500).json({ error: 'Ошибка обнуления джекпота' });
  }
}

// ── Глобальная статистика ────────────────────────────────────────────────────
async function getGlobalStats(req, res) {
  try {
    const SystemState = require('../models/SystemState');
    
    const karmaAggregation = await User.aggregate([
      { $group: { _id: null, totalKarma: { $sum: '$karma' } } }
    ]);
    const totalKarma = karmaAggregation.length > 0 ? karmaAggregation[0].totalKarma : 0;

    let state = await SystemState.findOne();
    if (!state) {
      state = new SystemState();
      await state.save();
    }
    const jackpotPool = state.jackpotPool;

    res.status(200).json({
      totalKarma,
      jackpotPool
    });
  } catch (err) {
    console.error('[admin/getGlobalStats]', err);
    res.status(500).json({ error: 'Ошибка получения глобальной статистики' });
  }
}

// ── Получение всех пользователей вместе с активными еженедельными квестами ──
async function getUsersWithQuests(req, res) {
  try {
    const UserTask = require('../models/UserTask');
    
    // 1. Получаем всех пользователей без пароля
    const users = await User.find()
      .select('-password -resetCode -resetCodeExpires')
      .sort({ createdAt: -1 });

    // 2. Ищем все активные еженедельные задачи (срок действия которых в будущем)
    const activeTasks = await UserTask.find({
      expires_at: { $gt: new Date() }
    });

    // 3. Группируем задачи по user_id
    const tasksByUser = {};
    activeTasks.forEach(task => {
      if (!task.user_id) return;
      const uId = task.user_id.toString();
      if (!tasksByUser[uId]) {
        tasksByUser[uId] = [];
      }
      tasksByUser[uId].push({
        _id: task._id,
        task_type: task.task_type,
        target_value: task.target_value,
        current_value: task.current_value,
        reward_karma: task.reward_karma,
        is_completed: task.is_completed,
        expires_at: task.expires_at,
        meta_data: task.meta_data
      });
    });

    // 4. Привязываем задачи к объектам пользователей
    const usersWithQuests = users.map(user => {
      const userObj = user.toObject();
      userObj.tasks = tasksByUser[user._id.toString()] || [];
      return userObj;
    });

    res.status(200).json(usersWithQuests);
  } catch (err) {
    console.error('[admin/getUsersWithQuests]', err);
    res.status(500).json({ error: 'Ошибка получения игроков и их заданий' });
  }
}

module.exports = {
  getUsers, banUser, unbanUser, deleteUser,
  getAllDebts, deleteDebt, cancelTransaction,
  resetUserPassword, getAdminLogs, grantKarma,
  getAchievements, createAchievement, updateAchievement, deleteAchievement,
  distributeKarma,
  adjustKarma, adjustElo, resetJackpot, getGlobalStats,
  getUsersWithQuests
};
