require('dotenv').config();
const express = require('express');
const { connectDatabase } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const credentialsRoutes = require('./routes/credentialsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { seedAdminUser } = require('./services/userStore');

const app = express();

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    return next();
});

app.use(express.json({ limit: '15mb' }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => {
    res.json({
        message: 'B-SMART backend is running.',
        frontend: 'Open the frontend Vite URL, usually http://localhost:5173/pages/login/login.html',
        health: '/health',
        apiBase: '/api',
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/reports', reportRoutes);

app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found.',
        path: req.originalUrl,
        hint: req.originalUrl.startsWith('/api')
            ? 'Check the API path and restart the backend if routes were recently added.'
            : 'This is the backend server. Open frontend pages on the Vite URL, usually http://localhost:5173.',
    });
});

app.use((error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
        message: error.message || 'Something went wrong.',
    });
});

async function startServer() {
    try {
        const database = await connectDatabase();
        await seedAdminUser();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`B-SMART backend listening on port ${PORT}`);
            console.log(`MongoDB ${database.status}: ${database.uri}`);
        });
    } catch (error) {
        console.error('Failed to start B-SMART backend');
        console.error(error.message);
        process.exit(1);
    }
}

startServer();
