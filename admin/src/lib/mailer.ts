import { env } from './env';

/**
 * Deliberately dependency-free: without SMTP_URL configured, mail is written
 * to the server log so nothing in the auth flow silently depends on a mail
 * provider being wired up. Point `send` at your provider in production.
 */
export type Mail = { to: string; subject: string; text: string };

export async function sendMail(mail: Mail): Promise<void> {
  if (!env.SMTP_URL) {
    console.info(`[mail:dev] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return;
  }
  try {
    // Wire your transport here (nodemailer, Resend, SES...).
    console.info(`[mail] queued to=${mail.to} subject="${mail.subject}"`);
  } catch (err) {
    console.error('[mail] send failed', err);
  }
}

export const templates = {
  newDevice: (name: string, ip: string, ua: string, when: Date) => ({
    subject: 'New sign-in to your Baytna Burger admin account',
    text: `Hi ${name},\n\nYour account was just signed in from a device we have not seen before.\n\nIP: ${ip}\nDevice: ${ua}\nTime: ${when.toISOString()}\n\nIf this was not you, change your password immediately and sign out of all devices from Profile → Security.`,
  }),
  passwordChanged: (name: string, when: Date) => ({
    subject: 'Your Baytna Burger admin password was changed',
    text: `Hi ${name},\n\nYour password was changed on ${when.toISOString()}.\n\nIf this was not you, contact a Super Admin immediately — your other sessions have already been signed out.`,
  }),
  accountLocked: (name: string, minutes: number) => ({
    subject: 'Your Baytna Burger admin account is temporarily locked',
    text: `Hi ${name},\n\nAfter repeated failed sign-in attempts your account is locked for ${minutes} minutes.\n\nIf this was not you, someone may be trying to guess your password. Reset it as soon as the lock expires.`,
  }),
  passwordReset: (name: string, link: string) => ({
    subject: 'Reset your Baytna Burger admin password',
    text: `Hi ${name},\n\nUse this link within 15 minutes to set a new password. It works once:\n\n${link}\n\nIf you did not request this, you can ignore this email.`,
  }),
  itemDeleted: (name: string, entity: string, label: string) => ({
    subject: `A ${entity} was deleted`,
    text: `Hi ${name},\n\n"${label}" (${entity}) was deleted from the site.\n\nSee Audit Log in the dashboard for the full record, including the previous values.`,
  }),
};
