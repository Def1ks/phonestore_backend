// services/adminService.js
const supabase = require('../config/supabase');
const storageService = require('./storageService');
const { uploadMultiple } = require('../services/storageService');

let usersCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 1 * 60 * 1000;

function isCacheValid() {
    return usersCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL);
}

// Получить список всех пользователей с пагинацией
exports.getAllUsers = async (page = 1, limit = 20) => {
    if (isCacheValid()) {
        return usersCache;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const safeLimit = Math.min(Number(limit), 100);

    const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + safeLimit - 1);

    if (error) {
        console.error('Admin Service Error (getAllUsers):', error);
        throw new Error(`Ошибка получения пользователей: ${error.message}`);
    }

    // Формируем ответ
    const result = {
        users: data || [],
        total: count || 0,
        page: Number(page),
        limit: safeLimit,
        totalPages: Math.ceil((count || 0) / safeLimit)
    };

    // Сохраняем в кэш
    usersCache = result;
    cacheTimestamp = Date.now();

    return result;
};

// Метод для очистки кэша (вызывать при изменении данных)
exports.clearUsersCache = () => {
    usersCache = null;
    cacheTimestamp = null;
};


// КЭШИРОВАНИЕ ДЛЯ ЗАКАЗОВ
let ordersCache = null;
let ordersCacheTimestamp = null;
const ORDERS_CACHE_TTL = 2 * 60 * 1000; // 2 минуты

function isOrdersCacheValid() {
    return ordersCache && ordersCacheTimestamp &&
        (Date.now() - ordersCacheTimestamp < ORDERS_CACHE_TTL);
}


// ЗАКАЗЫ (ORDERS)
exports.getAllOrders = async (page = 1, limit = 20) => {
    if (isOrdersCacheValid()) {
        return ordersCache;
    }

    const offset = (Number(page) - 1) * Number(limit);
    const safeLimit = Math.min(Number(limit), 100);

    const { data, error, count } = await supabase
        .from('orders')
        .select(`
      *,
      users (
        first_name,
        last_name,
        email
      )
    `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + safeLimit - 1);

    if (error) {
        console.error('Admin Service Error (getAllOrders):', error);
        throw new Error(`Ошибка получения заказов: ${error.message}`);
    }

    const result = {
        orders: data || [],
        total: count || 0,
        page: Number(page),
        limit: safeLimit,
        totalPages: Math.ceil((count || 0) / safeLimit)
    };

    ordersCache = result;
    ordersCacheTimestamp = Date.now();

    return result;
};

