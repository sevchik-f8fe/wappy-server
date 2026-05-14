import { httpRequestDuration, httpRequestsTotal } from './metrics.js';

export const metricsMiddleware = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;

        httpRequestDuration
            .labels(req.method, route, res.statusCode)
            .observe(duration);

        httpRequestsTotal
            .labels(req.method, route, res.statusCode)
            .inc();
    });

    next();
};