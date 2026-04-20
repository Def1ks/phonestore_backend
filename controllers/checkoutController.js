// controllers/checkoutController.js
const checkoutService = require('../services/checkoutService');

//  ПОЛУЧИТЬ ПУНКТЫ ВЫДАЧИ 
exports.getPickupPoints = async (req, res) => {
    try {
        const pickupPoints = await checkoutService.getPickupPoints();
        res.json({ 
            success: true, 
            pickupPoints 
        });
    } catch (error) {
        console.error('Error in getPickupPoints:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Не удалось загрузить пункты выдачи' 
        });
    }
};

//  ОФОРМИТЬ ЗАКАЗ 
exports.createOrder = async (req, res) => {
    try {
        const userId = req.user.id; 
        const { 
            items, 
            deliveryType, 
            paymentType, 
            phone, 
            email,
            pickupPointId,
            deliveryAddress 
        } = req.body;

        //  Валидация 
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Корзина пуста' });
        }
        if (!phone || !email) {
            return res.status(400).json({ success: false, message: 'Укажите телефон и email' });
        }
        if (!deliveryType || !paymentType) {
            return res.status(400).json({ success: false, message: 'Выберите способ доставки и оплаты' });
        }

        // Проверка данных доставки
        if (deliveryType === 'pickup' && !pickupPointId) {
            return res.status(400).json({ success: false, message: 'Выберите пункт выдачи' });
        }

        if (deliveryType === 'delivery') {
            if (!deliveryAddress || !deliveryAddress.city || !deliveryAddress.street || !deliveryAddress.house) {
                return res.status(400).json({ success: false, message: 'Заполните адрес доставки' });
            }
        }

        //  Выполнение 
        const result = await checkoutService.createOrder(userId, {
            items,
            deliveryType,
            paymentType,
            phone,
            email,
            pickupPointId,
            deliveryAddress
        });

        res.json({ 
            success: true, 
            message: 'Заказ успешно оформлен',
            orderId: result.orderId,
            totalAmount: result.totalAmount
        });
    } catch (error) {
        console.error('Error in createOrder:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Не удалось оформить заказ' 
        });
    }
};