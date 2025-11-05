import { findByEmail, updateUser } from "./util.js";

export const addToFavorites = async (req, res) => {
    try {
        const { user_email, item, source, refreshToken, token } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            res.status(404).json({ error: 'Ошибка' });
        }

        await updateUser(user[0]._id, user[0]._rev, { ...user[0], favorites: [{ source, data: item }, ...user[0].favorites], updatedAt: new Date().getTime() })

        const safeUser = {
            email: user[0].email,
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
    } catch (e) {
        console.log('err: ', e)
        res.status(500).json({ error: 'Ошибка' });
    }
}

export const removeFromFavorites = async (req, res) => {
    try {
        const { user_email, item, source, refreshToken, token } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            res.status(404).json({ error: 'Ошибка' });
        }

        const updatedFavorites = user[0].favorites.filter((elem) => (elem.data != item && elem.source != source))

        await updateUser(user[0]._id, user[0]._rev, { ...user[0], favorites: updatedFavorites, updatedAt: new Date().getTime() })

        const safeUser = {
            email: user[0].email,
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
    } catch (e) {
        console.log('err: ', e)
        res.status(500).json({ error: 'Ошибка' });
    }
}