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