/**
 * Контроллеры для административной панели
 * 
 * Аутентификация администратора:
 * @function adminAuth - Вход администратора
 *   - Проверка email и пароля
 *   - Генерация access + refresh токенов
 *   - Хеширование refresh токена в БД
 * 
 * @function checkAdminAuthMiddleware - Проверка авторизации
 *   - Валидация access токена (JWT)
 *   - При просрочке: проверка refresh токена
 *   - Сравнение хеша refresh токена с БД
 * 
 * @function updateAdminTokensMiddleware - Обновление токенов
 *   - Генерация новой пары токенов
 *   - Обновление refresh токена в БД
 *   - Добавление новых токенов в req.body
 * 
 * Управление пользователями:
 * @function getCount - Общее количество пользователей
 * @function getOnlineCount - Онлайн пользователи (активность за 1 минуту)
 * @function getUsers - Пагинированный список пользователей
 * @function deleteUserReq - Удаление пользователя
 * 
 * Безопасность:
 * - Все эндпоинты требуют авторизации
 * - Валидация входных данных (validateInput)
 * - Токены с ограниченным сроком жизни
 */

import { deleteUser, findAdmin, findByEmail, getOnlineUsersCount, getUsersCount, getUsersPaginated, updateAdmin, validateInput } from "./util.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"
import { logger } from "../logsControllers/logger.js";

//TODO: AUTH

export const adminAuth = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!validateInput(email) || !validateInput(password)) {
            return res.status(400).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        const admin = await findAdmin(email);

        if (!admin) {
            return res.status(404).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

        if (!isValidPassword) {
            return res.status(400).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        const refreshToken = jwt.sign(
            { id: admin._id },
            process.env.JWT_REFRESH,
            { expiresIn: '7d' }
        );

        const salt = await bcrypt.genSalt(10);
        const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

        await updateAdmin(admin._id, admin._rev, { ...admin, refreshToken: refreshTokenHash })

        const accessToken = jwt.sign(
            { id: admin._id, },
            process.env.JWT,
            { expiresIn: '1h', },
        );

        const safeAdmin = { email: admin.email, refreshToken, name: admin.name, id: admin._id };

        return res.status(200).json({ admin: safeAdmin, token: accessToken });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка авторизации. Проверьте введенные данные.',
        });
    }
}

export const checkAdminAuthMiddleware = async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
    const { refreshToken, email } = req.body;

    if (!validateInput(email)) {
        return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
    }

    if (token) {
        try {
            jwt.verify(token, process.env.JWT);

            return next();
        } catch (err) {
            if (err.name !== 'TokenExpiredError') {
                return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
            }
        }
    }

    if (refreshToken) {
        try {
            jwt.verify(refreshToken, process.env.JWT_REFRESH);

            const admin = await findAdmin(email);
            if (!admin || !admin.refreshToken) {
                return res.status(403).json({
                    message: 'Ошибка авторизации. Проверьте введенные данные.',
                });
            }

            const isValid = await bcrypt.compare(refreshToken, admin.refreshToken);
            if (!isValid) {
                return res.status(403).json({
                    message: 'Ошибка авторизации. Проверьте введенные данные.',
                });
            }

            req.body.isRefresh = true;

            return next();
        } catch (err) {
            return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
        }
    }

    return res.status(401).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
}

export const updateAdminTokensMiddleware = async (req, res, next) => {
    if (!req.body.isRefresh) {
        return next();
    }

    try {
        const admin = await findAdmin(req.body.email)
        const newAccessToken = jwt.sign(
            { id: admin._id },
            process.env.JWT,
            { expiresIn: '1h' }
        );

        const newRefreshToken = jwt.sign(
            { id: admin._id },
            process.env.JWT_REFRESH,
            { expiresIn: '7d' }
        );

        const salt = await bcrypt.genSalt(10);
        const refreshTokenHash = await bcrypt.hash(newRefreshToken, salt);

        await updateAdmin(admin._id, admin._rev, {
            ...admin,
            refreshToken: refreshTokenHash,
        });

        req.body.token = newAccessToken;
        req.body.refreshToken = newRefreshToken;

        next();
    } catch (error) {
        logger.error('Error processing data request', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
    }
}

//TODO: ANALYTIC REQESTS 

export const getCount = async (req, res) => {
    try {
        const count = await getUsersCount()

        return res.status(200).json({ count });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}

export const getOnlineCount = async (req, res) => {
    try {
        const count = await getOnlineUsersCount()

        return res.status(200).json({ on_count: count });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}

export const getUsers = async (req, res) => {
    try {
        const { page } = req.body;
        const data = await getUsersPaginated(page);

        return res.status(200).json({ users: data.docs, hasMore: data.hasMore });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}

export const deleteUserReq = async (req, res) => {
    try {
        const { us_email } = req.body;
        const user = await findByEmail(us_email);

        await deleteUser(user[0]._id, user[0]._rev)
        return res.status(200).json({ message: 'ok' });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}