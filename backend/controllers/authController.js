const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const tg = require('../services/telegramService');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

// Регистрация
async function register(req, res) {
  try {
    const { name, username, email, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ error: 'Заполните все поля: name, username, email, password' });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    // Проверяем существование пользователя
    const existingUser = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      if (existingUser.username === normalizedUsername) {
        return res.status(400).json({ error: 'Пользователь с таким username уже существует' });
      }
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const newUser = new User({
      name,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword
    });

    await newUser.save();

    // Синхронизация дружбы в локальной сети
    try {
      const { syncAllFriendships } = require('./friendController');
      await syncAllFriendships();
    } catch (err) {
      console.error('[authController.register] Ошибка синхронизации дружбы:', err);
    }

    // 📣 Telegram-уведомление
    const text = `🎉 <b>Новый пользователь зарегистрирован!</b>\n\n` +
      `👤 Игрок: <b>${newUser.name}</b>\n` +
      `🏷️ Юзернейм: @${newUser.username}`;
    tg.sendMessage(text);

    // Создаем токен
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        username: newUser.username,
        email: newUser.email,
        eloRating: newUser.eloRating,
        karma: newUser.karma
      }
    });
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка при регистрации пользователя' });
  }
}

// Вход
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Заполните поля username и password' });
    }

    const normalizedUsername = username.toLowerCase().trim();

    // Ищем пользователя
    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Проверяем пароль
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Создаем токен
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(200).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        eloRating: user.eloRating,
        karma: user.karma,
        telegramId: user.telegramId
      }
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка при авторизации' });
  }
}

// Получение профиля текущего авторизованного пользователя
async function getMe(req, res) {
  try {
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
}

// Забыли пароль (генерация и отправка кода в Telegram)
async function forgotPassword(req, res) {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'Укажите имя пользователя (username)' });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Генерируем 6-значный цифровой код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = code;
    user.resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 минут
    await user.save();

    console.log(`[PASSWORD RESET] Код для сброса пароля пользователя ${user.username}: ${code}`);

    let viaTg = false;
    const text = `🔑 <b>Сброс пароля в Azadolg!</b>\n\n` +
      `Код для сброса пароля: <code>${code}</code>\n` +
      `Срок действия: 15 минут.`;

    if (user.telegramId) {
      try {
        await tg.sendMessage(text, user.telegramId);
        viaTg = true;
      } catch (err) {
        console.error('Ошибка отправки кода в телеграм:', err.message);
      }
    }

    // Уведомление о попытке сброса пароля
    tg.sendMessage(`⚠️ <b>Запрошен сброс пароля!</b>\n\nПользователь <b>${user.name}</b> (@${user.username}) запросил код сброса пароля.`);

    if (viaTg) {
      res.status(200).json({ message: 'Код сброса пароля успешно отправлен на ваш Telegram!' });
    } else {
      res.status(200).json({ 
        message: 'Ваш профиль не привязан к Telegram или произошла ошибка отправки. Код сброса выведен в консоль бэкенда. Обратитесь к администратору.' 
      });
    }
  } catch (error) {
    console.error('Ошибка при генерации кода сброса пароля:', error);
    res.status(500).json({ error: 'Ошибка сервера при обработке запроса сброса пароля' });
  }
}

// Сброс пароля по коду
async function resetPassword(req, res) {
  try {
    const { username, code, newPassword } = req.body;
    if (!username || !code || !newPassword) {
      return res.status(400).json({ error: 'Заполните все поля: username, code, newPassword' });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const user = await User.findOne({ username: normalizedUsername });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.resetCode || user.resetCode !== code.trim()) {
      return res.status(400).json({ error: 'Неверный код сброса пароля' });
    }

    if (new Date() > user.resetCodeExpires) {
      return res.status(400).json({ error: 'Срок действия кода сброса истек' });
    }

    // Хешируем новый пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetCode = null;
    user.resetCodeExpires = null;
    await user.save();

    // 📣 Telegram: уведомление об изменении пароля
    const text = `🔒 <b>Безопасность: Пароль изменен!</b>\n\n` +
      `Пароль для аккаунта <b>${user.name}</b> (@${user.username}) был успешно сброшен и обновлен.`;
    
    tg.sendMessage(text);
    if (user.telegramId) tg.sendMessage(text, user.telegramId);

    res.status(200).json({ message: 'Пароль успешно изменен! Войдите под новым паролем.' });
  } catch (error) {
    console.error('Ошибка сброса пароля:', error);
    res.status(500).json({ error: 'Ошибка сервера при сбросе пароля' });
  }
}

module.exports = {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword
};
