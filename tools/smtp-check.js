/**
 * Standalone Spacemail/SMTP credential check.
 *
 * Isolates "are the credentials right" from "is the app configured right".
 * It talks to the mail host directly with nodemailer and prints the raw
 * server reply, which the API only ever surfaces as a generic 502.
 *
 * Run from the backend directory so nodemailer resolves:
 *
 *   cd backend
 *   node ../tools/smtp-check.js
 *
 * Reads backend/.env, so put the real password there first. Nothing is
 * printed except the host, the user and the server's own answer — the
 * password never appears in the output.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const nodemailer = require('nodemailer');

const user = (process.env.SMTP_USER || '').trim();
const pass = process.env.SMTP_PASS || '';
const host = (process.env.SMTP_HOST || 'mail.spacemail.com').trim();

if (!user || !pass) {
  console.error('SMTP_USER / SMTP_PASS are not set in backend/.env');
  process.exit(1);
}

// Surface the exact shape of the values, which is where the usual mistake
// hides: a pasted value that kept its surrounding quotes authenticates as a
// different username entirely.
console.log(`host : ${host}`);
console.log(`user : ${user}`);
console.log(`      length ${user.length}, quotes: ${/^["']|["']$/.test(user) ? 'YES — remove them' : 'none'}`);
console.log(`pass : length ${pass.length}, quotes: ${/^["']|["']$/.test(pass) ? 'YES — remove them' : 'none'}`);
console.log(`      whitespace at either end: ${pass !== pass.trim() ? 'YES — remove it' : 'none'}`);
console.log('');

async function attempt(label, options) {
  const t = nodemailer.createTransport({ ...options, auth: { user, pass } });
  try {
    await t.verify();
    console.log(`${label}: OK — credentials accepted`);
    return true;
  } catch (err) {
    console.log(`${label}: FAILED — ${err.message}`);
    return false;
  }
}

(async () => {
  const ok465 = await attempt('465 SSL     ', {
    host, port: 465, secure: true,
    tls: { servername: host },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
  });

  const ok587 = await attempt('587 STARTTLS', {
    host, port: 587, secure: false, requireTLS: true,
    tls: { servername: host },
    connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 20000,
  });

  console.log('');
  if (ok465 || ok587) {
    console.log('Credentials are fine. If the deployed API still answers 502,');
    console.log('the values on Render differ from the ones in backend/.env.');
  } else {
    console.log('Both ports refused. Check, in this order:');
    console.log('  1. Spacemail -> IMAP/SMTP access toggle is ENABLED');
    console.log('  2. The password is the MAILBOX password, not the account login');
    console.log('  3. The mailbox is fully provisioned (new trial mailboxes can lag)');
  }
})();
