import express from "express";
import axios from 'axios';
import axiosRetry from 'axios-retry';
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';

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

const activeCsrfTokens = new Map();

app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.includes('/api/')) {
        const csrfToken = crypto.randomBytes(32).toString('hex');
        const tokenId = crypto.randomBytes(16).toString('hex');

        activeCsrfTokens.set(tokenId, {
            token: csrfToken,
            timestamp: Date.now(),
            userId: null
        });

        cleanupExpiredTokens();

        res.setHeader('x-csrf-token', csrfToken);
        res.setHeader('x-csrf-token-id', tokenId);
    }
    next();
});

function cleanupExpiredTokens() {
    const now = Date.now();
    for (const [tokenId, tokenData] of activeCsrfTokens.entries()) {
        if (now - tokenData.timestamp > 60 * 60 * 1000) {
            activeCsrfTokens.delete(tokenId);
        }
    }
}

const csrfProtection = (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const clientToken = req.headers['x-csrf-token'];
        const tokenId = req.headers['x-csrf-token-id'];

        if (!clientToken || !tokenId) {
            return res.status(403).json({
                message: 'CSRF token missing',
                code: 'CSRF_TOKEN_MISSING'
            });
        }

        const serverTokenData = activeCsrfTokens.get(tokenId);

        if (!serverTokenData) {
            return res.status(403).json({
                message: 'CSRF token expired or invalid',
                code: 'CSRF_TOKEN_EXPIRED'
            });
        }

        if (serverTokenData.token !== clientToken ||
            Date.now() - serverTokenData.timestamp > 60 * 60 * 1000) {
            activeCsrfTokens.delete(tokenId);
            return res.status(403).json({
                message: 'CSRF token validation failed',
                code: 'CSRF_TOKEN_INVALID'
            });
        }
        console.log(serverTokenData.token, ' = ', clientToken)
        activeCsrfTokens.delete(tokenId);

        const newCsrfToken = crypto.randomBytes(32).toString('hex');
        const newTokenId = crypto.randomBytes(16).toString('hex');

        activeCsrfTokens.set(newTokenId, {
            token: newCsrfToken,
            timestamp: Date.now(),
            userId: serverTokenData.userId
        });

        res.setHeader('x-csrf-token', newCsrfToken);
        res.setHeader('x-csrf-token-id', newTokenId);
    }
    next();
};

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
    .then(() => console.log('db is ok'))
    .catch(err => console.log('db error: ', err))

app.get('/csrf-token', (req, res) => {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const tokenId = crypto.randomBytes(16).toString('hex');

    activeCsrfTokens.set(tokenId, {
        token: csrfToken,
        timestamp: Date.now(),
        userId: null
    });

    res.setHeader('x-csrf-token', csrfToken);
    res.setHeader('x-csrf-token-id', tokenId);
    res.json({
        message: 'CSRF token generated',
        token: csrfToken,
        tokenId: tokenId
    });
});

app.post('/auth/signup', csrfProtection, signUp, sendMail);
app.post('/auth/signin', csrfProtection, signIn, sendMail);
app.post('/auth/sendMail', csrfProtection, sendMail);
app.post('/auth/confirmMail', csrfProtection, confirmMail);

app.post('/profile/delete', csrfProtection, checkAuthMiddleware, updateTokensMiddleware, deleteAccount);
app.post('/profile/changeEmail', csrfProtection, checkAuthMiddleware, updateTokensMiddleware, changeEmail);
app.post('/profile/favorites/add', csrfProtection, checkAuthMiddleware, updateTokensMiddleware, addToFavorites);
app.post('/profile/favorites/remove', csrfProtection, checkAuthMiddleware, updateTokensMiddleware, removeFromFavorites);
app.post('/profile/history/add', csrfProtection, checkAuthMiddleware, updateTokensMiddleware, addToHistory);

app.post('/api/tenor/list', getTenorTrendings)
app.post('/api/tenor/search', getTenorSearch)
app.post('/api/tenor/getByID', getTenorByID)

app.post('/api/photos/list', getPhoto_list)
app.post('/api/photos/search', getPhoto_search)

app.post('/api/svg/search', getSVG_search)
app.post('/api/svg/code', getSVG_code)

app.listen(3000, '127.0.0.1', () => {
    console.log('server is ok');
});

const INTERVAL_MS = 5 * 60 * 1000;

async function runCleanup() {
    try {
        await deleteNotActive();
    } catch (error) {
        console.error('Ошибка при очистке:', error);
    }
}

setInterval(runCleanup, INTERVAL_MS);
runCleanup();