const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Duel = require('../models/Duel');
const SystemState = require('../models/SystemState');
const tg = require('../services/telegramService');
const mongoose = require('mongoose');
const { calculateEloWinProbability } = require('../utils/eloHelper');

async function getOrCreateSystemState(session = null) {
  const query = SystemState.findOne();
  if (session) query.session(session);
  let state = await query;
  if (!state) {
    state = new SystemState();
    if (session) await state.save({ session });
    else await state.save();
  }
  return state;
}

// ── 21 Очко: генерация колоды и подсчет суммы ────────────────────────────────
function generateTwentyOneDeck() {
  const suits = ['red', 'blue'];
  const deck = [];
  for (const suit of suits) {
    for (let value = 3; value <= 11; value++) {
      deck.push({
        suit,
        value,
        id: `${suit}-${value}-${Math.random().toString(36).substring(2, 7)}`
      });
    }
  }
  // Перемешиваем Fisher-Yates с использованием крипторандома
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function calculateHandSum(hand) {
  if (!hand || !Array.isArray(hand)) return 0;
  return hand.reduce((sum, card) => sum + (card.value || 0), 0);
}

function resetTwentyOneRound(duel, reasonMessage) {
  const newDeck = generateTwentyOneDeck();
  duel.gameState.challengerHand = [newDeck.pop(), newDeck.pop()];
  duel.gameState.opponentHand = [newDeck.pop(), newDeck.pop()];
  duel.gameState.deck = newDeck;
  duel.gameState.challengerPassed = false;
  duel.gameState.opponentPassed = false;
  duel.gameState.currentTurn = duel.challenger._id;
  duel.gameState.replayMessage = reasonMessage;
  duel.gameState.lastAction = `${reasonMessage}. Раздача новых карт!`;
}

function executeBotMoves(duel) {
  let botHand = duel.gameState.opponentHand;
  let humanHand = duel.gameState.challengerHand;
  let humanPassed = duel.gameState.challengerPassed;

  while (!duel.gameState.opponentPassed && duel.gameState.deck.length > 0) {
    const botSum = calculateHandSum(botHand);
    const humanSum = calculateHandSum(humanHand);

    if (botSum > 21) {
      duel.gameState.opponentPassed = true;
      break;
    }

    if (humanPassed) {
      if (humanSum > 21) {
        duel.gameState.opponentPassed = true;
        break;
      }
      if (botSum > humanSum && botSum <= 21) {
        duel.gameState.opponentPassed = true;
        break;
      }
    }

    if (botSum < 17) {
      const card = duel.gameState.deck.pop();
      botHand.push(card);
      const newSum = calculateHandSum(botHand);
      if (newSum >= 21) {
        duel.gameState.opponentPassed = true;
      }
    } else {
      duel.gameState.opponentPassed = true;
    }
  }

  if (!duel.gameState.challengerPassed) {
    duel.gameState.currentTurn = duel.challenger._id;
  }
}

function checkAndResolveTwentyOneRound(duel) {
  const cPassed = duel.gameState.challengerPassed;
  const oPassed = duel.gameState.opponentPassed;
  const deckEmpty = duel.gameState.deck.length === 0;

  if ((cPassed && oPassed) || deckEmpty) {
    const sumC = calculateHandSum(duel.gameState.challengerHand);
    const sumO = calculateHandSum(duel.gameState.opponentHand);

    // 1. Переигровка если оба > 21
    if (sumC > 21 && sumO > 21) {
      resetTwentyOneRound(duel, `🔄 Переигровка! Оба игрока набрали больше 21 (${sumC} и ${sumO})`);
      return;
    }

    // 2. Переигровка при равных очках
    if (sumC <= 21 && sumO <= 21 && sumC === sumO) {
      resetTwentyOneRound(duel, `🔄 Переигровка! Ничья (${sumC} : ${sumO})`);
      return;
    }

    // 3. Определение победителя
    let winnerId = null;
    if (sumC > 21) {
      winnerId = duel.opponent._id || duel.opponent;
    } else if (sumO > 21) {
      winnerId = duel.challenger._id || duel.challenger;
    } else if (sumC > sumO) {
      winnerId = duel.challenger._id || duel.challenger;
    } else {
      winnerId = duel.opponent._id || duel.opponent;
    }

    duel.status = 'finished';
    duel.winner = winnerId;
    duel.gameState.currentTurn = null;

    const challengerName = duel.challenger.name || 'Игрок 1';
    const opponentName = duel.opponent.name || 'Игрок 2';
    const winnerName = winnerId.toString() === (duel.challenger._id || duel.challenger).toString() ? challengerName : opponentName;
    
    duel.gameState.lastAction = `🏆 Игра завершена! Победитель: ${winnerName} (${sumC} против ${sumO})`;

    try {
      tg.sendMessage(
        `🃏 <b>Результаты дуэли 21 Очко!</b>\n\n` +
        `⚔️ <b>${challengerName}</b> (${sumC} очков) vs <b>${opponentName}</b> (${sumO} очков)\n` +
        `👑 Победитель: <b>${winnerName}</b>! 🎉`
      );
    } catch (e) {
      console.error('[tg] 21 points notification error:', e.message);
    }
  }
}

// Создать вызов на дуэль
async function createDuelChallenge(req, res) {
  try {
    const { opponentId, debtId, wager, gameType = 'twenty_one' } = req.body;
    const challengerId = req.user;

    if (gameType !== 'twenty_one') {
      return res.status(400).json({ error: 'Поддерживаются только дуэли 21 Очко' });
    }

    if (!opponentId || !mongoose.Types.ObjectId.isValid(opponentId)) {
      return res.status(400).json({ error: 'Укажите верный ID оппонента для вызова' });
    }

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

    if (challenger.isBanned || opponent.isBanned) {
      return res.status(403).json({ error: 'Один из участников заблокирован' });
    }

    if (debtId) {
      return res.status(400).json({ error: 'Дуэли на долг запрещены.' });
    }

    const wagerNum = parseInt(wager || 0, 10);

    const newDuel = new Duel({
      challenger: challengerId,
      opponent: opponentId,
      debtId: null,
      wager: wagerNum,
      gameType: 'twenty_one',
      status: 'pending'
    });
    await newDuel.save();

    // 📣 Telegram: уведомление о вызове
    const gameTitle = '🃏 21 Очко';
    const challengeText = `⚔️ <b>${challenger.name}</b> бросил вызов <b>${opponent.name}</b> на дуэль (${gameTitle})!\n` +
      `🎯 Примите вызов в приложении Azadolg!`;
    
    if (opponent.telegramId) {
      tg.sendMessage(challengeText, opponent.telegramId);
    } else {
      tg.sendMessage(challengeText);
    }

    res.status(201).json({ message: 'Вызов на дуэль 21 Очко успешно отправлен!', duel: newDuel });
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

    // ИНИЦИАЛИЗИРУЕМ ИГРУ КАРТ 21 ОЧКО
    duel.status = 'accepted';
    const deck = generateTwentyOneDeck();
    duel.gameState = {
      deck,
      challengerHand: [deck.pop(), deck.pop()],
      opponentHand: [deck.pop(), deck.pop()],
      challengerPassed: false,
      opponentPassed: false,
      currentTurn: duel.challenger._id,
      isBotMatch: false,
      lastAction: 'Игра началась! Раздача 2 карт каждому.',
      replayMessage: ''
    };
    await duel.save();
    return res.status(200).json({
      message: 'Дуэль 21 Очко началась!',
      duel
    });
  } catch (error) {
    console.error('Ошибка проведения дуэли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// ── Игра с Ботом (для мгновенного теста 21 Очко) ────────────────────────────
async function createBotTwentyOneDuel(req, res) {
  try {
    const userId = req.user;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Ищем или создаем Бота
    let bot = await User.findOne({ username: 'dealer_bot' });
    if (!bot) {
      bot = new User({
        name: 'Дилер Бот 🤖',
        username: 'dealer_bot',
        password: 'bot_secure_password_123',
        karma: 10000,
        isBanned: false
      });
      await bot.save();
    }

    const deck = generateTwentyOneDeck();
    const newDuel = new Duel({
      challenger: userId,
      opponent: bot._id,
      debtId: null,
      wager: 0,
      gameType: 'twenty_one',
      status: 'accepted',
      gameState: {
        deck,
        challengerHand: [deck.pop(), deck.pop()],
        opponentHand: [deck.pop(), deck.pop()],
        challengerPassed: false,
        opponentPassed: false,
        currentTurn: userId,
        isBotMatch: true,
        lastAction: 'Матч с Ботом начался! Ваша очередь ходить.',
        replayMessage: ''
      }
    });

    await newDuel.save();
    const populated = await Duel.findById(newDuel._id).populate('challenger opponent winner');

    res.status(201).json({ message: 'Матч с ботом создан!', duel: populated });
  } catch (err) {
    console.error('Ошибка создания матча с ботом:', err);
    res.status(500).json({ error: 'Ошибка сервера при создании матча с ботом' });
  }
}

// ── Ход в дуэли 21 Очко ──────────────────────────────────────────────────────
async function playTwentyOneAction(req, res) {
  try {
    const { duelId, action } = req.body; // 'hit' | 'pass'
    const userId = req.user;

    const duel = await Duel.findById(duelId).populate('challenger opponent winner');
    if (!duel) return res.status(404).json({ error: 'Дуэль не найдена' });

    if (duel.gameType !== 'twenty_one') {
      return res.status(400).json({ error: 'Эта дуэль не является игрой 21 очко' });
    }

    if (duel.status !== 'accepted') {
      return res.status(400).json({ error: 'Дуэль не активна или уже завершена' });
    }

    const isChallenger = duel.challenger._id.toString() === userId.toString();
    const isOpponent = duel.opponent._id.toString() === userId.toString();

    if (!isChallenger && !isOpponent) {
      return res.status(403).json({ error: 'Вы не участвуете в этой дуэли' });
    }

    if (duel.gameState.currentTurn && duel.gameState.currentTurn.toString() !== userId.toString()) {
      return res.status(400).json({ error: 'Сейчас не ваш ход' });
    }

    duel.gameState.replayMessage = '';
    const actingHand = isChallenger ? duel.gameState.challengerHand : duel.gameState.opponentHand;
    const actingName = isChallenger ? duel.challenger.name : duel.opponent.name;

    if (action === 'hit') {
      if (duel.gameState.deck.length === 0) {
        return res.status(400).json({ error: 'Колода карт пуста' });
      }
      const card = duel.gameState.deck.pop();
      actingHand.push(card);
      const cardSuitLabel = card.suit === 'red' ? '🔴 Красная' : '🔵 Синяя';
      duel.gameState.lastAction = `${actingName} вытащил карту: ${card.value} (${cardSuitLabel})`;

      const sum = calculateHandSum(actingHand);
      if (sum >= 21) {
        if (isChallenger) duel.gameState.challengerPassed = true;
        else duel.gameState.opponentPassed = true;
      }
    } else if (action === 'pass') {
      if (isChallenger) duel.gameState.challengerPassed = true;
      else duel.gameState.opponentPassed = true;
      duel.gameState.lastAction = `${actingName} сказал ПАС`;
    } else {
      return res.status(400).json({ error: 'Неверное действие' });
    }

    // Переход хода
    const otherPassed = isChallenger ? duel.gameState.opponentPassed : duel.gameState.challengerPassed;
    const otherUserId = isChallenger ? duel.opponent._id : duel.challenger._id;

    if (!otherPassed) {
      duel.gameState.currentTurn = otherUserId;
    } else {
      const actingPassed = isChallenger ? duel.gameState.challengerPassed : duel.gameState.opponentPassed;
      if (!actingPassed) {
        duel.gameState.currentTurn = userId;
      }
    }

    // Ход Бота если игра с Ботом
    if (
      duel.gameState.isBotMatch &&
      !duel.gameState.opponentPassed &&
      duel.gameState.currentTurn &&
      duel.gameState.currentTurn.toString() === duel.opponent._id.toString()
    ) {
      executeBotMoves(duel);
    }

    // Проверка на завершение раунда
    checkAndResolveTwentyOneRound(duel);

    await duel.save();
    const updatedDuel = await Duel.findById(duel._id).populate('challenger opponent winner');

    res.status(200).json({ duel: updatedDuel });
  } catch (err) {
    console.error('Ошибка действия 21 очко:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить активные дуэли пользователя
async function getMyDuels(req, res) {
  try {
    const userId = req.user;
    const duels = await Duel.find({
      $or: [{ challenger: userId }, { opponent: userId }],
      status: { $in: ['pending', 'accepted'] }
    }).populate('challenger opponent debtId winner', 'name username eloRating avatar description amount originalAmount');

    res.status(200).json(duels);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить H2H статистику между текущим пользователем и соперником
const { calculateH2H } = require('../utils/h2hHelper');
async function getHeadToHeadStats(req, res) {
  try {
    const userId = req.user;
    const { opponentId } = req.params;
    if (!opponentId) {
      return res.status(400).json({ error: 'ID соперника обязателен' });
    }

    const h2h = await calculateH2H(userId, opponentId);
    if (!h2h) {
      return res.status(404).json({ error: 'Статистика H2H недоступна' });
    }

    res.status(200).json(h2h);
  } catch (error) {
    console.error('[getHeadToHeadStats]', error);
    res.status(500).json({ error: error.message || 'Ошибка получения H2H статистики' });
  }
}

module.exports = {
  createDuelChallenge,
  respondToDuel,
  createBotTwentyOneDuel,
  playTwentyOneAction,
  getMyDuels,
  getHeadToHeadStats
};
