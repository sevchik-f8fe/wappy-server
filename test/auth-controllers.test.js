import { expect } from 'chai';
import nock from 'nock';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockDatabase = () => {
    nock('http://test-db:5984')
        .persist();
};

describe('Auth Controllers - Real Implementation', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            body: {},
            headers: {}
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

        next = () => { };

        process.env.JWT = 'test-jwt-secret';
        process.env.JWT_REFRESH = 'test-jwt-refresh-secret';
        process.env.BD_LINK = 'http://test-db:5984/';

        mockDatabase();
    });

    afterEach(() => {
        nock.cleanAll();
        delete process.env.JWT;
        delete process.env.JWT_REFRESH;
        delete process.env.BD_LINK;
    });

    describe('signUp', () => {
        it('should register new user successfully', async () => {
            const { signUp } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: `test${Date.now()}@example.com`,
                password: 'password123'
            };

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            nock('http://test-db:5984')
                .post('/users')
                .reply(201, { ok: true, id: 'new_user_id', rev: '1-123' });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signUp(req, res, next);

            expect(nextCalled).to.be.true;
            expect(res.statusCode).to.be.null;
        });

        it('should return 400 for existing user', async () => {
            const { signUp } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'existing@example.com',
                password: 'password123'
            };

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, {
                    docs: [{
                        email: 'existing@example.com',
                        _id: 'existing_user_id',
                        _rev: '1-abc'
                    }]
                });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signUp(req, res, next);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.include('Ошибка регистрации');
            expect(nextCalled).to.be.false;
        });

        it('should return 400 for invalid input', async () => {
            const { signUp } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'invalid<script>',
                password: 'pass'
            };

            req.body = mockUser;

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signUp(req, res, next);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.include('Ошибка регистрации');
            expect(nextCalled).to.be.false;
        });

        it('should handle database errors during registration', async () => {
            const { signUp } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'test@example.com',
                password: 'password123'
            };

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(500, { error: 'Database error' });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signUp(req, res, next);

            expect(res.statusCode).to.equal(500);
            expect(res.responseData.message).to.include('Ошибка регистрации');
            expect(nextCalled).to.be.false;
        });
    });

    describe('signIn', () => {
        it('should sign in user successfully', async () => {
            const { signIn } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'test@example.com',
                password: 'password123'
            };

            const hashedPassword = await bcrypt.hash('password123', 10);

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, {
                    docs: [{
                        email: 'test@example.com',
                        passwordHash: hashedPassword,
                        _id: 'user123',
                        _rev: '1-abc'
                    }]
                });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signIn(req, res, next);

            expect(nextCalled).to.be.true;
            expect(req.body.path).to.equal('signInVerification');
            expect(res.statusCode).to.be.null;
        });

        it('should return 404 for non-existent user', async () => {
            const { signIn } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'nonexistent@example.com',
                password: 'password123'
            };

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signIn(req, res, next);

            expect(res.statusCode).to.equal(404);
            expect(res.responseData.message).to.include('Ошибка авторизации');
            expect(nextCalled).to.be.false;
        });

        it('should return 400 for invalid password', async () => {
            const { signIn } = await import('../controllers/authControllers.js');

            const mockUser = {
                email: 'test@example.com',
                password: 'wrongpassword'
            };

            const hashedPassword = await bcrypt.hash('correctpassword', 10);

            req.body = mockUser;

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, {
                    docs: [{
                        email: 'test@example.com',
                        passwordHash: hashedPassword,
                        _id: 'user123',
                        _rev: '1-abc'
                    }]
                });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await signIn(req, res, next);

            expect(res.statusCode).to.equal(400);
            expect(res.responseData.message).to.include('Ошибка авторизации');
            expect(nextCalled).to.be.false;
        });
    });

    describe('checkAuthMiddleware', () => {
        it('should allow access with valid access token', async () => {
            const { checkAuthMiddleware } = await import('../controllers/authControllers.js');

            const validToken = jwt.sign({ id: 'user123' }, process.env.JWT, { expiresIn: '1h' });

            req.headers.authorization = `Bearer ${validToken}`;
            req.body = { email: 'test@example.com' };

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await checkAuthMiddleware(req, res, next);

            expect(nextCalled).to.be.true;
            expect(res.statusCode).to.be.null;
        });

        it('should return 403 for invalid access token', async () => {
            const { checkAuthMiddleware } = await import('../controllers/authControllers.js');

            req.headers.authorization = 'Bearer invalid-token';
            req.body = { email: 'test@example.com' };

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await checkAuthMiddleware(req, res, next);

            expect(res.statusCode).to.equal(403);
            expect(res.responseData.message).to.include('Ошибка авторизации');
            expect(nextCalled).to.be.false;
        });

        it('should allow access with valid refresh token when access token expired', async () => {
            const { checkAuthMiddleware } = await import('../controllers/authControllers.js');

            const expiredToken = jwt.sign({ id: 'user123' }, process.env.JWT, { expiresIn: '-1h' });
            const refreshToken = jwt.sign({ id: 'user123' }, process.env.JWT_REFRESH, { expiresIn: '7d' });
            const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

            req.headers.authorization = `Bearer ${expiredToken}`;
            req.body = {
                email: 'test@example.com',
                refreshToken: refreshToken
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, {
                    docs: [{
                        email: 'test@example.com',
                        refreshToken: hashedRefreshToken,
                        _id: 'user123',
                        _rev: '1-abc'
                    }]
                });

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await checkAuthMiddleware(req, res, next);

            expect(nextCalled).to.be.true;
            expect(req.body.isRefresh).to.be.true;
            expect(res.statusCode).to.be.null;
        });
    });

    describe('updateTokensMiddleware', () => {
        it('should update tokens successfully', async () => {
            const { updateTokensMiddleware } = await import('../controllers/authControllers.js');

            req.body = {
                isRefresh: true,
                email: 'test@example.com'
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, {
                    docs: [{
                        email: 'test@example.com',
                        _id: 'user123',
                        _rev: '1-abc'
                    }]
                });

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true, id: 'user123', rev: '2-def' }]);

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await updateTokensMiddleware(req, res, next);

            expect(nextCalled).to.be.true;
            expect(req.body.token).to.be.a('string');
            expect(req.body.refreshToken).to.be.a('string');
            expect(res.statusCode).to.be.null;
        });

        it('should call next immediately when not refresh flow', async () => {
            const { updateTokensMiddleware } = await import('../controllers/authControllers.js');

            req.body = {
                isRefresh: false,
                email: 'test@example.com'
            };

            let nextCalled = false;
            const next = () => { nextCalled = true; };

            await updateTokensMiddleware(req, res, next);

            expect(nextCalled).to.be.true;
            expect(req.body.token).to.be.undefined;
            expect(req.body.refreshToken).to.be.undefined;
        });
    });
});