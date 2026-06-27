const express = require('express');
const router = express.Router();
const { getPosts, createPost, likePost, commentPost, deletePost } = require('../controllers/postController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', getPosts);
router.post('/', createPost);
router.post('/:id/like', likePost);
router.post('/:id/comment', commentPost);
router.delete('/:id', deletePost);

module.exports = router;
