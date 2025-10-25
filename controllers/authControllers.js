import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

import { createUser } from "../schemas/User.js";
import { validateInput, findByEmail, addNewUser } from "./util.js";

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

  if (token) {
    try {
      jwt.verify(token, process.env.JWT);
      next();
    } catch (err) {
      res.status(403).json({
        message: 'Ошибка авторизации. Проверьте введенные данные.',
      });
    }
  } else {
    res.status(401).json({
      message: 'Ошибка авторизации. Проверьте введенные данные.',
    });
  }
}