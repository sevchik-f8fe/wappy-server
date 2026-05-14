/**
 * Схема создания нового пользователя
 * 
 * Поля:
 * @property {string} email - Email пользователя (уникальный)
 * @property {string} passwordHash - Хешированный пароль (bcrypt)
 * @property {boolean} isActive - Активен ли аккаунт
 * @property {string|null} refreshToken - Хеш refresh токена
 * 
 * Верификационные объекты:
 * @property {Object} activation - Код активации при регистрации
 * @property {Object} signInVerification - Код для входа (2FA)
 * @property {Object} emailChange - Код для смены email
 * 
 * Каждый объект содержит:
 * - code: 6-значный код
 * - generatedAt: timestamp генерации (TTL 5 минут)
 * 
 * Данные пользователя:
 * @property {Array} favorites - Избранные элементы
 * @property {Array} historyLoad - История загрузок
 * @property {number} createdAt - Timestamp регистрации
 * @property {number} updatedAt - Timestamp последней активности
 * 
 * Хеширование:
 * - Пароль хешируется с солью (10 раундов)
 * - Refresh токен также хешируется перед сохранением
 */

import bcrypt from "bcrypt"

export const createUser = async (email, pass) => {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(pass, salt);

    return ({
        email: email, // string, unique, required
        passwordHash: passwordHash, // string, required
        isActive: false, // boolean, required, default = false
        refreshToken: null,
        activation: {
            code: null, // string, default=null
            generatedAt: null, // timestamp, default=null
        },
        signInVerification: {
            code: null, // string, default=null
            generatedAt: null // timestamp, default=null
        },
        emailChange: {
            newEmail: null, // string, default=null
            code: null, // string, default=null
            generatedAt: null // timestamp, default=null
        },
        favorites: [], // [{media_id:string, photoUrl:string, source: string enum[storyblock, giphy, noun, photo], link: string}]
        historyLoad: [], // [{media_id:string, photoUrl:string, source: string enum[storyblock, giphy, noun, photo], link: string, loadedAt: timestamp}]
        createdAt: new Date().getTime(), // timestamp, required
        updatedAt: new Date().getTime(), // timestamp, required
    })
};
