import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: SMTP_USER && SMTP_PASS ? {
    user: SMTP_USER,
    pass: SMTP_PASS,
  } : undefined,
});

export async function sendEmail(data: EmailData): Promise<void> {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('SMTP credentials not configured. Email will not be sent.');
    throw new Error('Email service not configured');
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: data.to,
      subject: `[APP REPORT] ${data.subject} - ${new Date().toLocaleString()}`,
      html: data.html,
    });

    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

