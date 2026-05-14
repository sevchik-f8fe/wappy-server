import { expect } from 'chai';
import nock from 'nock';
import {
    getTenorTrendings,
    getTenorSearch,
    getTenorByID,
    getSVG_search,
    getSVG_code,
    getPhoto_list,
    getPhoto_search,
    responseCache
} from '../controllers/apiControllers.js';

describe('API Controllers', () => {
    let req, res;

    beforeEach(() => {
        // Очищаем кэш перед каждым тестом
        responseCache.clear();

        // Мокаем request и response
        req = {
            body: {}
        };

        res = {
            statusCode: null,
            responseData: null,
            status: function (code) {
                this.statusCode = code;
                return this;
            },
            json: function (data) {
                this.responseData = data;
                return this;
            }
        };

        // Мокаем переменные окружения
        process.env.TENOR_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        nock.cleanAll();
    });

    describe('getTenorTrendings', () => {
        it('should return trending GIFs successfully', async () => {
            const mockResponse = {
                results: [
                    { id: '1', title: 'GIF 1' },
                    { id: '2', title: 'GIF 2' }
                ],
                next: 'next-position'
            };

            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query({ key: 'test-api-key', limit: '15' })
                .reply(200, mockResponse);

            await getTenorTrendings(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.tenor).to.deep.equal(mockResponse);
        });

        it('should use cache for identical requests', async () => {
            const mockResponse = {
                results: [{ id: '1', title: 'Cached GIF' }],
                next: 'pos'
            };

            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query({ key: 'test-api-key', limit: '15' })
                .once() // Только один раз должен быть вызван
                .reply(200, mockResponse);

            // Первый запрос
            await getTenorTrendings(req, res);
            const firstResponse = res.responseData.tenor;

            // Сбрасываем response для второго запроса
            res.responseData = null;
            res.statusCode = null;

            // Второй запрос - должен использовать кэш
            await getTenorTrendings(req, res);
            const secondResponse = res.responseData.tenor;

            expect(firstResponse).to.deep.equal(secondResponse);
        });

        it('should handle API errors', async () => {
            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query(true)
                .reply(500, { error: 'Internal Server Error' });

            await getTenorTrendings(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Unable to fetch trending content');
        });

        it('should handle timeout errors', async function () {
            // Увеличиваем таймаут для этого теста
            this.timeout(5000);

            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query(true)
                .delay(100) // Уменьшаем задержку для теста
                .reply(408);

            await getTenorTrendings(req, res);

            // В реальности axios-retry может повторить запрос, поэтому проверяем общий сценарий
            expect(res.statusCode).to.be.oneOf([408, 500]);
        });

        it('should throw error when TENOR_API_KEY is missing', async () => {
            delete process.env.TENOR_API_KEY;

            await getTenorTrendings(req, res);

            expect(res.statusCode).to.equal(500);
        });
    });

    describe('getTenorSearch', () => {
        it('should search GIFs successfully', async () => {
            const mockResponse = {
                results: [
                    { id: '1', title: 'Search Result 1' },
                    { id: '2', title: 'Search Result 2' }
                ]
            };

            nock('https://g.tenor.com')
                .get('/v1/search')
                .query({
                    q: 'hello',
                    key: 'test-api-key',
                    limit: '15',
                    pos: '0'
                })
                .reply(200, mockResponse);

            req.body = { query: 'hello', page: 0 };

            await getTenorSearch(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.tenor).to.deep.equal(mockResponse.results);
        });

        it('should sanitize search query', async () => {
            const mockResponse = { results: [] };

            nock('https://g.tenor.com')
                .get('/v1/search')
                .query(query => {
                    // Проверяем что query был санитизирован
                    return query.q === 'testalertxss' && query.key === 'test-api-key';
                })
                .reply(200, mockResponse);

            req.body = { query: 'test<script>alert("xss")</script>', page: 0 };

            await getTenorSearch(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.tenor).to.deep.equal(mockResponse.results);
        });

        it('should return 400 for invalid search query', async () => {
            req.body = { query: '', page: 0 };

            await getTenorSearch(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.error).to.equal('Invalid search query');
        });

        it('should validate and limit page number', async () => {
            const mockResponse = { results: [] };

            nock('https://g.tenor.com')
                .get('/v1/search')
                .query({
                    q: 'test',
                    key: 'test-api-key',
                    limit: '15',
                    pos: '20000' // 1000 * 20 = 20000
                })
                .reply(200, mockResponse);

            req.body = { query: 'test', page: 1000 };

            await getTenorSearch(req, res);

            expect(res.statusCode).to.equal(200);
        });

        it('should handle search errors', async () => {
            nock('https://g.tenor.com')
                .get('/v1/search')
                .query(true)
                .reply(500, { error: 'API Error' });

            req.body = { query: 'test', page: 0 };

            await getTenorSearch(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Search service temporarily unavailable');
        });
    });

    describe('getTenorByID', () => {
        it('should return GIF by ID successfully', async () => {
            const mockGif = { id: '123', title: 'Test GIF', media: [] };
            const mockResponse = { results: [mockGif] };

            nock('https://g.tenor.com')
                .get('/v1/gifs')
                .query({ ids: '123', key: 'test-api-key', limit: '1' })
                .reply(200, mockResponse);

            req.body = { id: '123' };

            await getTenorByID(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.tenor).to.deep.equal(mockGif);
        });

        it('should return 400 for invalid GIF ID', async () => {
            req.body = { id: '' };

            await getTenorByID(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.error).to.equal('Invalid GIF ID');
        });

        it('should handle non-existent GIF ID', async () => {
            const mockResponse = { results: [] };

            nock('https://g.tenor.com')
                .get('/v1/gifs')
                .query(true)
                .reply(200, mockResponse);

            req.body = { id: 'nonexistent' };

            await getTenorByID(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.tenor).to.be.null;
        });

        it('should sanitize GIF ID', async () => {
            const mockResponse = { results: [] };

            nock('https://g.tenor.com')
                .get('/v1/gifs')
                .query(query => query.ids === 'testid')
                .reply(200, mockResponse);

            req.body = { id: 'testid<script>' };

            await getTenorByID(req, res);

            expect(res.statusCode).to.equal(200);
        });
    });

    describe('getSVG_search', () => {
        it('should search SVGs successfully', async () => {
            const mockResponse = [
                { name: 'icon1', title: 'Icon 1' },
                { name: 'icon2', title: 'Icon 2' }
            ];

            nock('https://api.svgl.app')
                .get('/')
                .query({ search: 'icon' })
                .reply(200, mockResponse);

            req.body = { query: 'icon' };

            await getSVG_search(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.svg).to.deep.equal(mockResponse);
        });

        it('should return 400 for invalid search query', async () => {
            req.body = { query: '' };

            await getSVG_search(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.error).to.equal('Invalid search query');
        });

        it('should sanitize SVG search query', async () => {
            const mockResponse = [];

            nock('https://api.svgl.app')
                .get('/')
                .query({ search: 'testsvgonloadalert1' }) // Санитизированная строка
                .reply(200, mockResponse);

            req.body = { query: 'test<svg onload=alert(1)>' };

            await getSVG_search(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.svg).to.deep.equal(mockResponse);
        });

        it('should handle SVG search errors', async () => {
            nock('https://api.svgl.app')
                .get('/')
                .query(true)
                .reply(500);

            req.body = { query: 'test' };

            await getSVG_search(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('SVG search service unavailable');
        });
    });

    describe('getSVG_code', () => {
        it('should return SVG code successfully', async () => {
            const mockSvgCode = '<svg>test</svg>';

            nock('https://api.svgl.app')
                .get('/svg/test-icon?no-optimize')
                .reply(200, mockSvgCode);

            req.body = { name: 'test-icon' };

            await getSVG_code(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.svg).to.equal(mockSvgCode);
        });

        it('should return 400 for invalid SVG name', async () => {
            req.body = { name: '' };

            await getSVG_code(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.error).to.equal('Invalid SVG name');
        });

        it('should prevent path traversal attacks', async () => {
            req.body = { name: '../../../etc/passwd' };

            await getSVG_code(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.error).to.equal('Invalid SVG name');
        });

        it('should handle 404 for non-existent SVG', async () => {
            nock('https://api.svgl.app')
                .get('/svg/nonexistent?no-optimize')
                .reply(404);

            req.body = { name: 'nonexistent' };

            await getSVG_code(req, res);

            expect(res.statusCode).to.equal(404);
            expect(res.responseData.error).to.equal('SVG not found');
        });

        it('should sanitize SVG name', async () => {
            const mockSvgCode = '<svg>sanitized</svg>';

            nock('https://api.svgl.app')
                .get('/svg/testname?no-optimize')
                .reply(200, mockSvgCode);

            req.body = { name: 'test<name>script' };

            await getSVG_code(req, res);

            expect(res.statusCode).to.equal(200);
        });
    });

    describe('getPhoto_list', () => {
        it('should return photo list successfully', async () => {
            const mockResponse = {
                data: [
                    { id: '1', url: 'photo1.jpg' },
                    { id: '2', url: 'photo2.jpg' }
                ]
            };

            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query({ page: '1' })
                .reply(200, mockResponse);

            req.body = { page: 1 };

            await getPhoto_list(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.photo).to.deep.equal(mockResponse.data);
        });

        it('should validate and limit page number', async () => {
            const mockResponse = { data: [] };

            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query({ page: '1000' })
                .reply(200, mockResponse);

            req.body = { page: 1500 }; // Должно быть ограничено до 1000

            await getPhoto_list(req, res);

            expect(res.statusCode).to.equal(200);
        });

        it('should handle negative page numbers', async () => {
            const mockResponse = { data: [] };

            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query({ page: '0' })
                .reply(200, mockResponse);

            req.body = { page: -5 };

            await getPhoto_list(req, res);

            expect(res.statusCode).to.equal(200);
        });

        it('should handle photo list errors', async () => {
            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query(true)
                .reply(500);

            req.body = { page: 1 };

            await getPhoto_list(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Unable to fetch photo list');
        });
    });

    describe('getPhoto_search', () => {
        it('should search photos successfully', async () => {
            const mockResponse = {
                data: [
                    { id: '1', url: 'nature1.jpg' },
                    { id: '2', url: 'nature2.jpg' }
                ]
            };

            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query({ q: 'nature', page: '1' })
                .reply(200, mockResponse);

            req.body = { query: 'nature', page: 1 };

            await getPhoto_search(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.photo).to.deep.equal(mockResponse.data);
        });

        it('should use cache for photo search', async () => {
            const mockResponse = { data: [{ id: '1', url: 'cached.jpg' }] };

            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query({ q: 'test', page: '1' })
                .once() // Только один раз
                .reply(200, mockResponse);

            req.body = { query: 'test', page: 1 };

            // Первый запрос
            await getPhoto_search(req, res);
            const firstResponse = res.responseData.photo;

            // Сбрасываем response для второго запроса
            res.responseData = null;
            res.statusCode = null;

            // Второй запрос - должен использовать кэш
            await getPhoto_search(req, res);
            const secondResponse = res.responseData.photo;

            expect(firstResponse).to.deep.equal(secondResponse);
        });

        it('should handle photo search errors', async () => {
            nock('https://wallhaven.cc')
                .get('/api/v1/search')
                .query(true)
                .reply(500);

            req.body = { query: 'test', page: 1 };

            await getPhoto_search(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Photo search service unavailable');
        });
    });

    describe('Cache functionality', () => {
        it('should cache responses with TTL', async () => {
            const mockResponse = { results: [{ id: '1' }] };

            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query(true)
                .reply(200, mockResponse);

            await getTenorTrendings(req, res);

            // Проверяем что данные добавлены в кэш
            expect(responseCache.size).to.equal(1);
        });

        it('should expire cache after TTL', async () => {
            const mockResponse = { results: [{ id: '1' }] };

            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query(true)
                .reply(200, mockResponse);

            await getTenorTrendings(req, res);

            // Симулируем истечение TTL
            const cacheKey = 'tenor_trending_';
            const cached = responseCache.get(cacheKey);
            cached.timestamp = Date.now() - (6 * 60 * 1000); // 6 минут назад

            // Следующий запрос должен сделать новый HTTP запрос
            const newMockResponse = { results: [{ id: '2' }] };
            nock('https://g.tenor.com')
                .get('/v1/trending')
                .query(true)
                .reply(200, newMockResponse);

            // Сбрасываем response
            res.responseData = null;
            res.statusCode = null;

            await getTenorTrendings(req, res);

            expect(res.responseData.tenor.results[0].id).to.equal('2');
        });
    });
});