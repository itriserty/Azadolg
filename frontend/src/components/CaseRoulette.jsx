import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Coins, AlertCircle, RefreshCw, X, Zap, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';

// ── Тиры (идентичны бэкенду rouletteController.js) ──────────────────────────
const TIERS_META = [
  {
    cost:     500,
    label:    'Супертир',
    sublabel: 'Легенда',
    color:    'from-purple-500 to-indigo-650',
    border:   'border-purple-500/40',
    glow:     'shadow-purple-500/20',
    textColor:'text-purple-400',
    prizes:   [
      { win: 0,    label: '0 Кармы',    emoji: '💀', rarity: 'Пусто',     weight: 25, tag: 'zero'       },
      { win: 250,  label: '+250 Кармы', emoji: '🪙', rarity: 'Кэшбек',    weight: 36, tag: 'cashback'   },
      { win: 500,  label: '+500 Кармы', emoji: '✅', rarity: 'Выход в 0', weight: 32, tag: 'break_even' },
      { win: 1000, label: '+1000 Кармы',emoji: '💎', rarity: 'Удвоение',  weight:  5, tag: 'double'      },
      { win: 2500, label: '+2500 Кармы',emoji: '🏆', rarity: 'ДЖЕКПОТ',   weight:  2, tag: 'jackpot'    },
    ],
  },
  {
    cost:     100,
    label:    'Тир I',
    sublabel: 'Хайроллер',
    color:    'from-amber-500 to-orange-500',
    border:   'border-amber-500/40',
    glow:     'shadow-amber-500/20',
    textColor:'text-amber-400',
    prizes:   [
      { win: 0,   label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     weight: 25, tag: 'zero'       },
      { win: 50,  label: '+50 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    weight: 36, tag: 'cashback'   },
      { win: 100, label: '+100 Кармы', emoji: '✅', rarity: 'Выход в 0', weight: 32, tag: 'break_even' },
      { win: 200, label: '+200 Кармы', emoji: '💎', rarity: 'Удвоение',  weight:  5, tag: 'double'      },
      { win: 500, label: '+500 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   weight:  2, tag: 'jackpot'    },
    ],
  },
  {
    cost:     50,
    label:    'Тир II',
    sublabel: 'Мидгейм',
    color:    'from-cyan-500 to-blue-500',
    border:   'border-cyan-500/40',
    glow:     'shadow-cyan-500/20',
    textColor:'text-cyan-400',
    prizes:   [
      { win: 0,   label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     weight: 25, tag: 'zero'       },
      { win: 25,  label: '+25 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    weight: 36, tag: 'cashback'   },
      { win: 50,  label: '+50 Кармы',  emoji: '✅', rarity: 'Выход в 0', weight: 32, tag: 'break_even' },
      { win: 100, label: '+100 Кармы', emoji: '💎', rarity: 'Удвоение',  weight:  5, tag: 'double'      },
      { win: 250, label: '+250 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   weight:  2, tag: 'jackpot'    },
    ],
  },
  {
    cost:     25,
    label:    'Тир III',
    sublabel: 'Новичок',
    color:    'from-emerald-500 to-teal-500',
    border:   'border-emerald-500/40',
    glow:     'shadow-emerald-500/20',
    textColor:'text-emerald-400',
    prizes:   [
      { win: 0,   label: '0 Кармы',   emoji: '💀', rarity: 'Пусто',     weight: 25, tag: 'zero'       },
      { win: 15,  label: '+15 Кармы',  emoji: '🪙', rarity: 'Кэшбек',    weight: 40, tag: 'cashback'   },
      { win: 25,  label: '+25 Кармы',  emoji: '✅', rarity: 'Выход в 0', weight: 28, tag: 'break_even' },
      { win: 50,  label: '+50 Кармы',  emoji: '💎', rarity: 'Удвоение',  weight:  5, tag: 'double'      },
      { win: 100, label: '+100 Кармы', emoji: '🏆', rarity: 'ДЖЕКПОТ',   weight:  2, tag: 'jackpot'    },
    ],
  },
];

// ── Цвет карточки по тегу ─────────────────────────────────────────────────────
const TAG_CARD_COLOR = {
  zero:       'border-gray-700   bg-gray-900/80    text-gray-400',
  cashback:   'border-cyan-600   bg-cyan-950/60    text-cyan-300',
  break_even: 'border-green-600  bg-green-950/60   text-green-300',
  double:     'border-purple-500 bg-purple-950/60  text-purple-300',
  jackpot:    'border-yellow-400 bg-yellow-950/60  text-yellow-300',
};

// Цвет модалки результата
const RESULT_COLOR = {
  zero:       'border-gray-600   bg-gray-900       text-gray-300',
  cashback:   'border-cyan-500   bg-cyan-950       text-cyan-300',
  break_even: 'border-green-500  bg-green-950      text-green-300',
  double:     'border-purple-500 bg-purple-950     text-purple-300',
  jackpot:    'border-yellow-400 bg-yellow-950     text-yellow-300',
};

// ── Размеры ленты ─────────────────────────────────────────────────────────────
const CARD_WIDTH = 110;  // px
const CARD_GAP   = 8;    // px
const STEP       = CARD_WIDTH + CARD_GAP;

// Позиция выигрышной карточки в ленте (0-indexed).
// Используем 34 чтобы лента всегда прокручивалась через много карточек.
const WIN_INDEX = 34;

// Общее кол-во карточек: WIN_INDEX + буфер справа
const TAPE_LENGTH = WIN_INDEX + 12;

/**
 * Строит ленту с гарантированным расположением выигрышной карточки
 * на позиции WIN_INDEX. Остальные позиции — псевдослучайные карточки
 * (только для визуального декора — они не влияют на результат).
 *
 * @param {Array}  prizes  - призовой пул тира
 * @param {string} winTag  - тег выигрышной карточки (null = без выигрыша)
 */
/**
 * buildTape — строит массив карточек ленты.
 *
 * КРИТИЧЕСКИ ВАЖНО: после генерации всего массива мы жёстко
 * перезаписываем слот WIN_INDEX объектом с бэкенда (backendPrize).
 * Это гарантирует, что render-данные карточки на позиции WIN_INDEX
 * и данные в стейте wonPrize — ОДИН И ТОТ ЖЕ объект.
 *
 * @param {Array}   prizes       - призовой пул тира
 * @param {Object|null} backendPrize - приз из ответа бэкенда (prize.*)
 */
function buildTape(prizes, backendPrize = null) {
  const items = [];
  for (let i = 0; i < TAPE_LENGTH; i++) {
    // Декоративные карточки — взвешенный рандом (только для визуала)
    const total = prizes.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (const p of prizes) { r -= p.weight; if (r <= 0) break; idx++; }
    let card = prizes[Math.min(idx, prizes.length - 1)];

    // Убираем джекпот с позиций вблизи WIN_INDEX если выигрыш не джекпот
    if (
      card.tag === 'jackpot' &&
      Math.abs(i - WIN_INDEX) <= 2 &&
      backendPrize?.tag !== 'jackpot'
    ) {
      card = prizes.find(p => p.tag === 'cashback') || prizes[1];
    }

    items.push({ ...card, _key: `${i}-${card.tag}-${Math.random().toString(36).slice(2)}` });
  }

  // ── ЖЁСТКАЯ ПЕРЕЗАПИСЬ WIN_INDEX ─────────────────────────────────────────
  // Делается ПОСЛЕ всего цикла, чтобы ничто не могло перетереть этот слот.
  if (backendPrize !== null) {
    items[WIN_INDEX] = {
      ...backendPrize,              // все поля с бэкенда: tag, emoji, label, rarity, win
      _key: 'win-card-forced',      // уникальный ключ — React не перепутает DOM-узел
    };
  }

  return items;
}

/**
 * calcFinalX — вычисляет ТОЧНЫЙ финальный сдвиг ленты (px).
 *
 * ── Доказательство формулы ────────────────────────────────────────────────
 * motion.div имеет px-[50%] → padding-left = containerW/2 (px-% считается
 * от ширины РОДИТЕЛЯ, а не самого элемента — это стандарт CSS).
 *
 * Значит, центр карточки i ДО анимации (при x=0) находится:
 *   pos_i = containerW/2  +  i * STEP  +  CARD_WIDTH/2
 *
 * После применения transform x=finalX:
 *   pos_i_after = containerW/2  +  i * STEP  +  CARD_WIDTH/2  +  finalX
 *
 * Нужно pos_WIN_after = containerW/2 (= позиция стрелки):
 *   containerW/2 + WIN_INDEX * STEP + CARD_WIDTH/2 + finalX = containerW/2
 *   finalX = -(WIN_INDEX * STEP + CARD_WIDTH/2)
 *
 * containerW ПОЛНОСТЬЮ СОКРАЩАЕТСЯ — формула не зависит от ширины контейнера.
 *
 * Предыдущая формула добавляла +containerW/2, что давало дрейф ~280px
 * (~2.4 карточки) — именно это и было причиной багa.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * @param {number} winIndex - индекс выигрышной карточки в ленте
 */
function calcFinalX(winIndex) {
  // Строгое математическое попадание в центр карточки
  const exactCenter = -(winIndex * STEP + CARD_WIDTH / 2);

  // Косметический jitter: СТРОГО внутри карточки (±10px << CARD_WIDTH/2 = 55px)
  const MAX_INNER_JITTER = 10;
  const jitter = (Math.random() - 0.5) * 2 * MAX_INNER_JITTER;

  return exactCenter + jitter;
}

// ── Компонент одной карточки ──────────────────────────────────────────────────
const TapeCard = React.memo(function TapeCard({ item }) {
  return (
    <div
      style={{ width: CARD_WIDTH, height: 104, flexShrink: 0 }}
      className={`rounded-xl border flex flex-col items-center justify-center gap-1 select-none ${TAG_CARD_COLOR[item.tag] || TAG_CARD_COLOR.cashback}`}
    >
      <span className="text-[7px] uppercase tracking-wider opacity-60 font-bold">{item.rarity}</span>
      <span className="text-2xl">{item.emoji}</span>
      <span className="text-[10px] font-black truncate max-w-[96px] text-center">{item.label}</span>
    </div>
  );
});

// ── Вспомогательная функция для расчета ELO и EXP по тегу и стоимости тира ──
function getPrizeEloAndExp(tag, cost) {
  const rate = cost / 100;
  let baseElo = 0;
  let baseExp = 0;
  switch (tag) {
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
    default:
      baseElo = 0;
      baseExp = 0;
  }
  return {
    elo: Math.round(baseElo * rate),
    exp: Math.round(baseExp * rate)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CaseRoulette({ user, onUserUpdate }) {
  const [tierIdx, setTierIdx]       = useState(0);
  const [spinning, setSpinning]     = useState(false);
  // tape и spinResult хранятся в ref-ах чтобы не провоцировать лишние ре-рендеры
  // во время анимации
  const [tape, setTape]             = useState(() => buildTape(TIERS_META[0].prizes));
  const [wonPrize, setWonPrize]     = useState(null);   // приз из бэкенда
  const [spinDetails, setSpinDetails] = useState(null); // детали спина (ELO, EXP)
  const [showResult, setShowResult] = useState(false);
  const [error, setError]           = useState('');

  const controls  = useAnimation();
  const tapeRef   = useRef(null);
  // ref для хранения актуального winTag во время анимации
  const winTagRef = useRef(null);

  const tier  = TIERS_META[tierIdx];
  const karma = user?.karma ?? 0;

  // ── Сброс при смене тира ───────────────────────────────────────────────────
  const resetTier = useCallback((idx) => {
    if (spinning) return;
    setTierIdx(idx);
    winTagRef.current = null;
    setWonPrize(null);
    setSpinDetails(null);
    setShowResult(false);
    setError('');
    controls.set({ x: 0 });
    setTape(buildTape(TIERS_META[idx].prizes));
  }, [spinning, controls]);

  // ── Инициализация ──────────────────────────────────────────────────────────
  useEffect(() => {
    setTape(buildTape(tier.prizes));
    controls.set({ x: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Главная функция спина ──────────────────────────────────────────────────
  const handleSpin = async () => {
    if (spinning || karma < tier.cost) return;

    setError('');
    setSpinning(true);
    setWonPrize(null);
    setSpinDetails(null);
    setShowResult(false);

    try {
      // ── ШАГ 1: ПОЛУЧАЕМ РЕЗУЛЬТАТ ОТ БЭКЕНДА ─────────────────────────────
      // Бэкенд — единственный источник истины. Мы запрашиваем его ДО анимации,
      // чтобы гарантированно знать, на какой карточке нужно остановиться.
      const result = await api.request('/roulette/spin', {
        method: 'POST',
        body:   JSON.stringify({ tier: tier.cost }),
      });

      // Сохраняем выигрышный тег в ref (на случай отладки)
      winTagRef.current = result.prize.tag;

      // ── ШАГ 2: СТРОИМ ЛЕНТУ — ЖЁСТКАЯ ПЕРЕЗАПИСЬ WIN_INDEX ───────────────
      // buildTape принимает ПОЛНЫЙ объект prize с бэкенда и жёстко
      // перезаписывает items[WIN_INDEX] — никакой рассинхрон невозможен.
      const newTape = buildTape(tier.prizes, result.prize);

      // Сначала сбрасываем x in 0 (без анимации), потом заменяем ленту,
      // чтобы пользователь не увидел скачка.
      controls.set({ x: 0 });
      setTape(newTape);

      // ── ШАГ 3: ЖДЁМ ОДИН BROWSER-PAINT ───────────────────────────────────
      // Даём React время смонтировать новую ленту в DOM.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // ── ШАГ 4: ТОЧНАЯ ПОЗИЦИЯ ОСТАНОВКИ (без containerW) ────────────────
      // calcFinalX не зависит от containerW — px-[50%] уже компенсирует
      // смещение. Формула: finalX = -(WIN_INDEX * STEP + CARD_WIDTH / 2).
      const finalX = calcFinalX(WIN_INDEX);

      // ── ШАГ 5: АНИМАЦИЯ ПРОКРУТКИ ─────────────────────────────────────────
      // ease: быстрый разгон → плавное торможение до точной остановки
      await controls.start({
        x:          finalX,
        transition: {
          type:     'tween',
          ease:     [0.12, 0.0, 0.08, 1.0],   // кубическая кривая Безье
          duration: 5.8,
        },
      });

      // ── ШАГ 6: ПОКАЗЫВАЕМ РЕЗУЛЬТАТ ──────────────────────────────────────
      // wonPrize — данные из бэкенда, та же карточка что и на ленте
      setWonPrize(result.prize);
      setSpinDetails(result.spinDetails);
      setShowResult(true);

      // Обновляем баланс пользователя в родительском компоненте
      if (onUserUpdate && result.user) {
        onUserUpdate(result.user);
      }

    } catch (err) {
      console.error('[CaseRoulette] spin error:', err);
      setError(err.message || 'Ошибка спина рулетки');
      // На ошибку — сбрасываем анимацию
      controls.set({ x: 0 });
      setTape(buildTape(tier.prizes));
    } finally {
      setSpinning(false);
    }
  };

  // ── Цвет указателя по тиру ────────────────────────────────────────────────
  const pointerColor = tierIdx === 0 ? '#f59e0b' : tierIdx === 1 ? '#06b6d4' : '#10b981';

  return (
    <div className="space-y-5">

      {/* ── Выбор Тира ──────────────────────────────────────────────────────── */}
      <div className="bg-[#0d1220] border border-gray-800 rounded-2xl p-4">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 text-center">
          Выберите ставку
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIERS_META.map((t, i) => (
            <button
              key={t.cost}
              onClick={() => resetTier(i)}
              disabled={spinning}
              className={`relative overflow-hidden flex flex-col items-center justify-center py-3 px-2 rounded-xl border transition-all duration-200 ${
                tierIdx === i
                  ? `bg-gradient-to-br ${t.color} bg-opacity-20 ${t.border} shadow-lg ${t.glow}`
                  : 'border-gray-800 bg-[#151c2c]/60 hover:border-gray-700'
              } disabled:opacity-40`}
            >
              <span className={`text-base font-black ${tierIdx === i ? 'text-white' : 'text-gray-300'}`}>
                {t.cost} ✧
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${tierIdx === i ? t.textColor : 'text-gray-600'}`}>
                {t.sublabel}
              </span>
              {tierIdx === i && (
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${t.color}`} />
              )}
            </button>
          ))}
        </div>

        {/* Таблица шансов */}
        <div className="mt-3.5 grid grid-cols-5 gap-1">
          {tier.prizes.map(p => {
            const rewards = getPrizeEloAndExp(p.tag, tier.cost);
            return (
              <div key={p.tag} className="text-center p-1 bg-[#0b0f19]/30 border border-gray-800/20 rounded-lg flex flex-col justify-between">
                <div>
                  <div className="text-base">{p.emoji}</div>
                  <div className={`text-[8px] font-black ${tier.textColor}`}>{p.weight}%</div>
                  <div className="text-[7px] text-gray-400 font-bold leading-tight truncate px-0.5">{p.label}</div>
                </div>
                <div className="mt-1 border-t border-gray-800/20 pt-1 space-y-0.5">
                  {rewards.elo > 0 ? (
                    <div className="text-[7px] text-cyan-400 font-black leading-none">+{rewards.elo} ELO</div>
                  ) : null}
                  {rewards.exp > 0 ? (
                    <div className="text-[7px] text-indigo-400 font-black leading-none">+{rewards.exp} XP</div>
                  ) : null}
                  {rewards.elo === 0 && rewards.exp === 0 ? (
                    <div className="text-[7px] text-gray-600 leading-none">—</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Рулетка ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 relative overflow-hidden">

        {/* Баланс */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black text-xs ${
            karma >= tier.cost
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            <Coins className="w-3.5 h-3.5" />
            💠 {karma} ✧
            {karma < tier.cost && <span className="text-[9px] ml-1 font-normal opacity-75">(мало)</span>}
          </div>
          <div className={`text-xs font-bold ${tier.textColor}`}>
            Ставка: {tier.cost} ✧ · RTP 70%
          </div>
        </div>

        {/* Лента */}
        <div className="relative w-full py-3 bg-[#0b0f19]/90 border border-gray-800 rounded-xl overflow-hidden mb-4">
          {/* Вертикальная стрелка-указатель (строго по центру) */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] z-20 pointer-events-none rounded-full"
            style={{
              background: `linear-gradient(to bottom, transparent 0%, ${pointerColor} 30%, ${pointerColor} 70%, transparent 100%)`,
              boxShadow:  `0 0 14px 3px ${pointerColor}88`,
            }}
          />
          {/* Треугольные засечки сверху и снизу */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `8px solid ${pointerColor}` }}
          />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: `8px solid ${pointerColor}` }}
          />
          <div
            ref={tapeRef}
            className="overflow-hidden w-full"
            style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
          >
            <motion.div
              animate={controls}
              className="flex px-[50%]"
              style={{ gap: CARD_GAP, width: 'max-content', willChange: 'transform' }}
            >
              {tape.map(item => (
                <TapeCard key={item._key} item={item} />
              ))}
            </motion.div>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="mb-3 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-1.5 justify-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Кнопка спина */}
        <button
          onClick={handleSpin}
          disabled={spinning || karma < tier.cost}
          className={`w-full bg-gradient-to-r ${tier.color} text-white font-black py-3.5 px-6 rounded-xl hover:opacity-90 shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wider flex items-center justify-center gap-2`}
        >
          {spinning ? (
            <><RefreshCw className="w-4 h-4 animate-spin" />Крутится...</>
          ) : (
            <><Zap className="w-4 h-4" />Крутить за {tier.cost} ✧</>
          )}
        </button>
      </div>

      {/* ── Модалка результата ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showResult && wonPrize && (
          <motion.div
            key="roulette-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1,    y: 0  }}
              exit={{ scale: 0.85,    y: 20 }}
              className={`relative w-full max-w-sm rounded-2xl border p-7 text-center shadow-2xl ${RESULT_COLOR[wonPrize.tag] || RESULT_COLOR.cashback}`}
            >
              <button
                onClick={() => setShowResult(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="text-[9px] uppercase tracking-widest font-bold opacity-60 mb-1">
                {tier.label} · Ставка {tier.cost} ✧
              </p>
              <h4 className="text-sm font-black uppercase tracking-wide mb-4">
                {wonPrize.tag === 'zero'    ? '😬 Не повезло...'
                 : wonPrize.tag === 'jackpot' ? '🎊 ДЖЕКПОТ!!!'
                 : '🎉 Выигрыш!'}
              </h4>

              {/* Иконка — ТА ЖЕ, что и карточка на которой остановилась лента */}
              <div className="w-20 h-20 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-4xl mx-auto mb-4">
                {wonPrize.emoji}
              </div>

              <div className="text-2xl font-extrabold mb-1">{wonPrize.label}</div>
              <p className="text-[11px] opacity-70 mb-2">[{wonPrize.rarity}]</p>

              {/* Итог транзакции */}
              <div className="mt-3 mb-5 bg-black/30 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Ставка</span>
                  <span className="text-red-400 font-bold">−{tier.cost} ✧</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Выигрыш</span>
                  <span className={wonPrize.win > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}>
                    +{wonPrize.win} ✧
                  </span>
                </div>
                {spinDetails && spinDetails.eloGained > 0 && (
                  <div className="flex justify-between text-cyan-400 font-bold">
                    <span>Получено ELO</span>
                    <span>+{spinDetails.eloGained} 🔥</span>
                  </div>
                )}
                {spinDetails && spinDetails.expGained > 0 && (
                  <div className="flex justify-between text-indigo-400 font-bold">
                    <span>Получено EXP</span>
                    <span>+{spinDetails.expGained} XP</span>
                  </div>
                )}
                {spinDetails && spinDetails.leveledUp && (
                  <div className="flex justify-between border-t border-white/5 pt-1 text-yellow-400 font-extrabold text-[9px] uppercase tracking-wider">
                    <span>🚀 Новый уровень!</span>
                    <span>LVL +{spinDetails.levelDiff || 1}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/10 pt-1">
                  <span className="font-bold">Итог</span>
                  <span className={`font-black ${wonPrize.win - tier.cost >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {wonPrize.win - tier.cost >= 0 ? '+' : ''}{wonPrize.win - tier.cost} ✧
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowResult(false)}
                className="w-full bg-white text-[#0b0f19] font-black py-2.5 px-6 rounded-xl text-xs hover:opacity-90 transition shadow-md uppercase tracking-wider flex items-center justify-center gap-1"
              >
                Продолжить <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
