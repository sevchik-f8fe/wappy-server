import { expect } from 'chai';
import nock from 'nock';

const sendEmailMock = async () => {
    return Promise.resolve();
};

const originalImportMetaUrl = import.meta.url;

describe('Confirm Email Controllers', () => {
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

        process.env.JWT = 'test-jwt-secret';
        process.env.JWT_REFRESH = 'test-jwt-refresh-secret';
        process.env.BD_LINK = 'http://test-db:5984/';

        global.sendEmail = sendEmailMock;
    });

    afterEach(() => {
        nock.cleanAll();
        delete process.env.JWT;
        delete process.env.JWT_REFRESH;
        delete process.env.BD_LINK;
        delete global.sendEmail;
    });

    describe('confirmMail', () => {
        it('should confirm email successfully for activation path', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockCode = '123456';
            const mockEmail = 'test@example.com';
            const mockPath = 'activation';

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: mockEmail,
                isActive: false,
                activation: {
                    code: mockCode,
                    generatedAt: Date.now() - 1000
                }
            };

            req.body = {
                enterCode: mockCode,
                email: mockEmail,
                path: mockPath
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal(mockEmail);
            expect(res.responseData.user.active).to.be.true;
            expect(res.responseData.token).to.be.a('string');
            expect(res.responseData.user.refreshToken).to.be.a('string');
        });

        it('should confirm email successfully for signInVerification path', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockCode = '123456';
            const mockEmail = 'test@example.com';
            const mockPath = 'signInVerification';

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: mockEmail,
                isActive: true,
                signInVerification: {
                    code: mockCode,
                    generatedAt: Date.now() - 1000
                }
            };

            req.body = {
                enterCode: mockCode,
                email: mockEmail,
                path: mockPath
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true }]);

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(200);
            expect(res.responseData.user.email).to.equal(mockEmail);
            expect(res.responseData.token).to.be.a('string');
        });

        it('should return 400 for invalid input', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            req.body = {
                enterCode: 'invalid<script>',
                email: 'test@example.com',
                path: 'activation'
            };

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when user not found', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            req.body = {
                enterCode: '123456',
                email: 'nonexistent@example.com',
                path: 'activation'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 when code is expired', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: false,
                activation: {
                    code: '123456',
                    generatedAt: Date.now() - (6 * 60 * 1000)
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                path: 'activation'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should return 400 for incorrect code', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: false,
                activation: {
                    code: '123456',
                    generatedAt: Date.now() - 1000
                }
            };

            req.body = {
                enterCode: 'wrongcode',
                email: 'test@example.com',
                path: 'activation'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should handle database errors', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: false,
                activation: {
                    code: '123456',
                    generatedAt: Date.now() - 1000
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                path: 'activation'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(500, { error: 'Database error' });

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.equal('Ошибка.');
        });

        it('should handle JWT signing errors', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const mockUser = {
                _id: 'user123',
                _rev: '1-abc',
                email: 'test@example.com',
                isActive: false,
                activation: {
                    code: '123456',
                    generatedAt: Date.now() - 1000
                }
            };

            req.body = {
                enterCode: '123456',
                email: 'test@example.com',
                path: 'activation'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [mockUser] });

            delete process.env.JWT;

            await confirmMail(req, res);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.equal('Ошибка.');

            process.env.JWT = 'test-jwt-secret';
        });
    });

    describe('Edge cases', () => {
        it('should handle different path types correctly', async () => {
            const { confirmMail } = await import('../controllers/confirmEmailControllers.js');

            const paths = ['activation', 'signInVerification'];

            for (const path of paths) {
                const mockUser = {
                    _id: 'user123',
                    _rev: '1-abc',
                    email: 'test@example.com',
                    isActive: false,
                    activation: {
                        code: '123456',
                        generatedAt: Date.now() - 1000
                    },
                    signInVerification: {
                        code: '123456',
                        generatedAt: Date.now() - 1000
                    }
                };

                req.body = {
                    enterCode: '123456',
                    email: 'test@example.com',
                    path: path
                };

                nock('http://test-db:5984')
                    .post('/users/_find')
                    .reply(200, { docs: [mockUser] });

                nock('http://test-db:5984')
                    .post('/users/_bulk_docs')
                    .reply(201, [{ ok: true }]);

                await confirmMail(req, res);

                expect(res.statusCode).to.equal(200);

                nock.cleanAll();
                res.statusCode = null;
                res.responseData = null;
            }
        });
    });
});