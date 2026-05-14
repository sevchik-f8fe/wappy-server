import { config } from 'dotenv';
import nock from 'nock';

config({ path: '.env.test' });

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
}

console.log('Testing in environment:', process.env.NODE_ENV);

beforeEach(() => {
    if (nock && nock.cleanAll) {
        nock.cleanAll();
    }
});

afterEach(() => {
    if (nock && nock.isDone) {
        if (!nock.isDone()) {
            console.error('Pending mocks:', nock.pendingMocks());
        }
        nock.cleanAll();
    }
});