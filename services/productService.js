// services/productService.js
const supabase = require('../config/supabase');

//  КЭШИРОВАНИЕ 
let productsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; 

let variantCache = {};
let reviewsCache = {};
let filterCache = null;

function isCacheValid() {
    return productsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL);
}

function getBadgeText(badgeType) {
    const badges = { new: 'НОВИНКА', sale: 'СКИДКА', hit: 'ХИТ' };
    return badges[badgeType] || null;
}

//  ФИЛЬТРАЦИЯ ТОВАРОВ 
exports.getFilteredProducts = async ({
    brand, ram, storage, color, minPrice, maxPrice, search,
    page = 1, limit = 20, sortBy = 'price', sortOrder = 'desc'
} = {}) => {
    const offset = (Number(page) - 1) * Number(limit);
    const safeLimit = Math.min(Number(limit), 100);

    let query = supabase
        .from('products_variants')
        .select(`
            id_variant, price, old_price, image_url, badge_type,
            colors!inner(id_color, name),
            product_ram!inner(id_ram, size_gb),
            product_storage!inner(id_storage, size_gb),
            products!inner(
                id_product, name, description, specs,
                brands!inner(id_brand, name)
            )
        `, { count: 'exact' });

    //  ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ВАЛИДАЦИИ 
    const parseIds = (value) => {
        if (!value) return [];
        const arr = Array.isArray(value) ? value : [value];
        return arr
            .map(id => {
                const num = Number(id);
                return isNaN(num) || num <= 0 ? null : num;
            })
            .filter(id => id !== null);
    };

    //  ФИЛЬТРЫ С ПРОВЕРКОЙ НА NaN 
    
    // Бренд
    const brandIds = parseIds(brand);
    if (brandIds.length > 0) {
        query = query.in('products.brands.id_brand', brandIds);
    }
    
    // RAM
    const ramIds = parseIds(ram);
    if (ramIds.length > 0) {
        query = query.in('product_ram.id_ram', ramIds);
    }
    
    // Storage
    const storageIds = parseIds(storage);
    if (storageIds.length > 0) {
        query = query.in('product_storage.id_storage', storageIds);
    }
    
    // Цвет
    const colorIds = parseIds(color);
    if (colorIds.length > 0) {
        query = query.in('colors.id_color', colorIds);
    }
    
    // Цена (проверка на валидность)
    if (minPrice && !isNaN(Number(minPrice))) {
        query = query.gte('price', Number(minPrice));
    }
    if (maxPrice && !isNaN(Number(maxPrice))) {
        query = query.lte('price', Number(maxPrice));
    }

    // === СОРТИРОВКА ===
    const validSortFields = ['price', 'name'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'price';
    const ascending = sortOrder === 'asc';
    
    if (sortField === 'name') {
        query = query.order('products.name', { ascending });
    } else {
        query = query.order('price', { ascending });
    }

    // === ПАГИНАЦИЯ ===
    const { data, error, count } = await query.range(offset, offset + safeLimit - 1);

    if (error) {
        console.error('Supabase error:', error);
        throw new Error(`DB Filter Error: ${error.message}`);
    }

    // === ФОРМАТИРОВАНИЕ ===
    const formatted = (data || []).map(v => ({
        id: v.id_variant,
        productId: v.products.id_product,
        name: v.products.name,
        brand: `${v.products.brands?.name || 'Бренд'} · ${v.product_ram?.size_gb || 0}GB · ${v.product_storage?.size_gb || 0}GB`,
        color: v.colors?.name || 'Не указан',
        price: v.price,
        oldPrice: v.old_price,
        image: v.image_url,
        badge: v.badge_type,
        badgeText: getBadgeText(v.badge_type),
        description: v.products.description,
        specs: v.products.specs,
        ram: v.product_ram?.size_gb,
        storage: v.product_storage?.size_gb
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / safeLimit);

    return {
        products: formatted,
        total,
        page: Number(page),
        limit: safeLimit,
        totalPages
    };
};

//  СПИСОК ТОВАРОВ (старый метод) 
exports.getAll = async () => {
    if (isCacheValid()) {
        return productsCache;
    }

    const { data: products, error } = await supabase
        .from('products')
        .select(`
            id_product,
            name,
            description,
            specs,
            brands!inner(id_brand, name),
            products_variants(
                id_variant,
                price,
                old_price,
                image_url,
                badge_type,
                colors!inner(id_color, name),
                product_ram!inner(id_ram, size_gb),
                product_storage!inner(id_storage, size_gb)
            )
        `);

    if (error) throw new Error('Ошибка базы данных');

    const formattedProducts = [];
    products.forEach(product => {
        if (!product.products_variants || product.products_variants.length === 0) return;
        product.products_variants.forEach(variant => {
            formattedProducts.push({
                id: variant.id_variant,
                productId: product.id_product,
                name: product.name,
                brand: `${product.brands?.name || 'Бренд'} · ${variant.product_ram?.size_gb || ''}GB · ${variant.product_storage?.size_gb || ''}GB`,
                color: variant.colors?.name,
                price: variant.price,
                oldPrice: variant.old_price,
                image: variant.image_url,
                badge: variant.badge_type,
                badgeText: getBadgeText(variant.badge_type),
                description: product.description,
                specs: product.specs,
                variantId: variant.id_variant,
                ram: variant.product_ram?.size_gb,
                storage: variant.product_storage?.size_gb
            });
        });
    });

    productsCache = formattedProducts;
    cacheTimestamp = Date.now();
    return formattedProducts;
};

//  ОДИН ТОВАР ПО ID ПРОДУКТА 
exports.getById = async (productId) => {
    const { data, error } = await supabase
        .from('products')
        .select(`
            id_product,
            name,
            description,
            specs,
            brands!inner(id_brand, name),
            products_variants(
                id_variant,
                price,
                old_price,
                image_url,
                badge_type,
                colors!inner(name),
                product_ram!inner(size_gb),
                product_storage!inner(size_gb)
            )
        `)
        .eq('id_product', productId)
        .single();

    if (error) throw error;
    if (!data) return null;

    return {
        id: data.id_product,
        name: data.name,
        description: data.description,
        specs: data.specs,
        brand: data.brands,
        variants: data.products_variants || []
    };
};

//  ОТЗЫВЫ С КЭШИРОВАНИЕМ 
exports.getReviewsByProductId = async (productId) => {
    const cached = reviewsCache[productId];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] Reviews for product ${productId} loaded from cache`);
        return cached.data;
    }

    console.log(`[CACHE MISS] Reviews for product ${productId} fetching from DB`);

    const { data, error } = await supabase
        .from('reviews')
        .select(`
            id_review,
            rating,
            comment,
            created_at,
            users(id_user, first_name, last_name)
        `)
        .eq('id_product', productId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reviews:', error);
        const emptyResult = {
            items: [],
            total: 0,
            average: 0,
            distribution: [
                { stars: 5, count: 0 },
                { stars: 4, count: 0 },
                { stars: 3, count: 0 },
                { stars: 2, count: 0 },
                { stars: 1, count: 0 }
            ]
        };
        reviewsCache[productId] = { data: emptyResult, timestamp: Date.now() };
        return emptyResult;
    }

    const formattedReviews = (data || []).map(review => ({
        user: {
            first_name: review.users?.first_name || 'Аноним',
            last_name: review.users?.last_name 
                ? review.users.last_name.charAt(0) + '.' 
                : ''
        },
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at
    }));

    const total = formattedReviews.length;
    const average = total > 0
        ? (formattedReviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1)
        : 0;

    const distribution = [5, 4, 3, 2, 1].map(stars => ({
        stars,
        count: formattedReviews.filter(r => r.rating === stars).length
    }));

    const result = {
        items: formattedReviews,
        total,
        average: Number(average),
        distribution
    };

    reviewsCache[productId] = {
        data: result,
        timestamp: Date.now()
    };

    return result;
};

//  ТОВАР ПО ID ВАРИАНТА 
exports.getByIdVariant = async (variantId) => {
    const cachedItem = variantCache[variantId];
    if (cachedItem && (Date.now() - cachedItem.timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] Variant ${variantId} loaded from cache`);
        return cachedItem.data;
    }

    console.log(`[CACHE MISS] Variant ${variantId} fetching from DB`);

    const { data: variant, error } = await supabase
        .from('products_variants')
        .select(`
            id_variant,
            price,
            old_price,
            image_url,
            badge_type,
            id_product,
            colors!inner(id_color, name),
            product_ram!inner(id_ram, size_gb),
            product_storage!inner(id_storage, size_gb),
            products!inner(
                id_product,
                name,
                description,
                specs,
                brands(id_brand, name)
            )
        `)
        .eq('id_variant', variantId)
        .single();

    if (error) {
        throw new Error('Ошибка при получении товара');
    }

    if (!variant) return null;

    const product = variant.products;
    const brand = product.brands;
    const reviews = await exports.getReviewsByProductId(product.id_product);

    const result = {
        id: variant.id_variant,
        productId: product.id_product,
        brand: {
            id: brand.id_brand,
            name: brand.name
        },
        name: product.name,
        description: product.description,
        specs: product.specs || {},
        variant: {
            id: variant.id_variant,
            color: { name: variant.colors?.name || 'Не указан' },
            storage: { size_gb: variant.product_storage?.size_gb || 0 },
            ram: { size_gb: variant.product_ram?.size_gb || 0 },
            price: variant.price,
            old_price: variant.old_price,
            image_url: variant.image_url,
            badge_type: variant.badge_type
        },
        reviews: reviews
    };

    variantCache[variantId] = {
        data: result,
        timestamp: Date.now()
    };

    return result;
};

