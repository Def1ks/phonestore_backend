require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

//  АВТОРИЗАЦИЯ 
app.use('/api/auth', require('./routes/auth'));

//  ТОВАРЫ 
app.use('/api/products', require('./routes/products'));

// === ЗАКАЗЫ ===
app.use('/api/orders', require('./routes/orders'));

// === КОРЗИНА ===
app.use('/api/cart', require('./routes/cart')); 

// === ОТЗЫВЫ О МАГАЗИНЕ ===
app.use('/api/shop-reviews', require('./routes/shopReviews'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});