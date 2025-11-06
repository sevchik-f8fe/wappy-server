import express from "express";
import axios from 'axios';
import axiosRetry from 'axios-retry';
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import session from 'express-session';
import csrf from 'csurf';
import { rateLimit } from 'express-rate-limit';
import cookieParser from "cookie-parser";

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
    getSVG_code
} from "./controllers/apiControllers.js";
import { changeEmail, deleteAccount } from "./controllers/profileControllers.js";
import { deleteNotActive } from "./controllers/util.js";
import { addToFavorites, removeFromFavorites } from "./controllers/favoriteControllers.js";
import { addToHistory } from "./controllers/histrotyLoadControllers.js";

const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 12 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

const csrfProtection = csrf({
    cookie: {
        key: '_csrf',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 3600,
        cookie: true
    }
});

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
app.use(cookieParser())

const limiter = rateLimit({
    windowMs: 5000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 64,
    message: 'Слишком много запросов с вашего IP, пожалуйста, попробуйте позже',
})

app.use(limiter);

app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);

    res.status(403).json({
        message: 'Invalid CSRF token'
    });
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

await axios.get(process.env.BD_LINK)
    .then(() => console.log('db is ok'))
    .catch(err => console.log('db error: ', err))

const INTERVAL_MS = 5 * 60 * 1000;

async function runCleanup() {
    try {
        console.log('Запуск очистки неактивных документов...');
        await deleteNotActive();
        console.log('Очистка завершена.');
    } catch (error) {
        console.error('Ошибка при очистке:', error);
    }
}

setInterval(runCleanup, INTERVAL_MS);
runCleanup();

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