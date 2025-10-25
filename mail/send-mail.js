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

    console.log(`Message sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.log(error);
    throw error;
  }
};