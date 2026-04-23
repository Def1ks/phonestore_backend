const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Публичные
router.post('/register', authController.register);
router.post('/login', authController.login);

// Для админов 
router.post('/admin/login', authController.adminLogin);

// Защищённые
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, authController.updateProfile);
router.put('/password', protect, authController.changePassword);

module.exports = router;