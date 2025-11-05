import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { createUser } from "../schemas/User.js";
import { validateInput, findByEmail, addNewUser, updateUser } from "./util.js";

export const signUp = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!validateInput(email) || !validateInput(password)) {
            console.log('notval')
            return res.status(400).json({
                message: 'Ошибка регистрации. Проверьте введенные данные.',
            });
        }
        console.log('start find for signup')

        const existingUser = await findByEmail(email);

        if (existingUser[0]) {
            console.log('ex')
            return res.status(400).json({
                message: 'Ошибка регистрации. Проверьте введенные данные.',
            });
        }

        const newUserData = await createUser(email, password);
        await addNewUser(newUserData)

        next();
    } catch (err) {
        console.log(err)
        res.status(500).json({
            message: 'Ошибка регистрации. Проверьте введенные данные.',
        });
    }
}

export const signIn = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!validateInput(email) || !validateInput(password)) {
            return res.status(400).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        const user = await findByEmail(email);

        if (!user[0]) {
            return res.status(404).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        const isValidPassword = await bcrypt.compare(password, user[0].passwordHash);

        if (!isValidPassword) {
            return res.status(400).json({
                message: 'Ошибка авторизации. Проверьте введенные данные.',
            });
        }

        req.body.path = 'signInVerification';
        next();
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка авторизации. Проверьте введенные данные.',
        });
    }
}

export const checkAuthMiddleware = async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/Bearer\s?/, '');
    const { refreshToken, email } = req.body;

    if (!validateInput(email)) {
        console.log('not ex err email')
        return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
    }

    if (token) {
        try {
            jwt.verify(token, process.env.JWT);
            return next();
        } catch (err) {
            if (err.name !== 'TokenExpiredError') {
                console.log('not ex err verify: ', err)
                return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
            }
        }
    }

    if (refreshToken) {
        try {
            jwt.verify(refreshToken, process.env.JWT_REFRESH);

            const user = await findByEmail(email);
            if (!user[0] || !user[0].refreshToken) {
                console.log('ex err no user/ref token')
                return res.status(403).json({
                    message: 'Ошибка авторизации. Проверьте введенные данные.',
                });
            }

            const isValid = await bcrypt.compare(refreshToken, user[0].refreshToken);
            if (!isValid) {
                console.log('ex err not valid')
                return res.status(403).json({
                    message: 'Ошибка авторизации. Проверьте введенные данные.',
                });
            }

            req.body.isRefresh = true;
            return next();
        } catch (err) {
            console.log('ex err: ', err)
            return res.status(403).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
        }
    }
    console.log('no tokens')

    return res.status(401).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
}

export const updateTokensMiddleware = async (req, res, next) => {
    if (!req.body.isRefresh) {
        return next();
    }

    try {
        const newAccessToken = jwt.sign(
            { id: req.userId },
            process.env.JWT,
            { expiresIn: '1h' }
        );

        const newRefreshToken = jwt.sign(
            { id: req.userId },
            process.env.JWT_REFRESH,
            { expiresIn: '7d' }
        );

        const salt = await bcrypt.genSalt(10);
        const refreshTokenHash = await bcrypt.hash(newRefreshToken, salt);

        const user = await findByEmail(req.body.email)

        await updateUser(user[0]._id, user[0]._rev, {
            ...user[0],
            refreshToken: refreshTokenHash,
            updatedAt: new Date().getTime()
        });

        req.body.token = newAccessToken;
        req.body.refreshToken = newRefreshToken;

        next();
    } catch (error) {
        console.log('up tokens er: ', error)

        return res.status(500).json({ message: 'Ошибка авторизации. Проверьте введенные данные.' });
    }
}