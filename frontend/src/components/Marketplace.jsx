import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { ShoppingBag, Tag, User, X, Check, ArrowRight, Coins } from 'lucide-react';

export default function Marketplace({ user, onUpdateUser, onViewProfile }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [buyingId, setBuyingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const data = await api.request('/market/list');
      setListings(data);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить товары на рынке');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleBuy = async (item) => {
    if (!window.confirm(`Купить "${item.details.name}" у @${item.seller.username} за ${item.price} ₸ Кармы?`)) {
      return;
    }
    setBuyingId(item._id);
    setError('');
    setSuccess('');
    try {
      const res = await api.request(`/market/buy/${item._id}`, { method: 'POST' });
      setSuccess(res.message);
      // Обновляем карму пользователя в основном состоянии приложения
      if (res.buyer && onUpdateUser) {
        onUpdateUser({ ...user, karma: res.buyer.karma });
      }
      await fetchListings();
    } catch (err) {
      setError(err.message || 'Ошибка при покупке предмета');
    } finally {
      setBuyingId(null);
    }
  };

  const handleCancel = async (item) => {
    if (!window.confirm('Оргадить продажу и вернуть предмет в инвентарь?')) {
      return;
    }
    setCancellingId(item._id);
    setError('');
    setSuccess('');
    try {
      const res = await api.request(`/market/cancel/${item._id}`, { method: 'POST' });
      setSuccess(res.message);
      await fetchListings();
    } catch (err) {
      setError(err.message || 'Ошибка отмены лота');
    } finally {
      setCancellingId(null);
    }
  };

  const myActiveListings = listings.filter(l => l.seller?._id === user?._id);
  const otherListings = listings.filter(l => l.seller?._id !== user?._id);

  return (
    <div className="space-y-6 animate-fadeIn text-sm">
      
      {/* Шапка рынка */}
      <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center font-black text-white text-xl">
            🛒
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              P2P Торговая Площадка (Marketplace)
            </h2>
            <p className="text-[10px] text-gray-500">Покупайте и продавайте кастомизацию за Карму</p>
          </div>
        </div>

        {/* Текущий баланс Кармы */}
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 rounded-xl self-start sm:self-auto shrink-0">
          <Coins className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-bold">Ваша Карма: {user?.karma} ₸</span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Мои лоты */}
      {myActiveListings.length > 0 && (
        <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40">
          <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 mb-4">
            Мои выставленные лоты ({myActiveListings.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {myActiveListings.map((item) => (
              <div key={item._id} className="p-4 bg-black/25 border border-gray-800 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-200">{item.details?.name}</div>
                  <div className="text-[10px] text-gray-500 capitalize">{item.itemType}</div>
                  <div className="text-xs text-purple-400 font-black mt-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {item.price} ₸ Кармы
                  </div>
                </div>
                <button
                  onClick={() => handleCancel(item)}
                  disabled={cancellingId === item._id}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold text-[10px] uppercase py-1.5 px-3 rounded-lg transition disabled:opacity-50"
                >
                  {cancellingId === item._id ? 'Снятие...' : 'Снять'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Общий список лотов */}
      <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl shadow-black/40">
        <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 mb-4">
          Лоты игроков на продаже ({otherListings.length})
        </h3>

        {loading ? (
          <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-2 border-t-cyan-500 border-gray-800 rounded-full animate-spin" />
            <span>Загрузка лотов...</span>
          </div>
        ) : otherListings.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">
            На рынке пока нет лотов от других игроков. Вы можете выставить свои вещи из своего профиля!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {otherListings.map((item) => (
              <div key={item._id} className="bg-black/20 border border-gray-850 hover:border-gray-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-gray-200 truncate">{item.details?.name}</span>
                    <span className={`text-[8px] uppercase tracking-widest font-extrabold px-1.5 py-0.5 rounded-full ${
                      item.details?.rarity === 'Immortal' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                      item.details?.rarity === 'Тайное' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-gray-800/50 text-gray-400'
                    }`}>
                      {item.details?.rarity || 'Common'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 capitalize mt-0.5">{item.itemType}</div>
                  <p className="text-[10px] text-gray-400 mt-2 line-clamp-2">{item.details?.description}</p>
                </div>

                {/* Продавец и покупка */}
                <div className="border-t border-gray-800/40 pt-3 flex flex-col space-y-3">
                  <div
                    onClick={() => onViewProfile && onViewProfile(item.seller?._id)}
                    className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-cyan-400 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span>Продавец: <b className="text-gray-300">@{item.seller?.username}</b></span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-emerald-400 font-extrabold text-sm flex items-center gap-0.5">
                      {item.price} ₸
                    </div>
                    <button
                      onClick={() => handleBuy(item)}
                      disabled={buyingId === item._id || (user && user.karma < item.price)}
                      className="bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-black text-xs py-1.5 px-3.5 rounded-lg transition disabled:opacity-40 flex items-center gap-1"
                    >
                      <span>Купить</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