// Детали одного заказа 
exports.getOrderDetails = async (orderId) => {
    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
        id_order,
        status,
        phone,
        email,
        payment_type,
        delivery_type,
        total_amount,
        created_at,
        updated_at,
        users (
          id_user,
          first_name,
          last_name,
          email
        ),
        order_items (
          quantity,
          price_at_buy,
          products_variants (
            products (
              name
            ),
            colors (name),
            product_ram (size_gb),
            product_storage (size_gb)
          )
        ),
        order_delivery (
          city,
          street,
          house,
          apartment,
          postal_code,
          
          pickup_points (
            name,
            address,
            work_hours
          )
        )
      `)
            .eq('id_order', orderId)
            .single();

        if (error) {
            console.error('Supabase error (getOrderDetails):', error);
            throw new Error(`Ошибка получения заказа: ${error.message}`);
        }

        if (!order) {
            throw new Error('Заказ не найден');
        }

        // Формируем список товаров
        const items = (order.order_items || []).map(item => {
            const product = item.products_variants?.products;
            const color = item.products_variants?.colors?.name;  
            const ram = item.products_variants?.product_ram?.size_gb;
            const storage = item.products_variants?.product_storage?.size_gb;

            let name = product?.name || 'Товар';

            const specs = [ram ? `${ram}GB` : '', storage ? `${storage}GB` : ''].filter(Boolean).join('/');
            if (specs) {
                name += ` (${specs})`;
            }

            if (color) {
                name += ` — ${color}`;
            }

            return {
                id_variant: item.products_variants?.id_variant,
                product_name: name,  
                color: color,        
                quantity: item.quantity || 1,
                price: Number(item.price_at_buy || 0),
                total: Number(item.price_at_buy || 0) * Number(item.quantity || 1)
            };
        });

        // Формируем данные о доставке
        let deliveryInfo = null;
        const deliveryData = order.order_delivery; 

        if (deliveryData && order.delivery_type === 'pickup') {
            const point = deliveryData.pickup_points;
            deliveryInfo = {
                type: 'Самовывоз',
                address: point ? `${point.name}, ${point.address}` : 'Адрес не указан'
            };
        } else if (deliveryData && order.delivery_type === 'courier') {
            // 
            const parts = [deliveryData.city, deliveryData.street, deliveryData.house, deliveryData.apartment].filter(Boolean);
            deliveryInfo = {
                type: 'Курьером',
                address: parts.join(', ') || 'Адрес не указан'
            };
        }

        // Собираем итоговый объект для фронтенда
        return {
            id_order: order.id_order,
            status: order.status,
            phone: order.phone,
            email: order.email, 
            payment_type: order.payment_type,
            delivery_type: order.delivery_type,
            total_amount: Number(order.total_amount) || 0,
            created_at: order.created_at,

            user: order.users ? {
                first_name: order.users.first_name || 'Гость',
                last_name: order.users.last_name,
                email: order.users.email
            } : null,

            delivery: deliveryInfo, 

            items: items
        };

    } catch (error) {
        console.error('Admin Service Error (getOrderDetails):', error);
        throw error;
    }
};

// Изменить статус заказа 
exports.updateOrderStatus = async (orderId, status) => {
    const { data, error } = await supabase
        .from('orders')
        .update({
            status: status,
            updated_at: new Date().toISOString()
        })
        .eq('id_order', orderId);

    if (error) {
        console.error('Admin Service Error (updateStatus):', error);
        throw new Error(`Ошибка обновления статуса: ${error.message}`);
    }

    exports.clearOrdersCache();

    return { message: 'Статус успешно обновлен', status };
};

// Очистка кэша заказов
exports.clearOrdersCache = () => {
    ordersCache = null;
    ordersCacheTimestamp = null;
};

// КЭШ ДЛЯ СТАТИСТИКИ 
let statsCache = null;
let statsCacheTimestamp = null;
const STATS_CACHE_TTL = 5 * 60 * 1000;

function isStatsCacheValid() {
    return statsCache && statsCacheTimestamp &&
        (Date.now() - statsCacheTimestamp < STATS_CACHE_TTL);
}


// СТАТИСТИКА (STATS) С КЭШИРОВАНИЕМ
exports.getStats = async () => {
    // 1. Проверяем кэш
    if (isStatsCacheValid()) {
        return statsCache;
    }

    try {
        const [
            { count: productsCount },
            { count: usersCount },
            { count: ordersCount },
            { data: ratingData }
        ] = await Promise.all([
            supabase.from('products_variants').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('orders').select('*', { count: 'exact', head: true }),
            supabase.from('reviews_shop').select('rating')
        ]);

        // Считаем средний рейтинг
        const averageRating = ratingData && ratingData.length > 0
            ? (ratingData.reduce((sum, r) => sum + r.rating, 0) / ratingData.length).toFixed(1)
            : 0;

        // Формируем результат
        const result = {
            totalProducts: productsCount || 0,
            totalUsers: usersCount || 0,
            totalOrders: ordersCount || 0,
            averageRating: Number(averageRating)
        };

        // Сохраняем в кэш
        statsCache = result;
        statsCacheTimestamp = Date.now();

        return result;

    } catch (error) {
        throw new Error(`Ошибка получения статистики: ${error.message}`);
    }
};


// КЭШИРОВАНИЕ ДЛЯ RAM
let ramCache = null;
let ramCacheTimestamp = null;
const RAM_CACHE_TTL = 5 * 60 * 1000; // 5 минут

function isRamCacheValid() {
    return ramCache && ramCacheTimestamp &&
        (Date.now() - ramCacheTimestamp < RAM_CACHE_TTL);
}


// ОПЕРАТИВНАЯ ПАМЯТЬ (RAM)
// Получить список всех записей RAM 
exports.getAllRam = async () => {
    // Проверяем кэш
    if (isRamCacheValid()) {
        console.log('[CACHE HIT] RAM list loaded from cache');
        return ramCache;
    }

    console.log('[CACHE MISS] RAM fetching from DB');

    try {
        const { data, error } = await supabase
            .from('product_ram')
            .select('*')
            .order('size_gb', { ascending: true });

        if (error) {
            console.error('Admin Service Error (getAllRam):', error);
            throw new Error(`Ошибка получения списка RAM: ${error.message}`);
        }

        const result = data || [];

        ramCache = result;
        ramCacheTimestamp = Date.now();

        return result;
    } catch (error) {
        console.error('Admin Service Error (getAllRam):', error);
        throw error;
    }
};

// Создать новую запись RAM 
exports.createRam = async (sizeGb) => {
    try {
        const size = Number(sizeGb);
        if (isNaN(size) || size < 1 || size > 10000) {
            throw new Error('Объем памяти должен быть от 1 до 10000 GB');
        }

        // Проверка на дубликат
        const { data: existing } = await supabase
            .from('product_ram')
            .select('id_ram')
            .eq('size_gb', size)
            .single();

        if (existing) {
            throw new Error(`RAM ${size} GB уже существует`);
        }

        const { data, error } = await supabase
            .from('product_ram')
            .insert({ size_gb: size })
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (createRam):', error);
            throw new Error(`Ошибка создания RAM: ${error.message}`);
        }

        // Очищаем кэш после создания
        exports.clearRamCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (createRam):', error);
        throw error;
    }
};

// Обновить запись RAM 
exports.updateRam = async (id, sizeGb) => {
    try {
        // Валидация
        const size = Number(sizeGb);
        if (isNaN(size) || size < 1 || size > 10000) {
            throw new Error('Объем памяти должен быть от 1 до 10000 GB');
        }

        // Проверка на дубликат 
        const { data: existing } = await supabase
            .from('product_ram')
            .select('id_ram')
            .eq('size_gb', size)
            .neq('id_ram', id)
            .single();

        if (existing) {
            throw new Error(`RAM ${size} GB уже существует`);
        }

        const { data, error } = await supabase
            .from('product_ram')
            .update({ size_gb: size })
            .eq('id_ram', id)
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (updateRam):', error);
            throw new Error(`Ошибка обновления RAM: ${error.message}`);
        }

        // Очищаем кэш после обновления
        exports.clearRamCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (updateRam):', error);
        throw error;
    }
};

// Удалить запись RAM 
exports.deleteRam = async (id) => {
    try {
        // Проверка зависимостей в products_variants
        const { data: variants, error: variantsError } = await supabase
            .from('products_variants')
            .select('id_variant')
            .eq('id_ram', id)
            .limit(1);

        if (variantsError) {
            console.error('Admin Service Error (checkDependencies):', variantsError);
            throw new Error(`Ошибка проверки зависимостей: ${variantsError.message}`);
        }

        if (variants && variants.length > 0) {
            throw new Error('Нельзя удалить: этот объем памяти используется в товарах');
        }

        // Удаление
        const { data, error } = await supabase
            .from('product_ram')
            .delete()
            .eq('id_ram', id);

        if (error) {
            console.error('Admin Service Error (deleteRam):', error);
            throw new Error(`Ошибка удаления RAM: ${error.message}`);
        }

        // Очищаем кэш после удаления
        exports.clearRamCache();

        return { message: 'RAM успешно удалена' };
    } catch (error) {
        console.error('Admin Service Error (deleteRam):', error);
        throw error;
    }
};

// Очистка кэша RAM
exports.clearRamCache = () => {
    ramCache = null;
    ramCacheTimestamp = null;
    console.log('[CACHE] RAM cache cleared');
};


// ВНУТРЕННЯЯ ПАМЯТЬ (STORAGE)


let storageCache = null;
let storageCacheTimestamp = null;
const STORAGE_CACHE_TTL = 5 * 60 * 1000; // 5 минут

function isStorageCacheValid() {
    return storageCache && storageCacheTimestamp &&
        (Date.now() - storageCacheTimestamp < STORAGE_CACHE_TTL);
}

// Получить список всех записей Storage (С КЭШИРОВАНИЕМ)
exports.getAllStorage = async () => {
    // Проверяем кэш
    if (isStorageCacheValid()) {
        console.log('[CACHE HIT] Storage list loaded from cache');
        return storageCache;
    }

    console.log('[CACHE MISS] Storage fetching from DB');

    try {
        const { data, error } = await supabase
            .from('product_storage')
            .select('*')
            .order('size_gb', { ascending: true });

        if (error) {
            console.error('Admin Service Error (getAllStorage):', error);
            throw new Error(`Ошибка получения списка Storage: ${error.message}`);
        }

        const result = data || [];

        // Сохраняем в кэш
        storageCache = result;
        storageCacheTimestamp = Date.now();

        return result;
    } catch (error) {
        console.error('Admin Service Error (getAllStorage):', error);
        throw error;
    }
};

// Создать новую запись Storage (С ОЧИСТКОЙ КЭША)
exports.createStorage = async (sizeGb) => {
    try {
        // Валидация
        const size = Number(sizeGb);
        if (isNaN(size) || size < 1 || size > 10000) {
            throw new Error('Объем памяти должен быть от 1 до 10000 GB');
        }

        // Проверка на дубликат
        const { data: existing } = await supabase
            .from('product_storage')
            .select('id_storage')
            .eq('size_gb', size)
            .single();

        if (existing) {
            throw new Error(`Storage ${size} GB уже существует`);
        }

        const { data, error } = await supabase
            .from('product_storage')
            .insert({ size_gb: size })
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (createStorage):', error);
            throw new Error(`Ошибка создания Storage: ${error.message}`);
        }

        // Очищаем кэш после создания
        exports.clearStorageCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (createStorage):', error);
        throw error;
    }
};

// Обновить запись Storage (С ОЧИСТКОЙ КЭША)
exports.updateStorage = async (id, sizeGb) => {
    try {
        // Валидация
        const size = Number(sizeGb);
        if (isNaN(size) || size < 1 || size > 10000) {
            throw new Error('Объем памяти должен быть от 1 до 10000 GB');
        }

        // Проверка на дубликат (кроме текущей записи)
        const { data: existing } = await supabase
            .from('product_storage')
            .select('id_storage')
            .eq('size_gb', size)
            .neq('id_storage', id)
            .single();

        if (existing) {
            throw new Error(`Storage ${size} GB уже существует`);
        }

        const { data, error } = await supabase
            .from('product_storage')
            .update({ size_gb: size })
            .eq('id_storage', id)
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (updateStorage):', error);
            throw new Error(`Ошибка обновления Storage: ${error.message}`);
        }

        // Очищаем кэш после обновления
        exports.clearStorageCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (updateStorage):', error);
        throw error;
    }
};

// Удалить запись Storage (С ПРОВЕРКОЙ ЗАВИСИМОСТЕЙ И ОЧИСТКОЙ КЭША)
exports.deleteStorage = async (id) => {
    try {
        // Проверка зависимостей в products_variants
        const { data: variants, error: variantsError } = await supabase
            .from('products_variants')
            .select('id_variant')
            .eq('id_storage', id)
            .limit(1);

        if (variantsError) {
            console.error('Admin Service Error (checkDependencies):', variantsError);
            throw new Error(`Ошибка проверки зависимостей: ${variantsError.message}`);
        }

        if (variants && variants.length > 0) {
            throw new Error('Нельзя удалить: этот объем памяти используется в товарах');
        }

        // Удаление
        const { data, error } = await supabase
            .from('product_storage')
            .delete()
            .eq('id_storage', id);

        if (error) {
            console.error('Admin Service Error (deleteStorage):', error);
            throw new Error(`Ошибка удаления Storage: ${error.message}`);
        }

        // Очищаем кэш после удаления
        exports.clearStorageCache();

        return { message: 'Storage успешно удален' };
    } catch (error) {
        console.error('Admin Service Error (deleteStorage):', error);
        throw error;
    }
};

// Очистка кэша Storage
exports.clearStorageCache = () => {
    storageCache = null;
    storageCacheTimestamp = null;
    console.log('[CACHE] Storage cache cleared');
};


// ЦВЕТА (COLORS)


let colorsCache = null;
let colorsCacheTimestamp = null;
const COLORS_CACHE_TTL = 5 * 60 * 1000; // 5 минут

function isColorsCacheValid() {
    return colorsCache && colorsCacheTimestamp &&
        (Date.now() - colorsCacheTimestamp < COLORS_CACHE_TTL);
}

// Получить список всех цветов (С КЭШИРОВАНИЕМ)
exports.getAllColors = async () => {
    // Проверяем кэш
    if (isColorsCacheValid()) {
        console.log('[CACHE HIT] Colors list loaded from cache');
        return colorsCache;
    }

    console.log('[CACHE MISS] Colors fetching from DB');

    try {
        const { data, error } = await supabase
            .from('colors')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Admin Service Error (getAllColors):', error);
            throw new Error(`Ошибка получения списка цветов: ${error.message}`);
        }

        const result = data || [];

        // Сохраняем в кэш
        colorsCache = result;
        colorsCacheTimestamp = Date.now();

        return result;
    } catch (error) {
        console.error('Admin Service Error (getAllColors):', error);
        throw error;
    }
};

// Создать новый цвет (С ОЧИСТКОЙ КЭША)
exports.createColor = async (name) => {
    try {
        // Валидация
        if (!name || typeof name !== 'string') {
            throw new Error('Необходимо указать название цвета');
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 50) {
            throw new Error('Название цвета должно быть от 2 до 50 символов');
        }

        // Проверка на дубликат (регистронезависимая)
        const { data: existing } = await supabase
            .from('colors')
            .select('id_color')
            .ilike('name', trimmedName)
            .single();

        if (existing) {
            throw new Error(`Цвет "${trimmedName}" уже существует`);
        }

        const { data, error } = await supabase
            .from('colors')
            .insert({ name: trimmedName })
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (createColor):', error);
            throw new Error(`Ошибка создания цвета: ${error.message}`);
        }

        // Очищаем кэш после создания
        exports.clearColorsCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (createColor):', error);
        throw error;
    }
};

// Обновить цвет (С ОЧИСТКОЙ КЭША)
exports.updateColor = async (id, name) => {
    try {
        // Валидация
        if (!name || typeof name !== 'string') {
            throw new Error('Необходимо указать название цвета');
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 50) {
            throw new Error('Название цвета должно быть от 2 до 50 символов');
        }

        // Проверка на дубликат (кроме текущей записи, регистронезависимая)
        const { data: existing } = await supabase
            .from('colors')
            .select('id_color')
            .ilike('name', trimmedName)
            .neq('id_color', id)
            .single();

        if (existing) {
            throw new Error(`Цвет "${trimmedName}" уже существует`);
        }

        const { data, error } = await supabase
            .from('colors')
            .update({ name: trimmedName })
            .eq('id_color', id)
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (updateColor):', error);
            throw new Error(`Ошибка обновления цвета: ${error.message}`);
        }

        // Очищаем кэш после обновления
        exports.clearColorsCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (updateColor):', error);
        throw error;
    }
};

// Удалить цвет (С ПРОВЕРКОЙ ЗАВИСИМОСТЕЙ И ОЧИСТКОЙ КЭША)
exports.deleteColor = async (id) => {
    try {
        // Проверка зависимостей в products_variants
        const { data: variants, error: variantsError } = await supabase
            .from('products_variants')
            .select('id_variant')
            .eq('id_color', id)
            .limit(1);

        if (variantsError) {
            console.error('Admin Service Error (checkDependencies):', variantsError);
            throw new Error(`Ошибка проверки зависимостей: ${variantsError.message}`);
        }

        if (variants && variants.length > 0) {
            throw new Error('Нельзя удалить: этот цвет используется в товарах');
        }

        // Удаление
        const { data, error } = await supabase
            .from('colors')
            .delete()
            .eq('id_color', id);

        if (error) {
            console.error('Admin Service Error (deleteColor):', error);
            throw new Error(`Ошибка удаления цвета: ${error.message}`);
        }

        // Очищаем кэш после удаления
        exports.clearColorsCache();

        return { message: 'Цвет успешно удален' };
    } catch (error) {
        console.error('Admin Service Error (deleteColor):', error);
        throw error;
    }
};

// Очистка кэша цветов
exports.clearColorsCache = () => {
    colorsCache = null;
    colorsCacheTimestamp = null;
    console.log('[CACHE] Colors cache cleared');
};


// БРЕНДЫ (BRANDS)


let brandsCache = null;
let brandsCacheTimestamp = null;
const BRANDS_CACHE_TTL = 5 * 60 * 1000; // 5 минут

function isBrandsCacheValid() {
    return brandsCache && brandsCacheTimestamp &&
        (Date.now() - brandsCacheTimestamp < BRANDS_CACHE_TTL);
}

// Получить список всех брендов (С КЭШИРОВАНИЕМ)
exports.getAllBrands = async () => {
    // Проверяем кэш
    if (isBrandsCacheValid()) {
        console.log('[CACHE HIT] Brands list loaded from cache');
        return brandsCache;
    }

    console.log('[CACHE MISS] Brands fetching from DB');

    try {
        const { data, error } = await supabase
            .from('brands')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Admin Service Error (getAllBrands):', error);
            throw new Error(`Ошибка получения списка брендов: ${error.message}`);
        }

        const result = data || [];

        // Сохраняем в кэш
        brandsCache = result;
        brandsCacheTimestamp = Date.now();

        return result;
    } catch (error) {
        console.error('Admin Service Error (getAllBrands):', error);
        throw error;
    }
};

// Создать новый бренд (С ОЧИСТКОЙ КЭША)
exports.createBrand = async (name) => {
    try {
        // Валидация
        if (!name || typeof name !== 'string') {
            throw new Error('Необходимо указать название бренда');
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 100) {
            throw new Error('Название бренда должно быть от 2 до 100 символов');
        }

        // Проверка на дубликат (регистронезависимая)
        const { data: existing } = await supabase
            .from('brands')
            .select('id_brand')
            .ilike('name', trimmedName)
            .single();

        if (existing) {
            throw new Error(`Бренд "${trimmedName}" уже существует`);
        }

        const { data, error } = await supabase
            .from('brands')
            .insert({ name: trimmedName })
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (createBrand):', error);
            throw new Error(`Ошибка создания бренда: ${error.message}`);
        }

        // Очищаем кэш после создания
        exports.clearBrandsCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (createBrand):', error);
        throw error;
    }
};

// Обновить бренд (С ОЧИСТКОЙ КЭША)
exports.updateBrand = async (id, name) => {
    try {
        // Валидация
        if (!name || typeof name !== 'string') {
            throw new Error('Необходимо указать название бренда');
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 100) {
            throw new Error('Название бренда должно быть от 2 до 100 символов');
        }

        // Проверка на дубликат (кроме текущей записи, регистронезависимая)
        const { data: existing } = await supabase
            .from('brands')
            .select('id_brand')
            .ilike('name', trimmedName)
            .neq('id_brand', id)
            .single();

        if (existing) {
            throw new Error(`Бренд "${trimmedName}" уже существует`);
        }

        const { data, error } = await supabase
            .from('brands')
            .update({ name: trimmedName })
            .eq('id_brand', id)
            .select()
            .single();

        if (error) {
            console.error('Admin Service Error (updateBrand):', error);
            throw new Error(`Ошибка обновления бренда: ${error.message}`);
        }

        // Очищаем кэш после обновления
        exports.clearBrandsCache();

        return data;
    } catch (error) {
        console.error('Admin Service Error (updateBrand):', error);
        throw error;
    }
};

// Удалить бренд (С ПРОВЕРКОЙ ЗАВИСИМОСТЕЙ И ОЧИСТКОЙ КЭША)
exports.deleteBrand = async (id) => {
    try {
        // Проверка зависимостей в products (не products_variants!)
        const { products, error: productsError } = await supabase
            .from('products')
            .select('id_product')
            .eq('id_brand', id)
            .limit(1);

        if (productsError) {
            console.error('Admin Service Error (checkDependencies):', productsError);
            throw new Error(`Ошибка проверки зависимостей: ${productsError.message}`);
        }

        if (products && products.length > 0) {
            throw new Error('Нельзя удалить: этот бренд используется в товарах');
        }

        // Удаление
        const { data, error } = await supabase
            .from('brands')
            .delete()
            .eq('id_brand', id);

        if (error) {
            console.error('Admin Service Error (deleteBrand):', error);
            throw new Error(`Ошибка удаления бренда: ${error.message}`);
        }

        // Очищаем кэш после удаления
        exports.clearBrandsCache();

        return { message: 'Бренд успешно удален' };
    } catch (error) {
        console.error('Admin Service Error (deleteBrand):', error);
        throw error;
    }
};

// Очистка кэша брендов
exports.clearBrandsCache = () => {
    brandsCache = null;
    brandsCacheTimestamp = null;
    console.log('[CACHE] Brands cache cleared');
};


// ТОВАРЫ (PRODUCTS) - ДЛЯ СПИСКА АДМИНКИ


let adminProductsCache = null;
let adminProductsCacheTimestamp = null;
const ADMIN_PRODUCTS_CACHE_TTL = 3 * 60 * 1000; // 3 минуты

function isAdminProductsCacheValid() {
    return adminProductsCache && adminProductsCacheTimestamp &&
        (Date.now() - adminProductsCacheTimestamp < ADMIN_PRODUCTS_CACHE_TTL);
}

// Получить список основных товаров (группировка)
exports.getAdminProducts = async (page = 1, limit = 10) => {
    // Проверяем кэш
    if (isAdminProductsCacheValid()) {
        console.log('[CACHE HIT] Admin products list loaded from cache');
        return adminProductsCache;
    }

    console.log('[CACHE MISS] Admin products fetching from DB');

    try {
        const offset = (Number(page) - 1) * Number(limit);
        const safeLimit = Math.min(Number(limit), 100);

        // Запрос к таблице products (ОСНОВНЫЕ ТОВАРЫ)
        // Мы подтягиваем:
        // 1. Бренд (для отображения)
        // 2. products_variants (только ID и картинку, чтобы посчитать кол-во и взять обложку)
        const { data, error, count } = await supabase
            .from('products')
            .select(`
        id_product,
        name,
        description,
        specs,
        brands (
          name
        ),
        products_variants (
          id_variant,
          image_url
        )
      `, { count: 'exact' })
            .order('id_product', { ascending: false }) // Сначала новые
            .range(offset, offset + safeLimit - 1);

        if (error) {
            console.error('Admin Service Error (getAdminProducts):', error);
            throw new Error(`Ошибка получения товаров: ${error.message}`);
        }

        // Формируем удобный формат для админки
        const result = {
            products: (data || []).map(product => {
                const variants = product.products_variants || [];
                return {
                    id: product.id_product,
                    name: product.name,
                    brand: product.brands?.name || 'Без бренда',
                    description: product.description,
                    specs: product.specs,
                    variantsCount: variants.length,
                    // Берем картинку первого варианта как обложку
                    coverImage: variants.length > 0 ? variants[0].image_url : null
                };
            }),
            total: count || 0,
            page: Number(page),
            limit: safeLimit,
            totalPages: Math.ceil((count || 0) / safeLimit)
        };

        // Сохраняем в кэш
        adminProductsCache = result;
        adminProductsCacheTimestamp = Date.now();

        return result;

    } catch (error) {
        console.error('Admin Service Error (getAdminProducts):', error);
        throw error;
    }
};

// Очистка кэша товаров (вызывать при создании/редактировании/удалении)
exports.clearAdminProductsCache = () => {
    adminProductsCache = null;
    adminProductsCacheTimestamp = null;
    console.log('[CACHE] Admin products cache cleared');
};


// ТОВАРЫ (PRODUCTS) - ДЕТАЛЬНАЯ ИНФОРМАЦИЯ (ДЛЯ РЕДАКТИРОВАНИЯ)


// Получить товар со всеми вариантами (для формы редактирования)
exports.getAdminProductById = async (productId) => {
    try {
        // Запрос к таблице products + все связанные данные
        const { data, error } = await supabase
            .from('products')
            .select(`
        id_product,
        name,
        description,
        specs,
        brands (
          id_brand,
          name
        ),
        products_variants (
          id_variant,
          price,
          old_price,
          image_url,
          badge_type,
          id_color,
          id_ram,
          id_storage
        )
      `)
            .eq('id_product', productId)
            .single();

        if (error) {
            console.error('Admin Service Error (getAdminProductById):', error);
            throw new Error(`Ошибка получения товара: ${error.message}`);
        }

        if (!data) {
            throw new Error('Товар не найден');
        }

        // Форматируем ответ для удобной работы с формой
        return {
            id: data.id_product,
            name: data.name,
            description: data.description || '',
            specs: data.specs || {}, // JSON с характеристиками
            brand: data.brands,
            variants: (data.products_variants || []).map(variant => ({
                id: variant.id_variant,
                price: variant.price,
                oldPrice: variant.old_price,
                imageUrl: variant.image_url,
                badgeType: variant.badge_type,
                idColor: variant.id_color,
                idRam: variant.id_ram,
                idStorage: variant.id_storage
            }))
        };

    } catch (error) {
        console.error('Admin Service Error (getAdminProductById):', error);
        throw error;
    }
};


// ТОВАРЫ (PRODUCTS) - СОЗДАНИЕ И РЕДАКТИРОВАНИЕ

// Создать новый товар с вариантами (С ЗАГРУЗКОЙ ФАЙЛОВ)
exports.createProduct = async (productData) => {
    const { name, brandId, description, specs, variants } = productData;

    try {
        // 1. Создаем основной товар
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert({
                name: name.trim(),
                id_brand: brandId,
                description: description?.trim() || '',
                specs: specs || {},
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (productError) {
            console.error('Admin Service Error (createProduct):', productError);
            throw new Error(`Ошибка создания товара: ${productError.message}`);
        }

        if (!product) {
            throw new Error('Товар не был создан');
        }

        // 2. Создаем варианты товара с загрузкой файлов
        if (variants && variants.length > 0) {
            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                let imageUrl = null;

                // Если есть файл для этого варианта - загружаем
                if (variant.file && (variant.file.path || variant.file instanceof File)) {
                    console.log(`[INFO] Variant ${variant.id}: Uploading NEW file`);
                    // Если загружен НОВЫЙ файл:
                    // 1. Удаляем старую картинку
                    if (currentVariant?.image_url) {
                        await storageService.deleteFromStorage(currentVariant.image_url);
                    }
                    // 2. Загружаем новую
                    const fileName = storageService.generateFileName(
                        name || currentProduct.name,
                        variant.ram,
                        variant.storage,
                        variant.color
                    );
                    const uploadResult = await storageService.uploadToStorage(variant.file.path, fileName);
                    imageUrl = uploadResult.url;
                } else {
                    console.log(`[INFO] Variant ${variant.id}: Keeping existing image: ${imageUrl}`);
                }

                // Проверяем на дубликаты
                const { data: existingVariant, error: existingError } = await supabase
                    .from('products_variants')
                    .select('id_variant')
                    .eq('id_product', product.id_product)
                    .eq('id_color', variant.idColor)
                    .eq('id_ram', variant.idRam)
                    .eq('id_storage', variant.idStorage)
                    .single();

                if (existingVariant) {
                    await supabase.from('products').delete().eq('id_product', product.id_product);
                    throw new Error(`Такой вариант уже существует`);
                }

                // Создаем вариант
                const { error: variantError } = await supabase
                    .from('products_variants')
                    .insert({
                        id_product: product.id_product,
                        id_color: Number(variant.colorId) || null,
                        id_ram: Number(variant.ramId) || null,
                        id_storage: Number(variant.storageId) || null,
                        price: Number(variant.price),
                        old_price: variant.oldPrice ? Number(variant.oldPrice) : null,
                        image_url: imageUrl,
                        badge_type: variant.badgeType || null
                    });

                if (variantError) {
                    console.error('[ERROR] Variant insert:', variantError);
                    await supabase.from('products').delete().eq('id_product', product.id_product);
                    throw new Error(`Ошибка создания варианта: ${variantError.message}`);
                }
            }
        }

        // Очищаем кэш
        exports.clearAdminProductsCache();

        return { id: product.id_product, message: 'Товар успешно создан' };

    } catch (error) {
        console.error('Admin Service Error (createProduct):', error);
        throw error;
    }
};

// Обновить товар с вариантами (С ЗАГРУЗКОЙ/УДАЛЕНИЕМ ФАЙЛОВ)
exports.updateProduct = async (productId, productData) => {
    const { name, brandId, description, specs, variants } = productData;

    try {
        // 1. Получаем ТЕКУЩИЕ данные товара
        const { data: currentProduct, error: currentError } = await supabase
            .from('products')
            .select('*')
            .eq('id_product', productId)
            .single();

        if (currentError || !currentProduct) {
            throw new Error('Товар не найден');
        }

        // 2. Получаем текущие варианты
        const { data: existingVariants, error: variantsError } = await supabase
            .from('products_variants')
            .select('*')
            .eq('id_product', productId);

        let variantsToDelete = [];

        if (existingVariants && existingVariants.length > 0) {
            const existingIds = existingVariants.map(v => v.id_variant);
            // Определяем какие варианты пришли с фронта (имеют ID)
            const incomingIds = variants
                .filter(v => v.id)
                .map(v => v.id);

            // Находим кандидатов на удаление (есть в БД, но нет в форме)
            const toDeleteIds = existingIds.filter(id => !incomingIds.includes(id));


            console.log('[DEBUG] Variants to delete:', toDeleteIds);
            console.log('[DEBUG] Existing IDs:', existingIds);
            console.log('[DEBUG] Incoming IDs:', incomingIds);

            if (toDeleteIds.length > 0) {
                // ПРОВЕРКА: Есть ли эти варианты в заказах?
                const { data: orderItems, error: orderError } = await supabase
                    .from('order_items')
                    .select('id_variant')
                    .in('id_variant', toDeleteIds);

                if (orderItems && orderItems.length > 0) {
                    const lockedIds = orderItems.map(oi => oi.id_variant);
                    // Удаляем только те, которые НЕ в заказах
                    variantsToDelete = toDeleteIds.filter(id => !lockedIds.includes(id));
                    console.warn(`[WARN] ${lockedIds.length} вариантов не удалены, так как есть в заказах.`);
                } else {
                    variantsToDelete = toDeleteIds;
                }
            }

            // 3. Удаляем ненужные варианты И ИХ КАРТИНКИ (только разрешенные)
            if (variantsToDelete.length > 0) {
                const physicalVariants = existingVariants.filter(v => variantsToDelete.includes(v.id_variant));

                // Удаляем файлы из хранилища
                for (const variant of physicalVariants) {
                    if (variant.image_url) {
                        await storageService.deleteFromStorage(variant.image_url);
                    }
                }
                // Удаляем из БД
                const { error: deleteError } = await supabase
                    .from('products_variants')
                    .delete()
                    .in('id_variant', variantsToDelete);

                if (deleteError) {
                    throw new Error(`Ошибка удаления вариантов: ${deleteError.message}`);
                }
            }
        }

        // 4. Обновляем основной товар
        const { error: updateError } = await supabase
            .from('products')
            .update({
                name: name || currentProduct.name,
                id_brand: brandId || currentProduct.id_brand,
                description: description !== undefined ? description : currentProduct.description,
                specs: specs || currentProduct.specs
            })
            .eq('id_product', productId);

        if (updateError) {
            throw new Error(`Ошибка обновления товара: ${updateError.message}`);
        }

        // 5. Обрабатываем варианты (Создание и Обновление)
        // 5. Обрабатываем варианты (Создание и Обновление)
        if (variants && variants.length > 0) {
            console.log('[SERVICE] Processing variants:', variants.length);

            for (let i = 0; i < variants.length; i++) {
                const variant = variants[i];
                const currentVariant = existingVariants?.find(v => v.id_variant === variant.id);

                console.log(`[SERVICE] Variant ${i}:`, {
                    incomingId: variant.id,
                    currentVariantId: currentVariant?.id_variant,
                    foundMatch: !!currentVariant
                });

                let imageUrl = currentVariant?.image_url || null;

                if (variant.file && variant.file.path) {
                    console.log(`[SERVICE] Uploading new file for variant ${variant.id}`);
                    // Если загружен НОВЫЙ файл:
                    // 1. Удаляем старую картинку
                    if (currentVariant?.image_url) {
                        await storageService.deleteFromStorage(currentVariant.image_url);
                    }
                    // 2. Загружаем новую
                    const fileName = storageService.generateFileName(
                        name || currentProduct.name,
                        variant.ram,
                        variant.storage,
                        variant.color
                    );
                    const uploadResult = await storageService.uploadToStorage(variant.file.path, fileName);
                    imageUrl = uploadResult.url;
                } else {
                    console.log(`[SERVICE] Keeping existing image: ${imageUrl}`);
                }

                const variantData = {
                    id_color: variant.colorId || (currentVariant?.id_color),
                    id_ram: variant.ramId || (currentVariant?.id_ram),
                    id_storage: variant.storageId || (currentVariant?.id_storage),
                    price: Number(variant.price) || (currentVariant?.price),
                    old_price: variant.oldPrice !== undefined ? (variant.oldPrice ? Number(variant.oldPrice) : null) : (currentVariant?.old_price),
                    image_url: imageUrl,
                    badge_type: variant.badgeType !== undefined ? variant.badgeType : (currentVariant?.badge_type)
                };

                if (variant.id && currentVariant) {
                    console.log(`[SERVICE] UPDATE variant ${variant.id}`);
                    const { error: varError } = await supabase
                        .from('products_variants')
                        .update(variantData)
                        .eq('id_variant', variant.id);
                    if (varError) throw new Error(`Ошибка обновления варианта: ${varError.message}`);
                } else {
                    console.log(`[SERVICE] INSERT new variant`);
                    const { error: varError } = await supabase
                        .from('products_variants')
                        .insert({ ...variantData, id_product: productId });
                    if (varError) throw new Error(`Ошибка создания варианта: ${varError.message}`);
                }
            }

        }

        // Очищаем кэш
        exports.clearAdminProductsCache();

        return { message: 'Товар успешно обновлен' };

    } catch (error) {
        console.error('Admin Service Error (updateProduct):', error);
        throw error;
    }
};

// Удалить товар (с проверкой зависимостей)
exports.deleteProduct = async (productId) => {
    try {
        // 1. Проверяем, используется ли товар в заказах
        const { data: variants, error: variantsError } = await supabase
            .from('products_variants')
            .select('id_variant')
            .eq('id_product', productId);

        if (variants && variants.length > 0) {
            const variantIds = variants.map(v => v.id_variant);

            const { data: orderItems, error: orderItemsError } = await supabase
                .from('order_items')
                .select('id_order')
                .in('id_variant', variantIds)
                .limit(1);

            if (orderItems && orderItems.length > 0) {
                throw new Error('Нельзя удалить: товар присутствует в заказах');
            }
        }

        // 2. Проверяем отзывы
        const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select('id_review')
            .eq('id_product', productId)
            .limit(1);

        if (reviews && reviews.length > 0) {
            throw new Error('Нельзя удалить: на товар есть отзывы');
        }

        // 3. Удаляем варианты (сначала)
        const { error: variantsDeleteError } = await supabase
            .from('products_variants')
            .delete()
            .eq('id_product', productId);

        if (variantsDeleteError) {
            throw new Error(`Ошибка удаления вариантов: ${variantsDeleteError.message}`);
        }

        // 4. Удаляем основной товар
        const { error: productDeleteError } = await supabase
            .from('products')
            .delete()
            .eq('id_product', productId);

        if (productDeleteError) {
            throw new Error(`Ошибка удаления товара: ${productDeleteError.message}`);
        }

        // Очищаем кэш
        exports.clearAdminProductsCache();

        return { message: 'Товар успешно удален' };

    } catch (error) {
        console.error('Admin Service Error (deleteProduct):', error);
        throw error;
    }
};