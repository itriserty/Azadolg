/**
 * rouletteController.js
 *
 * 3-тировая рулетка с математически выверенными вероятностями (RTP = 70%).
 *
 * Тир 1 (ставка 100): 0(25%) | 50(36%) | 100(32%) | 200(5%) | 500(2%)
 * Тир 2 (ставка  50): 0(25%) | 25(36%) | 50(32%)  | 100(5%) | 250(2%)
 * Тир 3 (ставка  25): 0(25%) | 15(40%) | 25(28%)  | 50(5%)  | 100(2%)
 *
 * RTP-проверка Тир 1: 0*25 + 50*36 + 100*32 + 200*5 + 500*2 = 0+1800+3200+1000+1000 = 7000 / 100 = 70 / ставка 100 → RTP 70%
 * RTP-проверка Тир 2: 0*25 + 25*36 + 50*32  + 100*5  + 250*2 = 0+900+1600+500+500 = 3500 / 100 = 35 / ставка 50 → RTP 70%
 * RTP-проверка Тир 3: 0*25 + 15*40 + 25*28  + 50*5   + 100*2 = 0+600+700+250+200 = 1750 / 100 = 17.5 / ставка 25 → RTP 70%
 */

const User        = require('../models/User');
const SystemState = require('../models/SystemState');
const tg          = require('../services/telegramService');
const mongoose    = require('mongoose');
const crypto      = require('crypto');

/**
 * Начисляет опыт и повышает уровни игрока
 * @param {Object} user 
 * @param {number} expGained 
 */
function addExperience(user, expGained) {
  if (expGained <= 0) return;
  user.exp = (user.exp || 0) + expGained;
  user.level = user.level || 1;
  while (user.exp >= user.level * 100) {
    user.exp -= user.level * 100;
    user.level += 1;
  }
}

