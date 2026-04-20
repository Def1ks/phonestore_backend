const express = require('express');
const router = express.Router();
const shopReviewController = require('../controllers/shopReviewController');
const { protect } = require('../middleware/auth'); 

router.get('/', shopReviewController.getAllShopReviews);
router.get('/clear-cache', shopReviewController.clearCache);

router.get('/eligibility', protect, shopReviewController.checkEligibility);
router.post('/', protect, shopReviewController.createReview);

module.exports = router;