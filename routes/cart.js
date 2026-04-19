const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

router.use(protect); 

router.delete('/', cartController.clearCart); 
router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.post('/quantity', cartController.updateQuantity);
router.post('/remove', cartController.removeItem);

module.exports = router;