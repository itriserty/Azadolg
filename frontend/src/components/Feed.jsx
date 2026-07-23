import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Send, Heart, MessageSquare, Trash2, Shield, Flame, 
  User, Check, Plus, UserPlus, Users, X, Clock, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Leaderboard from './Leaderboard';

export default function Feed({ user, onUpdateUser, onViewProfile, leaderboardUsers, friends, pendingRequests, onAddFriend, onAcceptRequest, onRejectRequest }) {
  const [activeMobileTab, setActiveMobileTab] = useState('posts');
  const [posts, setPosts] = useState([]);
  const [postContent, setPostContent] = useState('');
  
  // Пагинация для ленты
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Комментарии к постам
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentContent, setCommentContent] = useState({}); // { [postId]: 'text' }

  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [feedSuccess, setFeedSuccess] = useState('');

  const fetchFeedData = async () => {
    try {
      setLoading(true);
      setPage(1);
      const postsList = await api.request('/feed?page=1&limit=10');
      setPosts(postsList);
      setHasMore(postsList.length === 10);
    } catch (err) {
      console.error(err);
      setFeedError('Не удалось загрузить данные сообщества');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Мобильный переключатель вкладок */}
      <div className="lg:hidden flex gap-1.5 p-1 bg-[#060b0b]/60 border border-gray-850 rounded-2xl overflow-x-auto select-none mb-2">
        {[
          { id: 'posts', label: 'Лента', emoji: '💬' },
          { id: 'leaderboard', label: 'Рейтинг ELO', emoji: '🏆' },
          { id: 'friends', label: 'Община', emoji: '👥' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveMobileTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
              activeMobileTab === t.id
                ? 'bg-gradient-to-r from-purple-650/20 to-cyan-500/20 border border-cyan-500/40 text-cyan-400 shadow-md'
                : 'border border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <span>{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* ── ЛЕВАЯ КОЛОНКА: Лента + Сборы/Квесты (col-span-8) ── */}
      <div className="lg:col-span-8 space-y-6">
        
        {/* Сообщения об ошибках / успехе */}
        {feedError && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 font-bold">
            ⚠️ {feedError}
          </div>
        )}
        {feedSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold">
            ✅ {feedSuccess}
          </div>
        )}

        {/* Создать Пост */}
        <div className={`${activeMobileTab === 'posts' ? 'block' : 'hidden lg:block'} bg-[#0d1715] border border-gray-800 rounded-2xl p-4 shadow-xl`}>
          <form onSubmit={handleCreatePost} className="flex gap-3">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`}
              alt={user.name}
              className="w-9 h-9 rounded-xl border border-gray-800 shrink-0"
            />
            <div className="flex-1 relative">
              <input
                type="text"
                value={postContent}
                onChange={e => setPostContent(e.target.value)}
                placeholder="Что нового в вашей финансовой жизни? Опубликуйте пост..."
                className="w-full bg-[#060b0b] border border-gray-800 rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
              />
              <button
                type="submit"
                className="absolute right-2 top-2 text-cyan-400 hover:text-cyan-300"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>

        {/* Лента Постов */}
        <div className={`${activeMobileTab === 'posts' ? 'block' : 'hidden lg:block'} space-y-4`}>
          {posts.map((post) => {
            const hasLiked = post.likes?.includes(user._id);
            const isAuthor = post.author?._id === user._id;
            const isAdmin = user.role === 'admin';
            const frameStyle = post.author?.activeProfileFrame;
            
            // Динамические стили постов
            let cardClass = "bg-[#0d1715] border border-gray-850 rounded-2xl p-5 shadow-lg space-y-4 transition-all duration-300";
            let badgeText = "";
            let badgeClass = "";
            let showHeaderDetails = true;

            if (post.type === 'debt_created') {
              cardClass = "bg-[#0d1715] border-l-4 border-cyan-500 rounded-2xl p-5 shadow-lg space-y-4 border-t border-r border-b border-gray-850 shadow-[0_0_15px_rgba(6,182,212,0.06)]";
              badgeText = "🤝 Долг";
              badgeClass = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase";
            } else if (post.type === 'achievement_earned') {
              cardClass = "bg-[#0d1715] border-l-4 border-amber-500 rounded-2xl p-5 shadow-lg space-y-4 border-t border-r border-b border-gray-850 shadow-[0_0_15px_rgba(245,158,11,0.06)]";
              badgeText = "🏆 Достижение";
              badgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase";
            } else if (post.type === 'system_shaming') {
              cardClass = "bg-[#1f1215] border border-red-600/40 rounded-2xl p-5 shadow-lg space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.15)]";
              badgeText = "💀 Шейминг";
              badgeClass = "bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded font-black uppercase animate-pulse";
            } else if (post.type === 'external_meme') {
              cardClass = "bg-[#0d1715] border border-gray-850 rounded-2xl p-5 shadow-lg space-y-4 hover:border-purple-500/30 transition-all duration-300";
              badgeText = "👾 Мем";
              badgeClass = "bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase";
              showHeaderDetails = false;
            }

            return (
              <div key={post._id} className={cardClass}>
                {/* Шапка поста */}
                <div className="flex items-center justify-between">
                  {showHeaderDetails ? (
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => post.author?._id && onViewProfile(post.author._id)}>
                      <div className="relative">
                        <img
                          src={post.author?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${post.author?.username}`}
                          alt={post.author?.name || 'Пользователь'}
                          className={`w-9 h-9 rounded-xl border object-cover ${
                            frameStyle === 'gold_frame' ? 'border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                            frameStyle === 'diamond_frame' ? 'border-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' :
                            'border-gray-800'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100 flex items-center gap-1.5">
                          <span>{post.author?.name || 'Пользователь'}</span>
                          {post.author?.role === 'admin' && (
                            <Shield className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          {badgeText && <span className={badgeClass}>{badgeText}</span>}
                        </div>
                        <div className="text-[10px] text-gray-500">@{post.author?.username || 'username'}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-950/20 text-purple-400 border border-purple-800/30 flex items-center justify-center font-black text-sm">
                        🤖
                      </div>
                      <div>
                        <div className="font-bold text-gray-100 flex items-center gap-1.5">
                          <span>Reddit Агрегатор Мелькает</span>
                          {badgeText && <span className={badgeClass}>{badgeText}</span>}
                        </div>
                        <div className="text-[10px] text-gray-500">reddit.com</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">
                      {new Date(post.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => handleDeletePost(post._id)}
                        className="text-gray-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Содержимое */}
                {post.type === 'system_shaming' ? (
                  <p className="text-red-400 font-bold text-[12px] leading-relaxed break-words whitespace-pre-line bg-red-950/15 border border-red-900/30 p-3.5 rounded-xl italic flex items-start gap-2">
                    <span className="text-sm">⚠️</span>
                    <span>{post.content}</span>
                  </p>
                ) : (
                  <p className="text-gray-250 leading-relaxed text-[12px] break-words whitespace-pre-line">{post.content}</p>
                )}

                {/* Мем картинка */}
                {post.type === 'external_meme' && post.image_url && (
                  <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/40 mt-3 flex items-center justify-center">
                    <img 
                      src={post.image_url} 
                      alt={post.content} 
                      className="w-full max-h-96 object-contain"
                    />
                  </div>
                )}

                {/* Подвал: Лайки и Кнопка комментов */}
                <div className="flex items-center gap-4 border-t border-gray-800/40 pt-3">
                  <button
                    onClick={() => handleLikePost(post._id)}
                    className={`flex items-center gap-1.5 font-bold transition ${
                      hasLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${hasLiked ? 'fill-red-500' : ''}`} />
                    <span>{post.likes?.length || 0}</span>
                  </button>

                  <button
                    onClick={() => setActiveCommentsPostId(activeCommentsPostId === post._id ? null : post._id)}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-cyan-400 font-bold transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.comments?.length || 0} комм.</span>
                  </button>
                </div>

                {/* Блок комментариев */}
                {activeCommentsPostId === post._id && (
                  <div className="border-t border-gray-850 pt-4 space-y-3">
                    {/* Список */}
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {post.comments?.map((c, i) => (
                        <div key={i} className="flex gap-2.5 items-start bg-black/15 p-2 rounded-xl border border-gray-850/50">
                          <img
                            src={c.author?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c.author?.username}`}
                            alt={c.author?.name}
                            className="w-6 h-6 rounded-lg border border-gray-800 object-cover mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-gray-200 text-[10px]">{c.author?.name}</span>
                              <span className="text-[8px] text-gray-500">{new Date(c.createdAt).toLocaleDateString('ru-RU')}</span>
                            </div>
                            <p className="text-gray-300 mt-0.5 break-words text-[11px]">{c.content}</p>
                          </div>
                        </div>
                      ))}
                      {(!post.comments || post.comments.length === 0) && (
                        <p className="text-[10px] text-gray-500 text-center py-2">Здесь пока тихо... Будьте первым!</p>
                      )}
                    </div>

                    {/* Добавить комментарий */}
                    <form onSubmit={(e) => handleCommentSubmit(e, post._id)} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Написать комментарий..."
                        value={commentContent[post._id] || ''}
                        onChange={e => setCommentContent({ ...commentContent, [post._id]: e.target.value })}
                        className="flex-1 bg-[#060b0b] border border-gray-800 rounded-xl px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-cyan-600 hover:bg-cyan-500 text-[#060b0b] font-black px-3.5 py-1.5 rounded-xl transition"
                      >
                        Ответить
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={loadMorePosts}
                disabled={fetchingMore}
                className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
              >
                {fetchingMore ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Загрузка...
                  </>
                ) : (
                  'Показать еще посты'
                )}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── ПРАВАЯ КОЛОНКА: Лидерборд + Друзья (col-span-4) ── */}
      <div className="lg:col-span-4 space-y-6">

        {/* Виджет Лидерборда */}
        <div className={activeMobileTab === 'leaderboard' ? 'block' : 'hidden lg:block'}>
          <Leaderboard 
            users={leaderboardUsers} 
            currentUser={user} 
            onViewProfile={onViewProfile} 
          />
        </div>

        {/* Управление друзьями и социальная панель */}
        <div className={`${activeMobileTab === 'friends' ? 'block' : 'hidden lg:block'} bg-[#0d1715] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4`}>
          <div className="flex items-center gap-2 font-black text-gray-100 uppercase tracking-wider text-xs border-b border-gray-850 pb-2 flex-wrap">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Моя Община ({friends.length} друзей)</span>
          </div>

          {/* Добавить друга */}
          <form onSubmit={async (e) => {
            e.preventDefault();
            const usernameInput = e.target.elements.friendUsername.value;
            if (!usernameInput.trim()) return;
            try {
              const res = await onAddFriend(usernameInput.trim());
              alert(res.message || 'Запрос отправлен!');
              e.target.reset();
            } catch (err) {
              alert(err.message || 'Ошибка');
            }
          }} className="flex gap-2">
            <input
              type="text"
              name="friendUsername"
              placeholder="Добавить @username..."
              className="flex-1 bg-[#060b0b] border border-gray-800 text-[10px] text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-2 rounded-lg text-[10px] flex items-center gap-1 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Запросы */}
          {pendingRequests.length > 0 && (
            <div className="space-y-1.5 bg-cyan-950/10 border border-cyan-800/25 p-3 rounded-xl">
              <div className="text-[8px] uppercase tracking-wider font-extrabold text-cyan-400 mb-1.5">Входящие заявки:</div>
              {pendingRequests.map(req => (
                <div key={req._id} className="flex justify-between items-center gap-2 text-[10px]">
                  <span className="font-bold text-gray-200 truncate">@{req.sender?.username}</span>
                  <div className="flex gap-1">
                    <button onClick={() => onAcceptRequest(req._id)} className="bg-emerald-600 text-white font-bold p-1 rounded text-[8px]">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => onRejectRequest(req._id)} className="bg-gray-800 text-gray-400 p-1 rounded text-[8px]">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Список */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {friends.map(friend => (
              <div
                key={friend._id}
                onClick={() => onViewProfile(friend._id)}
                className="flex items-center justify-between p-2 bg-black/15 border border-gray-850/40 rounded-xl cursor-pointer hover:border-gray-800/80 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={friend.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${friend.username}`}
                    alt={friend.name}
                    className="w-7 h-7 rounded-lg object-cover border border-gray-850 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-gray-200 truncate leading-none mb-0.5">{friend.name}</div>
                    <div className="text-[9px] text-gray-500 truncate">@{friend.username}</div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-cyan-400 font-bold">{friend.eloRating} 🔥</div>
                  <div className="text-[8px] text-gray-550">💠 {friend.karma} ✧</div>
                </div>
              </div>
            ))}
            {friends.length === 0 && (
              <p className="text-[10px] text-gray-500 text-center py-4">Список друзей пуст</p>
            )}
          </div>
        </div>

      </div>

    </div>
  </div>
  );
}
