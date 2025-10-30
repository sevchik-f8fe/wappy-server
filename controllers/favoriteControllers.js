import { findByEmail, updateUser } from "./util.js";

export const addToFovorites = async (req, res) => {
    try {
        const { user_email, item, source } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            res.status(404).json({ error: 'Ошибка' });
        }

        await updateUser(user[0]._id, user[0]._rev, { ...user[0], favorites: [{ source, data: item }, ...user[0].favorites], updatedAt: new Date().getTime() })
        res.status(200).json({ message: 'ok add' });
    } catch (e) {
        console.log('err: ', e)
        res.status(500).json({ error: 'Ошибка' });
    }
}

export const removeFromFovorites = async (req, res) => {
    try {
        const { user_email, item, source } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            res.status(404).json({ error: 'Ошибка' });
        }

        const updatedFavorites = user[0].favorites.filter((elem) => (elem.data != item && elem.source != source))

        await updateUser(user[0]._id, user[0]._rev, { ...user[0], favorites: updatedFavorites, updatedAt: new Date().getTime() })
        res.status(200).json({ message: 'ok rem' });
    } catch (e) {
        console.log('err: ', e)
        res.status(500).json({ error: 'Ошибка' });
    }
}