/**
 * Логирование с Winston и корреляция запросов
 * 
 * Winston конфигурация:
 * - Уровень логирования: из env LOG_LEVEL (default: info)
 * - Формат: timestamp + JSON
 * - Транспорт: Console (всегда)
 * - Метаданные: service, environment, correlationId
 * 
 * Middleware:
 * 
 * 1. correlationMiddleware:
 *    - Генерирует/извлекает correlation ID
 *    - Источники: x-correlation-id, x-request-id
 *    - Формат: corr-{timestamp}-{random}
 *    - Добавляет заголовок в ответ
 *    - Добавляет ID в метаданные логгера
 * 
 * 2. httpLoggerMiddleware:
 *    - Логирует каждый HTTP запрос
 *    - Замеряет длительность выполнения
 *    - Логирует: метод, URL, статус, duration, User-Agent, IP
 * 
 * Использование:
 * - В контроллерах: logger.info/error/warn
 * - Автоматическое логирование всех запросов
 */

import winston from 'winston';

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: {
        service: 'wappy-server',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ]
});

export const correlationMiddleware = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    logger.defaultMeta = {
        ...logger.defaultMeta,
        correlationId
    };

    next();
};

export const httpLoggerMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;

        logger.info('HTTP request', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
    });

    next();
};