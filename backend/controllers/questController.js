const User  = require('../models/User');
const Quest = require('../models/Quest');
const tg    = require('../services/telegramService');

// ── Создать квест (bounty уходит в эскроу) ───────────────────────────────────
async function createQuest(req, res) {
  try {
    const { title, description, bounty, maxParticipants, dueDate } = req.body;
    const creatorId = req.user;

    if (!title || !description || !bounty || bounty <= 0)
      return res.status(400).json({ error: 'Укажите название, описание и награду (bounty > 0)' });

    const creator = await User.findById(creatorId);
    if (!creator) return res.status(404).json({ error: 'Создатель не найден' });
    if (creator.isBanned) return res.status(403).json({ error: 'Ваш аккаунт заблокирован' });

    if (creator.karma < bounty)
      return res.status(400).json({
        error: `Недостаточно Кармы. Нужно: ${bounty} ₸, у вас: ${creator.karma} ₸`
      });

    const max = Math.max(1, Math.min(20, Number(maxParticipants) || 1));

    const quest = new Quest({
      creator: creatorId,
      title,
      description,
      bounty,
      karmaReward:     bounty, // обратная совместимость
      maxParticipants: max,
      dueDate:         dueDate ? new Date(dueDate) : null,
      status:          'available'
    });

    // Эскроу: списываем bounty сразу
    creator.karma -= bounty;
    creator._karmaReason = 'quest_completed';
    creator._karmaRelatedEntityId = quest._id;
    await creator.save();
    await quest.save();


    tg.sendMessage(
      `🎯 <b>Новое задание на доске квестов!</b>\n\n` +
      `👤 Заказчик: <b>${creator.name}</b>\n` +
      `📝 <b>"${title}"</b>\n` +
      `📜 ${description}\n` +
      `💰 Bounty: <b>${bounty} ₸ Кармы</b> (÷${max} участников)\n` +
      (dueDate ? `📅 Срок: ${new Date(dueDate).toLocaleDateString('ru-RU')}\n` : '') +
      `⚔️ Откликнитесь в приложении Azadolg!`
    );

    res.status(201).json({ message: 'Квест создан!', quest, creatorKarma: creator.karma });
  } catch (error) {
    console.error('[createQuest]', error);
    res.status(500).json({ error: 'Ошибка создания квеста' });
  }
}

// ── Откликнуться на квест ─────────────────────────────────────────────────────
async function joinQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId      = req.user;

    const quest = await Quest.findById(questId).populate('creator');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'available')
      return res.status(400).json({ error: 'Этот квест недоступен для новых участников' });
    if (quest.creator._id.toString() === userId.toString())
      return res.status(400).json({ error: 'Нельзя выполнять собственные задания' });
    if (quest.participants.map(p => p.toString()).includes(userId.toString()))
      return res.status(400).json({ error: 'Вы уже участвуете в этом квесте' });
    if (quest.participants.length >= quest.maxParticipants)
      return res.status(400).json({ error: 'Достигнут лимит участников' });

    quest.participants.push(userId);
    // Для обратной совместимости: первый участник → assignee
    if (!quest.assignee) quest.assignee = userId;
    if (quest.participants.length >= quest.maxParticipants) {
      quest.status = 'in_progress';
    }
    await quest.save();

    const user = await User.findById(userId);
    tg.sendMessage(
      `⚔️ <b>Участник откликнулся на квест!</b>\n` +
      `👤 <b>${user?.name}</b> взял задание <b>"${quest.title}"</b>\n` +
      `👥 Участников: ${quest.participants.length}/${quest.maxParticipants}`,
      quest.creator.telegramId || null
    );

    res.status(200).json({ message: 'Вы записались на квест!', quest });
  } catch (error) {
    console.error('[joinQuest]', error);
    res.status(500).json({ error: 'Ошибка записи на квест' });
  }
}

// ── Взять квест (legacy: один участник) ──────────────────────────────────────
async function takeQuest(req, res) {
  req.body.questId = req.body.questId;
  return joinQuest(req, res);
}

// ── Отметить выполненным ──────────────────────────────────────────────────────
async function completeQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId      = req.user;

    const quest = await Quest.findById(questId).populate('creator');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (!['in_progress', 'available'].includes(quest.status))
      return res.status(400).json({ error: 'Квест не находится в работе' });

    const isParticipant = quest.participants.map(p => p.toString()).includes(userId.toString());
    if (!isParticipant)
      return res.status(403).json({ error: 'Вы не являетесь участником этого квеста' });

    quest.status = 'completed';
    await quest.save();

    const text = `🔔 <b>Квест выполнен — ожидает проверки!</b>\n\n` +
      `📝 <b>"${quest.title}"</b>\n` +
      `Участники отправили задание на проверку. Подтвердите в приложении!`;

    if (quest.creator.telegramId) tg.sendMessage(text, quest.creator.telegramId);
    else tg.sendMessage(text);

    res.status(200).json({ message: 'Квест отправлен на проверку!', quest });
  } catch (error) {
    console.error('[completeQuest]', error);
    res.status(500).json({ error: 'Ошибка завершения квеста' });
  }
}

