// routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminGuard = require('../middleware/adminGuard');
const { protect } = require('../middleware/auth');

// Middleware
router.use(protect);
router.use(adminGuard);

// === ПОЛЬЗОВАТЕЛИ ===
router.get('/users', adminController.getAllUsers);

// === СТАТИСТИКА ===
router.get('/stats', adminController.getStats);

// === ЗАКАЗЫ ===
router.get('/orders', adminController.getAllOrders);           // Список заказов
router.get('/orders/:id', adminController.getOrderDetails);    // Детали заказа
router.put('/orders/:id/status', adminController.updateOrderStatus); 

// === ОПЕРАТИВНАЯ ПАМЯТЬ (RAM) ===
router.get('/ram', adminController.getAllRam);           // Получить список
router.post('/ram', adminController.createRam);          // Создать
router.put('/ram/:id', adminController.updateRam);       // Обновить
router.delete('/ram/:id', adminController.deleteRam);    // Удалить

// === ВНУТРЕННЯЯ ПАМЯТЬ (STORAGE) ===
router.get('/storage', adminController.getAllStorage);        // Получить список
router.post('/storage', adminController.createStorage);       // Создать
router.put('/storage/:id', adminController.updateStorage);    // Обновить
router.delete('/storage/:id', adminController.deleteStorage); // Удалить

// === ЦВЕТА (COLORS) ===
router.get('/colors', adminController.getAllColors);        // Получить список
router.post('/colors', adminController.createColor);        // Создать
router.put('/colors/:id', adminController.updateColor);     // Обновить
router.delete('/colors/:id', adminController.deleteColor);  // Удалить

// === БРЕНДЫ (BRANDS) ===
router.get('/brands', adminController.getAllBrands);        // Получить список
router.post('/brands', adminController.createBrand);        // Создать
router.put('/brands/:id', adminController.updateBrand);     // Обновить
router.delete('/brands/:id', adminController.deleteBrand);  // Удалить

// === ТОВАРЫ (PRODUCTS) ===
router.get('/products', adminController.getAdminProducts);           // Список товаров
router.get('/products/:id', adminController.getAdminProductById);    // Детали товара
router.post('/products', adminController.createProduct);             // Создание
router.put('/products/:id', adminController.updateProduct);          // Обновление
router.delete('/products/:id', adminController.deleteProduct);       // Удаление

module.exports = router;