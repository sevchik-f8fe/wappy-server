import crypto from "crypto";
import axios from "axios";

import * as dotenv from 'dotenv';

dotenv.config();

export const generateCode = () => {
    const buffer = crypto.randomBytes(3);
    const code = parseInt(buffer.toString('hex'), 16) % 1000000;
    return code.toString().padStart(6, '0');
}

// export const validateInput = (value) => {
//     return value && value.length <= 60 && !/[<>;'"-+= ]/.test(value);
// };

export const validateInput = (value) => {
    if (!value || value.length === 0) return false;
    if (value.length > 60) return false;
    return !/[<>;'"&+= \-]/.test(value);
};

export const findByEmail = async (email) => {
    const user = await axios.post(`${process.env.BD_LINK}users/_find`,
        {
            "selector": {
                "email": {
                    "$eq": email
                }
            },
            "limit": 1
        }
    )
        .then(res => res.data.docs)

    return user;
};

export const addNewUser = async (user) => {
    await axios.post(`${process.env.BD_LINK}users`,
        user
    )
};

export const updateUser = async (user_id, user_rev, updatedDoc) => {
    await axios.post(
        `${process.env.BD_LINK}users/_bulk_docs`,
        {
            docs: [
                {
                    _id: user_id,
                    _rev: user_rev,
                    ...updatedDoc
                }
            ]
        },
    )
        .then((res) => res.data);
}

export const deleteUser = async (user_id, user_rev) => {
    await axios.delete(`${process.env.BD_LINK}users/${user_id}`,
        {
            headers: {
                'If-Match': user_rev,
            }
        }
    );

}

export const deleteNotActive = async () => {
    const threeYearsAgo = Date.now() - (3 * 365 * 24 * 60 * 60 * 1000);
    const halfHourAgo = Date.now() - (24 * 60 * 60 * 1000);

    let docs;
    try {
        const response = await axios.post(
            `${process.env.BD_LINK}users/_find`,
            {
                selector: {
                    "$or": [
                        {
                            "isActive": false,
                            "updatedAt": { "$lt": halfHourAgo }
                        },
                        {
                            "updatedAt": { "$lt": threeYearsAgo }
                        }
                    ]
                },
                limit: 50,
                fields: ["_id", "_rev"]
            }
        );
        docs = response.data.docs;
    } catch (e) {
        console.log(e);
        docs = [];
    }

    if (docs.length === 0) {
        return;
    }

    let deletedCount = 0;
    for (const doc of docs) {
        try {
            await deleteUser(doc._id, doc._rev);
            deletedCount++;

            if (deletedCount % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.log(`Ошибка при удалении документа ${doc._id}:`);
        }
    }
    return;
}