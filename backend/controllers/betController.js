const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bet = require('../models/Bet');
const SystemState = require('../models/SystemState');
const tg = require('../services/telegramService');

// Найти или создать глобальное состояние системы
async function getOrCreateSystemState(session = null) {
  let state = await SystemState.findOne().session(session);
  if (!state) {
    state = new SystemState();
    await state.save({ session });
  }
  return state;
}

// Сделать ставку на долг (тотализатор)
async function placeBet(req, res) {
  try {
    const { debtId, prediction } = req.body;
    const userId = req.user;
    
    const parsedWager = Math.round(Number(req.body.wager));
    if (isNaN(parsedWager) || parsedWager <= 0) {
      return res.status(400).json({ error: 'Ставка должна быть целым положительным числом' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (user.karma < parsedWager) {
      return res.status(400).json({ error: `Недостаточно Кармы для ставки. Требуется: ${parsedWager} ✧, у вас: ${user.karma} ✧.` });
    }

    const wager = parsedWager;

    const debt = await Transaction.findById(debtId);
    if (!debt) return res.status(404).json({ error: 'Долг не найден' });
    if (debt.status !== 'active') {
      return res.status(400).json({ error: 'Этот долг уже закрыт. Ставки больше не принимаются.' });
    }

    // Нельзя ставить на свой собственный долг (чтобы исключить умышленный слив рейтинга/кармы)
    if (debt.debtor.toString() === userId.toString() || debt.creditor.toString() === userId.toString()) {
      return res.status(400).json({ error: 'Вы не можете ставить на свои собственные долги' });
    }

    // Списываем ставку
    user.karma -= wager;
    await user.save();

    const newBet = new Bet({
      debtId,
      better: userId,
      prediction,
      wager
    });
    await newBet.save();

    res.status(201).json({
      message: `Ставка "${prediction ? 'Вернет вовремя' : 'Просрочит'}" на сумму ${wager} ₸ Кармы принята!`,
      bet: newBet,
      userKarma: user.karma
    });
  } catch (error) {
    console.error('Ошибка размещения ставки:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Разрешить ставки для закрытого долга (вызывается из payDebt)
async function resolveBetsForDebt(debtId, isOverdue, session = null) {
  try {
    const bets = await Bet.find({ debtId, status: 'pending' }).populate('better').session(session);
    if (bets.length === 0) return;

    console.log(`[Totalizator] Расчет ставок для долга ${debtId}. Просрочен: ${isOverdue}`);

    // Победный исход: если долг просрочен -> победили те, кто поставил false (не вернет вовремя)
    // Если долг закрыт вовремя -> победили те, кто поставил true (вернет вовремя)
    const winningPrediction = !isOverdue; // true = вовремя, false = просрочен

    const winningBets = bets.filter(b => b.prediction === winningPrediction);
    const losingBets = bets.filter(b => b.prediction !== winningPrediction);

    const totalLosingWagers = losingBets.reduce((sum, b) => sum + b.wager, 0);
    const totalWinningWagers = winningBets.reduce((sum, b) => sum + b.wager, 0);
    const totalPool = totalWinningWagers + totalLosingWagers;

    const systemState = await getOrCreateSystemState(session);

    if (winningBets.length > 0) {
      for (const bet of winningBets) {
        let winPayout = 0;

        if (losingBets.length > 0) {
          // ── ТОТАЛИЗАТОР ──
          // Делим проигранные ставки пропорционально размеру ставок победителей
          const share = bet.wager / totalWinningWagers;
          const winnings = totalLosingWagers * share;
          winPayout = bet.wager + winnings;
        } else {
          // ── ОДНОСТОРОННИЕ СТАВКИ ──
          // Если все поставили на один исход, выплачиваем скромный коэффициент 1.2x
          winPayout = bet.wager * 1.2;
        }

        // Вычитаем 1% комиссии в Джекпот
        const commission = Math.round(winPayout * 0.01);
        const netWin = Math.max(1, Math.round(winPayout - commission));

        systemState.jackpotPool += commission;

        // Начисляем выигрыш
        await User.findByIdAndUpdate(bet.better._id, {
          $inc: { karma: netWin, 'stats.totalKarmaEarned': netWin - bet.wager }
        }, { session });

        bet.status = 'won';
        await bet.save({ session });

        // Личное уведомление победителю
        if (bet.better.telegramId) {
          tg.sendMessage(
            `💰 <b>Поздравляем с победой в тотализаторе!</b>\n\n` +
            `🎯 Долг закрыт ${isOverdue ? 'с просрочкой' : 'вовремя'}.\n` +
            `💸 Ваша выплата: <b>+${netWin} ₸ Кармы</b> (комиссия 1% в Джекпот: ${commission} ₸).`,
            bet.better.telegramId
          );
        }
      }
    }

    // Помечаем проигравшие ставки
    for (const bet of losingBets) {
      bet.status = 'lost';
      await bet.save({ session });

      if (bet.better.telegramId) {
        tg.sendMessage(
          `😢 <b>Ваша ставка в тотализаторе проиграла.</b>\n\n` +
          `🎯 Долг закрыт ${isOverdue ? 'с просрочкой' : 'вовремя'}.\n` +
          `💸 Потери: <b>-${bet.wager} ₸ Кармы</b>. Повезет в следующий раз!`,
          bet.better.telegramId
        );
      }
    }

    await systemState.save({ session });
    console.log(`[Totalizator] Ставки на долг ${debtId} успешно рассчитаны.`);
  } catch (error) {
    console.error('[Totalizator] Ошибка расчета ставок:', error);
  }
}

// Получить мои активные ставки
async function getMyBets(req, res) {
  try {
    const userId = req.user;
    const bets = await Bet.find({ better: userId })
      .populate({
        path: 'debtId',
        populate: { path: 'debtor creditor', select: 'name username' }
      })
      .sort({ createdAt: -1 });

    res.status(200).json(bets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  placeBet,
  resolveBetsForDebt,
  getMyBets
};
