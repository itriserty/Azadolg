import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Coins, Tag, Award, Sparkles, User, ShoppingBag, ShieldCheck, Heart } from 'lucide-react';
import Marketplace from './Marketplace';

const RARITY_COLORS = {
  immortal: 'bg-gradient-to-r from-indigo-500 to-indigo-650 text-white shadow shadow-indigo-500/20 border-indigo-400',
  legendary: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow shadow-yellow-500/20 border-yellow-400',
  rare: 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white shadow shadow-purple-500/20 border-purple-400',
  common: 'bg-gradient-to-r from-slate-500 to-gray-600 text-white border-slate-400'
};

export default function Shop({ user, onUpdateUser, onViewProfile }) {
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeTab, setActiveTab] = useState('official'); // 'official' | 'p2p'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchShopData = async () => {
    try {
      setLoading(true);
      const [shopItems, userInventory] = await Promise.all([
        api.request('/shop/items'),
        api.request('/shop/inventory')
      ]);
      setItems(shopItems);
      setInventory(userInventory);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки витрины магазина');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, []);

  const handleBuy = async (itemId) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const res = await api.request('/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ itemId })
      });
      setSuccess(res.message);
      
      if (res.user && onUpdateUser) {
        onUpdateUser(res.user);
      }
      
      await fetchShopData();
    } catch (err) {
      setError(err.message || 'Ошибка покупки');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (itemId, itemType) => {
    try {
      setError('');
      setSuccess('');
      setLoading(true);
      const res = await api.request('/shop/activate', {
        method: 'POST',
        body: JSON.stringify({ itemId, itemType })
      });
      setSuccess(res.message);
      
      if (res.user && onUpdateUser) {
        onUpdateUser(res.user);
      }
      
      await fetchShopData();
    } catch (err) {
      setError(err.message || 'Ошибка активации предмета');
    } finally {
      setLoading(false);
    }
  };

  const isOwned = (itemId) => {
    return inventory.some(inv => inv.itemId === itemId && inv.quantity > 0);
  };

  const getActiveItem = (itemType) => {
    if (itemType === 'skin') return user.activeProfileSkin;
    if (itemType === 'frame') return user.activeProfileFrame;
    return null;
  };

  return (
    <div className="space-y-6 text-xs text-gray-300">
      
      {/* Шапка магазина */}
      <div className="bg-[#0d1715] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5 uppercase">
            🛍️ Рынок и Кастомизация
          </h2>
          <p className="text-[10px] text-gray-500">Улучшайте свой профиль, покупайте бустеры и торгуйте скинами.</p>
        </div>

        <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl self-start md:self-auto shrink-0">
          <div>
            <div className="text-[9px] text-gray-500 font-bold uppercase leading-none mb-0.5">Баланс Кармы</div>
            <div className="text-sm font-black text-emerald-400 leading-none">💠 {user.karma} ✧</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-bold flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold flex items-center gap-2">
          <span>✅</span> {success}
        </div>
      )}

      {/* Переключатель вкладок магазина */}
      <div className="flex bg-[#0d1715]/80 border border-gray-800 p-1.5 rounded-2xl gap-1.5 max-w-xs mx-auto">
        <button
          onClick={() => setActiveTab('official')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'official'
              ? 'bg-gradient-to-r from-purple-650/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-extrabold shadow'
              : 'text-gray-400 hover:text-gray-250 border border-transparent'
          }`}
        >
          🏪 Магазин
        </button>
        <button
          onClick={() => setActiveTab('p2p')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'p2p'
              ? 'bg-gradient-to-r from-purple-650/20 to-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-extrabold shadow'
              : 'text-gray-400 hover:text-gray-250 border border-transparent'
          }`}
        >
          🛍️ P2P Маркет
        </button>
      </div>

      {activeTab === 'p2p' ? (
        <Marketplace user={user} onUpdateUser={onUpdateUser} onViewProfile={onViewProfile} />
      ) : (
        <div className="space-y-6">
          {/* Официальная витрина */}
          <div className="bg-[#0d1715] border border-gray-800 rounded-3xl p-5 shadow-xl shadow-black/40 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400">
              Официальная Витрина Avarice
            </h3>

            {loading && items.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center justify-center space-y-2">
                <div className="w-8 h-8 border-2 border-t-purple-500 border-gray-800 rounded-full animate-spin" />
                <span>Загрузка витрины...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => {
                  const owned = isOwned(item.itemId);
                  const active = getActiveItem(item.type) === item.itemId;

                  return (
                    <div key={item.itemId} className="bg-black/25 border border-gray-850 hover:border-gray-800 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex justify-between items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${RARITY_COLORS[item.rarity] || RARITY_COLORS.common}`}>
                            {item.rarity}
                          </span>
                          <span className="text-gray-550 text-[9px] uppercase tracking-wider">{item.type}</span>
                        </div>

                        <h4 className="font-bold text-gray-200 mt-2 text-sm">{item.name}</h4>
                        <p className="text-[10px] text-gray-400 mt-1">{item.description}</p>
                      </div>

                      <div className="border-t border-gray-800/40 pt-3 flex items-center justify-between">
                        <span className="text-emerald-400 font-extrabold text-sm flex items-center gap-0.5">
                          {item.price} ✧
                        </span>

                        {item.type === 'boost' ? (
                          <button
                            onClick={() => handleBuy(item.itemId)}
                            disabled={loading || user.karma < item.price}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition ${
                              user.karma >= item.price
                                ? 'bg-emerald-650 hover:bg-emerald-550 text-white'
                                : 'bg-gray-800 text-gray-550 cursor-not-allowed'
                            }`}
                          >
                            Применить (+{item.value} {item.itemId.includes('elo') ? 'ELO' : 'Карма'})
                          </button>
                        ) : owned ? (
                          active ? (
                            <button
                              onClick={() => handleActivate(item.type === 'skin' ? 'default' : 'none', item.type)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-gray-850 hover:bg-gray-800 border border-gray-700 text-gray-300 font-bold rounded-lg text-[10px] uppercase transition"
                            >
                              Снять
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(item.itemId, item.type)}
                              disabled={loading}
                              className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-550 text-white font-bold rounded-lg text-[10px] uppercase transition"
                            >
                              Использовать
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleBuy(item.itemId)}
                            disabled={loading || user.karma < item.price}
                            className={`px-3 py-1.5 font-bold rounded-lg text-[10px] uppercase transition ${
                              user.karma >= item.price
                                ? 'bg-purple-650 hover:bg-purple-550 text-white'
                                : 'bg-gray-800 text-gray-550 cursor-not-allowed'
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
            )}
          </div>

          {/* Инвентарь коллекционера */}
          <div className="bg-[#0d1715] border border-gray-800 rounded-3xl p-5 shadow-xl shadow-black/40 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
              Ваш косметический шкаф (Инвентарь)
            </h3>

            {inventory.filter(i => i.itemType !== 'boost').length === 0 ? (
              <p className="text-[10px] text-gray-550 text-center py-6">В шкафу пока пусто. Купите вещи или откройте кейсы!</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {inventory.filter(i => i.itemType !== 'boost').map((inv) => {
                  const active = getActiveItem(inv.itemType) === inv.itemId;
                  return (
                    <div
                      key={inv._id}
                      onClick={() => handleActivate(active ? (inv.itemType === 'skin' ? 'default' : 'none') : inv.itemId, inv.itemType)}
                      className={`bg-black/30 border p-3 rounded-xl text-center cursor-pointer transition-all hover:scale-[1.03] ${
                        active ? 'border-cyan-500 bg-cyan-950/10 shadow shadow-cyan-500/10' : 'border-gray-850 hover:border-gray-800'
                      }`}
                    >
                      <div className="text-2xl mb-1">{inv.itemType === 'skin' ? '🎨' : '🖼️'}</div>
                      <div className="font-bold text-gray-200 truncate leading-none">{inv.details?.name || inv.itemId}</div>
                      <div className="text-[8px] text-gray-500 mt-1 uppercase tracking-widest">
                        {active ? 'Надето' : 'В запасе'} {inv.quantity > 1 && `(x${inv.quantity})`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
