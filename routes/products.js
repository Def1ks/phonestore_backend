const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productService = require('../services/productService');

// СТАТИЧЕСКИЕ / ТОЧНЫЕ РОУТЫ 
router.get('/', productController.getAll);
router.get('/clear-cache', (req, res) => {
    productService.clearCache();
    res.json({ message: 'Cache cleared successfully' });
});
router.get('/filters', productController.getFilterOptions);

// СПЕЦИФИЧНЫЕ ДИНАМИЧЕСКИЕ РОУТЫ
router.get('/variant/:id', productController.getByVariantId);
router.get('/:id/reviews', productController.getReviews);
router.get('/hits', productController.getMostExpensive);

// ОБЩИЙ ДИНАМИЧЕСКИЙ РОУТ
router.get('/:id', productController.getById);

module.exports = router;