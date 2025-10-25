import crypto from "crypto";
import axios from "axios";

import * as dotenv from 'dotenv';

dotenv.config();

export const generateCode = () => {
  const buffer = crypto.randomBytes(3);
  const code = parseInt(buffer.toString('hex'), 16) % 1000000;
  return code.toString().padStart(6, '0');
}

export const validateInput = (value) => {
  return value && value.length <= 60 && !/[<>;'"-+= ]/.test(value);
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

  // console.log('finded: ', user)
  return user;
};

export const addNewUser = async (user) => {
  await axios.post(`${process.env.BD_LINK}users`,
    user
  )
    .then(res => console.log('add new ok: ', res.data))
};

export const updateUser = async (user_id, user_rev, updatedDoc) => {
  const response = await axios.post(
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

  // console.log('ok update: ', response)
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

  const docs = await axios.post(
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
  )
    .then((res) => res.data.docs)
    .catch((e) => console.log(e));

  if (docs.length === 0) {
    console.log('Документы для удаления не найдены');
    return;
  }

  console.log(`Найдено ${docs.length} документов для удаления`);

  for (const doc of docs) {
    try {
      await deleteUser(doc._id, doc._rev);

      if (deletedCount % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Ошибка при удалении документа ${doc._id}:`, error.message);
    }
  }
  return;
}