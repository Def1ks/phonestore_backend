const shopReviewService = require('../services/shopReviewService');

exports.getAllShopReviews = async (req, res) => {
    try {
        const data = await shopReviewService.getAllShopReviews();
        res.json(data);
    } catch (error) {
        console.error('Error in getAllShopReviews:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.clearCache = async (req, res) => {
    try {
        shopReviewService.clearCache();
        res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.checkEligibility = async (req, res) => {
    try {
        const result = await shopReviewService.canReviewShop(req.user.id);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error checking shop review eligibility:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.createReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const result = await shopReviewService.createShopReview(req.user.id, rating, comment);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Error creating shop review:', error);
        res.status(400).json({ success: false, error: error.message });
    }
};