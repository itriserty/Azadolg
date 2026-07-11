const User = require('../models/User');
const tg = require('../services/telegramService');

// Получение списка всех пользователей (для выпадающих списков)
async function getUsers(req, res) {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).sort({ eloRating: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
}

function getRankLabel(elo) {
  if (elo < 1000) return 'Железо';
  if (elo < 1100) return 'Бронза';
  if (elo < 1200) return 'Серебро';
  if (elo < 1300) return 'Золото';
  if (elo < 1400) return 'Платина';
  if (elo < 1500) return 'Алмаз';
  return 'Global Elite';
}

// --- НОВЫЙ РОУТ: Таблица лидеров по ELO-рейтингу ---
// GET /api/leaderboard
async function getLeaderboard(req, res) {
  try {
    const users = await User.find({ role: { $ne: 'admin' } })
      .select('name username email eloRating karma avatar avatar_url activeProfileSkin activeProfileFrame')
      .sort({ eloRating: -1 }); // Сортируем по убыванию ELO

    const enrichedUsers = users.map(u => {
      const obj = u.toObject();
      obj.rank = getRankLabel(obj.eloRating);
      return obj;
    });

    res.status(200).json(enrichedUsers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка получения таблицы лидеров' });
  }
}

// Создание пользователя (регистрация)
async function createUser(req, res) {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Необходимо указать имя и email' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }
    const newUser = new User({ name, email });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
}

// Добавление в друзья (двусторонняя связь)
async function addFriend(req, res) {
  try {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) {
      return res.status(400).json({ error: 'Не указаны ID пользователей' });
    }
    if (userId === friendId) {
      return res.status(400).json({ error: 'Нельзя добавить себя в друзья' });
    }
    const user = await User.findById(userId);
    const friend = await User.findById(friendId);
    if (!user || !friend) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    if (user.friends.map(id => id.toString()).includes(friendId)) {
      return res.status(400).json({ error: 'Вы уже друзья' });
    }
    user.friends.push(friendId);
    friend.friends.push(userId);
    await Promise.all([user.save(), friend.save()]);
    res.status(200).json({ message: 'Друг успешно добавлен' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка добавления в друзья' });
  }
}

// Обновить Telegram ID пользователя
async function updateTelegramId(req, res) {
  try {
    const { telegramId } = req.body;
    const userId = req.user;

    const user = await User.findByIdAndUpdate(
      userId,
      { telegramId: telegramId ? telegramId.trim() : null },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // 📣 Telegram-уведомление
    if (user.telegramId) {
      tg.sendMessage(`🔔 <b>Уведомления привязаны!</b>\n\nВы успешно привязали свой Telegram аккаунт к системе Azadolg ELO. Теперь вы будете получать отчеты о долгах и активности сюда!`, user.telegramId);
    }
    tg.sendMessage(`🔔 <b>Telegram привязан!</b>\n\nПользователь <b>${user.name}</b> (@${user.username}) привязал свой Telegram ID.`);

    res.status(200).json({ message: 'Telegram ID успешно обновлен!', user });
  } catch (error) {
    console.error('Ошибка обновления telegramId:', error);
    res.status(500).json({ error: 'Ошибка обновления Telegram ID' });
  }
}

// Обновить аватар пользователя (загруженный файл через multer)
async function updateAvatar(req, res) {
  try {
    const userId = req.user;
    if (!req.file) {
      return res.status(400).json({ error: 'Необходимо прикрепить файл изображения' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl, avatar_url: avatarUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Telegram-уведомление
    tg.sendMessage(`🖼️ <b>Новое фото профиля!</b>\n\nПользователь <b>${user.name}</b> (@${user.username}) загрузил новый аватар.`);
    if (user.telegramId) {
      tg.sendMessage(`🖼️ Вы успешно обновили свой аватар в Azadolg!`, user.telegramId);
    }

    res.status(200).json({ message: 'Аватар профиля успешно обновлен!', user });
  } catch (error) {
    console.error('Ошибка обновления аватара:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении аватара' });
  }
}

// Получение профиля (Steam-подобная страница) с фильтрацией долгов по графу друзей
async function getUserProfile(req, res) {
  try {
    const { id } = req.params;
    const viewerId = req.user;

    // Проверяем достижение "Еблан года" (просрочка > 365 дней) перед загрузкой профиля
    const { checkAndAward } = require('../utils/achievementHelper');
    await checkAndAward(id, 'overdue_365');

    const [targetUser, viewerUser] = await Promise.all([
      User.findById(id)
        .select('-password -resetCode -resetCodeExpires')
        .populate('achievements.achievement')
        .populate('achievementShowcase')
        .populate('friends', 'name username avatar avatar_url eloRating karma activeProfileFrame activeProfileSkin'),
      User.findById(viewerId)
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const isSelf = id.toString() === viewerId.toString();
    const isFriend = targetUser.friends.map(f => f._id.toString()).includes(viewerId.toString());
    const isAdmin = viewerUser && viewerUser.role === 'admin';
    const canView = isSelf || isAdmin || isFriend;

    if (!canView) {
      // Если не друзья — возвращаем ограниченные данные (заблокированный профиль)
      return res.status(200).json({
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          avatar: targetUser.avatar,
          eloRating: targetUser.eloRating,
          activeProfileSkin: targetUser.activeProfileSkin,
          activeProfileFrame: targetUser.activeProfileFrame,
          isPrivateProfile: true
        },
        isFriend,
        canView: false,
        comments: [],
        debts: [],
        inventory: []
      });
    }

    // Загрузка комментариев
    const ProfileComment = require('../models/ProfileComment');
    const comments = await ProfileComment.find({ profileUserId: id })
      .populate('authorId', 'name username avatar activeProfileSkin activeProfileFrame')
      .sort({ createdAt: -1 });

    // Загрузка инвентаря косметики
    const Inventory = require('../models/Inventory');
    const { SHOP_ITEMS } = require('./shopController');
    const inventory = await Inventory.find({ userId: id });
    const enrichedInventory = inventory.map(inv => {
      const details = SHOP_ITEMS[inv.itemId];
      return {
        ...inv.toObject(),
        details: details || { name: 'Неизвестный предмет', description: 'Нет описания' }
      };
    });

    // Загрузка истории долгов с фильтрацией по графу друзей
    const Transaction = require('../models/Transaction');
    const myFriendIds = viewerUser ? viewerUser.friends : [];
    
    // Агрегация долгов с фильтрацией
    const mongoose = require('mongoose');
    const targetUserId = new mongoose.Types.ObjectId(id);
    const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
    const myFriendObjectIds = myFriendIds.map(fid => new mongoose.Types.ObjectId(fid));

    const rawDebts = await Transaction.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { creditor: targetUserId },
                { debtor: targetUserId }
              ]
            },
            {
              $or: [
                { creditor: viewerObjectId },
                { debtor: viewerObjectId },
                { witness: viewerObjectId },
                { $and: [{ debtor: targetUserId }, { creditor: { $in: myFriendObjectIds } }] },
                { $and: [{ creditor: targetUserId }, { debtor: { $in: myFriendObjectIds } }] }
              ]
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'creditor',
          foreignField: '_id',
          as: 'creditorInfo'
        }
      },
      { $unwind: '$creditorInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'debtor',
          foreignField: '_id',
          as: 'debtorInfo'
        }
      },
      { $unwind: '$debtorInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'witness',
          foreignField: '_id',
          as: 'witnessInfo'
        }
      },
      {
        $unwind: {
          path: '$witnessInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          originalAmount: 1,
          promisedReturnAmount: 1,
          paidAmount: 1,
          description: 1,
          dueDate: 1,
          incurredAt: 1,
          penaltyRate: 1,
          status: 1,
          witnessStatus: 1,
          payments: 1,
          createdAt: 1,
          resolvedAt: 1,
          creditor: {
            _id: '$creditorInfo._id',
            name: '$creditorInfo.name',
            username: '$creditorInfo.username',
            avatar: '$creditorInfo.avatar',
            eloRating: '$creditorInfo.eloRating'
          },
          debtor: {
            _id: '$debtorInfo._id',
            name: '$debtorInfo.name',
            username: '$debtorInfo.username',
            avatar: '$debtorInfo.avatar',
            eloRating: '$debtorInfo.eloRating'
          },
          witness: {
            _id: '$witnessInfo._id',
            name: '$witnessInfo.name',
            username: '$witnessInfo.username',
            avatar: '$witnessInfo.avatar',
            eloRating: '$witnessInfo.eloRating'
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // Пост-обработка долгов (пени, остаток)
    const { getCalculatedAmount } = require('../utils/debtHelper');
    const now = new Date();
    const processedDebts = rawDebts.map(t => {
      if (t.status === 'pending_approval' || t.status === 'pending_witness') {
        const base = t.promisedReturnAmount || t.originalAmount;
        return { ...t, amount: base, penaltyAccrued: 0, isOverdue: false, daysSinceCreation: 0, remaining: base };
      }

      const currentAmount = getCalculatedAmount(t, now);
      const base = t.promisedReturnAmount || t.originalAmount;
      const penaltyAccrued = Number((currentAmount - base).toFixed(2));
      const startDate = t.incurredAt || t.createdAt;
      const diffDays = Math.floor((now - new Date(startDate)) / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays > 7;
      const remaining = Math.max(0, currentAmount - (t.paidAmount || 0));

      return {
        ...t,
        amount: currentAmount,
        penaltyAccrued,
        isOverdue,
        daysSinceCreation: diffDays,
        remaining
      };
    });

    const Achievement = require('../models/Achievement');
    const allAchievements = await Achievement.find({ isActive: true });

    res.status(200).json({
      user: targetUser,
      isFriend,
      canView: true,
      comments,
      debts: processedDebts,
      inventory: enrichedInventory,
      allAchievements
    });
  } catch (error) {
    console.error('Ошибка getUserProfile:', error);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
}

// Переключение приватности профиля
async function toggleProfilePrivacy(req, res) {
  try {
    const userId = req.user;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.isPrivateProfile = !user.isPrivateProfile;
    await user.save();

    res.status(200).json({ message: 'Настройки приватности обновлены', isPrivateProfile: user.isPrivateProfile });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Обновление витрины ачивок (максимум 4)
async function updateShowcase(req, res) {
  try {
    const userId = req.user;
    const { achievementIds } = req.body;

    if (!Array.isArray(achievementIds)) {
      return res.status(400).json({ error: 'achievementIds должен быть массивом' });
    }

    if (achievementIds.length > 4) {
      return res.status(400).json({ error: 'В витрину можно поместить максимум 4 ачивки' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // У пользователя должны быть эти ачивки
    const earnedIds = user.achievements.map(a => a.achievement.toString());
    const validIds = achievementIds.filter(id => earnedIds.includes(id));

    user.achievementShowcase = validIds;
    await user.save();

    const updatedUser = await User.findById(userId).populate('achievementShowcase').select('-password');
    res.status(200).json({ message: 'Витрина успешно обновлена', user: updatedUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка обновления витрины' });
  }
}

// Добавление комментария на стену профиля
async function addProfileComment(req, res) {
  try {
    const profileUserId = req.params.id;
    const authorId = req.user;
    const { text } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Текст комментария пуст' });
    }

    const [profileUser, authorUser] = await Promise.all([
      User.findById(profileUserId),
      User.findById(authorId)
    ]);

    if (!profileUser) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    // Проверяем приватность: комментировать могут друзья
    const isSelf = profileUserId.toString() === authorId.toString();
    const isFriend = profileUser.friends.map(String).includes(authorId.toString());
    if (!isSelf && profileUser.isPrivateProfile && !isFriend) {
      return res.status(403).json({ error: 'Профиль скрыт настройками приватности' });
    }

    const ProfileComment = require('../models/ProfileComment');
    const comment = new ProfileComment({
      profileUserId,
      authorId,
      text: text.trim()
    });
    await comment.save();

    const populatedComment = await ProfileComment.findById(comment._id)
      .populate('authorId', 'name username avatar activeProfileSkin activeProfileFrame');

    res.status(201).json(populatedComment);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка публикации комментария' });
  }
}

// Удаление комментария
async function deleteProfileComment(req, res) {
  try {
    const { id, commentId } = req.params;
    const userId = req.user;

    const ProfileComment = require('../models/ProfileComment');
    const comment = await ProfileComment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });

    const user = await User.findById(userId);
    const isAuthor = comment.authorId.toString() === userId.toString();
    const isOwner = comment.profileUserId.toString() === userId.toString();
    const isAdmin = user && user.role === 'admin';

    if (!isAuthor && !isOwner && !isAdmin) {
      return res.status(403).json({ error: 'У вас нет прав для удаления этого комментария' });
    }

    await ProfileComment.findByIdAndDelete(commentId);
    res.status(200).json({ message: 'Комментарий удален' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка при удалении комментария' });
  }
}

module.exports = {
  getUsers,
  getLeaderboard,
  createUser,
  addFriend,
  updateTelegramId,
  updateAvatar,
  getUserProfile,
  toggleProfilePrivacy,
  updateShowcase,
  addProfileComment,
  deleteProfileComment
};
