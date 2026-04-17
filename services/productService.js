// services/productService.js
const supabase = require('../config/supabase');

// Кэширование
let productsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000;

function isCacheValid() {
    return productsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL);
}

/**
 * Получить все товары (каждый variant как отдельная карточка)
 */
exports.getAll = async () => {
    if (isCacheValid()) {
        return productsCache;
    }


    // Запрос: получаем товары со всеми вариантами
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

    if (error) {
        throw new Error('Ошибка базы данных');
    }

    // === ПРЕОБРАЗУЕМ: каждый variant → отдельная карточка ===
    const formattedProducts = [];

    products.forEach(product => {
        if (!product.products_variants || product.products_variants.length === 0) {
            return; // Пропускаем товары без вариантов
        }

        product.products_variants.forEach(variant => {
            formattedProducts.push({
                // Уникальный ID = variant.id
                id: variant.id_variant,
                productId: product.id_product, // Ссылка на родительский товар
                
                // Название: "iPhone 15" 
                name: product.name,
                
                // Бренд + конфигурация: "Apple · 6GB · 128GB"
                brand: `${product.brands?.name || 'Бренд'} · ${variant.product_ram?.size_gb || ''}GB · ${variant.product_storage?.size_gb || ''}GB`,
                
                // Цвет
                color: variant.colors?.name,
                
                // Цена и изображение из variant
                price: variant.price,
                oldPrice: variant.old_price,
                image: variant.image_url,
                
                // Бейдж
                badge: variant.badge_type,
                badgeText: getBadgeText(variant.badge_type),
                
                // Описание и спецификации из товара
                description: product.description,
                specs: product.specs,
                
                // Для модалки (если нужно)
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
    const badges = {
        new: 'НОВИНКА',
        sale: 'СКИДКА',
        hit: 'ХИТ'
    };
    return badges[badgeType] || null;
}

/**
 * Очистить кэш
 */
exports.clearCache = () => {
    productsCache = null;
    cacheTimestamp = null;
};

/**
 * Получить один товар по ID продукта (не variant!)
 */
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