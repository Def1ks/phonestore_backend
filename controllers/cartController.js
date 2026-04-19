const cartService = require('../services/cartService');

exports.getCart = async (req, res) => {
    try {
        const items = await cartService.getCart(req.user.id);
        res.json({ success: true, items });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { variantId, quantity = 1 } = req.body;
        if (!variantId) return res.status(400).json({ success: false, message: 'variantId обязателен' });
        const items = await cartService.addToCart(req.user.id, variantId, quantity);
        res.json({ success: true, message: 'Товар добавлен', items });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateQuantity = async (req, res) => {
    try {
        const { itemId, delta } = req.body; 
        if (!itemId || delta === undefined) return res.status(400).json({ success: false, message: 'Неверные данные' });
        const items = await cartService.updateQuantity(req.user.id, itemId, delta);
        res.json({ success: true, message: 'Количество обновлено', items });
    } catch (error) {
        console.error('Update quantity error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeItem = async (req, res) => {
    try {
        const { itemId } = req.body; 
        if (!itemId) return res.status(400).json({ success: false, message: 'Неверные данные' });
        const items = await cartService.removeItem(req.user.id, itemId);
        res.json({ success: true, message: 'Товар удалён', items });
    } catch (error) {
        console.error('Remove item error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.clearCart = async (req, res) => {
    try {
        await cartService.clearCart(req.user.id);
        res.json({ success: true, message: 'Корзина очищена' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};