/**
 * Контроллер для истории загрузок
 * 
 * @function addToHistory - Добавление в историю
 *   - Поиск пользователя по email
 *   - Добавление элемента в начало массива historyLoad
 *   - Формат элемента:
 *     {
 *       source: string,
 *       data: object,
 *       loadDate: timestamp (Date.now())
 *     }
 *   - Обновление updatedAt
 *   - Возврат обновленного пользователя
 * 
 * Особенности:
 * - Запись timestamp загрузки
 * - Сохраняем полные данные элемента
 * - Поддержка refresh токенов
 * - При isRefresh: возвращает новый access токен
 * 
 * Использование:
 * - Вызывается при скачивании медиа-файла
 * - Отображается на странице истории
 * - Используется для статистики и PDF отчета
 * 
 * Безопасность:
 * - Требуется авторизация
 * - Валидация входных данных
 * - Проверка существования пользователя
 */

import { logger } from "../logsControllers/logger.js";
import { findByEmail, updateUser } from "./util.js";

export const addToHistory = async (req, res) => {
    try {
        const { user_email, item, source, refreshToken, token } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            return res.status(404).json({ error: 'Ошибка' });
        }

        const updatedHistory = [
            {
                source,
                data: item,
                loadDate: new Date().getTime()
            },
            ...(user[0].historyLoad || [])
        ];

        await updateUser(user[0]._id, user[0]._rev, {
            ...user[0],
            historyLoad: updatedHistory,
            updatedAt: new Date().getTime()
        });

        const safeUser = {
            email: user[0].email,
            favorites: user[0].favorites,
            historyLoad: updatedHistory,
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