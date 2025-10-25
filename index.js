import express from "express";
import axios from 'axios';
import axiosRetry from 'axios-retry';
import cors from "cors";
import helmet from "helmet";
import hpp from "hpp";
import { rateLimit } from 'express-rate-limit'

import * as dotenv from 'dotenv';

dotenv.config();

import { signIn, signUp, checkAuthMiddleware } from "./controllers/authControllers.js";
import { sendMail, confirmMail } from "./controllers/confirmEmailControllers.js";
import {
    getTenorTrendings, getTenorSearch,
    getPhotos, getPhotoByID, getPhotosByQuery,
    getStroyblockPhotosByQuery, getStroyblockVideosByQuery, getStroyblockVideoByID, getStroyblockPhotoByID
} from "./controllers/apiControllers.js";
import { changeEmail, deleteAccount } from "./controllers/profileControllers.js";
import { deleteNotActive } from "./controllers/util.js";

const app = express();

axiosRetry(axios, { retries: 5 });
app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(hpp());

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

app.post('/auth/signup', signUp, sendMail);
app.post('/auth/signin', signIn, sendMail);
app.post('/auth/sendMail', sendMail);
app.post('/auth/confirmMail', confirmMail);

app.post('/profile/delete', checkAuthMiddleware, deleteAccount);
app.post('/profile/changeEmail', checkAuthMiddleware, changeEmail);

app.post('/api/tenor/list', getTenorTrendings) //!
app.post('/api/tenor/search', getTenorSearch) //?

app.post('/api/photos/list', getPhotos) //!
app.post('/api/photos/photosByQuery', getPhotosByQuery) //?
app.post('/api/photos/photoByID', getPhotoByID) //*

app.post('/api/storyblock/photosByQuery', getStroyblockPhotosByQuery) //?
app.post('/api/storyblock/videosByQuery', getStroyblockVideosByQuery) //?
// app.post('/api/storyblock/video', getStroyblockVideoByID) //*
// app.post('/api/storyblock/photo', getStroyblockPhotoByID) //*

app.listen(3000, '127.0.0.1', () => {
    console.log('server is ok');
});