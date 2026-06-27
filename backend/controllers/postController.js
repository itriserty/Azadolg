const Post = require('../models/Post');
const User = require('../models/User');

// GET /api/posts - Получить все посты ленты
async function getPosts(req, res) {
  try {
    const posts = await Post.find()
      .populate('author', 'name username avatar activeProfileFrame activeProfileSkin')
      .populate('comments.author', 'name username avatar')
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    console.error('Ошибка получения постов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// POST /api/posts - Создать новый пост
async function createPost(req, res) {
  try {
    const { content } = req.body;
    const authorId = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Содержимое поста не может быть пустым' });
    }

    const post = new Post({
      author: authorId,
      content: content.trim()
    });
    await post.save();

    const populated = await Post.findById(post._id)
      .populate('author', 'name username avatar activeProfileFrame activeProfileSkin');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Ошибка создания поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// POST /api/posts/:id/like - Поставить/убрать лайк
async function likePost(req, res) {
  try {
    const postId = req.params.id;
    const userId = req.user;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const index = post.likes.indexOf(userId);
    if (index === -1) {
      post.likes.push(userId); // Ставим лайк
    } else {
      post.likes.splice(index, 1); // Убираем лайк
    }
    await post.save();

    res.status(200).json({ likesCount: post.likes.length, liked: index === -1 });
  } catch (error) {
    console.error('Ошибка лайка:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// POST /api/posts/:id/comment - Оставить комментарий
async function commentPost(req, res) {
  try {
    const postId = req.params.id;
    const userId = req.user;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Текст комментария не может быть пустым' });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const newComment = {
      author: userId,
      content: content.trim(),
      createdAt: new Date()
    };
    post.comments.push(newComment);
    await post.save();

    const updated = await Post.findById(postId)
      .populate('comments.author', 'name username avatar');

    res.status(201).json(updated.comments[updated.comments.length - 1]);
  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// DELETE /api/posts/:id - Удалить пост
async function deletePost(req, res) {
  try {
    const postId = req.params.id;
    const userId = req.user;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Пост не найден' });

    const user = await User.findById(userId);
    const isAuthor = post.author.toString() === userId.toString();
    const isAdmin = user && user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'У вас нет прав для удаления этого поста' });
    }

    await Post.findByIdAndDelete(postId);
    res.status(200).json({ message: 'Пост успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления поста:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getPosts,
  createPost,
  likePost,
  commentPost,
  deletePost
};
