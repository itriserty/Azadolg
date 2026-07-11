import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Coins, Gift, AlertCircle, RefreshCw, X, Zap, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';

// ── Тиры ─────────────────────────────────────────────────────────────────────
const TIERS_META = [
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

// ── Цвет карточки в ленте по тегу ────────────────────────────────────────────
const TAG_CARD_COLOR = {
  zero:       'border-gray-700   bg-gray-900/80    text-gray-400',
  cashback:   'border-cyan-600   bg-cyan-950/60    text-cyan-300',
  break_even: 'border-green-600  bg-green-950/60   text-green-300',
  double:     'border-purple-500 bg-purple-950/60  text-purple-300',
  jackpot:    'border-yellow-400 bg-yellow-950/60  text-yellow-300',
};

const CARD_WIDTH = 110;
const CARD_GAP   = 8;
const WIN_INDEX  = 32;  // позиция выигрышной карточки в ленте

// Строим ленту из 50 карточек, позиция WIN_INDEX — выигрыш
function buildTape(prizes, winTag = null) {
  const items = [];
  for (let i = 0; i < WIN_INDEX + 14; i++) {
    let card;
    if (i === WIN_INDEX && winTag) {
      card = prizes.find(p => p.tag === winTag) || prizes[1];
    } else {
      // Псевдослучайная карточка для декора (смещённые веса, чтобы не угадать)
      const weights = prizes.map(p => p.weight);
      const total   = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let idx = 0;
      for (const w of weights) { r -= w; if (r <= 0) break; idx++; }
      card = prizes[Math.min(idx, prizes.length - 1)];
    }
    items.push({ ...card, key: `${card.tag}-${i}-${Math.random()}` });
  }
  return items;
}

// ── Компонент карточки ленты ──────────────────────────────────────────────────
function TapeCard({ item }) {
  return (
    <div
      style={{ width: CARD_WIDTH, height: 100, flexShrink: 0 }}
      className={`rounded-xl border flex flex-col items-center justify-center gap-1 select-none ${TAG_CARD_COLOR[item.tag] || TAG_CARD_COLOR.cashback}`}
    >
      <span className="text-[7px] uppercase tracking-wider opacity-60 font-bold">{item.rarity}</span>
      <span className="text-2xl">{item.emoji}</span>
      <span className="text-[10px] font-black truncate max-w-[96px] text-center">{item.label}</span>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export default function CaseRoulette({ user, onUserUpdate }) {
  const [tierIdx, setTierIdx]       = useState(0);
  const [spinning, setSpinning]     = useState(false);
  const [tape, setTape]             = useState([]);
  const [wonPrize, setWonPrize]     = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError]           = useState('');

  const controls  = useAnimation();
  const tapeRef   = useRef(null);

  const tier  = TIERS_META[tierIdx];
  const karma = user?.karma ?? 0;

  // Инициализируем ленту при смене тира
  useEffect(() => {
    setTape(buildTape(tier.prizes));
    setWonPrize(null);
    setShowResult(false);
    setError('');
    controls.set({ x: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierIdx]);

  const handleSpin = async () => {
    if (spinning || karma < tier.cost) return;
    setError('');
    setSpinning(true);
    setWonPrize(null);
    setShowResult(false);

    try {
      // ── Запрос к бэкенду ──────────────────────────────────────────────────
      const result = await api.request('/roulette/spin', {
        method: 'POST',
        body: JSON.stringify({ tier: tier.cost }),
      });

      const winTag = result.prize.tag;

      // ── Перестраиваем ленту с выигрышем на WIN_INDEX ──────────────────────
      const newTape = buildTape(tier.prizes, winTag);
      setTape(newTape);

      // Сбрасываем позицию
      await controls.set({ x: 0 });

      // Ждём 1 тик, чтобы React обновил DOM
      await new Promise(r => setTimeout(r, 30));

      // Вычисляем смещение
      const containerW = tapeRef.current?.offsetWidth || 560;
      const leftEdge   = WIN_INDEX * (CARD_WIDTH + CARD_GAP);
      const center     = leftEdge - containerW / 2 + CARD_WIDTH / 2;
      const jitter     = (Math.random() - 0.5) * (CARD_WIDTH * 0.5);
      const finalX     = -(center + jitter);

      // Анимация прокрутки
      await controls.start({
        x:          finalX,
        transition: { type: 'tween', ease: [0.05, 0.82, 0.05, 1], duration: 5.5 },
      });

      // ── Показываем результат ──────────────────────────────────────────────
      setWonPrize(result.prize);
      setShowResult(true);

      // Обновляем юзера в родителе
      if (onUserUpdate && result.user) {
        onUserUpdate(result.user);
      }
    } catch (err) {
      console.error('[CaseRoulette]', err);
      setError(err.message || 'Ошибка спина рулетки');
    } finally {
      setSpinning(false);
    }
  };

  // Определяем цвет результата по тегу
  const getResultColor = (tag) => {
    const map = {
      zero:       'border-gray-600   bg-gray-900       text-gray-300',
      cashback:   'border-cyan-500   bg-cyan-950       text-cyan-300',
      break_even: 'border-green-500  bg-green-950      text-green-300',
      double:     'border-purple-500 bg-purple-950     text-purple-300',
      jackpot:    'border-yellow-400 bg-yellow-950     text-yellow-300',
    };
    return map[tag] || map.cashback;
  };

  return (
    <div className="space-y-5">

      {/* ── Выбор Тира ───────────────────────────────────────────────────────── */}
      <div className="bg-[#0d1220] border border-gray-800 rounded-2xl p-4">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 text-center">
          Выберите ставку
        </p>
        <div className="grid grid-cols-3 gap-2">
          {TIERS_META.map((t, i) => (
            <button
              key={t.cost}
              onClick={() => !spinning && setTierIdx(i)}
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

        {/* Таблица шансов выбранного тира */}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {tier.prizes.map(p => (
            <div key={p.tag} className="text-center">
              <div className="text-base">{p.emoji}</div>
              <div className={`text-[8px] font-black ${tier.textColor}`}>{p.weight}%</div>
              <div className="text-[7px] text-gray-600 leading-tight">{p.rarity}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Рулетка ──────────────────────────────────────────────────────────── */}
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
        <div
          className="relative w-full py-3 bg-[#0b0f19]/90 border border-gray-800 rounded-xl overflow-hidden mb-4"
        >
          {/* Указатель */}
          <div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 z-10 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent, ${tierIdx === 0 ? '#f59e0b' : tierIdx === 1 ? '#06b6d4' : '#10b981'}, transparent)`, boxShadow: `0 0 12px ${tierIdx === 0 ? '#f59e0b' : tierIdx === 1 ? '#06b6d4' : '#10b981'}` }}
          />

          <div
            ref={tapeRef}
            className="overflow-hidden w-full"
            style={{ maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)' }}
          >
            <motion.div
              animate={controls}
              className="flex px-[50%]"
              style={{ gap: CARD_GAP, width: 'max-content' }}
            >
              {tape.map(item => (
                <TapeCard key={item.key} item={item} />
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

      {/* ── Модалка результата ────────────────────────────────────────────────── */}
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
              className={`relative w-full max-w-sm rounded-2xl border p-7 text-center shadow-2xl ${getResultColor(wonPrize.tag)}`}
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
                {wonPrize.tag === 'zero' ? '😬 Не повезло...' : wonPrize.tag === 'jackpot' ? '🎊 ДЖЕКПОТ!!!' : '🎉 Выигрыш!'}
              </h4>

              <div className="w-20 h-20 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-4xl mx-auto mb-4">
                {wonPrize.emoji}
              </div>

              <div className="text-2xl font-extrabold mb-1">{wonPrize.label}</div>
              <p className="text-[11px] opacity-70 mb-2">[{wonPrize.rarity}]</p>

              {/* Итог транзакции */}
              <div className="mt-3 mb-5 bg-black/30 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Ставка</span><span className="text-red-400 font-bold">−{tier.cost} ✧</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Выигрыш</span>
                  <span className={wonPrize.win > 0 ? 'text-green-400 font-bold' : 'text-gray-500'}>
                    +{wonPrize.win} ✧
                  </span>
                </div>
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
