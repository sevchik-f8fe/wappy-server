import { expect } from 'chai';
import nock from 'nock';
import { addToFavorites, removeFromFavorites } from '../controllers/favoriteControllers.js';

describe('Favorite Controllers', () => {
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

    describe('addToFavorites', () => {
        it('should add item to favorites successfully', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [],
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

            await addToFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('test@example.com');
            expect(res.responseData.user.active).to.be.true;
            expect(res.responseData.user.id).to.equal('user123');
            expect(res.responseData.token).to.be.undefined;
        });

        it('should add item to favorites with token when isRefresh is true', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: [{ source: 'existing', data: { id: 'existing' } }],
                historyLoad: ['item1']
            };

            const mockItem = { id: 'item2', title: 'New Item' };
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

            await addToFavorites(req, res);

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

            await addToFavorites(req, res);

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

            await addToFavorites(req, res);

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

            await addToFavorites(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Ошибка');
        });

        it('should add item to beginning of favorites array', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'old1' } },
                { source: 'photos', data: { id: 'old2' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
                historyLoad: []
            };

            const newItem = { id: 'new1', title: 'New Favorite' };
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

            await addToFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.favorites[0].source).to.equal(newSource);
            expect(res.responseData.user.favorites[0].data).to.deep.equal(newItem);
        });
    });

    describe('removeFromFavorites', () => {
        it('should remove item from favorites successfully', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'item1', title: 'Item 1' } },
                { source: 'photos', data: { id: 'item2', title: 'Item 2' } },
                { source: 'svg', data: { id: 'item3', title: 'Item 3' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item2', title: 'Item 2' },
                source: 'photos'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('test@example.com');
            expect(res.responseData.user.favorites).to.have.lengthOf(2);
            expect(res.responseData.user.favorites.find(fav =>
                fav.data.id === 'item2' && fav.source === 'photos'
            )).to.be.undefined;
        });

        it('should remove item from favorites with token when isRefresh is true', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'item1' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item1' },
                source: 'tenor',
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

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.refreshToken).to.equal('refresh-token-123');
            expect(res.responseData.token).to.equal('access-token-123');
        });

        it('should return 404 when user not found for removal', async () => {
            req.body = {
                user_email: 'nonexistent@example.com',
                item: { id: 'item1' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(404);
            expect(res.responseData.error).to.equal('Ошибка');
        });

        it('should handle case when item to remove is not in favorites', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'item1' } },
                { source: 'photos', data: { id: 'item2' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'nonexistent' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.favorites).to.have.lengthOf(2);
        });

        it('should remove only exact matching items', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'item1', title: 'Item 1' } },
                { source: 'tenor', data: { id: 'item2', title: 'Item 2' } },
                { source: 'photos', data: { id: 'item1', title: 'Item 1' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
                historyLoad: []
            };

            req.body = {
                user_email: 'test@example.com',
                item: { id: 'item1', title: 'Item 1' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.favorites).to.have.lengthOf(2);
            expect(res.responseData.user.favorites.find(fav =>
                fav.source === 'tenor' && fav.data.id === 'item1'
            )).to.be.undefined;
            expect(res.responseData.user.favorites.find(fav =>
                fav.source === 'photos' && fav.data.id === 'item1'
            )).to.exist;
        });

        it('should handle database errors during removal', async () => {
            const existingFavorites = [
                { source: 'tenor', data: { id: 'item1' } }
            ];

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                favorites: existingFavorites,
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

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.error).to.equal('Ошибка');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty favorites array when adding', async () => {
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

            await addToFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.favorites).to.have.lengthOf(1);
        });

        it('should handle empty favorites array when removing', async () => {
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
                item: { id: 'nonexistent' },
                source: 'tenor'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await removeFromFavorites(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.favorites).to.have.lengthOf(0);
        });
    });
});