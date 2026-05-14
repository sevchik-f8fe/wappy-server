/**
 * Prometheus метрики для мониторинга сервера
 * 
 * Метрики:
 * 
 * 1. http_request_duration_seconds (Histogram)
 *    - Длительность запросов в секундах
 *    - Лейблы: method, route, status_code
 *    - Buckets: 0.1, 0.5, 1, 2, 3, 5, 10 сек
 * 
 * 2. http_requests_total (Counter)
 *    - Общее количество запросов
 *    - Лейблы: method, route, status_code
 * 
 * 3. active_users (Gauge)
 *    - Количество активных пользователей
 *    - Обновляется через отдельный механизм
 * 
 * 4. search_queries_total (Counter)
 *    - Количество поисковых запросов
 * 
 * Стандартные метрики:
 * - collectDefaultMetrics: память, GC, event loop, и т.д.
 * 
 * Эндпоинт: GET /metrics
 * - Возвращает метрики в формате Prometheus
 * - Используется для сбора данных в Prometheus server
 */

import promClient from 'prom-client';

const register = new promClient.Registry();

promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 3, 5, 10]
});

const httpRequestsTotal = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

const activeUsers = new promClient.Gauge({
    name: 'active_users',
    help: 'Number of active users'
});

const searchQueries = new promClient.Counter({
    name: 'search_queries_total',
    help: 'Total number of search queries'
});

register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeUsers);
register.registerMetric(searchQueries);

export {
    register,
    httpRequestDuration,
    httpRequestsTotal,
    activeUsers,
    searchQueries
};