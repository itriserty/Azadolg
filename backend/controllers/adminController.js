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

module.exports = {
  getUsers, banUser, unbanUser, deleteUser,
  getAllDebts, deleteDebt, cancelTransaction,
  resetUserPassword, getAdminLogs, grantKarma,
  getAchievements, createAchievement, updateAchievement, deleteAchievement
};
