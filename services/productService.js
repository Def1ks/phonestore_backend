// services/productService.js
const supabase = require('../config/supabase');

// ================= КЭШИРОВАНИЕ =================
let productsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

let variantCache = {};
let reviewsCache = {}; // ← Новый кэш для отзывов

function isCacheValid() {
    return productsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL);
}

// ================= СПИСОК ТОВАРОВ =================
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

function getBadgeText(badgeType) {
    const badges = { new: 'НОВИНКА', sale: 'СКИДКА', hit: 'ХИТ' };
    return badges[badgeType] || null;
}

// ================= ОДИН ТОВАР ПО ID ПРОДУКТА =================
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

// ================= ОТЗЫВЫ С КЭШИРОВАНИЕМ =================
/**
 * Получить отзывы для конкретного товара (с кэшированием)
 */
exports.getReviewsByProductId = async (productId) => {
    // 1. Проверяем кэш
    const cached = reviewsCache[productId];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`[CACHE HIT] Reviews for product ${productId} loaded from cache`);
        return cached.data;
    }

    console.log(`[CACHE MISS] Reviews for product ${productId} fetching from DB`);

    // 2. Запрос к БД
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
        // Кэшируем и пустой результат, чтобы не спамить БД ошибками
        reviewsCache[productId] = { data: emptyResult, timestamp: Date.now() };
        return emptyResult;
    }

    // 3. Форматируем под фронтенд
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

    // 4. Считаем статистику
    const total = formattedReviews.length;
    const average = total > 0
        ? (formattedReviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1)
        : 0;

    // 5. Распределение по звёздам
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

    // 6. Сохраняем в кэш
    reviewsCache[productId] = {
        data: result,
        timestamp: Date.now()
    };

    return result;
};

// ================= ТОВАР ПО ID ВАРИАНТА =================
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

    // Получаем отзывы (с кэшированием внутри функции)
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

// ================= ОЧИСТКА ВСЕХ КЭШЕЙ =================
exports.clearCache = () => {
    productsCache = null;
    cacheTimestamp = null;
    variantCache = {};
    reviewsCache = {}; // ← Очистка кэша отзывов
    console.log('[CACHE] All caches cleared');
};

// ================= ВАРИАНТЫ ТОВАРА =================
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

/**
 * Получить N самых дорогих товаров
 */
exports.getMostExpensive = async (limit = 3) => {
    // Сначала получаем все товары (можно оптимизировать запрос)
    const allProducts = await exports.getAll();
    
    // Сортируем по цене и берём топ
    return allProducts
        .sort((a, b) => b.price - a.price)
        .slice(0, limit);
};