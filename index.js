/**
 * Главный файл сервера Express.js
 * 
 * Настройки и middleware:
 * - CORS: разрешены запросы с CLIENT_URL
 * - Helmet: защита HTTP заголовков (CSP, frameguard)
 * - HPP: защита от параметр поллинга
 * - Rate limiting: 20 запросов за 5 секунд
 * - Логирование: correlation ID и HTTP логгер
 * - Метрики: Prometheus для мониторинга
 * 
 * API маршруты:
 * - /auth/* - аутентификация пользователей
 * - /profile/* - профиль пользователя (избранное, история)
 * - /api/* - внешние API (Tenor, WHVN, SVG)
 * - /ad/* - административная панель
 * 
 * Фоновые задачи:
 * - Очистка неактивных пользователей (каждые 5 минут)
 * - Мониторинг подключения к БД
 * 
 * Health check: /health - статус сервера, uptime, память
 * Метрики: /metrics - Prometheus метрики
 */

import express from "express";
import axios from 'axios';
import axiosRetry from 'axios-retry';
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import { rateLimit } from 'express-rate-limit';
import { correlationMiddleware, httpLoggerMiddleware, logger } from './logsControllers/logger.js';
import {
    register, httpRequestDuration, httpRequestsTotal
} from './logsControllers/metricks.js'

import * as dotenv from 'dotenv';

dotenv.config();

import { signIn, signUp, checkAuthMiddleware, updateTokensMiddleware } from "./controllers/authControllers.js";
import { sendMail, confirmMail } from "./controllers/confirmEmailControllers.js";
import {
    getTenorTrendings, getTenorSearch,
    getTenorByID,
    getPhoto_list,
    getPhoto_search,
    getSVG_search,
    getSVG_code,
} from "./controllers/apiControllers.js";
import { changeEmail, deleteAccount } from "./controllers/profileControllers.js";
import { deleteNotActive } from "./controllers/util.js";
import { addToFavorites, removeFromFavorites } from "./controllers/favoriteControllers.js";
import { addToHistory } from "./controllers/histrotyLoadControllers.js";
import { adminAuth, checkAdminAuthMiddleware, deleteUserReq, getCount, getOnlineCount, getUsers, updateAdminTokensMiddleware } from "./controllers/adminControllers.js";

const app = express();

axiosRetry(axios, { retries: 5 });

app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: {
        action: 'deny'
    }
}));
app.use(hpp());

app.use(correlationMiddleware);
app.use(httpLoggerMiddleware);

app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;

        httpRequestDuration
            .labels(req.method, route, res.statusCode)
            .observe(duration);

        httpRequestsTotal
            .labels(req.method, route, res.statusCode)
            .inc();
    });

    next();
});

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.send(metrics);
    } catch (error) {
        res.status(500).send(error.toString());
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

const limiter = rateLimit({
    windowMs: 5000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 64,
    message: 'Слишком много запросов с вашего IP, пожалуйста, попробуйте позже',
})

app.use(limiter);

await axios.get(process.env.BD_LINK)
    .then(() => logger.info('db is ok'))
    .catch(() => logger.error('db error'))

app.post('/auth/signup', signUp, sendMail);
app.post('/auth/signin', signIn, sendMail);
app.post('/auth/sendMail', sendMail);
app.post('/auth/confirmMail', confirmMail);

app.post('/profile/delete', checkAuthMiddleware, updateTokensMiddleware, deleteAccount);
app.post('/profile/changeEmail', checkAuthMiddleware, updateTokensMiddleware, changeEmail);
app.post('/profile/favorites/add', checkAuthMiddleware, updateTokensMiddleware, addToFavorites);
app.post('/profile/favorites/remove', checkAuthMiddleware, updateTokensMiddleware, removeFromFavorites);
app.post('/profile/history/add', checkAuthMiddleware, updateTokensMiddleware, addToHistory);

app.post('/api/tenor/list', getTenorTrendings)
app.post('/api/tenor/search', getTenorSearch)
app.post('/api/tenor/getByID', getTenorByID)

app.post('/api/photos/list', getPhoto_list)
app.post('/api/photos/search', getPhoto_search)

app.post('/api/svg/search', getSVG_search)
app.post('/api/svg/code', getSVG_code)

app.post('/ad/auth', adminAuth);
app.post('/ad/delete', checkAdminAuthMiddleware, updateAdminTokensMiddleware, deleteUserReq);
app.post('/ad/get/users', checkAdminAuthMiddleware, updateAdminTokensMiddleware, getUsers)
app.post('/ad/get/usersCount', checkAdminAuthMiddleware, updateAdminTokensMiddleware, getCount)
app.post('/ad/get/usersOnlineCount', checkAdminAuthMiddleware, updateAdminTokensMiddleware, getOnlineCount)

const INTERVAL_MS = 5 * 60 * 1000;

async function runCleanup() {
    try {
        await deleteNotActive();
    } catch (error) {
        logger.error('Error processing data request', {
            error: error.message,
            stack: error.stack
        });
    }
}

setInterval(runCleanup, INTERVAL_MS);
runCleanup();

app.listen(3000, '0.0.0.0', () => {
    logger.info('Server running on http://0.0.0.0:3000');
});