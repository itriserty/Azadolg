const User = require('../models/User');
const Quest = require('../models/Quest');
const tg = require('../services/telegramService');

// Создать поручение / квест
async function createQuest(req, res) {
  try {
    const { title, description, karmaReward } = req.body;
    const creatorId = req.user;

    if (!title || !description || !karmaReward || karmaReward <= 0) {
      return res.status(400).json({ error: 'Необходимо указать название, описание и награду больше 0' });
    }

    const creator = await User.findById(creatorId);
    if (!creator) return res.status(404).json({ error: 'Создатель не найден' });

    if (creator.karma < karmaReward) {
      return res.status(400).json({ error: `Недостаточно Кармы для выставления награды. Требуется: ${karmaReward} ₸, у вас: ${creator.karma} ₸.` });
    }

    // Списываем награду в "депо" (эскроу)
    creator.karma -= karmaReward;
    await creator.save();

    const quest = new Quest({
      creator: creatorId,
      title,
      description,
      karmaReward,
      status: 'available'
    });

    await quest.save();

    // 📣 Telegram-уведомление о новом квесте
    tg.sendMessage(
      `🎯 <b>Новое поручение на доске квестов!</b>\n\n` +
      `👤 Заказчик: <b>${creator.name}</b>\n` +
      `📝 Суть: <b>"${title}"</b>\n` +
      `📜 Описание: <i>${description}</i>\n` +
      `💰 Награда: <b>+${karmaReward} ₸ Кармы</b>\n` +
      `⚔️ Возьмите квест в приложении Azadolg!`
    );

    res.status(201).json({ message: 'Квест успешно создан!', quest, creatorKarma: creator.karma });
  } catch (error) {
    console.error('Ошибка создания квеста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Взять квест в работу
async function takeQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId = req.user;

    const quest = await Quest.findById(questId).populate('creator');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });

    if (quest.status !== 'available') {
      return res.status(400).json({ error: 'Этот квест уже взят в работу или выполнен' });
    }

    if (quest.creator._id.toString() === userId.toString()) {
      return res.status(400).json({ error: 'Вы не можете выполнять собственные поручения' });
    }

    quest.assignee = userId;
    quest.status = 'in_progress';
    await quest.save();

    const assignee = await User.findById(userId);

    // 📣 Telegram-уведомление
    tg.sendMessage(
      `⚔️ <b>Квест взят!</b>\n\n` +
      `👤 Исполнитель <b>${assignee.name}</b> взялся за поручение <b>"${quest.title}"</b> от <b>${quest.creator.name}</b>.`
    );

    res.status(200).json({ message: 'Квест взят в работу!', quest });
  } catch (error) {
    console.error('Ошибка взятия квеста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Отметить как выполненный (отправить на проверку)
async function completeQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId = req.user;

    const quest = await Quest.findById(questId).populate('creator assignee');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });

    if (quest.status !== 'in_progress') {
      return res.status(400).json({ error: 'Квест не находится в работе' });
    }

    if (quest.assignee._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не являетесь исполнителем этого квеста' });
    }

    quest.status = 'completed';
    await quest.save();

    // 📣 Telegram-уведомление заказчику
    const text = `🔔 <b>Квест выполнен и ожидает проверки!</b>\n\n` +
      `👤 Исполнитель <b>${quest.assignee.name}</b> завершил поручение <b>"${quest.title}"</b>.\n` +
      `🎯 Подтвердите выполнение в приложении!`;
    
    if (quest.creator.telegramId) {
      tg.sendMessage(text, quest.creator.telegramId);
    } else {
      tg.sendMessage(text);
    }

    res.status(200).json({ message: 'Квест отправлен на проверку!', quest });
  } catch (error) {
    console.error('Ошибка завершения квеста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Проверить и подтвердить квест (заказчиком)
async function verifyQuest(req, res) {
  try {
    const { questId, action } = req.body; // action: 'approve' | 'reject'
    const userId = req.user;

    const quest = await Quest.findById(questId).populate('creator assignee');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });

    if (quest.status !== 'completed') {
      return res.status(400).json({ error: 'Квест не ожидает проверки' });
    }

    if (quest.creator._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не являетесь создателем этого квеста' });
    }

    if (action === 'approve') {
      quest.status = 'verified';
      await quest.save();

      // Начисляем награду исполнителю
      const assignee = await User.findById(quest.assignee._id);
      assignee.karma += quest.karmaReward;
      assignee.stats.totalKarmaEarned += quest.karmaReward;
      
      // Добавляем BattlePass XP за закрытие квеста (+20 XP)
      const { addXP } = require('../utils/battlePassHelper');
      await addXP(assignee, 20);

      // 📣 Telegram-уведомление
      const text = `🎉 <b>Поручение подтверждено!</b>\n\n` +
        `👤 Заказчик <b>${quest.creator.name}</b> подтвердил выполнение квеста <b>"${quest.title}"</b>.\n` +
        `💰 Исполнитель <b>${assignee.name}</b> получает <b>+${quest.karmaReward} ₸ Кармы</b> и <b>+20 XP</b> Боевого Пропуска!`;
      
      if (assignee.telegramId) {
        tg.sendMessage(text, assignee.telegramId);
      } else {
        tg.sendMessage(text);
      }

      res.status(200).json({ message: 'Поручение успешно подтверждено и оплачено!', quest });
    } else if (action === 'reject') {
      // Возвращаем в работу
      quest.status = 'in_progress';
      await quest.save();

      const text = `⚠️ <b>Поручение отклонено заказчиком!</b>\n\n` +
        `👤 Заказчик <b>${quest.creator.name}</b> отклонил выполнение квеста <b>"${quest.title}"</b>.\n` +
        `🔧 Исполнитель <b>${quest.assignee.name}</b>, внесите исправления и попробуйте снова.`;

      if (quest.assignee.telegramId) {
        tg.sendMessage(text, quest.assignee.telegramId);
      } else {
        tg.sendMessage(text);
      }

      res.status(200).json({ message: 'Поручение возвращено исполнителю на доработку.', quest });
    } else {
      res.status(400).json({ error: 'Неверное действие' });
    }
  } catch (error) {
    console.error('Ошибка проверки квеста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Отмена квеста создателем (если он ещё не выполнен)
async function cancelQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId = req.user;

    const quest = await Quest.findById(questId);
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });

    if (quest.creator.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не являетесь создателем этого квеста' });
    }

    if (quest.status === 'verified') {
      return res.status(400).json({ error: 'Нельзя отменить уже завершенный и оплаченный квест' });
    }

    // Возвращаем Карму создателю
    const creator = await User.findById(userId);
    creator.karma += quest.karmaReward;
    await creator.save();

    // Удаляем или помечаем отмененным
    await Quest.findByIdAndDelete(questId);

    res.status(200).json({ message: 'Квест успешно отменен, Карма возвращена.', creatorKarma: creator.karma });
  } catch (error) {
    console.error('Ошибка отмены квеста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить список всех квестов
async function getQuests(req, res) {
  try {
    const quests = await Quest.find()
      .populate('creator assignee', 'name username eloRating avatar')
      .sort({ createdAt: -1 });

    res.status(200).json(quests);
  } catch (error) {
    console.error('Ошибка получения квестов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  createQuest,
  takeQuest,
  completeQuest,
  verifyQuest,
  cancelQuest,
  getQuests
};