//  ПОЛУЧИТЬ СПИСОК ФИЛЬТРОВ 
exports.getFilterOptions = async () => {
    if (filterCache) {
        return filterCache;
    }

    try {
        const { data: brands, error: brandsError } = await supabase
            .from('brands')
            .select('id_brand, name')
            .order('name', { ascending: true });

        const { data: ram, error: ramError } = await supabase
            .from('product_ram')
            .select('id_ram, size_gb')
            .order('size_gb', { ascending: true });

        const { data: storage, error: storageError } = await supabase
            .from('product_storage')
            .select('id_storage, size_gb')
            .order('size_gb', { ascending: true });

        const { data: colors, error: colorsError } = await supabase
            .from('colors')
            .select('id_color, name')
            .order('name', { ascending: true });

        filterCache = {
            brands: brands || [],
            ram: ram || [],
            storage: storage || [],
            colors: colors || []
        };

        return filterCache;

    } catch (error) {
        console.error('Ошибка получения опций фильтров:', error);
        return { brands: [], ram: [], storage: [], colors: [] };
    }
};

//  ОЧИСТКА ВСЕХ КЭШЕЙ 
exports.clearCache = () => {
    productsCache = null;
    cacheTimestamp = null;
    variantCache = {};
    reviewsCache = {};
    filterCache = null;
    console.log('[CACHE] All caches cleared');
};

