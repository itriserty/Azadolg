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

// ─── Таблицы призов (сумма весов = 100) ─────────────────────────────────────
const TIERS = {
  100: {
    cost: 100,
    label: 'Тир 1',
    prizes: [
      { win: 0,   weight: 25, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 50,  weight: 36, label: '+50 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 100, weight: 32, label: '+100 Кармы', emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 200, weight: 5,  label: '+200 Кармы', emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 500, weight: 2,  label: '+500 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
  50: {
    cost: 50,
    label: 'Тир 2',
    prizes: [
      { win: 0,   weight: 25, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 25,  weight: 36, label: '+25 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 50,  weight: 32, label: '+50 Кармы',  emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 100, weight: 5,  label: '+100 Кармы', emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 250, weight: 2,  label: '+250 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
  25: {
    cost: 25,
    label: 'Тир 3',
    prizes: [
      { win: 0,   weight: 25, label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     tag: 'zero'     },
      { win: 15,  weight: 40, label: '+15 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    tag: 'cashback' },
      { win: 25,  weight: 28, label: '+25 Кармы',  emoji: '✅', rarity: 'Выход в 0', tag: 'break_even' },
      { win: 50,  weight: 5,  label: '+50 Кармы',  emoji: '💎', rarity: 'Удвоение',  tag: 'double'   },
      { win: 100, weight: 2,  label: '+100 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   tag: 'jackpot'  },
    ],
  },
};

/**
 * Выбрать случайный приз из пула с учётом весов.
 * Сервер — единственный источник рандома.
 */
function selectPrize(prizes) {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const prize of prizes) {
    r -= prize.weight;
    if (r <= 0) return prize;
  }
  return prizes[prizes.length - 1];
}

/**
 * POST /api/roulette/spin
 * body: { tier: 100 | 50 | 25 }
 */
async function spin(req, res) {
  // Открываем MongoDB-сессию для ACID-транзакции
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user;
    const tierKey = parseInt(req.body.tier, 10);

    if (!userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const tier = TIERS[tierKey];
    if (!tier) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'Недопустимый тир. Доступны: 100, 50, 25.' });
    }

    // Загружаем пользователя ВНУТРИ транзакции
    const users = await User.find({ _id: userId }).session(session);
    const user = users[0];
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (user.isBanned) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован. Вы не можете крутить рулетку.' });
    }

    // Проверка баланса
    if ((user.karma || 0) < tier.cost) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        error: `Недостаточно Кармы. Нужно ${tier.cost} ✧, у вас ${user.karma || 0} ✧.`
      });
    }

    // ── Выбираем приз (рандом только на сервере!) ───────────────────────────
    const prize = selectPrize(tier.prizes);

    // ── Атомарное обновление баланса ─────────────────────────────────────────
    // 1. Вычитаем ставку
    user.karma -= tier.cost;
    // 2. Зачисляем выигрыш (даже если 0 — транзакция всё равно фиксируется)
    user.karma += prize.win;

    // ── Джекпот-пул: 30% от ставки уходит в пул (house edge = 30%) ──────────
    const jackpotContrib = Math.floor(tier.cost * 0.30);
    let systemState = await SystemState.findOne().session(session);
    if (!systemState) {
      systemState = new SystemState();
    }
    systemState.jackpotPool = (systemState.jackpotPool || 0) + jackpotContrib;

    await systemState.save({ session });
    await user.save({ session });

    // ── Коммитим транзакцию ──────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    // ── Telegram-уведомление при джекпоте ───────────────────────────────────
    if (prize.tag === 'jackpot') {
      const msg =
        `🎰 <b>РУЛЕТКА: ДЖЕКПОТ!</b> 🎰\n\n` +
        `👤 <b>${user.name}</b> сорвал джекпот!\n` +
        `🏆 Выигрыш: <b>+${prize.win} Кармы</b> (Тир ${tier.cost} ✧)`;
      tg.sendMessage(msg);
      if (user.telegramId) {
        try {
          await tg.sendMessage(
            `🎉 Поздравляем! Вы сорвали джекпот рулетки: +${prize.win} Кармы! 🏆`,
            user.telegramId
          );
        } catch (e) {
          console.error('[Roulette] Telegram notification error:', e.message);
        }
      }
    }

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
      user: {
        _id:   user._id,
        name:  user.name,
        karma: user.karma,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
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
