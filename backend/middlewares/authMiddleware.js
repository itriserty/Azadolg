const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

module.exports = function (req, res, next) {
  // Получаем токен из заголовка Authorization
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Доступ запрещен. Токен не предоставлен.' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Неверный формат токена (должен быть Bearer token)' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.id; // Прикрепляем ID пользователя к объекту запроса

    // Обновляем время активности в фоне (с ограничением частоты в 2 минуты)
    const User = require('../models/User');
    User.findById(req.user).select('lastLoginAt').then(user => {
      if (user) {
        const now = new Date();
        if (!user.lastLoginAt || (now - user.lastLoginAt) > 2 * 60 * 1000) {
          user.lastLoginAt = now;
          user.save().catch(err => console.error('[authMiddleware] Ошибка сохранения времени активности:', err));
        }
      }
    }).catch(err => console.error('[authMiddleware] Ошибка обновления активности пользователя:', err));

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный или истекший токен.' });
  }
};
