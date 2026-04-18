const express = require('express');
const router = express.Router();
const shopReviewController = require('../controllers/shopReviewController');

router.get('/', shopReviewController.getAllShopReviews);

router.get('/clear-cache', shopReviewController.clearCache);

module.exports = router;