import { expect } from 'chai';
import nock from 'nock';
import { deleteAccount, changeEmail } from '../controllers/profileControllers.js';

describe('Profile Controllers', () => {
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

    describe('deleteAccount', () => {
        it('should delete account successfully', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com'
            };

            req.body = {
                email: 'test@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .delete('/users/user123')
                .matchHeader('If-Match', '1-abc')
                .reply(200, { ok: true, id: 'user123' });

            await deleteAccount(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.message).to.equal('ok del');
        });

        it('should return 400 for invalid email input', async () => {
            req.body = {
                email: 'invalid<script>'
            };

            await deleteAccount(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when user not found', async () => {
            req.body = {
                email: 'nonexistent@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await deleteAccount(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should handle database errors during user search', async () => {
            req.body = {
                email: 'test@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(500, { error: 'Database error' });

            await deleteAccount(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should handle database errors during user deletion', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com'
            };

            req.body = {
                email: 'test@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .delete('/users/user123')
                .matchHeader('If-Match', '1-abc')
                .reply(500, { error: 'Deletion failed' });

            await deleteAccount(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.equal('Ошибка.');
        });
    });

    describe('changeEmail', () => {
        it('should change email successfully with valid code', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'old@example.com',
                isActive: true,
                favorites: ['item1'],
                historyLoad: ['item2'],
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'old@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('new@example.com');
            expect(res.responseData.user.active).to.be.true;
            expect(res.responseData.user.favorites).to.deep.equal(['item1']);
            expect(res.responseData.token).to.be.undefined;
        });

        it('should change email with token when isRefresh is true', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'old@example.com',
                isActive: true,
                favorites: [],
                historyLoad: [],
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'old@example.com',
                newEmail: 'new@example.com',
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

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('new@example.com');
            expect(res.responseData.user.refreshToken).to.equal('refresh-token-123');
            expect(res.responseData.token).to.equal('access-token-123');
        });

        it('should return 400 for invalid input', async () => {
            req.body = {
                enterCode: 'invalid<script>',
                email: 'test@example.com',
                newEmail: 'new@example.com'
            };

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when user not found', async () => {
            req.body = {
                enterCode: '123456',
                email: 'nonexistent@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when emailChange data is missing', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when emailChange code is missing', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                emailChange: {
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when code is expired', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - (6 * 60 * 1000),
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 for incorrect code', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: true,
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: 'wrongcode',
                email: 'test@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should handle database errors during email change', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'old@example.com',
                isActive: true,
                favorites: [],
                historyLoad: [],
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'old@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(500, { error: 'Update failed' });

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should clear emailChange data after successful change', async () => {
            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'old@example.com',
                isActive: true,
                favorites: [],
                historyLoad: [],
                emailChange: {
                    code: '123456',
                    generatedAt: Date.now() - 1000,
                    newEmail: 'new@example.com'
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'old@example.com',
                newEmail: 'new@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            // Проверяем что emailChange очищается
            nock('http://test-db:5984')
                .post('/users/_bulk_docs', {
                    docs: [{
                        _id: 'user123',
                        _rev: '1-abc',
                        email: 'new@example.com',
                        isActive: true,
                        favorites: [],
                        historyLoad: [],
                        emailChange: { code: null, generatedAt: null },
                        updatedAt: /^\d+$/
                    }]
                })
                .reply(201, [{ ok: true }]);

            await changeEmail(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal('new@example.com');
        });
    });
});