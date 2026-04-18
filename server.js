require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

// Товары
app.use('/api/products', require('./routes/products'));

// Отзывы о магазине
app.use('/api/shop-reviews', require('./routes/shopReviews'));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});