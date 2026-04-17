// controllers/productController.js
const productService = require('../services/productService');

exports.getAll = async (req, res) => {
    try {
        const products = await productService.getAll();
        
        res.json({
            products: products,
            total: products.length,
            page: 1,
            totalPages: 1
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
        
        if (!product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('Error in productController.getById:', error);
        res.status(500).json({ error: error.message });
    }
};