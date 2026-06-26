import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Coins, Gift, AlertCircle, RefreshCw, X } from 'lucide-react';

// Полный пул карточек рулетки (должен соответствовать типам с бэкенда)
const TAPE_POOL = [
  { type: 'penalty',        label: '-10 ELO',    color: 'border-gray-600  bg-gray-900/80     text-gray-300',             emoji: '🤬', rarity: 'Ширпотреб'   },
  { type: 'cashback',       label: '+150 Coins',  color: 'border-cyan-500  bg-cyan-950/50     text-cyan-400',             emoji: '🪙', rarity: 'Армейское'   },
  { type: 'elo_bonus',      label: '+50 ELO',     color: 'border-purple-500 bg-purple-950/50 text-purple-400',            emoji: '🔥', rarity: 'Запрещенное' },
  { type: 'debt_reduction', label: '-5% Долга',   color: 'border-yellow-400 bg-yellow-950/50 text-yellow-300 shadow-yellow-400/20 shadow-md', emoji: '⭐', rarity: 'Тайное ⭐'   }
];

const CARD_WIDTH = 130;
const CARD_GAP   = 8;
const WIN_INDEX  = 34; // Позиция выигрышной карточки в ленте

export default function CaseRoulette({ user, onOpenCase, onUserUpdate }) {
  const [spinning, setSpinning]     = useState(false);
  const [tape, setTape]             = useState([]);
  const [wonPrize, setWonPrize]     = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError]           = useState('');

  const controls  = useAnimation();
  const tapeRef   = useRef(null);

  // Инициализация ленты
  useEffect(() => { buildTape(); }, []);

  const buildTape = (winType = null) => {
    const items = [];
    for (let i = 0; i < WIN_INDEX + 8; i++) {
      let item;
      if (i === WIN_INDEX && winType) {
        item = TAPE_POOL.find(p => p.type === winType) || TAPE_POOL[2];
      } else {
        const weights = [20, 20, 35, 25]; // penalty, cashback, elo_bonus, debt_reduction
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let idx = 0;
        for (let w of weights) { r -= w; if (r <= 0) break; idx++; }
        item = TAPE_POOL[Math.min(idx, TAPE_POOL.length - 1)];
      }
      items.push({ ...item, key: `${item.type}-${i}-${Math.random()}` });
    }
    setTape(items);
    return items;
  };

  const handleSpin = async () => {
    if (spinning || !user || user.coins < 100) return;
    setError('');
    setSpinning(true);
    setWonPrize(null);
    setShowResult(false);

    try {
      // 1. Запрос к бэкенду → получаем настоящий выигрыш
      const result = await onOpenCase();
      const winType = result.drop.type === 'penalty' ? 'penalty'
                    : result.drop.type === 'elo_bonus' ? 'elo_bonus'
                    : result.drop.type === 'debt_reduction' ? 'debt_reduction'
                    : 'cashback';

      // 2. Перестраиваем ленту с выигрышем на позиции WIN_INDEX
      buildTape(winType);

      // 3. Сброс позиции
      await controls.set({ x: 0 });

      // 4. Вычисляем смещение: нужно остановиться на WIN_INDEX-й карточке по центру
      const containerW = tapeRef.current?.offsetWidth || 640;
      const leftEdge   = WIN_INDEX * (CARD_WIDTH + CARD_GAP);
      const center      = leftEdge - containerW / 2 + CARD_WIDTH / 2;
      // Небольшой случайный оффсет внутри карточки для реализма
      const jitter = (Math.random() - 0.5) * (CARD_WIDTH * 0.6);
      const finalX  = -(center + jitter);

      // 5. Анимация прокрутки
      await controls.start({
        x: finalX,
        transition: { type: 'tween', ease: [0.05, 0.85, 0.05, 1], duration: 6 }
      });

      // 6. Показываем результат
      const prizeCard = TAPE_POOL.find(p => p.type === winType);
      setWonPrize({ ...prizeCard, ...result.drop });

      // Коллбэк для обновления состояния пользователя в App
      if (onUserUpdate) onUserUpdate(result.user);

      setShowResult(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка открытия кейса');
    } finally {
      setSpinning(false);
    }
  };

  const coins = user?.coins ?? 0;

  return (
    <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40 text-center relative overflow-hidden">
      {/* Заголовок */}
      <div className="flex flex-col items-center mb-5">
        <div className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <Gift className="w-4 h-4" />
          Azadolg Case — CS2 Style
        </div>
        <p className="text-xs text-gray-500 max-w-xs">
          Тратьте 100 Coins, крутите рулетку и получайте призы!
        </p>
      </div>

      {/* Баланс */}
      <div className="flex justify-center mb-5">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black text-sm ${
          coins >= 100
            ? 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <Coins className="w-4 h-4" />
          {coins} Coins
          {coins < 100 && <span className="text-[10px] ml-1 font-normal">(мало)</span>}
        </div>
      </div>

      {/* Рулетка */}
      <div className="relative w-full py-4 bg-[#0b0f19]/90 border border-gray-800 rounded-xl overflow-hidden mb-5">
        {/* Центральный визир */}
        <div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-purple-500 shadow-[0_0_12px_#a855f7] z-10 pointer-events-none" />

        {/* Лента */}
        <div
          ref={tapeRef}
          className="overflow-hidden w-full"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}
        >
          <motion.div
            animate={controls}
            className="flex gap-2 px-[50%]"
            style={{ width: 'max-content' }}
          >
            {tape.map(item => (
              <div
                key={item.key}
                style={{ width: CARD_WIDTH, height: 120 }}
                className={`rounded-xl border flex flex-col items-center justify-center gap-1 select-none shrink-0 ${item.color}`}
              >
                <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold">{item.rarity}</span>
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-sm font-black">{item.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Ошибка */}
      {error && (
        <div className="mb-4 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-1.5 justify-center">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Кнопка открытия кейса */}
      <button
        onClick={handleSpin}
        disabled={spinning || coins < 100}
        className="w-full max-w-[240px] mx-auto block bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 shadow-purple-500/20 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      >
        {spinning
          ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Вращается...</span>
          : '🎲 Испытать удачу (100 Coins)'
        }
      </button>

      {/* Модальное окно с результатом */}
      <AnimatePresence>
        {showResult && wonPrize && (
          <motion.div
            key="result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1,    y: 0  }}
              exit={{ scale: 0.85,    y: 20 }}
              className={`relative w-full max-w-sm rounded-2xl border p-7 text-center shadow-2xl ${wonPrize.color}`}
            >
              {/* Кнопка закрытия */}
              <button
                onClick={() => setShowResult(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="text-[10px] uppercase tracking-widest font-bold opacity-70 mb-1">
                [{wonPrize.rarity}]
              </p>
              <h4 className="text-lg font-black uppercase tracking-wide mb-4">
                Поздравляем! 🎉
              </h4>

              <div className="w-20 h-20 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-4xl mx-auto mb-5">
                {wonPrize.emoji}
              </div>

              <div className="text-2xl font-extrabold mb-3">{wonPrize.label}</div>
              <p className="text-sm leading-relaxed text-white/85 mb-6 px-2">
                {wonPrize.description}
              </p>

              <button
                onClick={() => setShowResult(false)}
                className="w-full bg-white text-[#0b0f19] font-black py-2.5 px-6 rounded-xl text-sm hover:opacity-90 transition shadow-md"
              >
                Забрать приз! 🚀
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
