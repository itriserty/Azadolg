import React from 'react';

const BATTLEPASS_REWARDS = [
  { level: 1, name: 'Стартовый набор', type: 'karma', detail: '+200 ₸ Кармы (Выдается при регистрации)' },
  { level: 2, name: 'Неоново-Голубая Рамка', type: 'frame', detail: 'Косметическая рамка для вашего аватара' },
  { level: 3, name: 'Буст ELO-рейтинга', type: 'elo', detail: 'Мгновенное начисление +20 ELO' },
  { level: 4, name: 'Скин Vaporwave', type: 'skin', detail: 'Косметическая обложка профиля (ретро-вейв)' },
  { level: 5, name: 'Карма-бонус', type: 'karma', detail: '+150 ₸ Кармы в кошелек' },
  { level: 6, name: 'Неоново-Красная Рамка', type: 'frame', detail: 'Косметическая рамка для вашего аватара' },
  { level: 7, name: 'Супер-буст ELO', type: 'elo', detail: 'Мгновенное начисление +50 ELO' },
  { level: 8, name: 'Скин Матрица', type: 'skin', detail: 'Цифровой зеленый дождь на обложку профиля' },
  { level: 9, name: 'Золотой Карма-бонус', type: 'karma', detail: '+300 ₸ Кармы в кошелек' },
  { level: 10, name: 'Золотая Рамка', type: 'frame', detail: 'Легендарная рамка для истинных чемпионов' }
];

export default function BattlePass({ user }) {
  const currentLevel = user.battlePassLevel || 1;
  const currentXP = user.battlePassXP || 0;
  const xpPercent = Math.min(100, currentXP);

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Сводка Боевого Пропуска */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900 border border-indigo-500/30 backdrop-blur-md rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <span className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/30 uppercase tracking-widest">Сезонный боевой пропуск</span>
            <h2 className="text-3xl font-black text-white mt-2 tracking-wide uppercase">Battle Pass: Сезон 1</h2>
            <p className="text-slate-400 mt-1 text-sm max-w-xl">
              Закрывайте долги, выполняйте поручения и прокачивайте свой уровень Боевого Пропуска, чтобы разблокировать уникальные награды.
            </p>
          </div>
          
          <div className="flex items-center space-x-6 bg-slate-950/60 border border-slate-800/80 px-6 py-4 rounded-2xl">
            <div className="text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Текущий уровень</div>
              <div className="text-4xl font-black text-indigo-400 mt-1">{currentLevel}</div>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Прогресс до Level {currentLevel + 1}</div>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${xpPercent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-300">{currentXP} / 100 XP</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Инструкции по прокачке */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-md">
        <h3 className="text-lg font-bold text-white mb-4">Как получать опыт (XP)?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl flex items-start space-x-3">
            <span className="text-2xl">✅</span>
            <div>
              <h4 className="text-sm font-bold text-white">Возврат долга вовремя</h4>
              <p className="text-xs text-slate-400 mt-1">Закройте долг в течение первых 7 дней с момента создания.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">+25 XP</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl flex items-start space-x-3">
            <span className="text-2xl">⏰</span>
            <div>
              <h4 className="text-sm font-bold text-white">Возврат долга с задержкой</h4>
              <p className="text-xs text-slate-400 mt-1">Закройте просроченный долг (после 7 дней создания).</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">+10 XP</span>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/50 p-4 rounded-xl flex items-start space-x-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h4 className="text-sm font-bold text-white">Выполнение квестов</h4>
              <p className="text-xs text-slate-400 mt-1">Выполняйте квесты и поручения друзей с доски объявлений.</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">+20 XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Дорожная карта наград */}
      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-white">Линейка наград</h3>
        
        <div className="space-y-3">
          {BATTLEPASS_REWARDS.map(r => {
            const isUnlocked = currentLevel >= r.level;
            
            return (
              <div 
                key={r.level} 
                className={`border rounded-xl p-4 flex items-center justify-between transition-all ${
                  isUnlocked 
                    ? 'bg-indigo-950/10 border-indigo-500/30' 
                    : 'bg-slate-900/20 border-slate-800/80 grayscale'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg border ${
                    isUnlocked
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                      : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}>
                    Lvl {r.level}
                  </div>
                  <div>
                    <h4 className={`font-bold ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                      {r.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{r.detail}</p>
                  </div>
                </div>

                <div>
                  {isUnlocked ? (
                    <span className="flex items-center space-x-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                      <span>✓</span>
                      <span>Разблокировано</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5 text-slate-500 text-xs font-bold bg-slate-950/60 px-3 py-1 rounded-full border border-slate-800">
                      <span>🔒</span>
                      <span>Заблокировано</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
