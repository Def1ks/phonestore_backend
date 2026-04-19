const productService = require('../services/productService');

exports.getAll = async (req, res) => {
    try {
        const {
            brand, ram, storage, color,
            minPrice, maxPrice, search,
            page, limit,
            sortBy, sortOrder
        } = req.query;

        if (brand || ram || storage || color || minPrice || maxPrice || search || sortBy) {
            const result = await productService.getFilteredProducts({
                brand, ram, storage, color,
                minPrice, maxPrice, search,
                page: page || 1,
                limit: limit || 20,
                sortBy,
                sortOrder
            });
            return res.json(result);
        }

        const products = await productService.getAll();
        const pageNum = Number(page) || 1;
        const limitNum = Math.min(Number(limit) || 20, 100);
        const totalPages = Math.ceil(products.length / limitNum);
        const paginated = products.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        res.json({
            products: paginated,
            total: products.length,
            page: pageNum,
            limit: limitNum,
            totalPages,
            cached: true
        });
    } catch (error) {
        console.error('Error in productController.getAll:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productService.getById(id);
        if (!product) return res.status(404).json({ error: 'Товар не найден' });
        res.json(product);
    } catch (error) {
        console.error('Error in productController.getById:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getByVariantId = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productService.getByIdVariant(id);
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error in productController.getByVariantId:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const variants = await productService.getVariantsByProductId(productId);
        res.json({
            variants,
            total: variants.length
        });
    } catch (error) {
        console.error('Error in productController.getVariants:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getReviews = async (req, res) => {
    try {
        const { id } = req.params;
        const reviews = await productService.getReviewsByProductId(id);
        res.json(reviews);
    } catch (error) {
        console.error('Error in getReviews:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getMostExpensive = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 3;
        const products = await productService.getMostExpensive(limit);
        res.json({ products, total: products.length });
    } catch (error) {
        console.error('Error in getMostExpensive:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getFilterOptions = async (req, res) => {
    try {
        const filters = await productService.getFilterOptions();
        res.json(filters);
    } catch (error) {
        console.error('Ошибка в productController.getFilterOptions:', error);
        res.status(500).json({ error: error.message });
    }
};