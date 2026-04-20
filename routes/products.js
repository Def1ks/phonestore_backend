const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productService = require('../services/productService');
const { protect } = require('../middleware/auth'); 

router.get('/', productController.getAll);
router.get('/clear-cache', (req, res) => {
    productService.clearCache();
    res.json({ message: 'Cache cleared successfully' });
});
router.get('/filters', productController.getFilterOptions);
router.get('/hits', productController.getMostExpensive);

router.get('/:id/reviews/eligibility', protect, productController.checkProductReviewEligibility);
router.post('/:id/reviews', protect, productController.createProductReview);

router.get('/:id/reviews', productController.getReviews);

router.get('/variant/:id', productController.getByVariantId);

router.get('/:id', productController.getById);

module.exports = router;