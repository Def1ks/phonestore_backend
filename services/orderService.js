const supabase = require('../config/supabase');

//  КЭШИРОВАНИЕ 
let ordersCache = {};
let cacheTimestamp = {};
const ORDERS_CACHE_TTL = 2 * 60 * 1000; 

function isOrdersCacheValid(userId) {
    return ordersCache[userId] && 
           cacheTimestamp[userId] && 
           (Date.now() - cacheTimestamp[userId] < ORDERS_CACHE_TTL);
}

//  ПОЛУЧИТЬ ВСЕ ЗАКАЗЫ ПОЛЬЗОВАТЕЛЯ 
exports.getUserOrders = async (userId) => {
    try {
        if (isOrdersCacheValid(userId)) {
            console.log(`[ORDERS CACHE HIT] User ${userId}`);
            return ordersCache[userId];
        }
        console.log(`[ORDERS CACHE MISS] User ${userId} - fetching from DB`);

        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .eq('id_user', userId)
            .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        if (!orders || orders.length === 0) {
            const emptyResult = {
                orders: [],
                stats: { total_orders: 0, total_sum: 0 }
            };
            ordersCache[userId] = emptyResult;
            cacheTimestamp[userId] = Date.now();
            return emptyResult;
        }

        const ordersWithDetails = await Promise.all(
            orders.map(async (order) => {
                const { data: items, error: itemsError } = await supabase
                    .from('order_items')
                    .select(`
                        id_variant,
                        quantity,
                        price_at_buy,
                        products_variants (
                            id_product,
                            products (name),
                            colors (name),
                            product_ram (size_gb),
                            product_storage (size_gb)
                        )
                    `)
                    .eq('id_order', order.id_order);

                if (itemsError) throw itemsError;

                const formattedItems = (items || []).map(item => ({
                    id_variant: item.id_variant,
                    name: item.products_variants?.products?.name || 'Товар',
                    color: item.products_variants?.colors?.name || '',
                    ram: item.products_variants?.product_ram?.size_gb || 0,
                    storage: item.products_variants?.product_storage?.size_gb || 0,
                    quantity: item.quantity,
                    price: item.price_at_buy
                }));

                let deliveryInfo = null;
                if (order.delivery_type === 'delivery') {
                    const { data: delivery, error: deliveryError } = await supabase
                        .from('order_delivery')
                        .select('city, street, house, apartment, postal_code')
                        .eq('id_order', order.id_order)
                        .single();
                    if (deliveryError && deliveryError.code !== 'PGRST116') throw deliveryError;
                    deliveryInfo = delivery;
                } else if (order.delivery_type === 'pickup') {
                    const { data: delivery, error: deliveryError } = await supabase
                        .from('order_delivery')
                        .select(`
                            id_pickup_point,
                            pickup_points (name, address, work_hours)
                        `)
                        .eq('id_order', order.id_order)
                        .single();
                    if (deliveryError && deliveryError.code !== 'PGRST116') throw deliveryError;
                    deliveryInfo = delivery;
                }

                return {
                    id_order: order.id_order,
                    status: order.status,
                    phone: order.phone,
                    email: order.email,
                    payment_type: order.payment_type,
                    delivery_type: order.delivery_type,
                    total_amount: order.total_amount,
                    created_at: order.created_at,
                    updated_at: order.updated_at,
                    items: formattedItems,
                    delivery: deliveryInfo
                };
            })
        );

        // Статистика
        const totalOrders = ordersWithDetails.length;
        const totalSum = ordersWithDetails.reduce((sum, order) => sum + order.total_amount, 0);

        const result = {
            orders: ordersWithDetails,
            stats: { total_orders: totalOrders, total_sum: totalSum }
        };

        ordersCache[userId] = result;
        cacheTimestamp[userId] = Date.now();

        return result;
    } catch (error) {
        console.error('Error in getUserOrders:', error);
        throw error;
    }
};

//  ПОЛУЧИТЬ КОНКРЕТНЫЙ ЗАКАЗ 
exports.getOrderById = async (orderId, userId) => {
    try {
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id_order', orderId)
            .eq('id_user', userId)
            .single();

        if (orderError) throw orderError;
        if (!order) return null;

        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select(`
                id_variant, quantity, price_at_buy,
                products_variants (
                    id_product, products(name), colors(name),
                    product_ram(size_gb), product_storage(size_gb)
                )
            `)
            .eq('id_order', orderId);

        if (itemsError) throw itemsError;

        const formattedItems = (items || []).map(item => ({
            id_variant: item.id_variant,
            name: item.products_variants?.products?.name || 'Товар',
            color: item.products_variants?.colors?.name || '',
            ram: item.products_variants?.product_ram?.size_gb || 0,
            storage: item.products_variants?.product_storage?.size_gb || 0,
            quantity: item.quantity,
            price: item.price_at_buy
        }));

        let deliveryInfo = null;
        if (order.delivery_type === 'delivery') {
            const { data: delivery } = await supabase
                .from('order_delivery')
                .select('city, street, house, apartment, postal_code')
                .eq('id_order', orderId)
                .single();
            deliveryInfo = delivery;
        } else if (order.delivery_type === 'pickup') {
            const { data: delivery } = await supabase
                .from('order_delivery')
                .select(`id_pickup_point, pickup_points(name, address, work_hours)`)
                .eq('id_order', orderId)
                .single();
            deliveryInfo = delivery;
        }

        return {
            id_order: order.id_order,
            status: order.status,
            phone: order.phone,
            email: order.email,
            payment_type: order.payment_type,
            delivery_type: order.delivery_type,
            total_amount: order.total_amount,
            created_at: order.created_at,
            updated_at: order.updated_at,
            items: formattedItems,
            delivery: deliveryInfo
        };
    } catch (error) {
        console.error('Error in getOrderById:', error);
        throw error;
    }
};

//  ОЧИСТКА КЭША 
exports.clearOrdersCache = (userId) => {
    if (userId) {
        delete ordersCache[userId];
        delete cacheTimestamp[userId];
        console.log(`[ORDERS CACHE] Cleared for user ${userId}`);
    } else {
        ordersCache = {};
        cacheTimestamp = {};
        console.log('[ORDERS CACHE] All caches cleared');
    }
};