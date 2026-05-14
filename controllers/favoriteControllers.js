/**
 * Контроллеры для управления избранным
 * 
 * @function addToFavorites - Добавление в избранное
 *   - Поиск пользователя по email
 *   - Добавление элемента в начало массива favorites
 *   - Формат элемента: { source, data }
 *   - Обновление updatedAt
 *   - Возврат обновленного пользователя
 * 
 * @function removeFromFavorites - Удаление из избранного
 *   - Фильтрация массива favorites
 *   - Удаление по source и data.id
 *   - Обновление updatedAt
 *   - Возврат обновленного пользователя
 * 
 * Особенности:
 * - Оптимистичное обновление (сначала обновляем локально)
 * - Поддержка refresh токенов (isRefresh)
 * - При isRefresh: возвращает новый access токен
 * - Сохранение истории и других полей пользователя
 * 
 * Безопасность:
 * - Требуется авторизация (checkAuthMiddleware)
 * - Валидация email пользователя
 * - Проверка существования пользователя
 */

import { logger } from "../logsControllers/logger.js";
import { findByEmail, updateUser } from "./util.js";

export const addToFavorites = async (req, res) => {
    try {
        const { user_email, item, source, refreshToken, token } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            return res.status(404).json({ error: 'Ошибка' });
        }

        const updatedFavorites = [{ source, data: item }, ...(user[0].favorites || [])];

        await updateUser(user[0]._id, user[0]._rev, {
            ...user[0],
            favorites: updatedFavorites,
            updatedAt: new Date().getTime()
        });

        const safeUser = {
            email: user[0].email,
            favorites: updatedFavorites,
            historyLoad: user[0].historyLoad,
            active: user[0].isActive,
            id: user[0]._id,
            refreshToken: refreshToken
        };

        if (req.body.isRefresh) {
            return res.status(200).json({ user: safeUser, token: token });
        } else {
            return res.status(200).json({ user: safeUser });
        }
    } catch (error) {
        logger.error('Error processing data request', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: 'Ошибка' });
    }
}

export const removeFromFavorites = async (req, res) => {
    try {
        const { user_email, item, source, refreshToken, token } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            return res.status(404).json({ error: 'Ошибка' });
        }


        const updatedFavorites = (user[0].favorites || []).filter((elem) =>
            !(elem.data.id == item.id && elem.source == source)
        );

        await updateUser(user[0]._id, user[0]._rev, {
            ...user[0],
            favorites: updatedFavorites,
            updatedAt: new Date().getTime()
        });

        const safeUser = {
            email: user[0].email,
            favorites: updatedFavorites,
            historyLoad: user[0].historyLoad,
            active: user[0].isActive,
            id: user[0]._id,
            refreshToken: refreshToken
        };

        if (req.body.isRefresh) {
            return res.status(200).json({ user: safeUser, token: token });
        } else {
            return res.status(200).json({ user: safeUser });
        }
    } catch (error) {
        logger.error('Error processing data request', {
            error: error.message,
            stack: error.stack
        });
        return res.status(500).json({ error: 'Ошибка' });
    }
}