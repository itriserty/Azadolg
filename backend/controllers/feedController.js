const Post = require('../models/Post');

async function getFeed(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate('author', 'name username avatar activeProfileFrame activeProfileSkin role')
      .populate('targetUser', 'name username avatar activeProfileFrame activeProfileSkin role')
      .populate('comments.author', 'name username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json(posts);
  } catch (error) {
    console.error('[getFeed] Ошибка получения ленты:', error);
    res.status(500).json({ error: 'Ошибка сервера при получении ленты' });
  }
}

module.exports = { getFeed };
