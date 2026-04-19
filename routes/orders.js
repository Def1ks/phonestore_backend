// routes/orders.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/auth');

// Все роуты защищены
router.use(protect);

// Получить все заказы текущего пользователя
router.get('/', orderController.getUserOrders);

// Получить конкретный заказ по ID
router.get('/:id', orderController.getOrderById);

// Очистить кэш заказов
router.get('/clear-cache', orderController.clearCache);

module.exports = router;