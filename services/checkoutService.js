// services/checkoutService.js
const supabase = require('../config/supabase');
const cartService = require('./cartService'); 
const orderService = require('./orderService');

//  ПОЛУЧИТЬ ПУНКТЫ ВЫДАЧИ 
exports.getPickupPoints = async () => {
    try {
        const { data, error } = await supabase
            .from('pickup_points')
            .select('id_pickup_point, name, address, work_hours')
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []).map(point => ({
            id: point.id_pickup_point,
            name: point.name,
            address: point.address,
            workHours: point.work_hours
        }));
    } catch (error) {
        console.error('Error in getPickupPoints:', error);
        throw error;
    }
};

//  СОЗДАТЬ ЗАКАЗ 
exports.createOrder = async (userId, orderData) => {
    const { 
        items, 
        deliveryType, 
        paymentType, 
        phone, 
        email,
        pickupPointId,
        deliveryAddress 
    } = orderData;

    try {
        const totalAmount = items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        const { data: order, error: orderError } = await supabase  
            .from('orders')
            .insert({
                id_user: userId,
                status: 'pending',
                phone,
                email,
                payment_type: paymentType,
                delivery_type: deliveryType,
                total_amount: totalAmount,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('id_order')
            .single();

        if (orderError) throw orderError;

        const orderItems = items.map(item => ({
            id_order: order.id_order,
            id_variant: item.variantId,
            quantity: item.quantity,
            price_at_buy: item.price
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);

        if (itemsError) throw itemsError;

        if (deliveryType === 'pickup' && pickupPointId) {
            const { error: deliveryError } = await supabase
                .from('order_delivery')
                .insert({
                    id_order: order.id_order,
                    id_pickup_point: pickupPointId,
                    city: null,
                    street: null,
                    house: null,
                    apartment: null,
                    postal_code: null
                });

            if (deliveryError) throw deliveryError;
        } else if (deliveryType === 'delivery' && deliveryAddress) {
            const { error: deliveryError } = await supabase
                .from('order_delivery')
                .insert({
                    id_order: order.id_order,
                    id_pickup_point: null,
                    city: deliveryAddress.city,
                    street: deliveryAddress.street,
                    house: deliveryAddress.house,
                    apartment: deliveryAddress.apartment || null,
                    postal_code: deliveryAddress.postalCode || null
                });

            if (deliveryError) throw deliveryError;
        }

        await supabase
            .from('cart')
            .delete()
            .eq('id_user', userId);

        cartService.clearCartCache(userId);

        orderService.clearOrdersCache(userId);

        return {
            orderId: order.id_order,
            totalAmount,
            itemsCount: items.length
        };
    } catch (error) {
        console.error('Error in createOrder:', error);
        throw error;
    }
};

