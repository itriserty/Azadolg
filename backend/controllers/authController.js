const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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
        coins: newUser.coins
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
        coins: user.coins,
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

module.exports = {
  register,
  login,
  getMe
};
