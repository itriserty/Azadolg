import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  Rss, CreditCard, Sparkles, Trophy, ShoppingBag, 
  User, ShieldAlert, LogOut, Flame, Coins, Shield
} from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { path: '/feed',       label: 'Лента',     icon: Rss,          color: 'hover:text-cyan-400' },
  { path: '/debts',      label: 'Долги',     icon: CreditCard,   color: 'hover:text-purple-400' },
  { path: '/casino',     label: 'Казино',    icon: Sparkles,     color: 'hover:text-amber-400' },
  { path: '/battlepass', label: 'BP Pass',   icon: Trophy,       color: 'hover:text-yellow-400' },
  { path: '/shop',       label: 'Магазин',   icon: ShoppingBag,  color: 'hover:text-emerald-400' },
  { path: '/profile',    label: 'Профиль',   icon: User,         color: 'hover:text-indigo-400' }
];

export default function Layout({ user, onLogout }) {
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#070b13] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#131a2e] via-[#070b13] to-black text-gray-200 flex flex-col md:flex-row font-sans selection:bg-purple-600/40">
      
      {/* ── ДЕСКТОПНЫЙ САЙДБАР ── */}
      <aside className="hidden md:flex md:w-64 flex-col border-r border-gray-800/60 bg-[#0b0f19]/70 backdrop-blur-xl shrink-0 p-5 justify-between">
        <div className="space-y-6">
          {/* Логотип */}
          <div className="flex items-center gap-2 px-2 cursor-pointer" onClick={() => navigate('/feed')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-purple-500/25">
              AD
            </div>
            <div>
              <h1 className="font-black text-sm tracking-tight text-white leading-none">AZADOLG</h1>
              <span className="text-[9px] text-cyan-400 font-extrabold uppercase tracking-widest leading-none">Season 1</span>
            </div>
          </div>

          {/* Информация об игроке */}
          <div className="p-3.5 bg-black/20 border border-gray-800/40 rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <img
                src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
                alt={user.name}
                className="w-9 h-9 rounded-xl border border-gray-800 object-cover"
              />
              <div className="min-w-0">
                <div className="font-bold text-xs truncate text-white leading-none mb-0.5">{user.name}</div>
                <div className="text-[10px] text-gray-500 truncate">@{user.username}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-gray-800/40 text-[10px]">
              <div className="flex items-center gap-1 text-cyan-400 font-bold">
                <Flame className="w-3 h-3 text-red-500" /> {user.eloRating} 🔥
              </div>
              <div className="flex items-center gap-1 text-yellow-400 font-bold">
                🪙 {user.coins || 0}
              </div>
              <div className="flex items-center gap-1 text-emerald-400 font-bold col-span-2">
                💠 {user.karma} ✧
              </div>
            </div>
          </div>

          {/* Меню навигации */}
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-600/15 to-cyan-500/15 border-cyan-500/30 text-cyan-400 font-extrabold shadow shadow-cyan-500/5'
                      : 'border-transparent text-gray-400 hover:bg-gray-850 hover:text-gray-200'
                  } ${item.color}`
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* Админка */}
            {user.role === 'admin' && (
              <NavLink
                to="/admin"
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive 
                      ? 'bg-purple-600/20 border-purple-500/30 text-purple-400 font-extrabold'
                      : 'border-transparent text-gray-500 hover:text-purple-400 hover:bg-purple-950/10'
                  }`
                }
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>Админ-панель</span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* Выход */}
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-red-400 hover:bg-red-950/15 border border-transparent transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Выйти</span>
        </button>
      </aside>

      {/* ── МОБИЛЬНАЯ ШАПКА ── */}
      <header className="md:hidden flex items-center justify-between p-4 bg-[#0b0f19]/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-650 to-cyan-500 flex items-center justify-center font-black text-white text-sm">
            AD
          </div>
          <span className="font-black text-xs text-white">AZADOLG</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-cyan-400 font-bold">{user.eloRating} 🔥</span>
          <span className="text-emerald-400 font-bold">💠 {user.karma} ✧</span>
          <button onClick={onLogout} className="text-gray-500 hover:text-red-400">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── ОСНОВНОЙ КОНТЕНТ ── */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-60px)] md:max-h-screen pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ── МОБИЛЬНОЕ НИЖНЕЕ МЕНЮ ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0b0f19]/90 backdrop-blur-xl border-t border-gray-800/80 px-2 py-2 flex justify-around items-center z-40">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[9px] font-bold transition-all ${
                isActive 
                  ? 'text-cyan-400 font-black' 
                  : 'text-gray-500 hover:text-gray-250'
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
        {user.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) => 
              `flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl text-[9px] font-bold transition-all ${
                isActive ? 'text-purple-400 font-black' : 'text-gray-500'
              }`
            }
          >
            <Shield className="w-4.5 h-4.5" />
            <span>Админ</span>
          </NavLink>
        )}
      </nav>

    </div>
  );
}
