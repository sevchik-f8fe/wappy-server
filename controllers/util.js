/**
 * Утилиты для работы с базой данных и валидации
 * 
 * Генерация:
 * @function generateCode - 6-значный числовой код (000000-999999)
 * 
 * Валидация:
 * @function validateInput - Проверка входных данных
 *   - Не пустой, длина ≤ 60
 *   - Без опасных символов: < > ; ' " & += -
 * 
 * Поиск:
 * @function findByEmail - Поиск пользователя по email (CouchDB _find)
 * @function findAdmin - Поиск администратора
 * 
 * Статистика:
 * @function getUsersCount - Общее количество пользователей
 * @function getOnlineUsersCount - Онлайн за последнюю минуту
 * @function getUsersPaginated - Пагинированный список (limit=10)
 * 
 * CRUD операции с БД:
 * @function addNewUser - Создание пользователя
 * @function updateUser - Обновление пользователя (_bulk_docs)
 * @function updateAdmin - Обновление администратора
 * @function deleteUser - Удаление пользователя (с _rev)
 * 
 * Очистка:
 * @function deleteNotActive - Фоновая очистка
 *   - Неактивные регистрации (isActive=false, updatedAt < 24 часа)
 *   - Старые аккаунты (updatedAt < 3 года)
 *   - Пауза 100ms каждые 10 удалений
 * 
 * База данных: CouchDB (REST API)
 */

import crypto from "crypto";
import axios from "axios";

import * as dotenv from 'dotenv';
import { logger } from "../logsControllers/logger.js";

dotenv.config();

export const generateCode = () => {
    const buffer = crypto.randomBytes(3);
    const code = parseInt(buffer.toString('hex'), 16) % 1000000;
    return code.toString().padStart(6, '0');
}

export const validateInput = (value) => {
    if (!value || value.length === 0) return false;
    if (value.length > 60) return false;
    return !/[<>;'"&+= \-]/.test(value);
};

export const findByEmail = async (email) => {
    const user = await axios.post(`${process.env.BD_LINK}users/_find`,
        {
            "selector": {
                "email": {
                    "$eq": email
                }
            },
            "limit": 1
        }
    )
        .then(res => res.data.docs)

    return user;
};

export const findAdmin = async (email) => {
    const admin = await axios.post(`${process.env.BD_LINK}admin/_find`,
        {
            "selector": {
                "email": {
                    "$eq": email
                }
            },
            "limit": 1
        }
    )
        .then(res => res.data.docs[0])

    return admin;
};

export const getUsersCount = async () => {
    const response = await axios.get(
        `${process.env.BD_LINK}users/_all_docs?limit=0`
    );
    return response.data.total_rows;
};

export const getOnlineUsersCount = async () => {
    const tenSecondsAgo = Date.now() - (60 * 1000);

    const response = await axios.post(
        `${process.env.BD_LINK}users/_find`,
        {
            selector: {
                "updatedAt": {
                    "$gte": tenSecondsAgo
                }
            },
            fields: ["_id"],
            limit: 100000
        }
    );
    return response.data.docs.length;
};

export const getUsersPaginated = async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const response = await axios.post(
        `${process.env.BD_LINK}users/_find`,
        {
            selector: {},
            limit: limit,
            skip: skip
        }
    );

    return {
        docs: response.data.docs,
        hasMore: response.data.docs.length === limit
    };
};

export const addNewUser = async (user) => {
    await axios.post(`${process.env.BD_LINK}users`,
        user
    )
};

export const updateUser = async (user_id, user_rev, updatedDoc) => {
    await axios.post(
        `${process.env.BD_LINK}users/_bulk_docs`,
        {
            docs: [
                {
                    _id: user_id,
                    _rev: user_rev,
                    ...updatedDoc
                }
            ]
        },
    )
        .then((res) => res.data);
}

export const updateAdmin = async (a_id, a_rev, updatedDoc) => {
    await axios.post(
        `${process.env.BD_LINK}admin/_bulk_docs`,
        {
            docs: [
                {
                    _id: a_id,
                    _rev: a_rev,
                    ...updatedDoc
                }
            ]
        },
    )
        .then((res) => res.data);
}

export const deleteUser = async (user_id, user_rev) => {
    await axios.delete(`${process.env.BD_LINK}users/${user_id}`,
        {
            headers: {
                'If-Match': user_rev,
            }
        }
    );

}

export const deleteNotActive = async () => {
    const threeYearsAgo = Date.now() - (3 * 365 * 24 * 60 * 60 * 1000);
    const halfHourAgo = Date.now() - (24 * 60 * 60 * 1000);

    let docs;
    try {
        const response = await axios.post(
            `${process.env.BD_LINK}users/_find`,
            {
                selector: {
                    "$or": [
                        {
                            "isActive": false,
                            "updatedAt": { "$lt": halfHourAgo }
                        },
                        {
                            "updatedAt": { "$lt": threeYearsAgo }
                        }
                    ]
                },
                limit: 50,
                fields: ["_id", "_rev"]
            }
        );
        docs = response.data.docs;
    } catch (error) {
        logger.error('Error processing data request', {
            error: error.message,
            stack: error.stack
        });
        docs = [];
    }

    if (docs.length === 0) {
        return;
    }

    let deletedCount = 0;
    for (const doc of docs) {
        try {
            await deleteUser(doc._id, doc._rev);
            deletedCount++;

            if (deletedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            logger.error('Error processing data request', {
                error: error.message,
                stack: error.stack
            });
        }
    }
    return;
}