// ─── Таблицы призов (сумма весов = 100) ─────────────────────────────────────
const TIERS = {
  500: {
    cost: 500,
    label: 'Суперрулетка',
    prizes: [
      { win: 0,    weight: 15, label: '0 Кармы',    emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 250,  weight: 30, label: '+250 Кармы', emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 500,  weight: 35, label: '+500 Кармы', emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 1000, weight: 12, label: '+1000 Кармы',emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 2500, weight: 8,  label: '+2500 Кармы',emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
  100: {
    cost: 100,
    label: 'Тир 1',
    prizes: [
      { win: 0,   weight: 15, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 50,  weight: 30, label: '+50 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 100, weight: 35, label: '+100 Кармы', emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 200, weight: 12, label: '+200 Кармы', emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 500, weight: 8,  label: '+500 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
  50: {
    cost: 50,
    label: 'Тир 2',
    prizes: [
      { win: 0,   weight: 15, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 25,  weight: 30, label: '+25 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 50,  weight: 35, label: '+50 Кармы',  emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 100, weight: 12, label: '+100 Кармы', emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 250, weight: 8,  label: '+250 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
  25: {
    cost: 25,
    label: 'Тир 3',
    prizes: [
      { win: 0,   weight: 15, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 15,  weight: 30, label: '+15 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 25,  weight: 35, label: '+25 Кармы',  emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 50,  weight: 12, label: '+50 Кармы',  emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 100, weight: 8,  label: '+100 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
};

/**
 * Выбрать случайный приз из пула с учётом весов и Pity-системы.
 * Используется криптографически стойкий генератор рандома (crypto.randomInt).
 */
function selectPrize(prizes, lossStreak = 0) {
  let activePrizes = prizes;
  // Pity system: если игрок проиграл (или получил кэшбек < стоимости) 3 раза подряд,
  // исключаем 0 и заставляем выдать минимум Выход в 0, Удвоение или Джекпот!
  if (lossStreak >= 3) {
    activePrizes = prizes.filter(p => p.tag === 'break_even' || p.tag === 'double' || p.tag === 'jackpot');
  }

  const total = activePrizes.reduce((s, p) => s + p.weight, 0);
  let r = crypto.randomInt(0, total);
  for (const prize of activePrizes) {
    if (r < prize.weight) return prize;
    r -= prize.weight;
  }
  return activePrizes[activePrizes.length - 1];
}

/**
 * POST /api/roulette/spin
 * body: { tier: 500 | 100 | 50 | 25 }
 */
async function spin(req, res) {
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (err) {
    // В случаях когда MongoDB запущен без репликасета, транзакции не поддерживаются
    if (session) {
      try { session.endSession(); } catch (e) {}
      session = null;
    }
    useTransaction = false;
  }

  try {
    const userId = req.user;
    const tierKey = parseInt(req.body.tier, 10);

    if (!userId) {
      if (useTransaction) { await session.abortTransaction(); session.endSession(); }
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const tier = TIERS[tierKey];
    if (!tier) {
      if (useTransaction) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({ error: 'Недопустимый тир. Доступны: 500, 100, 50, 25.' });
    }

    // Загружаем пользователя
    const userQuery = User.findById(userId);
    if (useTransaction) userQuery.session(session);
    const user = await userQuery;

    if (!user) {
      if (useTransaction) { await session.abortTransaction(); session.endSession(); }
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isBanned) {
      if (useTransaction) { await session.abortTransaction(); session.endSession(); }
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Вы не можете крутить рулетку.' });
    }

    // Проверка баланса
    if ((user.karma || 0) < tier.cost) {
      if (useTransaction) { await session.abortTransaction(); session.endSession(); }
      return res.status(400).json({
        error: `Недостаточно Кармы. Нужно ${tier.cost} ✧, у вас ${user.karma || 0} ✧.`
      });
    }

    // ── Выбираем приз с учётом защиты от неудач ────────────────────────────
    const lossStreak = user.rouletteLossStreak || 0;
    const prize = selectPrize(tier.prizes, lossStreak);

    // Обновляем счетчик серии проигрышей
    if (prize.win < tier.cost) {
      user.rouletteLossStreak = lossStreak + 1;
    } else {
      user.rouletteLossStreak = 0;
    }

    // Вычисляем ELO и EXP на основе тира и тега приза
    const rate = tier.cost / 100;
    let baseElo = 0;
    let baseExp = 0;

    switch (prize.tag) {
      case 'cashback':
        baseElo = 2;
        baseExp = 5;
        break;
      case 'break_even':
        baseElo = 5;
        baseExp = 10;
        break;
      case 'double':
        baseElo = 10;
        baseExp = 20;
        break;
      case 'jackpot':
        baseElo = 25;
        baseExp = 50;
        break;
      case 'zero':
      default:
        baseElo = 0;
        baseExp = 0;
        break;
    }

    const eloGained = Math.round(baseElo * rate);
    const expGained = Math.round(baseExp * rate);

    // ── Атомарное обновление баланса ──────────────────────────────────────────
    // 1. Вычитаем ставку
    user.replenishBalance('karma', -tier.cost, 'roulette_spin');
    // 2. Зачисляем выигрыш (если он больше нуля)
    if (prize.win > 0) {
      user.replenishBalance('karma', prize.win, 'roulette_spin');
    }

    // 3. Зачисляем ELO
    if (eloGained > 0) {
      user.replenishBalance('elo', eloGained, 'roulette_spin');
    }

    // 4. Зачисляем EXP
    const initialLevel = user.level || 1;
    if (expGained > 0) {
      addExperience(user, expGained);
    }
    const leveledUp = (user.level || 1) > initialLevel;

    // 4.1 Зачисляем EXP на Battle Pass
    const initialBPLevel = user.battlePassLevel || 1;
    if (expGained > 0) {
      user.battlePassXP = (user.battlePassXP || 0) + expGained;
      while (user.battlePassXP >= 100) {
        user.battlePassXP -= 100;
        user.battlePassLevel = (user.battlePassLevel || 1) + 1;
      }
    }
    const bpLeveledUp = (user.battlePassLevel || 1) > initialBPLevel;
    if (bpLeveledUp) {
      const { grantBattlePassReward } = require('../utils/battlePassHelper');
      for (let lvl = initialBPLevel + 1; lvl <= user.battlePassLevel; lvl++) {
        await grantBattlePassReward(user, lvl);
      }
    }

    // ── Джекпот-пул: 30% от ставки уходит в пул (house edge = 30%) ──────────
    const jackpotContrib = Math.floor(tier.cost * 0.30);
    const sysQuery = SystemState.findOne();
    if (useTransaction) sysQuery.session(session);
    let systemState = await sysQuery;
    if (!systemState) {
      systemState = new SystemState();
    }
    systemState.jackpotPool = (systemState.jackpotPool || 0) + jackpotContrib;

    if (useTransaction) {
      await systemState.save({ session });
      await user.save({ session });
      await session.commitTransaction();
      session.endSession();
    } else {
      await systemState.save();
      await user.save();
    }

    // ── Telegram-уведомление при джекпоте ───────────────────────────────────
    if (prize.tag === 'jackpot') {
      const msg =
        `🎰 <b>РУЛЕТКА: ДЖЕКПОТ!</b> 🎰\n\n` +
        `👤 <b>${user.name}</b> сорвал джекпот!\n` +
        `🏆 Выигрыш: <b>+${prize.win} Кармы</b> (Тир ${tier.cost} ✧)`;
      tg.sendMessage(msg);
      if (user.telegramId) {
        try {
          tg.sendMessage(
            `🎉 Поздравляем! Вы сорвали джекпот рулетки: +${prize.win} Кармы! 🏆`,
            user.telegramId
          );
        } catch (e) {
          console.error('[Roulette] Telegram notification error:', e.message);
        }
      }
    }

    let newlyCompletedQuests = [];
    try {
      const questService = require('../services/questService');
      const q1 = await questService.trackProgress(userId, 'spin_roulette_3');
      let q2 = [];
      if (tier.cost === 100) {
        q2 = await questService.trackProgress(userId, 'spin_elite_roulette');
      }
      newlyCompletedQuests = [...q1, ...q2];
    } catch (err) {
      console.error('[Casino] Ошибка QuestService:', err);
    }

    const achievementService = require('../services/AchievementService');
    const newlyAwarded = await achievementService.emit('roulette_spun', {
      userId: user._id,
      tierCost: tier.cost,
      winAmount: prize.win,
      isJackpot: prize.tag === 'jackpot'
    });

    return res.status(200).json({
      message: 'Спин завершён!',
      tier: { cost: tier.cost, label: tier.label },
      prize: {
        win:    prize.win,
        label:  prize.label,
        emoji:  prize.emoji,
        rarity: prize.rarity,
        tag:    prize.tag,
      },
      karmaChange: prize.win - tier.cost,  // < 0 если потеря, >= 0 если прибыль/ноль
      spinDetails: {
        eloGained,
        expGained,
        leveledUp: bpLeveledUp || leveledUp,
        levelDiff: bpLeveledUp ? (user.battlePassLevel - initialBPLevel) : ((user.level || 1) - initialLevel)
      },
      user: {
        ...user.toObject(),
        password: undefined,
        resetCode: undefined,
        resetCodeExpires: undefined
      },
      newlyCompletedQuests,
      newlyAwarded
    });
  } catch (err) {
    if (useTransaction && session) {
      try { await session.abortTransaction(); } catch(e){}
      session.endSession();
    }
    console.error('[rouletteController.spin] Ошибка:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера при спине рулетки' });
  }
}

/**
 * GET /api/roulette/tiers  — информация о тирах (для фронта)
 */
function getTiers(req, res) {
  const info = Object.values(TIERS).map(t => ({
    cost:   t.cost,
    label:  t.label,
    prizes: t.prizes.map(p => ({
      win:    p.win,
      label:  p.label,
      emoji:  p.emoji,
      rarity: p.rarity,
      tag:    p.tag,
      chance: `${p.weight}%`,
    })),
  }));
  res.json({ tiers: info });
}

module.exports = { spin, getTiers, TIERS };
