const User = require('../models/User');

// Получение списка всех пользователей (для выпадающих списков)
async function getUsers(req, res) {
  try {
    const users = await User.find({}).sort({ eloRating: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
}

// --- НОВЫЙ РОУТ: Таблица лидеров по ELO-рейтингу ---
// GET /api/leaderboard
async function getLeaderboard(req, res) {
  try {
    const users = await User.find({})
      .select('name email eloRating coins')
      .sort({ eloRating: -1 }); // Сортируем по убыванию ELO

    res.status(200).json(users);
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

    res.status(200).json({ message: 'Telegram ID успешно обновлен!', user });
  } catch (error) {
    console.error('Ошибка обновления telegramId:', error);
    res.status(500).json({ error: 'Ошибка обновления Telegram ID' });
  }
}

module.exports = {
  getUsers,
  getLeaderboard,
  createUser,
  addFriend,
  updateTelegramId
};
