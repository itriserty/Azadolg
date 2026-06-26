/**
 * adminMiddleware.js
 * Проверяет, что авторизованный пользователь имеет роль 'admin'.
 * Должен использоваться ПОСЛЕ authMiddleware.
 */
const User = require('../models/User');

async function adminMiddleware(req, res, next) {
  try {
    const userId = req.user; // устанавливается authMiddleware
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const user = await User.findById(userId).select('role isBanned');
    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ запрещён: требуются права администратора' });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    console.error('[adminMiddleware]', err);
    res.status(500).json({ error: 'Ошибка проверки прав доступа' });
  }
}

module.exports = adminMiddleware;
