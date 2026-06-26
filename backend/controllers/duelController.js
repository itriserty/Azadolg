const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Duel = require('../models/Duel');
const SystemState = require('../models/SystemState');
const tg = require('../services/telegramService');

// Найти или создать глобальное состояние системы
async function getOrCreateSystemState() {
  let state = await SystemState.findOne();
  if (!state) {
    state = new SystemState();
    await state.save();
  }
  return state;
}

// Создать вызов на дуэль
async function createDuelChallenge(req, res) {
  try {
    const { opponentId, debtId, wager } = req.body;
    const challengerId = req.user;

    if (challengerId.toString() === opponentId.toString()) {
      return res.status(400).json({ error: 'Нельзя бросить вызов самому себе' });
    }

    const [challenger, opponent] = await Promise.all([
      User.findById(challengerId),
      User.findById(opponentId)
    ]);

    if (!challenger || !opponent) {
      return res.status(404).json({ error: 'Игрок не найден' });
    }

    // Проверяем дружбу
    if (!challenger.friends.includes(opponentId) || !opponent.friends.includes(challengerId)) {
      return res.status(400).json({ error: 'Бросить вызов можно только другу' });
    }

    // Если дуэль на Карму
    if (wager && wager > 0) {
      if (challenger.karma < wager) {
        return res.status(400).json({ error: `Недостаточно Кармы для ставки. Требуется: ${wager} ₸, у вас: ${challenger.karma} ₸.` });
      }
    }

    // Если дуэль на долг
    if (debtId) {
      const debt = await Transaction.findById(debtId);
      if (!debt) return res.status(404).json({ error: 'Долг не найден' });
      if (debt.status !== 'active') return res.status(400).json({ error: 'Долг уже закрыт' });

      // Проверяем, что дуэлянты — стороны этого долга
      const isChallengerDebtor = debt.debtor.toString() === challengerId.toString();
      const isOpponentCreditor = debt.creditor.toString() === opponentId.toString();
      const isChallengerCreditor = debt.creditor.toString() === challengerId.toString();
      const isOpponentDebtor = debt.debtor.toString() === opponentId.toString();

      if (!((isChallengerDebtor && isOpponentCreditor) || (isChallengerCreditor && isOpponentDebtor))) {
        return res.status(400).json({ error: 'Вы можете разыграть долг только с его второй стороной' });
      }
    }

    const newDuel = new Duel({
      challenger: challengerId,
      opponent: opponentId,
      debtId: debtId || null,
      wager: wager || 0,
      status: 'pending'
    });
    await newDuel.save();

    // 📣 Telegram: уведомление о вызове
    const challengeText = `⚔️ <b>${challenger.name}</b> бросил вызов <b>${opponent.name}</b> на дуэль!\n` +
      (wager ? `🪙 Ставка: <b>${wager} ₸ Кармы</b>\n` : `💸 Ставка: <b>Списание долга (пан или пропал)</b>\n`) +
      `🎯 Примите вызов в приложении Azadolg!`;
    
    if (opponent.telegramId) {
      tg.sendMessage(challengeText, opponent.telegramId);
    } else {
      tg.sendMessage(challengeText);
    }

    res.status(201).json({ message: 'Вызов на дуэль успешно отправлен!', duel: newDuel });
  } catch (error) {
    console.error('Ошибка создания дуэли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Ответ на дуэль (принять / отклонить)
async function respondToDuel(req, res) {
  try {
    const { duelId, action } = req.body; // action: 'accept' | 'reject'
    const userId = req.user;

    const duel = await Duel.findById(duelId).populate('challenger opponent debtId');
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });

    if (duel.opponent._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: 'Вы не можете ответить на этот вызов' });
    }

    if (duel.status !== 'pending') {
      return res.status(400).json({ error: 'Дуэль уже завершена или отклонена' });
    }

    if (action === 'reject') {
      duel.status = 'rejected';
      await duel.save();
      return res.status(200).json({ message: 'Дуэль отклонена', duel });
    }

    if (action !== 'accept') {
      return res.status(400).json({ error: 'Неверное действие' });
    }

    // Проверяем балансы перед принятием (для ставок на карму)
    if (duel.wager > 0) {
      if (duel.challenger.karma < duel.wager) {
        duel.status = 'rejected';
        await duel.save();
        return res.status(400).json({ error: 'У бросившего вызов больше нет нужного количества Кармы. Дуэль отменена.' });
      }
      if (duel.opponent.karma < duel.wager) {
        return res.status(400).json({ error: `У вас недостаточно Кармы. Нужно: ${duel.wager} ₸, у вас: ${duel.opponent.karma} ₸.` });
      }
    }

    // ── Запуск Coinflip (50/50) ──
    const roll = Math.random();
    const winner = roll < 0.5 ? duel.challenger : duel.opponent;
    const loser = winner._id.toString() === duel.challenger._id.toString() ? duel.opponent : duel.challenger;

    let duelResult = '';

    if (duel.wager > 0) {
      // Снимаем ставку с обоих
      winner.karma -= duel.wager;
      loser.karma -= duel.wager;

      // Рассчитываем джекпот комиссию 1% от общего банка (2% от одной ставки)
      const totalPot = duel.wager * 2;
      const commission = Math.round(totalPot * 0.01);
      const netWin = totalPot - commission;

      // Зачисляем выигрыш победителю
      winner.karma += netWin;
      winner.stats.totalKarmaEarned += netWin;

      // Отправляем комиссию в Джекпот
      const systemState = await getOrCreateSystemState();
      systemState.jackpotPool += commission;
      await systemState.save();

      await Promise.all([winner.save(), loser.save()]);
      duelResult = `🪙 Победитель получил <b>+${netWin} ₸ Кармы</b> (с учетом комиссии 1% в Джекпот: ${commission} ₸)`;
    } else if (duel.debtId) {
      // Дуэль на долг: Двойной или Ничего!
      const debt = await Transaction.findById(duel.debtId._id);
      
      const isWinnerDebtor = debt.debtor.toString() === winner._id.toString();

      if (isWinnerDebtor) {
        // Должник победил -> Долг полностью прощается!
        debt.status = 'paid';
        debt.amount = 0;
        debt.resolvedAt = new Date();
        await debt.save();
        duelResult = `🎉 Должник выиграл! Долг <b>"${debt.description}"</b> полностью СПИСАН!`;
      } else {
        // Кредитор победил -> Долг удваивается!
        debt.amount = debt.amount * 2;
        await debt.save();
        duelResult = `⚡ Кредитор выиграл! Долг <b>"${debt.description}"</b> УДВОЕН! Новая сумма: <b>${debt.amount} ₸</b>.`;
      }
    }

    duel.status = 'finished';
    duel.winner = winner._id;
    await duel.save();

    // 📣 Telegram: уведомление о результатах дуэли
    const duelText = `🎰 <b>Результаты дуэли Azadolg Coinflip!</b>\n\n` +
      `⚔️ Участники: <b>${duel.challenger.name}</b> vs <b>${duel.opponent.name}</b>\n` +
      `👑 Победитель: 🎉 <b>${winner.name}</b> 🎉\n\n` +
      `📝 ${duelResult}`;

    tg.sendMessage(duelText);

    res.status(200).json({
      message: 'Дуэль состоялась!',
      roll,
      winner: winner._id,
      duelResult,
      duel
    });
  } catch (error) {
    console.error('Ошибка проведения дуэли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить активные дуэли пользователя
async function getMyDuels(req, res) {
  try {
    const userId = req.user;
    const duels = await Duel.find({
      $or: [{ challenger: userId }, { opponent: userId }],
      status: 'pending'
    }).populate('challenger opponent debtId', 'name username eloRating avatar description amount originalAmount');

    res.status(200).json(duels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  createDuelChallenge,
  respondToDuel,
  getMyDuels
};
