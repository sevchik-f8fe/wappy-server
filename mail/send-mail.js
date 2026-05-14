/**
 * Отправка email через SMTP сервер Яндекса
 * 
 * Конфигурация:
 * - Хост: smtp.yandex.ru
 * - Порт: 465 (SSL/TLS)
 * - Аутентификация: SMTP_USER и SMTP_KEY из .env
 * 
 * Шаблоны:
 * - Использует Handlebars для рендеринга HTML
 * - Шаблон: ./templates/mail.html
 * - Переменная {{code}} заменяется на код подтверждения
 * 
 * Процесс:
 * 1. Создание транспортера nodemailer
 * 2. Чтение HTML шаблона из файла
 * 3. Компиляция шаблона с Handlebars
 * 4. Отправка письма
 * 
 * Параметры mailObj:
 * @param {string} from - Email отправителя
 * @param {string} to - Email получателя
 * @param {Object} auth_code - Объект с полем code
 */

import nodemailer from "nodemailer";
import path from "path";
import handlebars from "handlebars";
import fs from "fs";

export const sendEmail = async (mailObj) => {
    const { from, to, auth_code } = mailObj;

    try {
        let transporter = nodemailer.createTransport({
            host: "smtp.yandex.ru",
            port: 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_KEY,
            },
        });

        const templatePath = path.resolve("mail", "./templates/mail.html");
        const templateSource = fs.readFileSync(templatePath, "utf8");

        const compiledTemplate = handlebars.compile(templateSource);

        const html = compiledTemplate(auth_code);

        let info = await transporter.sendMail({
            from: from,
            to: to,
            html: html
        });

        return info;
    } catch (error) {
        throw error;
    }
};