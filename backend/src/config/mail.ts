import nodemailer from 'nodemailer';
import { config } from './env.js';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.emailUser,
    pass: config.emailPass,
  },
});
