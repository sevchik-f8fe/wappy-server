import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { validateInput, findByEmail, deleteUser, updateUser } from "./util.js";

export const deleteAccount = async (req, res) => {
    try {
        const { email } = req.body;

        if (!validateInput(email)) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        const existingUser = await findByEmail(email);

        if (!existingUser[0]) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        await deleteUser(existingUser[0]._id, existingUser[0]._rev)

        return res.status(200).json({ message: 'ok del' });

    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}

export const changeEmail = async (req, res) => {
    try {
        const { enterCode, email, newEmail, refreshToken, token } = req.body;

        if (!validateInput(email) || !validateInput(enterCode) || !validateInput(newEmail)) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        const user = await findByEmail(email);

        if (!user[0] || !user[0]?.emailChange?.code || !user[0]?.emailChange?.generatedAt) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        if ((new Date() - user[0]?.emailChange?.generatedAt) > 1000 * 60 * 5) {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }

        if (enterCode == user[0].emailChange.code) {
            await updateUser(user[0]._id, user[0]._rev, {
                ...user[0],
                emailChange: { code: null, generatedAt: null },
                email: newEmail,
                updatedAt: new Date().getTime()
            });

            const safeUser = {
                email: newEmail,
                favorites: user[0].favorites,
                historyLoad: user[0].historyLoad,
                active: user[0].isActive,
                id: user[0]._id,
                refreshToken: refreshToken
            };

            if (req.body.isRefresh) {
                res.status(200).json({ user: safeUser, token: token });
            } else {
                res.status(200).json({ user: safeUser });
            }
        } else {
            return res.status(400).json({
                message: 'Ошибка.',
            });
        }
    } catch (err) {
        res.status(500).json({
            message: 'Ошибка.',
        });
    }
}
