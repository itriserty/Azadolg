const express = require('express');
const router = express.Router();
const { getUserProfile, registerUser, addFriend } = require('../controllers/userController');

// Получение профиля пользователя
router.get('/profile/:id', getUserProfile);

// Создание пользователя (регистрация)
router.post('/register', registerUser);

// Добавление в друзья
router.post('/add-friend', addFriend);

module.exports = router;
