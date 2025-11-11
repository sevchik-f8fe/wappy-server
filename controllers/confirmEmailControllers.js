import jwt from "jsonwebtoken";
import bcrypt from "bcrypt"
import { sendEmail } from "../mail/send-mail.js";
import { generateCode, validateInput, findByEmail, updateUser } from "./util.js";

export const confirmMail = async (req, res) => {
    try {
        const { enterCode, email, path } = req.body;

        if (!validateInput(email) || !validateInput(enterCode)) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        const user = await findByEmail(email);

        if (!user[0] || !user[0][path]?.code || !user[0][path]?.generatedAt) {
            console.log(user[0])
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        if ((new Date() - user[0][path]?.generatedAt) > 1000 * 60 * 5) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }
        const refreshToken = jwt.sign(
            { id: user[0]._id },
            process.env.JWT_REFRESH,
            { expiresIn: '7d' }
        );

        const salt = await bcrypt.genSalt(10);
        const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

        if (enterCode == user[0][path]?.code) {
            switch (path) {
                case 'signInVerification': {
                    await updateUser(user[0]._id, user[0]._rev, {
                        ...user[0],
                        refreshToken: refreshTokenHash,
                        signInVerification: { code: null, generatedAt: null },
                        updatedAt: new Date().getTime()
                    });

                    break;
                }
                default: {
                    await updateUser(user[0]._id, user[0]._rev, {
                        ...user[0],
                        isActive: true,
                        refreshToken: refreshTokenHash,
                        activation: { code: null, generatedAt: null },
                        updatedAt: new Date().getTime()
                    });
                }
            }

            const accessToken = jwt.sign(
                { id: user[0]._id, },
                process.env.JWT,
                { expiresIn: '1h', },
            );

            const safeUser = {
                email: user[0].email,
                favorites: user[0].favorites,
                historyLoad: user[0].historyLoad,
                active: true,
                id: user[0]._id,
                refreshToken: refreshToken
            };

            return res.status(200).json({ user: safeUser, token: accessToken });
        } else {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

    } catch (e) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}

export const sendMail = async (req, res) => {
    try {
        const { email, path, newEmail } = req.body;

        const code = generateCode();
        const mailForSend = path == 'emailChange' ? newEmail : email;

        const mailObj = {
            from: "kononovseva06@yandex.ru",
            to: mailForSend,
            auth_code: {
                code,
            },
        };

        const user = await findByEmail(email);
        const exUser = await findByEmail(newEmail);

        if (exUser[0] && path === 'emailChange') {
            return res.status(500).json({
                message: 'Ошибка.',
            });
        }

        switch (path) {
            case 'signInVerification': {
                await updateUser(user[0]._id, user[0]._rev, {
                    ...user[0],
                    signInVerification: { code: code, generatedAt: new Date().getTime() },
                    updatedAt: new Date().getTime()
                });
                break;
            }
            case 'emailChange': {
                await updateUser(user[0]._id, user[0]._rev, {
                    ...user[0],
                    emailChange: { newEmail: newEmail, code: code, generatedAt: new Date().getTime() },
                    updatedAt: new Date().getTime()
                });
                break;
            }
            default: {
                await updateUser(user[0]._id, user[0]._rev, {
                    ...user[0],
                    isActive: false,
                    activation: { code: code, generatedAt: new Date().getTime() },
                    updatedAt: new Date().getTime()
                });
            }
        }
        await sendEmail(mailObj)
            .catch((error) => console.error("err send:", error));

        const safeUser = {
            email: user[0].email,
            favorites: user[0].favorites,
            historyLoad: user[0].historyLoad,
            active: user[0].isActive,
            id: user[0]._id
        };

        res.status(200).json({ user: safeUser });
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}