//  ВАРИАНТЫ ТОВАРА 
exports.getVariantsByProductId = async (productId) => {
    const { data, error } = await supabase
        .from('products_variants')
        .select(`
            id_variant,
            price,
            old_price,
            image_url,
            badge_type,
            colors(name),
            product_ram(size_gb),
            product_storage(size_gb)
        `)
        .eq('id_product', productId);

    if (error) {
        throw new Error('Ошибка при получении вариантов');
    }

    return data || [];
};

//  ТОП ТОВАРОВ 
exports.getMostExpensive = async (limit = 3) => {
    const allProducts = await exports.getAll();
    return allProducts
        .sort((a, b) => b.price - a.price)
        .slice(0, limit);
};

exports.canReviewProduct = async (userId, productId) => {
    console.log('[DEBUG] canReviewProduct - userId:', userId, 'productId:', productId);

    const {  data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id_order')
        .eq('id_user', userId)
        .eq('status', 'delivered');

    if (orderError) {
        console.error('[DEBUG] Error fetching orders:', orderError);
        throw orderError;
    }

    console.log('[DEBUG] Orders:', orders);

    if (!orders || orders.length === 0) {
        return { allowed: false, reason: 'Отзыв доступен только после получения заказа' };
    }

    const orderIds = orders.map(o => o.id_order);
    const {  data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id_variant')
        .in('id_order', orderIds);

    if (itemsError) {
        console.error('[DEBUG] Error fetching order_items:', itemsError);
        throw itemsError;
    }

    console.log('[DEBUG] Order items:', items);

    if (!items || items.length === 0) {
        return { allowed: false, reason: 'Отзыв доступен только после получения заказа' };
    }

    const variantIds = items.map(item => item.id_variant);

    const {  data: variants, error: variantsError } = await supabase
        .from('products_variants')
        .select('id_product')
        .in('id_variant', variantIds)
        .eq('id_product', productId);

    if (variantsError) {
        console.error('[DEBUG] Error fetching variants:', variantsError);
        throw variantsError;
    }

    console.log('[DEBUG] Variants:', variants);

    const hasPurchased = variants && variants.length > 0;

    if (!hasPurchased) {
        return { allowed: false, reason: 'Отзыв доступен только после получения заказа' };
    }

    const {  data: existing, error: reviewError } = await supabase
        .from('reviews')
        .select('id_review')
        .eq('id_product', productId)
        .eq('id_user', userId)
        .single();

    if (reviewError && reviewError.code !== 'PGRST116') {
        console.error('[DEBUG] Error checking existing review:', reviewError);
        throw reviewError;
    }
    
    if (existing) {
        return { allowed: false, reason: 'Вы уже оставляли отзыв на этот товар' };
    }

    console.log('[DEBUG] User can review product!');
    return { allowed: true };
};
exports.createProductReview = async (userId, productId, rating, comment) => {
    if (!rating || rating < 1 || rating > 5) throw new Error('Рейтинг должен быть от 1 до 5');
    if (!comment || comment.trim().length < 10) throw new Error('Отзыв должен содержать минимум 10 символов');

    const {  data: existing } = await supabase
        .from('reviews')
        .select('id_review')
        .eq('id_product', productId)
        .eq('id_user', userId)
        .single();

    if (existing) throw new Error('Вы уже оставляли отзыв на этот товар');

    const { data, error } = await supabase
        .from('reviews')
        .insert({
            id_product: productId,
            id_user: userId,
            rating,
            comment: comment.trim(),
            created_at: new Date().toISOString()
        });

    if (error) throw error;

    delete reviewsCache[productId];
    console.log(`[CACHE] Reviews cache cleared for product ${productId}`);

    return { message: 'Отзыв успешно опубликован' };
};