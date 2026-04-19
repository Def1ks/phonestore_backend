const supabase = require('../config/supabase');

let cartCache = {};
let cartCacheTimestamp = {};
const CART_CACHE_TTL = 1 * 60 * 1000; 

function isCartCacheValid(userId) {
    return cartCache[userId] && 
           cartCacheTimestamp[userId] && 
           (Date.now() - cartCacheTimestamp[userId] < CART_CACHE_TTL);
}

function formatCartItem(cartRow, variantData) {
    return {
        id: cartRow.id_variant,
        variantId: cartRow.id_variant,
        brand: variantData?.products?.brands?.name || 'Бренд',
        name: variantData?.products?.name || 'Товар',
        price: variantData?.price || 0,
        oldPrice: variantData?.old_price,
        image: variantData?.image_url || '',
        quantity: cartRow.quantity,
        color: variantData?.colors?.name || '',
        ram: variantData?.product_ram?.size_gb || 0,
        storage: variantData?.product_storage?.size_gb || 0
    };
}

exports.getCart = async (userId) => {
    try {
        if (isCartCacheValid(userId)) {
            console.log(`[CART CACHE HIT] User ${userId}`);
            return cartCache[userId];
        }
        console.log(`[CART CACHE MISS] User ${userId} - fetching from DB`);

        const { data: cartRows, error: cartError } = await supabase
            .from('cart')
            .select('id_variant, quantity, added_at')
            .eq('id_user', userId)
            .order('added_at', { ascending: false });

        if (cartError) throw cartError;
        if (!cartRows || cartRows.length === 0) {
            const emptyResult = [];
            cartCache[userId] = emptyResult;
            cartCacheTimestamp[userId] = Date.now();
            return emptyResult;
        }

        const variantIds = cartRows.map(c => c.id_variant);
        const { data: variants, error: varError } = await supabase
            .from('products_variants')
            .select(`
                id_variant, price, old_price, image_url,
                products!inner(name, brands!inner(name)),
                colors!inner(name),
                product_ram!inner(size_gb),
                product_storage!inner(size_gb)
            `)
            .in('id_variant', variantIds);

        if (varError) throw varError;

        const variantMap = new Map(variants?.map(v => [v.id_variant, v]) || []);
        
        const result = cartRows.map(row => {
            const v = variantMap.get(row.id_variant);
            return v ? formatCartItem(row, v) : null;
        }).filter(Boolean);

        cartCache[userId] = result;
        cartCacheTimestamp[userId] = Date.now();

        return result;
    } catch (error) {
        console.error('Error in getCart:', error);
        throw error;
    }
};

exports.addToCart = async (userId, variantId, quantity = 1) => {
    const { data: existing } = await supabase
        .from('cart')
        .select('quantity')
        .eq('id_user', userId)
        .eq('id_variant', variantId)
        .single();

    if (existing) {
        await supabase
            .from('cart')
            .update({ quantity: existing.quantity + quantity, added_at: new Date().toISOString() })
            .eq('id_user', userId)
            .eq('id_variant', variantId);
    } else {
        await supabase
            .from('cart')
            .insert({ id_user: userId, id_variant: variantId, quantity, added_at: new Date().toISOString() });
    }

    exports.clearCartCache(userId);

    return await this.getCart(userId);
};

exports.updateQuantity = async (userId, variantId, delta) => {
    const { data: existing, error: fetchError } = await supabase
        .from('cart')
        .select('quantity')
        .eq('id_user', userId)
        .eq('id_variant', variantId)
        .single();

    if (fetchError || !existing) throw new Error('Товар не найден в корзине');

    const newQuantity = existing.quantity + delta;
    if (newQuantity < 1) throw new Error('Минимальное количество: 1');

    await supabase
        .from('cart')
        .update({ quantity: newQuantity })
        .eq('id_user', userId)
        .eq('id_variant', variantId);

    exports.clearCartCache(userId);

    return await this.getCart(userId);
};

exports.removeItem = async (userId, variantId) => {
    await supabase
        .from('cart')
        .delete()
        .eq('id_user', userId)
        .eq('id_variant', variantId);

    exports.clearCartCache(userId);

    return await this.getCart(userId);
};

exports.clearCartCache = (userId) => {
    if (userId) {
        delete cartCache[userId];
        delete cartCacheTimestamp[userId];
        console.log(`[CART CACHE] Cleared for user ${userId}`);
    } else {
        cartCache = {};
        cartCacheTimestamp = {};
        console.log('[CART CACHE] All caches cleared');
    }
};