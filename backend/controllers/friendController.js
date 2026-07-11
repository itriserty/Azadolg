const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const tg = require('../services/telegramService');

// Отправить запрос в друзья (или автоматически принять, если взаимно)
async function addFriend(req, res) {
  try {
    const { username } = req.body;
    const senderId = req.user;

    if (!username) {
      return res.status(400).json({ error: 'Необходимо указать username пользователя' });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const receiver = await User.findOne({ username: normalizedUsername });

    if (!receiver) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (senderId.toString() === receiver._id.toString()) {
      return res.status(400).json({ error: 'Нельзя добавить самого себя в друзья' });
    }

    const senderUser = await User.findById(senderId);
    if (!senderUser) {
      return res.status(404).json({ error: 'Ваш профиль не найден' });
    }

    // Проверяем, не друзья ли уже
    if (senderUser.friends.includes(receiver._id)) {
      return res.status(400).json({ error: 'Вы уже друзья' });
    }

    // Проверяем, нет ли уже отправленного запроса от нас к нему
    const outgoingRequest = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiver._id,
      status: 'pending'
    });

    if (outgoingRequest) {
      return res.status(400).json({ error: 'Запрос в друзья уже был отправлен' });
    }

    // Проверяем, нет ли входящего запроса от него к нам
    const incomingRequest = await FriendRequest.findOne({
      sender: receiver._id,
      receiver: senderId,
      status: 'pending'
    });

    if (incomingRequest) {
      // Если есть входящий запрос, автоматически одобряем его (взаимное добавление)
      incomingRequest.status = 'accepted';
      await incomingRequest.save();

      // Добавляем друг друга в друзья
      await User.findByIdAndUpdate(senderId, { $addToSet: { friends: receiver._id } });
      await User.findByIdAndUpdate(receiver._id, { $addToSet: { friends: senderId } });

      return res.status(200).json({
        message: `Взаимный запрос принят! Вы подружились с ${receiver.name} (@${receiver.username})`,
        status: 'accepted'
      });
    }

    // Иначе создаем новый запрос в друзья
    const newRequest = new FriendRequest({
      sender: senderId,
      receiver: receiver._id,
      status: 'pending'
    });
    await newRequest.save();

    // 📣 Telegram-уведомление
    const challengeText = `👥 <b>Запрос в друзья!</b>\n\n` +
      `Пользователь <b>${senderUser.name}</b> (@${senderUser.username}) отправил запрос в друзья <b>${receiver.name}</b> (@${receiver.username}).`;
    tg.sendMessage(challengeText);
    if (receiver.telegramId) {
      tg.sendMessage(`👥 <b>Новый запрос в друзья!</b>\n\nПользователь <b>${senderUser.name}</b> (@${senderUser.username}) хочет добавить вас в друзья. Одобрите запрос в приложении.`, receiver.telegramId);
    }

    res.status(201).json({
      message: `Запрос в друзья отправлен пользователю ${receiver.name} (@${receiver.username})`,
      status: 'pending'
    });
  } catch (error) {
    console.error('Ошибка добавления в друзья:', error);
    res.status(500).json({ error: 'Ошибка сервера при добавлении в друзья' });
  }
}

// Принять входящий запрос в друзья
async function acceptFriendRequest(req, res) {
  try {
    const { requestId } = req.body;
    const userId = req.user;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не можете одобрить чужой запрос' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Этот запрос уже обработан' });
    }

    request.status = 'accepted';
    await request.save();

    // Добавляем друзей взаимно
    const [sender, receiver] = await Promise.all([
      User.findByIdAndUpdate(request.sender,   { $addToSet: { friends: request.receiver } }, { new: true }),
      User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } }, { new: true })
    ]);

    // 📣 Telegram-уведомление
    const text = `👥 <b>Дружба подтверждена!</b>\n\n` +
      `<b>${receiver.name}</b> (@${receiver.username}) и <b>${sender.name}</b> (@${sender.username}) теперь официально друзья!`;
    tg.sendMessage(text);
    if (sender.telegramId) tg.sendMessage(text, sender.telegramId);
    if (receiver.telegramId) tg.sendMessage(text, receiver.telegramId);

    res.status(200).json({ message: 'Запрос в друзья успешно принят!' });
  } catch (error) {
    console.error('Ошибка принятия запроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Отклонить запрос в друзья
async function rejectFriendRequest(req, res) {
  try {
    const { requestId } = req.body;
    const userId = req.user;

    const request = await FriendRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Запрос не найден' });
    }

    if (request.receiver.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не можете отклонить чужой запрос' });
    }

    request.status = 'rejected';
    await request.save();

    res.status(200).json({ message: 'Запрос в друзья отклонен' });
  } catch (error) {
    console.error('Ошибка отклонения запроса:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить список друзей
async function getFriends(req, res) {
  try {
    const user = await User.findById(req.user).populate({
      path: 'friends',
      select: 'name username email eloRating karma telegramId'
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.status(200).json(user.friends);
  } catch (error) {
    console.error('Ошибка получения списка друзей:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении друзей' });
  }
}

// Получить входящие активные запросы в друзья
async function getPendingRequests(req, res) {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user,
      status: 'pending'
    }).populate('sender', 'name username eloRating');

    res.status(200).json(requests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  addFriend,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getPendingRequests
};
