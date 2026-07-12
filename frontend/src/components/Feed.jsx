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

  // Сборы (Котлы) и Квесты
  const [funds, setFunds] = useState([]);
  const [quests, setQuests] = useState([]);
  const [weeklyQuests, setWeeklyQuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [feedSuccess, setFeedSuccess] = useState('');

  // Формы Котлов и Квестов
  const [fundTitle, setFundTitle] = useState('');
  const [fundTarget, setFundTarget] = useState(500);
  const [contributionAmounts, setContributionAmounts] = useState({}); // { [fundId]: amount }
  
  const [questTitle, setQuestTitle] = useState('');
  const [questDesc, setQuestDesc] = useState('');
  const [questReward, setQuestReward] = useState(100);

  const fetchFeedData = async () => {
    try {
      setLoading(true);
      setPage(1);
      const [postsList, fundsList, questsList, weeklyList] = await Promise.all([
        api.request('/feed?page=1&limit=10'),
        api.request('/fund'),
        api.request('/quests'),
        api.getWeeklyQuests()
      ]);
      setPosts(postsList);
      setHasMore(postsList.length === 10);
      setFunds(fundsList);
      setQuests(questsList);
      setWeeklyQuests(weeklyList);
    } catch (err) {
      console.error(err);
      setFeedError('Не удалось загрузить данные сообщества');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (fetchingMore || !hasMore) return;
    setFetchingMore(true);
    try {
      const nextPage = page + 1;
      const postsList = await api.request(`/feed?page=${nextPage}&limit=10`);
      if (postsList.length > 0) {
        setPosts(prev => [...prev, ...postsList]);
        setPage(nextPage);
        setHasMore(postsList.length === 10);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Ошибка загрузки дополнительных постов ленты:', err);
    } finally {
      setFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchFeedData();
  }, []);

  // ── Посты ленты ─────────────────────────────────────────────────────────────
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!postContent.trim()) return;
    try {
      const newPost = await api.request('/posts', {
        method: 'POST',
        body: JSON.stringify({ content: postContent })
      });
      setPosts(prev => [newPost, ...prev]);
      setPostContent('');
    } catch (err) {
      alert(err.message || 'Ошибка создания поста');
    }
  };

  const handleLikePost = async (postId) => {
    try {
      const res = await api.request(`/posts/${postId}/like`, { method: 'POST' });
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          const currentLikes = p.likes || [];
          let updatedLikes = [...currentLikes];
          if (res.liked) {
            updatedLikes.push(user._id);
          } else {
            updatedLikes = updatedLikes.filter(id => id !== user._id);
          }
          return { ...p, likes: updatedLikes };
        }
        return p;
      }));
    } catch (err) {
      console.error('Ошибка лайка:', err);
    }
  };

  const handleCommentSubmit = async (e, postId) => {
    e.preventDefault();
    const text = commentContent[postId];
    if (!text || !text.trim()) return;

    try {
      const newComment = await api.request(`/posts/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ content: text })
      });
      setPosts(prev => prev.map(p => {
        if (p._id === postId) {
          return { ...p, comments: [...(p.comments || []), newComment] };
        }
        return p;
      }));
      setCommentContent(prev => ({ ...prev, [postId]: '' }));
    } catch (err) {
      alert(err.message || 'Ошибка отправки комментария');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Удалить этот пост?')) return;
    try {
      await api.request(`/posts/${postId}`, { method: 'DELETE' });
      setPosts(prev => prev.filter(p => p._id !== postId));
    } catch (err) {
      alert(err.message || 'Ошибка удаления поста');
    }
  };

  // ── Котлы (Краудфандинг) ─────────────────────────────────────────────────────
  const handleCreateFund = async (e) => {
    e.preventDefault();
    setFeedError('');
    setFeedSuccess('');
    if (!fundTitle.trim()) return setFeedError('Назовите сбор');

    try {
      setLoading(true);
      const res = await api.request('/fund', {
        method: 'POST',
        body: JSON.stringify({ title: fundTitle.trim(), targetAmount: Number(fundTarget) })
      });
      setFeedSuccess(`Сбор "${fundTitle}" успешно запущен!`);
      setFundTitle('');
      setFundTarget(500);
      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка создания сбора');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async (fundId) => {
    setFeedError('');
    setFeedSuccess('');
    const amt = Number(contributionAmounts[fundId]);
    if (!amt || amt <= 0) return setFeedError('Введите сумму взноса больше 0');

    try {
      setLoading(true);
      const res = await api.request(`/fund/contribute/${fundId}`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt })
      });
      setFeedSuccess(res.message);

      if (res.userKarma !== undefined && onUpdateUser) {
        onUpdateUser({ ...user, karma: res.userKarma });
      }

      setContributionAmounts(prev => ({ ...prev, [fundId]: '' }));
      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка взноса');
    } finally {
      setLoading(false);
    }
  };

  // ── Квесты (Поручения) ───────────────────────────────────────────────────────
  const handleCreateQuest = async (e) => {
    e.preventDefault();
    setFeedError('');
    setFeedSuccess('');
    if (!questTitle.trim() || !questDesc.trim()) return setFeedError('Заполните название и суть поручения');

    try {
      setLoading(true);
      const res = await api.request('/quests', {
        method: 'POST',
        body: JSON.stringify({ title: questTitle.trim(), description: questDesc.trim(), reward: Number(questReward) })
      });
      setFeedSuccess(`Поручение "${questTitle}" создано!`);

      if (res.creatorKarma !== undefined && onUpdateUser) {
        onUpdateUser({ ...user, karma: res.creatorKarma });
      }

      setQuestTitle('');
      setQuestDesc('');
      setQuestReward(100);
      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка создания квеста');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeQuest = async (questId) => {
    setFeedError('');
    setFeedSuccess('');
    try {
      setLoading(true);
      const res = await api.request(`/quests/take/${questId}`, { method: 'POST' });
      setFeedSuccess(res.message);
      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка принятия квеста');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteQuest = async (questId) => {
    setFeedError('');
    setFeedSuccess('');
    try {
      setLoading(true);
      const res = await api.request(`/quests/complete/${questId}`, { method: 'POST' });
      setFeedSuccess(res.message);
      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка завершения квеста');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyQuest = async (questId, action) => {
    setFeedError('');
    setFeedSuccess('');
    try {
      setLoading(true);
      const res = await api.request(`/quests/verify/${questId}`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      setFeedSuccess(res.message);

      const profile = await api.getMe();
      if (onUpdateUser) onUpdateUser(profile);

      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка верификации');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelQuest = async (questId) => {
    setFeedError('');
    setFeedSuccess('');
    try {
      setLoading(true);
      const res = await api.request(`/quests/cancel/${questId}`, { method: 'POST' });
      setFeedSuccess(res.message);

      if (res.creatorKarma !== undefined && onUpdateUser) {
        onUpdateUser({ ...user, karma: res.creatorKarma });
      }

      fetchFeedData();
    } catch (err) {
      setFeedError(err.message || 'Ошибка отмены квеста');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Мобильный переключатель вкладок */}
      <div className="lg:hidden flex gap-1.5 p-1 bg-[#0b0f19]/60 border border-gray-850 rounded-2xl overflow-x-auto select-none mb-2">
        {[
          { id: 'posts', label: 'Лента', emoji: '💬' },
          { id: 'activities', label: 'Котлы & Квесты', emoji: '🏺' },
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
        <div className={`${activeMobileTab === 'posts' ? 'block' : 'hidden lg:block'} bg-[#151c2c] border border-gray-800 rounded-2xl p-4 shadow-xl`}>
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
                className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl pl-4 pr-10 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
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
            let cardClass = "bg-[#151c2c] border border-gray-850 rounded-2xl p-5 shadow-lg space-y-4 transition-all duration-300";
            let badgeText = "";
            let badgeClass = "";
            let showHeaderDetails = true;

            if (post.type === 'debt_created') {
              cardClass = "bg-[#151c2c] border-l-4 border-cyan-500 rounded-2xl p-5 shadow-lg space-y-4 border-t border-r border-b border-gray-850 shadow-[0_0_15px_rgba(6,182,212,0.06)]";
              badgeText = "🤝 Долг";
              badgeClass = "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase";
            } else if (post.type === 'achievement_earned') {
              cardClass = "bg-[#151c2c] border-l-4 border-amber-500 rounded-2xl p-5 shadow-lg space-y-4 border-t border-r border-b border-gray-850 shadow-[0_0_15px_rgba(245,158,11,0.06)]";
              badgeText = "🏆 Достижение";
              badgeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0.5 rounded font-black uppercase";
            } else if (post.type === 'system_shaming') {
              cardClass = "bg-[#1f1215] border border-red-600/40 rounded-2xl p-5 shadow-lg space-y-4 shadow-[0_0_20px_rgba(220,38,38,0.15)]";
              badgeText = "💀 Шейминг";
              badgeClass = "bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1.5 py-0.5 rounded font-black uppercase animate-pulse";
            } else if (post.type === 'external_meme') {
              cardClass = "bg-[#151c2c] border border-gray-850 rounded-2xl p-5 shadow-lg space-y-4 hover:border-purple-500/30 transition-all duration-300";
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
                        className="flex-1 bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                        required
                      />
                      <button
                        type="submit"
                        className="bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-black px-3.5 py-1.5 rounded-xl transition"
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

        {/* 🏺 ОБЩИЕ КОТЛЫ (CROWDFUNDING) */}
        <div className={`${activeMobileTab === 'activities' ? 'grid' : 'hidden lg:grid'} grid-cols-1 md:grid-cols-2 gap-6 pt-4`}>
          
          <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>🏺</span> Создать Общий Котёл
            </h3>
            
            <form onSubmit={handleCreateFund} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Цель сбора</label>
                <input
                  type="text"
                  value={fundTitle}
                  onChange={e => setFundTitle(e.target.value)}
                  placeholder="Например, На пиццу к выходным 🍕"
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Сумма (Карма ✧)</label>
                <input
                  type="number"
                  value={fundTarget}
                  onChange={e => setFundTarget(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  min="100"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-cyan-650 hover:bg-cyan-550 text-white font-bold py-2 rounded-xl shadow-lg transition"
              >
                Запустить сбор
              </button>
            </form>
          </div>

          <div className="bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span>🏺</span> Активные Котлы ({funds.length})
            </h3>

            <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1">
              {funds.map((fund) => {
                const percent = Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100));
                
                return (
                  <div key={fund._id} className="p-3 bg-black/20 border border-gray-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-200">{fund.title}</div>
                        <div className="text-[9px] text-gray-500">Автор: {fund.creator?.name}</div>
                      </div>
                      <span className="text-[9px] text-cyan-400 font-extrabold uppercase bg-cyan-500/10 px-1.5 py-0.5 rounded">
                        {percent}%
                      </span>
                    </div>

                    {/* Полоска прогресса */}
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full" style={{ width: `${percent}%` }} />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-400">
                      <span>Собрано: <b>{fund.currentAmount}</b> из <b>{fund.targetAmount} ✧</b></span>
                    </div>

                    {/* Внести взнос */}
                    {fund.status === 'active' && fund.creator?._id !== user._id && (
                      <div className="flex gap-1.5 pt-1.5">
                        <input
                          type="number"
                          placeholder="Сумма ✧"
                          value={contributionAmounts[fund._id] || ''}
                          onChange={e => setContributionAmounts({ ...contributionAmounts, [fund._id]: e.target.value })}
                          className="bg-black/60 border border-gray-800 rounded-lg p-1.5 text-center text-white text-[10px] w-20 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={() => handleContribute(fund._id)}
                          className="flex-1 bg-emerald-650 hover:bg-emerald-550 text-white font-bold py-1.5 px-3 rounded-lg text-[10px] transition"
                        >
                          Внести вклад
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {funds.length === 0 && (
                <p className="text-[10px] text-gray-500 text-center py-6">Нет активных котлов.</p>
              )}
            </div>
          </div>

        </div>

        {/* 📜 БЮЛЛЕТЕНЬ ПОРУЧЕНИЙ (КВЕСТЫ) */}
        <div className={`${activeMobileTab === 'activities' ? 'block' : 'hidden lg:block'} bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4`}>
          <h3 className="text-sm font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <span>🛡️</span> Бюллетень поручений (Квесты за Карму)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Форма */}
            <form onSubmit={handleCreateQuest} className="p-4 bg-black/20 border border-gray-850 rounded-xl space-y-3 self-start">
              <h4 className="font-bold text-gray-200">Создать квест поручение</h4>
              <div>
                <label className="text-[9px] uppercase font-bold text-gray-500 block mb-0.5">Суть поручения</label>
                <input
                  type="text"
                  value={questTitle}
                  onChange={e => setQuestTitle(e.target.value)}
                  placeholder="Например, Забрать посылку с почты 📦"
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-gray-500 block mb-0.5">Условия / Детали</label>
                <input
                  type="text"
                  value={questDesc}
                  onChange={e => setQuestDesc(e.target.value)}
                  placeholder="Привезти в кабинет к 15:00"
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase font-bold text-gray-500 block mb-0.5">Награда (Карма ✧)</label>
                <input
                  type="number"
                  value={questReward}
                  onChange={e => setQuestReward(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-purple-500"
                  min="50"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-purple-650 hover:bg-purple-550 text-white font-bold py-1.5 rounded-lg transition"
              >
                Опубликовать поручение
              </button>
            </form>

            {/* Список квестов */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {quests.map((quest) => {
                const isCreator = quest.creator?._id === user._id;
                const isExecutor = quest.executor?._id === user._id;
                
                return (
                  <div key={quest._id} className="p-3 bg-black/25 border border-gray-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-gray-200">{quest.title}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{quest.description}</div>
                        <div className="text-[9px] text-gray-500 mt-1">Организатор: @{quest.creator?.username}</div>
                      </div>
                      <span className="text-[10px] text-purple-400 font-extrabold uppercase shrink-0">
                        +{quest.reward} ✧
                      </span>
                    </div>

                    <div className="border-t border-gray-800/40 pt-2 flex items-center justify-between text-[9px] text-gray-500">
                      <span>Статус: <b className="capitalize text-gray-300">{quest.status}</b></span>
                      {quest.executor && (
                        <span>Исполнитель: @{quest.executor.username}</span>
                      )}
                    </div>

                    <div className="flex gap-1.5 pt-1 flex-wrap">
                      {/* Гость берет квест */}
                      {quest.status === 'open' && !isCreator && (
                        <button
                          onClick={() => handleTakeQuest(quest._id)}
                          className="bg-cyan-600 hover:bg-cyan-500 text-[#0b0f19] font-bold text-[9px] py-1 px-2.5 rounded-lg transition"
                        >
                          Взять поручение
                        </button>
                      )}

                      {/* Исполнитель завершает квест */}
                      {quest.status === 'in_progress' && isExecutor && (
                        <button
                          onClick={() => handleCompleteQuest(quest._id)}
                          className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[9px] py-1 px-2.5 rounded-lg transition animate-pulse"
                        >
                          Выполнил! Отправить отчет
                        </button>
                      )}

                      {/* Создатель подтверждает квест */}
                      {quest.status === 'pending_verification' && isCreator && (
                        <>
                          <button
                            onClick={() => handleVerifyQuest(quest._id, 'approve')}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold text-[9px] py-1 px-2.5 rounded-lg transition"
                          >
                            Подтвердить
                          </button>
                          <button
                            onClick={() => handleVerifyQuest(quest._id, 'reject')}
                            className="bg-red-650 hover:bg-red-550 text-white font-bold text-[9px] py-1 px-2.5 rounded-lg transition"
                          >
                            Отклонить
                          </button>
                        </>
                      )}

                      {/* Создатель или админ удаляет */}
                      {(isCreator || user.role === 'admin') && quest.status !== 'completed' && (
                        <button
                          onClick={() => handleCancelQuest(quest._id)}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-400 font-bold text-[9px] py-1 px-2.5 rounded-lg transition ml-auto"
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {quests.length === 0 && (
                <p className="text-[10px] text-gray-500 text-center py-6">Бюллетень поручений пуст.</p>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ── ПРАВАЯ КОЛОНКА: Лидерборд + Друзья (col-span-4) ── */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Виджет Еженедельных заданий */}
        <div className={activeMobileTab === 'leaderboard' ? 'block' : 'hidden lg:block'}>
          <div className="bg-[#151c2c] border border-amber-500/20 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>📅</span> Еженедельные задания
              </h3>
              <span className="text-[9px] text-gray-500 font-bold">Обновление каждый Пн</span>
            </div>

            <div className="space-y-3">
              {weeklyQuests.map((quest) => {
                const percent = Math.min(100, Math.round((quest.current_value / quest.target_value) * 100));
                return (
                  <div key={quest._id} className="p-3 bg-black/20 border border-gray-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-bold text-gray-200 text-xs">{quest.meta_data?.title || quest.task_type}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{quest.meta_data?.description || ''}</div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-extrabold shrink-0">
                        +{quest.reward_karma} ✧
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-400 h-full" style={{ width: `${percent}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-500">
                        <span>Прогресс: {quest.current_value} / {quest.target_value}</span>
                        {quest.is_completed ? (
                          <span className="text-emerald-400 font-bold">Выполнено</span>
                        ) : (
                          <span className="text-amber-500 font-bold">Активно</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {weeklyQuests.length === 0 && (
                <p className="text-[10px] text-gray-500 text-center py-4">Нет активных заданий.</p>
              )}
            </div>
          </div>
        </div>

        {/* Виджет Лидерборда */}
        <div className={activeMobileTab === 'leaderboard' ? 'block' : 'hidden lg:block'}>
          <Leaderboard 
            users={leaderboardUsers} 
            currentUser={user} 
            onViewProfile={onViewProfile} 
          />
        </div>

        {/* Управление друзьями и социальная панель */}
        <div className={`${activeMobileTab === 'friends' ? 'block' : 'hidden lg:block'} bg-[#151c2c] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4`}>
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
              className="flex-1 bg-[#0b0f19] border border-gray-800 text-[10px] text-gray-100 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
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
