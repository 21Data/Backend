// myrentabuja-backend/server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const app = express();
const PORT = process.env.PORT;

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const propertyRoutes = require('./routes/properties');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');

// Middleware
app.use(express.json()); // Body parser for JSON requests

// Basic route for testing
app.get('/', (req, res) => {
    res.send('MyrentAbuja Backend API is running!');
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

// Global error handler (optional, but good practice)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});