// ── Проверить и подтвердить / отклонить (заказчиком) ─────────────────────────
async function verifyQuest(req, res) {
  try {
    const { questId, action } = req.body;
    const userId              = req.user;

    const quest = await Quest.findById(questId).populate('creator participants');
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.status !== 'completed')
      return res.status(400).json({ error: 'Квест не ожидает проверки' });
    if (quest.creator._id.toString() !== userId.toString())
      return res.status(403).json({ error: 'Только создатель квеста может его подтвердить' });

    if (action === 'approve') {
      quest.status = 'verified';
      await quest.save();

      // Делим bounty поровну между участниками
      const participantIds = quest.participants.map(p => p._id || p);
      const perPerson      = participantIds.length > 0
        ? Math.floor(quest.bounty / participantIds.length)
        : quest.bounty;

      const { addXP } = require('../utils/battlePassHelper');

      await Promise.all(participantIds.map(async (pid) => {
        const participant = await User.findById(pid);
        if (!participant) return;
        participant.karma                    += perPerson;
        participant.stats.totalKarmaEarned   += perPerson;
        participant._karmaReason             = 'quest_completed';
        participant._karmaRelatedEntityId    = quest._id;
        await addXP(participant, 20);


        if (participant.telegramId) {
          tg.sendMessage(
            `🎉 <b>Квест подтверждён!</b>\n` +
            `📝 "${quest.title}"\n` +
            `💰 Ваша доля: <b>+${perPerson} ₸ Кармы</b> + <b>+20 XP</b>`,
            participant.telegramId
          );
        }
      }));

      res.status(200).json({
        message:   `Квест подтверждён! Bounty ${quest.bounty} ₸ распределено по ${participantIds.length} участникам (по ${perPerson} ₸ каждому)`,
        quest
      });
    } else if (action === 'reject') {
      quest.status = 'in_progress';
      await quest.save();

      // Уведомляем всех участников
      for (const pid of quest.participants) {
        const p = await User.findById(pid._id || pid);
        if (p?.telegramId) {
          tg.sendMessage(
            `⚠️ <b>Квест отклонён заказчиком!</b>\n` +
            `📝 "${quest.title}"\nВнесите исправления и попробуйте снова.`,
            p.telegramId
          );
        }
      }

      res.status(200).json({ message: 'Квест возвращён на доработку', quest });
    } else {
      res.status(400).json({ error: 'Неверное действие. Ожидается: approve | reject' });
    }
  } catch (error) {
    console.error('[verifyQuest]', error);
    res.status(500).json({ error: 'Ошибка подтверждения квеста' });
  }
}

// ── Отмена квеста (с возвратом bounty) ───────────────────────────────────────
async function cancelQuest(req, res) {
  try {
    const { questId } = req.body;
    const userId      = req.user;

    const quest = await Quest.findById(questId);
    if (!quest) return res.status(404).json({ error: 'Квест не найден' });
    if (quest.creator.toString() !== userId.toString())
      return res.status(403).json({ error: 'Только создатель может отменить квест' });
    if (quest.status === 'verified')
      return res.status(400).json({ error: 'Нельзя отменить завершённый квест' });

    // Возврат bounty создателю
    const creator = await User.findById(userId);
    if (creator) {
      creator.karma += quest.bounty;
      creator._karmaReason = 'quest_completed';
      creator._karmaRelatedEntityId = quest._id;
      await creator.save();
    }


    quest.status = 'cancelled';
    await quest.save();

    res.status(200).json({
      message:      'Квест отменён, Карма возвращена',
      creatorKarma: creator?.karma
    });
  } catch (error) {
    console.error('[cancelQuest]', error);
    res.status(500).json({ error: 'Ошибка отмены квеста' });
  }
}

// ── Список квестов ────────────────────────────────────────────────────────────
async function getQuests(req, res) {
  try {
    const quests = await Quest.find({ status: { $ne: 'cancelled' } })
      .populate('creator participants', 'name username eloRating avatar')
      .sort({ createdAt: -1 });
    res.status(200).json(quests);
  } catch (error) {
    console.error('[getQuests]', error);
    res.status(500).json({ error: 'Ошибка получения квестов' });
  }
}

module.exports = { createQuest, joinQuest, takeQuest, completeQuest, verifyQuest, cancelQuest, getQuests };
