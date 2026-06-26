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
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Недействительный или истекший токен.' });
  }
};
