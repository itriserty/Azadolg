import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';

const RARITY_COLORS = {
  'Тайное': 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-lg shadow-yellow-500/20 border-yellow-400',
  'Запрещенное': 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 border-purple-400',
  'Армейское': 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 border-blue-400',
  'Ширпотреб': 'bg-gradient-to-r from-slate-500 to-gray-600 text-white border-slate-400'
};

export default function Shop({ user, onUpdateUser }) {
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gachaRolling, setGachaRolling] = useState(false);
  const [gachaDrop, setGachaDrop] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      setLoading(true);
      const [shopItems, userInventory] = await Promise.all([
        api.getShopItems(),
        api.getUserInventory()
      ]);
      setItems(shopItems);
      setInventory(userInventory);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки данных магазина');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (itemId) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const res = await api.buyShopItem(itemId);
      setSuccess(res.message);
      
      // Обновляем баланс пользователя на фронтенде
      if (res.user) {
        onUpdateUser({
          ...user,
          karma: res.user.karma,
          eloRating: res.user.eloRating
        });
      }
      
      await fetchShopData();
    } catch (err) {
      setError(err.message || 'Ошибка при покупке товара');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (itemId, itemType) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const res = await api.activateCosmetic(itemId, itemType);
      setSuccess(res.message);
      if (res.user) {
        onUpdateUser(res.user);
      }
      await fetchShopData();
    } catch (err) {
      setError(err.message || 'Ошибка активации');
    } finally {
      setLoading(false);
    }
  };

  const handleRollGacha = async () => {
    try {
      setError('');
      setSuccess('');
      setGachaDrop(null);
      setGachaRolling(true);

      // Имитируем вращение рулетки для вау-эффекта
      await new Promise(resolve => setTimeout(resolve, 2000));

      const res = await api.pullGacha();
      setGachaDrop(res.drop);
      
      if (res.user) {
        onUpdateUser({
          ...user,
          karma: res.user.karma,
          eloRating: res.user.eloRating,
          coins: res.user.coins
        });
      }
      
      await fetchShopData();
    } catch (err) {
      setError(err.message || 'Ошибка при запуске Гачи');
    } finally {
      setGachaRolling(false);
    }
  };

  const isOwned = (itemId) => {
    return inventory.some(inv => inv.itemId === itemId);
  };

  const getActiveItem = (itemType) => {
    if (itemType === 'skin') return user.activeProfileSkin;
    if (itemType === 'frame') return user.activeProfileFrame;
    return null;
  };

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Шапка с балансом */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-slate-900/60 border border-slate-800/80 backdrop-blur-md rounded-2xl p-6 shadow-xl">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-wide">Магазин и Гача-рулетка</h2>
          <p className="text-slate-400 mt-1">Тратьте заработанную Карму на оформление профиля и бустеры рейтинга ELO.</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-6 bg-slate-800/50 px-6 py-3 rounded-xl border border-slate-700/50">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Ваша Карма</div>
            <div className="text-2xl font-black text-emerald-400 flex items-center">
              <span>{user.karma} ₸</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-700/80" />
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">Ваш Рейтинг</div>
            <div className="text-2xl font-black text-blue-400 flex items-center">
              <span>{user.eloRating} ELO</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-center space-x-3">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm flex items-center space-x-3">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* Сетка: Гача и Товары */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Блок ГАЧА-Рулетки */}
        <div className="lg:col-span-1 bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-purple-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="bg-purple-500/20 text-purple-400 text-xs font-bold px-3 py-1 rounded-full border border-purple-500/30">Кейс Косметики</span>
              <span className="text-slate-400 text-sm font-semibold">100 ₸ / Крутка</span>
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-2">Gacha Roulette</h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Испытайте удачу! Из кейса с разной вероятностью выпадают неоновые скины, анимированные рамки профиля и ELO-бустеры.
            </p>

            {/* Визуализатор рулетки */}
            <div className="h-48 flex items-center justify-center bg-slate-950/60 rounded-2xl border border-slate-800 relative overflow-hidden mb-6">
              {gachaRolling ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 border-4 border-t-purple-500 border-r-emerald-400 border-b-blue-500 border-l-slate-700 rounded-full animate-spin" />
                  <div className="text-purple-400 text-sm font-black tracking-widest uppercase animate-pulse">Крутим кейс...</div>
                </div>
              ) : gachaDrop ? (
                <div className="text-center p-4 animate-scaleUp">
                  <div className="text-xs uppercase tracking-wider text-slate-400 mb-1">Вы выбили:</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${RARITY_COLORS[gachaDrop.rarity] || ''} mb-2`}>
                    {gachaDrop.rarity}
                  </div>
                  <h4 className="text-xl font-black text-white">{gachaDrop.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">{gachaDrop.description}</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-2">🎁</div>
                  <div className="text-slate-500 text-xs">Нажмите ниже для прокрутки</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleRollGacha}
            disabled={gachaRolling || user.karma < 100 || loading}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all transform duration-300 shadow-lg ${
              user.karma >= 100 && !gachaRolling
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-purple-500/20'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
            }`}
          >
            {user.karma < 100 ? 'Недостаточно Кармы' : gachaRolling ? 'Вращение...' : 'Прокрутить за 100 ₸'}
          </button>
        </div>

        {/* Список товаров в Магазине */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-2xl font-bold text-white">Товары на витрине</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(item => {
              const owned = isOwned(item.id);
              const active = getActiveItem(item.type) === item.id;
              
              return (
                <div key={item.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${RARITY_COLORS[item.rarity] || ''}`}>
                        {item.rarity}
                      </span>
                      <span className="text-slate-500 text-xs capitalize">{item.type === 'boost' ? 'Буст' : item.type === 'skin' ? 'Скин' : 'Рамка'}</span>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1">{item.name}</h4>
                    <p className="text-xs text-slate-400 mb-4">{item.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                    <span className="text-emerald-400 font-extrabold text-lg">{item.price} ₸</span>
                    
                    {item.type === 'boost' ? (
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={loading || user.karma < item.price}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          user.karma >= item.price
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Применить (+{item.value} ELO)
                      </button>
                    ) : owned ? (
                      active ? (
                        <button
                          onClick={() => handleActivate(item.type === 'skin' ? 'default' : 'none', item.type)}
                          disabled={loading}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 hover:bg-slate-600 transition-all"
                        >
                          Снять
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(item.id, item.type)}
                          disabled={loading}
                          className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all"
                        >
                          Надеть
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleBuy(item.id)}
                        disabled={loading || user.karma < item.price}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          user.karma >= item.price
                            ? 'bg-purple-600 hover:bg-purple-500 text-white'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        Купить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Инвентарь Косметики */}
      <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-4">Ваша коллекция косметики</h3>
        
        {inventory.filter(i => i.itemType !== 'boost').length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            Ваш инвентарь пуст. Покупайте товары в магазине или крутите гачу! 🛒
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {inventory.filter(i => i.itemType !== 'boost').map(inv => {
              const active = getActiveItem(inv.itemType) === inv.itemId;
              return (
                <div
                  key={inv._id}
                  onClick={() => handleActivate(active ? (inv.itemType === 'skin' ? 'default' : 'none') : inv.itemId, inv.itemType)}
                  className={`bg-slate-950/60 border rounded-xl p-3 text-center cursor-pointer transition-all hover:scale-105 ${
                    active ? 'border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-2xl mb-1">{inv.itemType === 'skin' ? '🖼️' : '🔘'}</div>
                  <div className="text-xs font-bold text-white truncate">{inv.details?.name || inv.itemId}</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">
                    {active ? 'Активен' : 'В запасе'} {inv.quantity > 1 && `(x${inv.quantity})`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
