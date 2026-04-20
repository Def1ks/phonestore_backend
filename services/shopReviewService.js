const supabase = require('../config/supabase');
let shopReviewsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; 

function isCacheValid() {
    return shopReviewsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_TTL);
}

exports.getAllShopReviews = async () => {
    // 1. Проверяем кэш
    if (isCacheValid()) {
        console.log('[CACHE HIT] Shop reviews loaded from cache');
        return shopReviewsCache;
    }

    const response = await supabase
        .from('reviews_shop')
        .select(`
            id_review_shop,
            rating,
            comment,
            created_at,
            users (id_user, first_name, last_name)
        `)
        .order('created_at', { ascending: false });

    const reviews = response.data;
    const error = response.error;

    if (error) {
        throw new Error('Ошибка при получении отзывов');
    }

    const formattedReviews = (reviews || []).map(review => ({
        id: review.id_review_shop,
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
    const average = calculateAverage(formattedReviews);
    const distribution = calculateDistribution(formattedReviews);

    const result = {
        items: formattedReviews,
        total,
        average,
        distribution
    };

    shopReviewsCache = result;
    cacheTimestamp = Date.now();

    return result;
};

function calculateAverage(reviews) {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    return Number((sum / reviews.length).toFixed(1));
}

function calculateDistribution(reviews) {
    return [5, 4, 3, 2, 1].map(stars => ({
        stars,
        count: reviews.filter(r => r.rating === stars).length
    }));
}

exports.canReviewShop = async (userId) => {
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id_order')
        .eq('id_user', userId)
        .eq('status', 'delivered')
        .limit(1);

    if (orderError) throw orderError;
    if (!orders || orders.length === 0) {
        return { allowed: false, reason: 'Отзыв доступен после получения первого заказа' };
    }
    
    const { data: existing, error: reviewError } = await supabase
        .from('reviews_shop')
        .select('id_review_shop')
        .eq('id_user', userId)
        .single();

    if (reviewError && reviewError.code !== 'PGRST116') throw reviewError;
    if (existing) {
        return { allowed: false, reason: 'Вы уже оставляли отзыв о магазине' };
    }

    return { allowed: true };
};

exports.createShopReview = async (userId, rating, comment) => {
    if (!rating || rating < 1 || rating > 5) throw new Error('Рейтинг должен быть от 1 до 5');
    if (!comment || comment.trim().length < 10) throw new Error('Отзыв должен содержать минимум 10 символов');

    const { data: existing } = await supabase
        .from('reviews_shop')
        .select('id_review_shop')
        .eq('id_user', userId)
        .single();

    if (existing) throw new Error('Вы уже оставляли отзыв о магазине');

    const { error } = await supabase
        .from('reviews_shop')
        .insert({
            id_user: userId,
            rating,
            comment: comment.trim(),
            created_at: new Date().toISOString()
        });

    if (error) throw error;
    
    exports.clearCache();
    
    return { message: 'Отзыв успешно опубликован' };
};

exports.clearCache = () => {
    shopReviewsCache = null;
    cacheTimestamp = null;
    console.log('[CACHE] Shop reviews cache cleared');
};