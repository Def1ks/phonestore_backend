const supabase = require('../config/supabase');

let shopReviewsCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; 

exports.getAllShopReviews = async () => {
    // Проверяем кэш
    if (shopReviewsCache && (Date.now() - cacheTimestamp < CACHE_TTL)) {
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
        user: review.users || null,
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

exports.clearCache = () => {
    shopReviewsCache = null;
    cacheTimestamp = null;
};