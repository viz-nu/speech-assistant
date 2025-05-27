import nodemailer from "nodemailer";
import 'dotenv/config';
let HOST = process.env.EMAIL_SMTP_HOST, AUTH = process.env.EMAIL_SMTP_AUTH, PASS = process.env.EMAIL_SMTP_PASS;

export const sendMail = async (emailData) => {
    let info
    try {
        let transporter = nodemailer.createTransport({
            host: HOST,
            port: 465,
            secure: true,
            auth: {
                user: AUTH,
                pass: PASS,
            },
        });
        let mailData = {
            from: `"AVA" <${AUTH}>`, // sender address
            to: emailData.to, // list of receivers
            subject: emailData.subject, // Subject line
        }
        if (emailData.cc) mailData.cc = emailData.cc;
        if (emailData.bcc) mailData.bcc = emailData.bcc;
        if (emailData.attachments?.length > 0) mailData.attachments = emailData.attachments;
        if (emailData.html) mailData.html = emailData.html;
        if (emailData.text) mailData.text = emailData.text;
        info = await transporter.sendMail(mailData);
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error(error);
        return { status: false, ...error }
    }
    finally {
        return {
            status: true,
            ...info
        }
    }
}
export const jsonArrayToHtmlTable = (data) => {
    let html = '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; font-family: Arial; width: 100%;">';
    html += '<thead><tr><th>Key</th><th>Description</th><th>Type</th><th>Constraints</th><th>Value</th></tr></thead><tbody>';

    for (const item of data) {
        let value = item.value;

        if (Array.isArray(value)) {
            value = `<ul>${value.map(v => `<li>${v}</li>`).join('')}</ul>`;
        } else if (typeof value === 'object' && value !== null) {
            value = '<table border="1" style="border-collapse: collapse; font-size: 14px;">' +
                Object.entries(value).map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('') +
                '</table>';
        }

        html += `<tr>
            <td>${item.key}</td>
            <td>${item.description}</td>
            <td>${item.type}</td>
            <td>${item.constraints}</td>
            <td>${value}</td>
        </tr>`;
    }

    html += '</tbody></table>';
    return html;
}

