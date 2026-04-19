// controllers/orderController.js
const orderService = require('../services/orderService');

//  ПОЛУЧИТЬ ВСЕ ЗАКАЗЫ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ 
exports.getUserOrders = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await orderService.getUserOrders(userId);
        res.json(result);
    } catch (error) {
        console.error('Error in orderController.getUserOrders:', error);
        res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
};

//  ПОЛУЧИТЬ КОНКРЕТНЫЙ ЗАКАЗ 
exports.getOrderById = async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const userId = req.user.id;

        const order = await orderService.getOrderById(orderId, userId);

        if (!order) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json({ order });
    } catch (error) {
        console.error('Error in orderController.getOrderById:', error);
        res.status(500).json({ error: 'Ошибка при получении заказа' });
    }
};

//  ОЧИСТИТЬ КЭШ ЗАКАЗОВ 
exports.clearCache = (req, res) => {
    const userId = req.user.id;
    orderService.clearOrdersCache(userId);
    res.json({ message: 'Кэш заказов очищен' });
};