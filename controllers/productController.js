// controllers/productController.js
const productService = require('../services/productService');

exports.getAll = async (req, res) => {
  try {
    const products = await productService.getAll();
    res.json({
      products,
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
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    res.json(product);
  } catch (error) {
    console.error('Error in productController.getById:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Получить товар по ID варианта (для страницы товара)
 */
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
