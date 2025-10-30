import { findByEmail, updateUser } from "./util.js";

export const addToHistory = async (req, res) => {
    try {
        const { user_email, item, source } = req.body;

        const user = await findByEmail(user_email);

        if (!user[0]) {
            res.status(404).json({ error: 'Ошибка' });
        }

        await updateUser(user[0]._id, user[0]._rev, { ...user[0], historyLoad: [{ source, data: item, loadDate: new Date().getTime() }, ...user[0].historyLoad], updatedAt: new Date().getTime() })
        res.status(200).json({ message: 'ok add' });
    } catch (e) {
        console.log('err: ', e)
        res.status(500).json({ error: 'Ошибка' });
    }
}