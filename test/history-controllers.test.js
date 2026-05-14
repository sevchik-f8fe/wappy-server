import { expect } from 'chai';
import nock from 'nock';
import { addToHistory } from '../controllers/histrotyLoadControllers.js';

describe('History Load Controllers', () => {
    let req, res;

    beforeEach(() => {
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

        process.env.BD_LINK = 'http://test-db:5984/';
    });

    afterEach(() => {
        nock.cleanAll();
        delete process.env.BD_LINK;
    });

    describe('addToHistory', () => {
        it('should add item to history successfully', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: ['item1'],
                historyLoad: []
            };

            const mockItem = { id: 'item1', title: 'Test Item' };
            const mockSource = 'tenor';

            req.body = {
                user_email: 'test@example.com',
                item: mockItem,
                source: mockSource
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('test@example.com');
            expect(res.responseData.user.active).to.be.true;
            expect(res.responseData.user.id).to.equal('user123');
            expect(res.responseData.token).to.be.undefined;
        });

        it('should add item to history with token when isRefresh is true', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
                historyLoad: [{ source: 'existing', data: { id: 'old' }, loadDate: Date.now() }]
            };

            const mockItem = { id: 'item2', title: 'New History Item' };
            const mockSource = 'photos';

            req.body = {
                user_email: 'test@example.com',
                item: mockItem,
                source: mockSource,
                refreshToken: 'refresh-token-123',
                token: 'access-token-123',
                isRefresh: true
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('test@example.com');
            expect(res.responseData.user.refreshToken).to.equal('refresh-token-123');
            expect(res.responseData.token).to.equal('access-token-123');
        });

        it('should return 404 when user not found', async () => {
            req.body = {
                user_email: 'nonexistent@example.com',
                item: { id: 'item1' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(404);
            expect(res.responseData.error).to.equal('Ошибка');
        });

        it('should handle database errors during user search', async () => {
            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item1' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(500, { error: 'Database error' });

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Ошибка');
        });

        it('should handle database errors during user update', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item1' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(500, { error: 'Update failed' });

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Ошибка');
        });

        it('should add item to beginning of history array with loadDate', async () => {
            const existingHistory = [
                {
                    source: 'tenor',
                    data: { id: 'old1', title: 'Old Item 1' },
                    loadDate: Date.now() - 10000
                },
                {
                    source: 'photos',
                    data: { id: 'old2', title: 'Old Item 2' },
                    loadDate: Date.now() - 5000
                }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
                historyLoad: existingHistory
            };

            const newItem = { id: 'new1', title: 'New History Item' };
            const newSource = 'svg';

            req.body = {
                user_email: 'test@example.com',
                item: newItem,
                source: newSource
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.historyLoad[0].source).to.equal(newSource);
            expect(res.responseData.user.historyLoad[0].data).to.deep.equal(newItem);
            expect(res.responseData.user.historyLoad[0].loadDate).to.be.a('number');
        });

        it('should handle empty history array when adding', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'firstItem' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.historyLoad).to.have.lengthOf(1);
            expect(res.responseData.user.historyLoad[0].data.id).to.equal('firstItem');
        });

        it('should preserve existing history items', async () => {
            const existingHistory = [
                {
                    source: 'tenor',
                    data: { id: 'item1' },
                    loadDate: 1234567890
                }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
                historyLoad: existingHistory
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item2' },
                source: 'photos'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await addToHistory(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.historyLoad).to.have.lengthOf(2);
            expect(res.responseData.user.historyLoad[1].data.id).to.equal('item1');
            expect(res.responseData.user.historyLoad[1].source).to.equal('tenor');
        });
    });
});