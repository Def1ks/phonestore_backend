// routes/orders.js
const express = require('express');
const router = express.Router();

// Импортируем контроллеры
const orderController = require('../controllers/orderController'); // Для истории заказов
const checkoutController = require('../controllers/checkoutController'); // Для оформления

const { protect } = require('../middleware/auth');

// Все роуты защищены (требуется авторизация)
router.use(protect);

// Получить пункты выдачи
router.get('/pickup-points', checkoutController.getPickupPoints);

// Оформить заказ
router.post('/', checkoutController.createOrder);

// Получить все заказы пользователя
router.get('/', orderController.getUserOrders);

// Получить конкретный заказ по ID
router.get('/:id', orderController.getOrderById);

// Очистить кэш заказов (для тестов)
router.get('/clear-cache', orderController.clearCache);

module.exports = router;