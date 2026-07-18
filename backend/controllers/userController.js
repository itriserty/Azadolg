const mongoose = require('mongoose');
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

    let cleanTelegramId = null;
    if (telegramId !== undefined && telegramId !== null) {
      const trimmed = String(telegramId).trim();
      if (trimmed && trimmed !== '0' && trimmed !== 'null' && trimmed !== 'undefined') {
        cleanTelegramId = trimmed;
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { telegramId: cleanTelegramId },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // 📣 Telegram-уведомление
    if (user.telegramId) {
      tg.sendMessage(`🔔 <b>Уведомления привязаны!</b>\n\nВы успешно привязали свой Telegram аккаунт к системе Avarice ELO. Теперь вы будете получать отчеты о долгах и активности сюда!`, user.telegramId);
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
      tg.sendMessage(`🖼️ Вы успешно обновили свой аватар в Avarice!`, user.telegramId);
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

    // Валидация ID пользователя во избежание CastError
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Неверный формат ID пользователя' });
    }

    // Проверяем достижение "Еблан года" (просрочка > 365 дней) перед загрузкой профиля
    const achievementService = require('../services/AchievementService');
    await achievementService.emit('overdue_check', { userId: id });

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
    
    // Безопасное сопоставление списка друзей (исключая возможные null значения при populate)
    const isFriend = targetUser.friends && targetUser.friends
      .filter(Boolean)
      .map(f => f._id.toString())
      .includes(viewerId.toString());

    const isAdmin = viewerUser && viewerUser.role === 'admin';
    const canView = isSelf || isAdmin || isFriend;

    if (!canView) {
      // Если не друзья — возвращаем ограниченные данные (заблокированный профиль) с дефолтными значениями для фронтенда
      return res.status(200).json({
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          username: targetUser.username,
          avatar: targetUser.avatar,
          eloRating: targetUser.eloRating,
          activeProfileSkin: targetUser.activeProfileSkin,
          activeProfileFrame: targetUser.activeProfileFrame,
          isPrivateProfile: true,
          level: targetUser.level || 1,
          exp: targetUser.exp || 0,
          friends: [],
          achievements: [],
          achievementShowcase: [],
          badges: [],
          email: '',
          balance: 0
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
    const targetUserId = new mongoose.Types.ObjectId(id);
    const viewerObjectId = new mongoose.Types.ObjectId(viewerId);
    const myFriendObjectIds = (myFriendIds || [])
      .filter(Boolean)
      .map(fid => new mongoose.Types.ObjectId(fid));

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
    const UserAchievementProgress = require('../models/UserAchievementProgress');

    const [rawAchievements, progresses] = await Promise.all([
      Achievement.find({ isActive: true }),
      UserAchievementProgress.find({ userId: id })
    ]);

    const progressMap = {};
    progresses.forEach(p => {
      if (p.achievementId) {
        progressMap[p.achievementId.toString()] = {
          isEarned: p.isEarned,
          currentValue: p.currentValue
        };
      }
    });

    const allAchievements = rawAchievements.map(ach => {
      const achObj = ach.toObject();
      const prog = progressMap[ach._id.toString()];
      achObj.isEarned = prog ? prog.isEarned : false;
      achObj.progress = prog ? prog.currentValue : 0;

      const userEarned = targetUser.achievements.find(
        ua => ua.achievement && ua.achievement._id.toString() === ach._id.toString()
      );
      if (userEarned) {
        achObj.isEarned = true;
        achObj.earnedAt = userEarned.earnedAt;
      }
      return achObj;
    });

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

// ── Перевод Кармы между пользователями (P2P) ──────────────────────────────────
async function transferKarma(req, res) {
  try {
    const fromUserId = req.user;
    const { toUserId, amount } = req.body;

    if (!fromUserId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    if (!toUserId) {
      return res.status(400).json({ error: 'Не указан получатель' });
    }

    if (fromUserId.toString() === toUserId.toString()) {
      return res.status(400).json({ error: 'Нельзя переводить Карму самому себе' });
    }

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Сумма перевода должна быть целым положительным числом' });
    }

    const session = await mongoose.startSession();

    let success = false;
    let senderUpdated = null;
    let recipientUpdated = null;

    try {
      session.startTransaction();

      const sender = await User.findById(fromUserId).session(session);
      if (!sender) {
        throw new Error('Отправитель не найден');
      }

      if (sender.isBanned) {
        throw new Error('Ваш аккаунт заблокирован. Вы не можете совершать переводы.');
      }

      const recipient = await User.findById(toUserId).session(session);
      if (!recipient) {
        throw new Error('Получатель не найден');
      }

      if (recipient.isBanned) {
        throw new Error('Получатель заблокирован');
      }

      if ((sender.karma || 0) < amount) {
        throw new Error(`Недостаточно Кармы. Требуется ${amount} ✧, у вас на балансе ${sender.karma || 0} ✧.`);
      }

      // Обновляем балансы
      sender.karma -= amount;
      sender._karmaReason = 'transfer_sent';
      sender._karmaRelatedEntityId = recipient._id;
      
      const receivedAmount = Math.floor(amount * 0.9);
      recipient.karma = (recipient.karma || 0) + receivedAmount;
      recipient._karmaReason = 'transfer_received';
      recipient._karmaRelatedEntityId = sender._id;

      await sender.save({ session });
      await recipient.save({ session });


      const Transaction = require('../models/Transaction');
      
      // Создаем записи истории
      const transferSent = new Transaction({
        creditor: toUserId,
        debtor: fromUserId,
        amount: amount,
        originalAmount: amount,
        description: `Перевод кармы пользователю @${recipient.username}`,
        dueDate: new Date(),
        status: 'paid',
        type: 'transfer_sent',
        createdBy: fromUserId
      });
      await transferSent.save({ session });

      const transferReceived = new Transaction({
        creditor: toUserId,
        debtor: fromUserId,
        amount: receivedAmount,
        originalAmount: receivedAmount,
        description: `Получен перевод кармы от @${sender.username}`,
        dueDate: new Date(),
        status: 'paid',
        type: 'transfer_received',
        createdBy: fromUserId
      });
      await transferReceived.save({ session });

      await session.commitTransaction();
      success = true;
      senderUpdated = sender;
      recipientUpdated = recipient;
    } catch (txError) {
      await session.abortTransaction();

      // Проверка на отсутствие Replica Set (fallback для локальной разработки)
      if (txError.message && txError.message.includes('Transaction numbers are only allowed')) {
        console.warn('[transferKarma] Transactions not supported by MongoDB server. Falling back to non-transactional execution...');
        
        // Повторяем без транзакции
        const sender = await User.findById(fromUserId);
        if (!sender) return res.status(404).json({ error: 'Отправитель не найден' });
        if (sender.isBanned) return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Вы не можете совершать переводы.' });

        const recipient = await User.findById(toUserId);
        if (!recipient) return res.status(404).json({ error: 'Получатель не найден' });
        if (recipient.isBanned) return res.status(400).json({ error: 'Получатель заблокирован' });

        if ((sender.karma || 0) < amount) {
          return res.status(400).json({ error: `Недостаточно Кармы. Требуется ${amount} ✧, у вас на балансе ${sender.karma || 0} ✧.` });
        }

        sender.karma -= amount;
        sender._karmaReason = 'transfer_sent';
        sender._karmaRelatedEntityId = recipient._id;

        const receivedAmount = Math.floor(amount * 0.9);
        recipient.karma = (recipient.karma || 0) + receivedAmount;
        recipient._karmaReason = 'transfer_received';
        recipient._karmaRelatedEntityId = sender._id;

        await sender.save();
        await recipient.save();

        const Transaction = require('../models/Transaction');
        
        const transferSent = new Transaction({
          creditor: toUserId,
          debtor: fromUserId,
          amount: amount,
          originalAmount: amount,
          description: `Перевод кармы пользователю @${recipient.username}`,
          dueDate: new Date(),
          status: 'paid',
          type: 'transfer_sent',
          createdBy: fromUserId
        });
        await transferSent.save();

        const transferReceived = new Transaction({
          creditor: toUserId,
          debtor: fromUserId,
          amount: receivedAmount,
          originalAmount: receivedAmount,
          description: `Получен перевод кармы от @${sender.username}`,
          dueDate: new Date(),
          status: 'paid',
          type: 'transfer_received',
          createdBy: fromUserId
        });
        await transferReceived.save();

        success = true;
        senderUpdated = sender;
        recipientUpdated = recipient;
      } else {
        return res.status(400).json({ error: txError.message || 'Ошибка транзакции перевода' });
      }
    } finally {
      session.endSession();
    }

    if (success) {
      const achievementService = require('../services/AchievementService');
      const newlyAwarded = await achievementService.emit('karma_transferred', {
        fromUserId: fromUserId,
        toUserId: toUserId,
        amount: amount
      });

      const questService = require('../services/questService');
      const newlyCompletedQuests = await questService.trackProgress(fromUserId, 'send_karma');

      return res.status(200).json({
        message: 'Перевод успешно выполнен',
        senderKarma: senderUpdated.karma,
        recipientKarma: recipientUpdated.karma,
        newlyCompletedQuests,
        newlyAwarded
      });
    }
  } catch (error) {
    console.error('[transferKarma]', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

async function getWeeklyQuests(req, res) {
  try {
    const userId = req.user;
    const UserTask = require('../models/UserTask');
    const questService = require('../services/questService');

    let tasks = await UserTask.find({
      user_id: userId,
      expires_at: { $gt: new Date() }
    });

    if (tasks.length === 0) {
      tasks = await questService.generateQuestsForUser(userId);
    }

    res.status(200).json(tasks);
  } catch (error) {
    console.error('[getWeeklyQuests]', error);
    res.status(500).json({ error: 'Ошибка получения еженедельных заданий' });
  }
}

async function getBalanceHistory(req, res) {
  try {
    const userId = req.user;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const BalanceLog = require('../models/BalanceLog');
    const Transaction = require('../models/Transaction');
    const UserTask = require('../models/UserTask');
    const Achievement = require('../models/Achievement');
    const User = require('../models/User');

    const total = await BalanceLog.countDocuments({ user_id: userId });
    const logs = await BalanceLog.find({ user_id: userId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Bulk fetch related entities to build descriptions
    const debtIds = [];
    const taskIds = [];
    const achievementIds = [];
    const userIds = [];

    logs.forEach(log => {
      if (log.related_entity_id) {
        const refId = log.related_entity_id;
        if (['debt_issued', 'debt_repaid', 'debt_paid', 'overdue_penalty'].includes(log.reason)) {
          debtIds.push(refId);
        } else if (log.reason === 'quest_completed') {
          taskIds.push(refId);
        } else if (log.reason === 'achievement_unlocked') {
          achievementIds.push(refId);
        } else if (['transfer_sent', 'transfer_received'].includes(log.reason)) {
          userIds.push(refId);
        }
      }
    });

    const [debts, tasks, achievements, users] = await Promise.all([
      Transaction.find({ _id: { $in: debtIds } }).populate('creditor debtor', 'name username'),
      UserTask.find({ _id: { $in: taskIds } }),
      Achievement.find({ _id: { $in: achievementIds } }),
      User.find({ _id: { $in: userIds } }, 'name username')
    ]);

    const debtMap = new Map(debts.map(d => [d._id.toString(), d]));
    const taskMap = new Map(tasks.map(t => [t._id.toString(), t]));
    const achievementMap = new Map(achievements.map(a => [a._id.toString(), a]));
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const formattedLogs = logs.map(log => {
      let description = 'Изменение баланса';
      const refIdStr = log.related_entity_id ? log.related_entity_id.toString() : '';

      switch (log.reason) {
        case 'debt_issued': {
          const debt = debtMap.get(refIdStr);
          if (debt) {
            const isCreditor = debt.creditor?._id?.toString() === userId.toString();
            const otherUser = isCreditor ? debt.debtor : debt.creditor;
            description = isCreditor 
              ? `Выдача долга пользователю @${otherUser?.username || 'user'}`
              : `Получение долга от пользователя @${otherUser?.username || 'user'}`;
          } else {
            description = 'Выдача/получение долга';
          }
          break;
        }
        case 'debt_repaid':
        case 'debt_paid': {
          const debt = debtMap.get(refIdStr);
          if (debt) {
            const isCreditor = debt.creditor?._id?.toString() === userId.toString();
            const otherUser = isCreditor ? debt.debtor : debt.creditor;
            description = isCreditor 
              ? `Получена оплата долга от пользователя @${otherUser?.username || 'user'}`
              : `Погашен долг перед пользователем @${otherUser?.username || 'user'}`;
          } else {
            description = 'Погашение долга';
          }
          break;
        }
        case 'quest_completed': {
          const task = taskMap.get(refIdStr);
          description = task 
            ? `Выполнение еженедельного квеста: "${task.meta_data?.title || task.task_type}"`
            : 'Выполнение еженедельного квеста';
          break;
        }
        case 'achievement_unlocked': {
          const ach = achievementMap.get(refIdStr);
          description = ach 
            ? `Получено достижение: ${ach.emoji || '🏆'} ${ach.title}`
            : 'Получено достижение';
          break;
        }
        case 'transfer_sent': {
          const otherUser = userMap.get(refIdStr);
          description = otherUser 
            ? `Перевод кармы пользователю @${otherUser.username}`
            : 'Перевод кармы';
          break;
        }
        case 'transfer_received': {
          const otherUser = userMap.get(refIdStr);
          description = otherUser 
            ? `Получен перевод кармы от пользователя @${otherUser.username}`
            : 'Получен перевод кармы';
          break;
        }
        case 'roulette_spin':
          description = 'Игра в рулетку';
          break;
        case 'overdue_penalty': {
          const debt = debtMap.get(refIdStr);
          description = debt 
            ? `Штраф за просрочку долга перед @${debt.creditor?.username || 'пользователем'}`
            : 'Штраф за просрочку долга';
          break;
        }
        case 'weekly_bonus':
          description = 'Еженедельная Карма по ELO';
          break;
        case 'weekly_decay':
          description = 'Списание Кармы за неактивность';
          break;
        case 'admin_adjustment':
          description = 'Корректировка баланса администратором';
          break;
        case 'duel_result':
          description = 'Результат дуэли';
          break;
        case 'jackpot_win':
          description = 'Выигрыш в еженедельном джекпоте';
          break;
        case 'jackpot_split':
          description = 'Начисление за распределение джекпота';
          break;
        case 'case_open':
          description = 'Открытие кейса';
          break;
        case 'item_purchase':
          description = 'Покупка товара в магазине';
          break;
        case 'battlepass_reward':
          description = 'Награда Battle Pass';
          break;
      }

      return {
        _id: log._id,
        currency: log.currency,
        amount: log.amount,
        reason: log.reason,
        created_at: log.created_at,
        description
      };
    });

    res.status(200).json({
      logs: formattedLogs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[getBalanceHistory] Ошибка:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении истории баланса' });
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
  deleteProfileComment,
  transferKarma,
  getWeeklyQuests,
  getBalanceHistory
};

