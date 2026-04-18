// routes/products.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productService = require('../services/productService');

//Статические/точные роуты (самые конкретные)
router.get('/', productController.getAll);
//GET http://localhost:3000/api/products/clear-cache 
router.get('/clear-cache', (req, res) => {
  productService.clearCache();
  res.json({ message: 'Cache cleared successfully' });
});

//Специфичные динамические роуты
router.get('/variant/:id', productController.getByVariantId);  
router.get('/:id/reviews', productController.getReviews);      

//Общий динамический роут 
router.get('/:id', productController.getById);                 

module.exports = router;