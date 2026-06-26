const User = require('../models/User');

/**
 * Получение профиля пользователя с проверкой дружбы
 * GET /user/profile/:id
 */
async function getUserProfile(req, res) {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.headers['x-user-id']; // Симулируем текущего юзера

    if (!currentUserId) {
      return res.status(401).json({ error: 'Требуется авторизация (заголовок x-user-id)' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // 1. Если пользователь смотрит свой собственный профиль
    if (targetUserId === currentUserId) {
      return res.status(200).json({
        profileType: 'own',
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          karma: targetUser.karma,
          balance: targetUser.balance,
          friends: targetUser.friends
        }
      });
    }

    // 2. Ищем текущего пользователя, чтобы проверить его список друзей
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'Текущий пользователь не найден в БД' });
    }

    // Проверяем, является ли целевой пользователь другом текущего
    const isFriend = currentUser.friends.some(friendId => friendId.toString() === targetUserId);

    if (isFriend) {
      // Полный доступ к профилю (друзья)
      res.status(200).json({
        profileType: 'friend',
        user: {
          id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          karma: targetUser.karma,
          balance: targetUser.balance,
          friends: targetUser.friends
        }
      });
    } else {
      // Ограниченный доступ к профилю (не друзья)
      res.status(200).json({
        profileType: 'public',
        user: {
          id: targetUser._id,
          name: targetUser.name,
          karma: targetUser.karma
          // Скрываем email, balance и список друзей
        }
      });
    }
  } catch (error) {
    console.error('Ошибка в getUserProfile:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}

/**
 * Создание нового пользователя (регистрация/тест)
 * POST /user/register
 */
async function registerUser(req, res) {
  try {
    const { name, email, balance } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Имя (name) и почта (email) обязательны' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с такой почтой уже существует' });
    }

    const newUser = new User({
      name,
      email,
      balance: balance !== undefined ? balance : 10000
    });

    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
  }
}

/**
 * Добавление в друзья (двусторонняя связь для простоты демонстрации)
 * POST /user/add-friend
 */
async function addFriend(req, res) {
  try {
    const { friendId } = req.body;
    const currentUserId = req.headers['x-user-id'];

    if (!currentUserId || !friendId) {
      return res.status(400).json({ error: 'Не указан currentUserId (заголовок x-user-id) или friendId' });
    }

    if (currentUserId === friendId) {
      return res.status(400).json({ error: 'Нельзя добавить самого себя в друзья' });
    }

    const currentUser = await User.findById(currentUserId);
    const friendUser = await User.findById(friendId);

    if (!currentUser || !friendUser) {
      return res.status(404).json({ error: 'Пользователь или друг не найден' });
    }

    // Проверяем, нет ли уже в друзьях
    const alreadyFriends = currentUser.friends.includes(friendId);
    if (alreadyFriends) {
      return res.status(400).json({ error: 'Вы уже друзья' });
    }

    // Двустороннее добавление
    currentUser.friends.push(friendId);
    friendUser.friends.push(currentUserId);

    await currentUser.save();
    await friendUser.save();

    res.status(200).json({
      message: 'Друг успешно добавлен!',
      currentUserFriends: currentUser.friends,
      friendUserFriends: friendUser.friends
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка при добавлении в друзья' });
  }
}

module.exports = {
  getUserProfile,
  registerUser,
  addFriend
};
