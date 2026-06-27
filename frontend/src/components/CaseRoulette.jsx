import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Coins, Gift, AlertCircle, RefreshCw, X } from 'lucide-react';

// Полный пул карточек для обычного ELO-кейса
const TAPE_POOL = [
  { type: 'penalty',           label: '-10 ELO',               color: 'border-gray-600  bg-gray-900/80     text-gray-300',             emoji: '🤬', rarity: 'Ширпотреб'   },
  { type: 'cashback',          label: '+150 Кармы',            color: 'border-cyan-500  bg-cyan-950/50     text-cyan-400',             emoji: '🪙', rarity: 'Армейское'   },
  { type: 'elo_bonus',         label: '+15 ELO',               color: 'border-purple-500 bg-purple-950/50 text-purple-400',            emoji: '🔥', rarity: 'Запрещенное' },
  { type: 'karma_super_bonus', label: '+300 Кармы & BP',       color: 'border-yellow-400 bg-yellow-950/50 text-yellow-300 shadow-yellow-400/20 shadow-md', emoji: '💎', rarity: 'Тайное ⭐'   }
];

const CARD_WIDTH = 130;
const CARD_GAP   = 8;
const WIN_INDEX  = 34; // Позиция выигрышной карточки в ленте

export default function CaseRoulette({ user, onOpenCase }) {
  const [spinning, setSpinning]     = useState(false);
  const [caseType, setCaseType]     = useState('common'); // 'common' | 'cosmetic'
  const [tape, setTape]             = useState([]);
  const [wonPrize, setWonPrize]     = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [error, setError]           = useState('');

  const controls  = useAnimation();
  const tapeRef   = useRef(null);

  // Инициализация ленты при смене типа кейса
  useEffect(() => {
    buildTape(null, caseType);
  }, [caseType]);

  const buildTape = (winLabel = null, typeSelected = caseType) => {
    const items = [];
    for (let i = 0; i < WIN_INDEX + 8; i++) {
      let item;
      if (i === WIN_INDEX && winLabel) {
        if (typeSelected === 'cosmetic') {
          item = {
            type: 'cosmetic',
            label: winLabel,
            emoji: winLabel.includes('Скин') ? '🎨' : '🖼️',
            rarity: winLabel.includes('Скин Галактика') || winLabel.includes('Алмазная') ? 'Immortal 🌟' : 'Тайное',
            color: 'border-purple-500 bg-purple-950/50 text-purple-400'
          };
        } else {
          item = TAPE_POOL.find(p => p.type === winLabel) || TAPE_POOL[2];
        }
      } else {
        if (typeSelected === 'cosmetic') {
          const cosmeticEmojis = ['🎨', '🖼️', '👑', '🛡️', '⚔️'];
          const rarities = ['Армейское', 'Запрещенное', 'Тайное', 'Immortal 🌟'];
          const mockLabels = ['Скин Vaporwave', 'Неоновая Рамка', 'Золотая Рамка', 'Скин Матрица'];
          item = {
            type: 'cosmetic',
            label: mockLabels[i % mockLabels.length],
            emoji: cosmeticEmojis[i % cosmeticEmojis.length],
            rarity: rarities[i % rarities.length],
            color: 'border-purple-500/20 bg-slate-900/90 text-purple-300'
          };
        } else {
          const weights = [25, 18, 35, 22]; // penalty, cashback, elo_bonus, karma_super_bonus
          const total = weights.reduce((a, b) => a + b, 0);
          let r = Math.random() * total;
          let idx = 0;
          for (let w of weights) { r -= w; if (r <= 0) break; idx++; }
          item = TAPE_POOL[Math.min(idx, TAPE_POOL.length - 1)];
        }
      }
      items.push({ ...item, key: `${item.type}-${typeSelected}-${i}-${Math.random()}` });
    }
    setTape(items);
    return items;
  };

  const cost = caseType === 'cosmetic' ? 250 : 100;
  const karma = user?.karma ?? 0;

  const handleSpin = async () => {
    if (spinning || !user || karma < cost) return;
    setError('');
    setSpinning(true);
    setWonPrize(null);
    setShowResult(false);

    try {
      // Запрос к бэкенду
      const result = await onOpenCase(caseType);
      
      const winLabel = caseType === 'cosmetic' 
        ? result.drop.label 
        : (result.drop.type || 'cashback');

      // Перестраиваем ленту с выигрышем на позиции WIN_INDEX
      buildTape(winLabel, caseType);

      // Сброс позиции
      await controls.set({ x: 0 });

      // Вычисляем смещение: нужно остановиться на WIN_INDEX-й карточке по центру
      const containerW = tapeRef.current?.offsetWidth || 640;
      const leftEdge   = WIN_INDEX * (CARD_WIDTH + CARD_GAP);
      const center      = leftEdge - containerW / 2 + CARD_WIDTH / 2;
      const jitter = (Math.random() - 0.5) * (CARD_WIDTH * 0.6);
      const finalX  = -(center + jitter);

      // Анимация прокрутки
      await controls.start({
        x: finalX,
        transition: { type: 'tween', ease: [0.05, 0.85, 0.05, 1], duration: 6 }
      });

      // Показываем результат
      if (caseType === 'cosmetic') {
        const isImmortal = result.drop.label.includes('Галактика') || result.drop.label.includes('Алмазная');
        setWonPrize({
          label: result.drop.label,
          rarity: isImmortal ? 'Immortal 🌟' : result.drop.rarity || 'Тайное',
          emoji: result.drop.label.includes('Скин') ? '🎨' : '🖼️',
          description: result.drop.description || 'Новая кастомизация для вашего Steam-профиля.',
          color: isImmortal ? 'border-indigo-400 bg-indigo-950/90 text-indigo-300' : 'border-purple-400 bg-purple-950/90 text-purple-300'
        });
      } else {
        const prizeCard = TAPE_POOL.find(p => p.type === result.drop.type) || TAPE_POOL[2];
        setWonPrize({ ...prizeCard, description: result.drop.description });
      }

      setShowResult(true);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ошибка открытия кейса');
    } finally {
      setSpinning(false);
    }
  };

  return (
    <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/40 text-center relative overflow-hidden">
      
      {/* Заголовок */}
      <div className="flex flex-col items-center mb-5">
        <div className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-2">
          <Gift className="w-4 h-4" />
          Azadolg Case Roulette
        </div>
        
        {/* Переключатель типов кейсов */}
        <div className="flex bg-black/40 border border-gray-850 p-1 rounded-xl gap-1 mt-2">
          <button
            onClick={() => !spinning && setCaseType('common')}
            disabled={spinning}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
              caseType === 'common' ? 'bg-purple-650 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            ELO-Кейс (100 ✧)
          </button>
          <button
            onClick={() => !spinning && setCaseType('cosmetic')}
            disabled={spinning}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
              caseType === 'cosmetic' ? 'bg-amber-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Cosmetics (250 ✧)
          </button>
        </div>
      </div>

      {/* Баланс */}
      <div className="flex justify-center mb-5">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black text-xs ${
          karma >= cost
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        }`}>
          <Coins className="w-4 h-4 text-emerald-400" />
          💠 {karma} ✧
          {karma < cost && <span className="text-[9px] ml-1 font-normal">(недостаточно)</span>}
        </div>
      </div>

      {/* Рулетка */}
      <div className="relative w-full py-4 bg-[#0b0f19]/90 border border-gray-800 rounded-xl overflow-hidden mb-5">
        <div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-purple-500 shadow-[0_0_12px_#a855f7] z-10 pointer-events-none" />

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
                <span className="text-[8px] uppercase tracking-wider opacity-60 font-bold">{item.rarity}</span>
                <span className="text-2xl">{item.emoji}</span>
                <span className="text-xs font-black truncate max-w-[110px]">{item.label}</span>
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
        disabled={spinning || karma < cost}
        className="w-full max-w-[260px] mx-auto block bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 shadow-purple-500/20 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed text-xs uppercase"
      >
        {spinning
          ? <span className="flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Идет вращение...</span>
          : `🎲 Открыть кейс за ${cost} ✧`
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
              <button
                onClick={() => setShowResult(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <p className="text-[10px] uppercase tracking-widest font-bold opacity-70 mb-1">
                [{wonPrize.rarity}]
              </p>
              <h4 className="text-base font-black uppercase tracking-wide mb-4">
                Успешное Открытие! 🎉
              </h4>

              <div className="w-20 h-20 rounded-full bg-black/30 border border-white/10 flex items-center justify-center text-4xl mx-auto mb-5">
                {wonPrize.emoji}
              </div>

              <div className="text-xl font-extrabold mb-3">{wonPrize.label}</div>
              <p className="text-[11px] leading-relaxed text-white/80 mb-6 px-2">
                {wonPrize.description}
              </p>

              <button
                onClick={() => setShowResult(false)}
                className="w-full bg-white text-[#0b0f19] font-black py-2.5 px-6 rounded-xl text-xs hover:opacity-90 transition shadow-md uppercase tracking-wider"
              >
                Забрать в инвентарь! 🚀
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
