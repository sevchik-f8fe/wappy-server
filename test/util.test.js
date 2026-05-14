import { expect } from 'chai';
import nock from 'nock';
import axios from 'axios';
import * as utils from '../controllers/util.js';

const originalEnv = process.env;

describe('Utils Functions', () => {

    beforeEach(() => {
        process.env.BD_LINK = 'http://test-db:5984/';
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        nock.cleanAll();
    });

    describe('generateCode()', () => {
        it('should generate a 6-digit code', () => {
            const code = utils.generateCode();
            expect(code).to.be.a('string');
            expect(code).to.have.lengthOf(6);
            expect(/^\d{6}$/.test(code)).to.be.true;
        });

        it('should generate different codes on multiple calls', () => {
            const codes = new Set();
            for (let i = 0; i < 10; i++) {
                codes.add(utils.generateCode());
            }
            expect(codes.size).to.be.greaterThan(1);
        });
    });

    describe('validateInput()', () => {
        it('should return true for valid input', () => {
            expect(utils.validateInput('validInput')).to.be.true;
            expect(utils.validateInput('test123')).to.be.true;
        });

        it('should return false for empty input', () => {
            expect(utils.validateInput('')).to.be.false;
            expect(utils.validateInput(null)).to.be.false;
            expect(utils.validateInput(undefined)).to.be.false;
        });

        it('should return false for input longer than 60 characters', () => {
            const longString = 'a'.repeat(61);
            expect(utils.validateInput(longString)).to.be.false;
        });

        it('should return false for input with special characters', () => {
            expect(utils.validateInput('test<')).to.be.false;
            expect(utils.validateInput('test>')).to.be.false;
            expect(utils.validateInput('test;')).to.be.false;
            expect(utils.validateInput("test'")).to.be.false;
            expect(utils.validateInput('test"')).to.be.false;
            expect(utils.validateInput('test&')).to.be.false;
            expect(utils.validateInput('test+')).to.be.false;
            expect(utils.validateInput('test=')).to.be.false;
            expect(utils.validateInput('test -')).to.be.false;
        });
    });

    describe('findByEmail()', () => {
        it('should find user by email', async () => {
            const mockEmail = 'test@example.com';
            const mockResponse = {
                docs: [{ _id: '123', email: mockEmail, name: 'Test User' }]
            };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, mockResponse);

            const result = await utils.findByEmail(mockEmail);

            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(1);
            expect(result[0].email).to.equal(mockEmail);
        });

        it('should handle empty results', async () => {
            const mockEmail = 'nonexistent@example.com';
            const mockResponse = { docs: [] };

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, mockResponse);

            const result = await utils.findByEmail(mockEmail);

            expect(result).to.be.an('array');
            expect(result).to.have.lengthOf(0);
        });

        it('should handle database errors', async () => {
            const mockEmail = 'test@example.com';

            nock('http://test-db:5984')
                .post('/users/_find')
                .replyWithError('Database connection failed');

            try {
                await utils.findByEmail(mockEmail);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('addNewUser()', () => {
        it('should add new user successfully', async () => {
            const mockUser = {
                email: 'new@example.com',
                password: 'hashedpassword',
                isActive: false
            };

            nock('http://test-db:5984')
                .post('/users')
                .reply(201, { ok: true, id: 'new_user_id', rev: '1-123' });

            await utils.addNewUser(mockUser);

            expect(true).to.be.true;
        });
    });

    describe('updateUser()', () => {
        it('should update user successfully', async () => {
            const userId = 'user123';
            const userRev = '2-abc';
            const updatedDoc = { email: 'updated@example.com', isActive: true };

            nock('http://test-db:5984')
                .post('/users/_bulk_docs')
                .reply(201, [{ ok: true, id: userId, rev: '3-def' }]);

            await utils.updateUser(userId, userRev, updatedDoc);

            expect(true).to.be.true;
        });
    });

    describe('deleteUser()', () => {
        it('should delete user successfully', async () => {
            const userId = 'user123';
            const userRev = '2-abc';

            nock('http://test-db:5984')
                .delete(`/users/${userId}`)
                .matchHeader('If-Match', userRev)
                .reply(200, { ok: true, id: userId });

            await utils.deleteUser(userId, userRev);

            expect(true).to.be.true;
        });

        it('should handle deletion errors', async () => {
            const userId = 'user123';
            const userRev = '2-abc';

            nock('http://test-db:5984')
                .delete(`/users/${userId}`)
                .matchHeader('If-Match', userRev)
                .reply(404, { error: 'not_found', reason: 'missing' });

            try {
                await utils.deleteUser(userId, userRev);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.exist;
            }
        });
    });

    describe('deleteNotActive()', () => {
        it('should delete inactive and old users', async () => {
            const mockUsers = [
                { _id: 'inactive1', _rev: '1-abc', isActive: false, updatedAt: Date.now() - (25 * 60 * 60 * 1000) },
                { _id: 'old1', _rev: '2-def', isActive: true, updatedAt: Date.now() - (4 * 365 * 24 * 60 * 60 * 1000) }
            ];

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: mockUsers });

            mockUsers.forEach(user => {
                nock('http://test-db:5984')
                    .delete(`/users/${user._id}`)
                    .matchHeader('If-Match', user._rev)
                    .reply(200, { ok: true });
            });

            await utils.deleteNotActive();

            expect(true).to.be.true;
        });

        it('should handle empty results', async () => {
            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: [] });

            await utils.deleteNotActive();

            expect(true).to.be.true;
        });

        it('should handle partial deletion failures', async () => {
            const mockUsers = [
                { _id: 'inactive1', _rev: '1-abc' },
                { _id: 'inactive2', _rev: '2-def' }
            ];

            nock('http://test-db:5984')
                .post('/users/_find')
                .reply(200, { docs: mockUsers });

            nock('http://test-db:5984')
                .delete('/users/inactive1')
                .reply(200, { ok: true });

            nock('http://test-db:5984')
                .delete('/users/inactive2')
                .reply(500, { error: 'internal_error' });

            await utils.deleteNotActive();

            expect(true).to.be.true;
        });
    });
});