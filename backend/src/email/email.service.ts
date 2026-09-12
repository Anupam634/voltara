import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as nodemailer from 'nodemailer';
import { createOtpStore, OtpPurpose, OtpRecord, OtpStore } from './otp.store';
import { button, codeBlock, layout, note, paragraph, stat } from './templates';

export type { OtpRecord, OtpPurpose } from './otp.store';

/** A single address may request this many codes per window. */
export const OTP_SENDS_PER_ADDRESS = 3;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
/**
 * Wrong guesses allowed against one address before its live code is burned.
 *
 * A code is six digits and lives for ten minutes; the only per-IP limit is
 * the blanket 300/min throttle, which a handful of hosts walks straight
 * past. Without a cap here, guessing a reset code is arithmetic, not luck.
 * The counter is cleared whenever a fresh code is issued, so a user who
 * fat-fingers the code and asks for a new one is not locked out — and
 * `OTP_SENDS_PER_ADDRESS` still bounds how often that can happen.
 */
export const OTP_MAX_ATTEMPTS = 5;
/** Upper bound on how long a caller waits for SMTP before giving up. */
const SMTP_DEADLINE_MS = 12_000;

/** Minimal HTML escaping for values interpolated into email templates. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fallbackTransporter: nodemailer.Transporter | null = null;
  private readonly otpStore: OtpStore;

  constructor() {
    this.otpStore = createOtpStore(this.logger);
    this.initTransporter();
  }

  /**
   * Reject an SMTP attempt that outlives the deadline. Both transporters
   * have their own socket timeouts, but they stack: a primary that hangs
   * for 20s followed by a fallback that hangs for 20s left the caller
   * waiting the better part of a minute.
   */
  private withDeadline<T>(work: Promise<T>, label: string): Promise<T> {
    return Promise.race([
      work,
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timed out after ${SMTP_DEADLINE_MS}ms`)),
          SMTP_DEADLINE_MS,
        ).unref(),
      ),
    ]);
  }

  private sanitizeEmail(rawEmail: string): string {
    if (!rawEmail) return '';
    const match = rawEmail.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return match ? match[0].toLowerCase() : rawEmail.trim().toLowerCase();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || process.env.MAIL_HOST || 'mail.spacemail.com';
    const portEnv = process.env.SMTP_PORT || process.env.MAIL_PORT;
    const user = process.env.SMTP_USER || process.env.SMTP_EMAIL || process.env.MAIL_USER || 'hello@voltaragrid.com';
    const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASS || '').replace(/\s+/g, '');
    // An explicitly configured host wins over provider sniffing.
    //
    // Provider detection used to look at the *username's domain*, so setting
    // SMTP_HOST=localhost with SMTP_USER=dev@voltaragrid.com — the obvious
    // way to point a dev box at a local mail catcher — silently rebuilt the
    // transport as `mail.spacemail.com:465` and tried to send through the
    // company's production mailbox. It failed with `535 authentication
    // failed`, which reads as a credentials problem and sends you looking in
    // entirely the wrong place; the configured host never appeared in the
    // log at all. Sniffing is only a fallback for when no host is given.
    const hostConfigured = !!(process.env.SMTP_HOST || process.env.MAIL_HOST);
    const isGmail = !hostConfigured && (host.includes('gmail') || user.endsWith('@gmail.com'));
    const isSpacemail =
      host.includes('spacemail') || (!hostConfigured && user.includes('@voltaragrid.com'));

    if (user && pass) {
      if (isGmail) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        this.logger.log(`[EmailService] Gmail service transporter initialized for ${user}`);
      } else if (isSpacemail) {
        // Spacemail Primary: Port 465 (SSL)
        this.transporter = nodemailer.createTransport({
          host: 'mail.spacemail.com',
          port: 465,
          secure: true,
          auth: { user, pass },
          // `rejectUnauthorized: false` used to be set on both Spacemail
          // transports, which accepts any certificate — including one
          // presented by whatever is between this box and the mail host. The
          // SMTP password is sent right after the handshake, so that turned a
          // network attacker into a holder of the company mailbox.
          tls: { servername: 'mail.spacemail.com' },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });

        // Spacemail Secondary Fallback: Port 587 (STARTTLS)
        this.fallbackTransporter = nodemailer.createTransport({
          host: 'mail.spacemail.com',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user, pass },
          tls: { servername: 'mail.spacemail.com' },
          connectionTimeout: 15000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });

        this.logger.log(`[EmailService] Spacemail SMTP Transporter initialized (Primary 465 SSL, Fallback 587 STARTTLS) for ${user}`);
      } else {
        const port = parseInt(portEnv || '465', 10);
        const secure = port === 465 || process.env.SMTP_SECURE === 'true';

        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          connectionTimeout: 12000,
          greetingTimeout: 10000,
          socketTimeout: 20000,
        });
        this.logger.log(`[EmailService] SMTP Transporter configured for ${user}@${host}:${port} (secure: ${secure})`);
      }

      // Verify connection in background
      if (this.transporter) {
        this.transporter.verify((err) => {
          if (err) {
            this.logger.warn(`[EmailService] SMTP Transporter verification notice: ${err.message}`);
          } else {
            this.logger.log(`[EmailService] ✓ SMTP Transporter verified and ready to deliver emails for ${user}`);
          }
        });
      }
    } else {
      // Not a degraded optional feature — the product cannot onboard anyone
      // in this state. Signup requires a 6-digit email code, so with no
      // transporter every `send-otp` answers 502 and the form dead-ends,
      // while the process itself stays healthy and the health check passes.
      // The old wording ("check environment variables") read like a notice
      // about mail being off rather than the outage it is.
      this.logger.error(
        '[EmailService] No SMTP transporter: SMTP_USER / SMTP_PASS are unset. ' +
          'SIGNUP IS DISABLED — verification codes cannot be delivered and ' +
          'every registration will fail with 502. Password reset and 2FA are ' +
          'down too. Set the SMTP_* variables (see DEPLOY.md).',
      );
    }
  }


  /**
   * The From header for every outgoing message.
   *
   * `SMTP_FROM` used to be documented in `.env.example`, prompted for by
   * `render.yaml`, and read by nothing: the header was assembled inline in
   * three places as `"VOLTARA Labs" <SMTP_USER>`. Setting it did nothing,
   * which is the worst kind of config — it looks applied.
   *
   * A display name is not cosmetic here. Mailbox providers weigh a
   * consistent, recognisable From when deciding whether a transactional
   * message is a phish, and signup dies entirely if the code lands in spam.
   *
   * Falls back to the old literal so nothing changes for a deployment that
   * never sets it.
   */
  private fromHeader(): string {
    const senderEmail = (process.env.SMTP_USER || 'hello@voltaragrid.com')
      .trim()
      .toLowerCase();
    const configured = (process.env.SMTP_FROM ?? '').trim();
    if (!configured) return `"VOLTARA Labs" <${senderEmail}>`;

    // The address is always the authenticated mailbox, whatever SMTP_FROM
    // says. A From that does not match the login is rejected outright —
    // `553 Sender address rejected: not owned by user` — and that failure
    // takes signup down completely while the transporter still verifies
    // green, so nothing upstream looks wrong.
    //
    // It is an easy value to get wrong. Written in a .env file the display
    // name needs escaping (`SMTP_FROM="\"VOLTARA\" <me@host>"`), and
    // pasting that same string into a dashboard — which does no unquoting —
    // sends the backslashes to the mail server verbatim.
    //
    // So only the display name is taken from the config, and only if it
    // survives being stripped of quotes and backslashes.
    const address = configured.match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/)?.[0]?.toLowerCase();
    const name = configured
      .replace(/<[^>]*>/g, '')
      .replace(/["'\\]/g, '')
      .trim();

    if (address && address !== senderEmail) {
      this.logger.warn(
        `[EmailService] SMTP_FROM address (${address}) is not the authenticated ` +
          `mailbox (${senderEmail}); the mail server would reject it. Using the ` +
          'mailbox address and keeping only the display name.',
      );
    }
    return name ? `"${name}" <${senderEmail}>` : `"VOLTARA Labs" <${senderEmail}>`;
  }

  /**
   * Generate a 6-digit code and store it with a 10-minute TTL.
   *
   * `randomInt` rather than `Math.random`: this is the only thing standing
   * between an attacker and someone else's account during a password
   * reset, and Math.random is predictable from a handful of outputs.
   *
   * The code itself is never logged. It used to be, which put a working
   * credential into every log sink the box ships to.
   */
  async generateOtp(rawEmail: string, purpose: OtpPurpose): Promise<string> {
    const cleanEmail = this.sanitizeEmail(rawEmail);
    const code = randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await this.otpStore.put(cleanEmail, { code, expiresAt, purpose });
    // A new code starts with a clean slate, so a legitimate user who mistyped
    // the last one is not locked out of this one.
    await this.otpStore.clearAttempts(cleanEmail);
    this.logger.log(`[OTP GENERATED] ${cleanEmail} | purpose=${purpose} | ttl=10m`);

    return code;
  }

  /**
   * Verify the provided code against the stored, unexpired code for this
   * address.
   *
   * `expectedPurpose` is required: the store holds one record per address,
   * so without this check a code mailed out for one flow satisfies another —
   * a signup code would complete a password reset. The code and the purpose
   * are issued together and must be redeemed together.
   */
  async verifyOtp(
    rawEmail: string,
    code: string,
    expectedPurpose: OtpPurpose,
  ): Promise<boolean> {
    const cleanEmail = this.sanitizeEmail(rawEmail);
    const cleanCode = code.trim();
    const record = await this.otpStore.take(cleanEmail);

    if (!record) {
      this.logger.warn(`[OTP VERIFY FAILED] no active code for ${cleanEmail}`);
      return false;
    }

    if (Date.now() > record.expiresAt) {
      this.logger.warn(`[OTP VERIFY FAILED] expired for ${cleanEmail}`);
      await this.otpStore.drop(cleanEmail);
      return false;
    }

    if (record.purpose !== expectedPurpose) {
      // Burn it: a code being presented to the wrong flow is either a client
      // bug or someone walking a code between endpoints.
      this.logger.warn(
        `[OTP VERIFY FAILED] purpose mismatch for ${cleanEmail} (issued=${record.purpose} presented=${expectedPurpose})`,
      );
      await this.otpStore.drop(cleanEmail);
      return false;
    }

    // Neither the expected nor the supplied code is logged: a rejected
    // attempt is still someone's live credential.
    if (record.code !== cleanCode) {
      const attempts = await this.otpStore.failAttempt(
        cleanEmail,
        OTP_SEND_WINDOW_MS,
      );
      if (attempts >= OTP_MAX_ATTEMPTS) {
        // Burn the code rather than the account: the address can request a
        // new one, but this code is no longer guessable.
        await this.otpStore.drop(cleanEmail);
        this.logger.warn(
          `[OTP BURNED] ${cleanEmail} after ${attempts} wrong codes`,
        );
        return false;
      }
      this.logger.warn(
        `[OTP VERIFY FAILED] code mismatch for ${cleanEmail} (${attempts}/${OTP_MAX_ATTEMPTS})`,
      );
      return false;
    }

    await this.otpStore.drop(cleanEmail);
    await this.otpStore.clearAttempts(cleanEmail);
    this.logger.log(`[OTP VERIFY SUCCESS] ${cleanEmail}`);
    return true;
  }

  /**
   * Send branded verification email via Spacemail / SMTP.
   */
  async sendOtpEmail(rawEmail: string, purpose: OtpPurpose): Promise<{ success: boolean; message: string }> {
    if (!this.transporter) {
      this.initTransporter();
    }

    const cleanEmail = this.sanitizeEmail(rawEmail);

    // Per-address ceiling. The signup form is unauthenticated, so without
    // this anyone can point it at a stranger's inbox and flood it.
    const allowed = await this.otpStore.allowSend(
      cleanEmail,
      OTP_SENDS_PER_ADDRESS,
      OTP_SEND_WINDOW_MS,
    );
    if (!allowed) {
      this.logger.warn(`[OTP THROTTLED] ${cleanEmail}`);
      throw new HttpException(
        `Too many verification codes requested for that address. Try again in ${Math.round(OTP_SEND_WINDOW_MS / 60000)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = await this.generateOtp(cleanEmail, purpose);

    let subject = 'VOLTARA Verification Code';
    let purposeTitle = 'Account Verification';
    let purposeDesc = 'Use the verification code below to complete your registration on VOLTARA Labs.';

    if (purpose === 'forgot_password') {
      subject = 'VOLTARA Password Reset Request';
      purposeTitle = 'Password Reset Security Code';
      purposeDesc = 'We received a request to reset the password for your VOLTARA account. Enter the verification code below:';
    } else if (purpose === 'login_2fa') {
      subject = 'VOLTARA 2FA Security Code';
      purposeTitle = 'Two-Factor Authentication';
      purposeDesc = 'Use the verification code below to sign in to your VOLTARA Mining Dashboard.';
    }

    const html = layout({
      preheader: `${code} is your VOLTARA code. It expires in 10 minutes.`,
      eyebrow: purposeTitle,
      heading: 'Your verification code',
      body: [
        paragraph(purposeDesc),
        codeBlock(code, 'Valid 10 minutes &middot; single use'),
        note(
          '<strong style="color:#F4F1FA;">Never share this code.</strong> ' +
            'Nobody from VOLTARA will ever ask you for it. If you did not ask ' +
            'to sign in, you can ignore this message — nothing has changed on ' +
            'your account.',
        ),
      ].join(''),
    });

    const delivered = await this.deliver({
      to: cleanEmail,
      subject,
      html,
      text: `Your VOLTARA verification code is: ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
    });
    if (delivered) {
      return {
        success: true,
        message: `Verification code sent to ${cleanEmail}. Please check your inbox and spam folder.`,
      };
    }

    // Reaching here means every transport failed, or none was configured.
    // Reporting success anyway told the user to go and check an inbox that
    // was never going to receive anything, with no error shown anywhere.
    // Drop the code so a retry issues a fresh one.
    await this.otpStore.drop(cleanEmail);
    throw new HttpException(
      'We could not send your verification code right now. Please try again in a moment.',
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Push one message through the primary transport, then the fallback.
   * Resolves `true` on delivery and `false` when every transport failed or
   * none is configured; the caller decides what that means for its flow.
   */
  private async deliver(mail: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }
    if (!this.transporter) {
      this.logger.error(`[EmailService] Cannot send email: No SMTP transporter initialized. Check SMTP_USER & SMTP_PASS in .env.`);
      return false;
    }

    const message = { from: this.fromHeader(), ...mail };

    try {
      const info = await this.withDeadline(this.transporter.sendMail(message), 'Primary SMTP');
      this.logger.log(`[EmailService] ✓ "${mail.subject}" delivered to ${mail.to} (ID: ${info.messageId}, Response: ${info.response})`);
      return true;
    } catch (primaryErr: any) {
      this.logger.warn(
        `[EmailService] Primary SMTP delivery attempt failed: ${primaryErr?.message || primaryErr}. Trying fallback transporter...`,
      );
    }

    if (!this.fallbackTransporter) return false;
    try {
      const info = await this.withDeadline(this.fallbackTransporter.sendMail(message), 'Fallback SMTP');
      this.logger.log(`[EmailService] ✓ Fallback (Port 587) "${mail.subject}" delivered to ${mail.to} (ID: ${info.messageId}, Response: ${info.response})`);
      return true;
    } catch (fallbackErr: any) {
      this.logger.error(`[EmailService] Fallback SMTP delivery also failed: ${fallbackErr?.message || fallbackErr}`);
      return false;
    }
  }

  /**
   * "Your inviter wants you back at the controls" — sent when a miner taps
   * Remind next to an idle referral. The inviter is named only by their
   * masked handle: the referral chose to sign up under them, but that is
   * not a licence to hand out the inviter's full address.
   */
  async sendReferralReminderEmail(
    rawEmail: string,
    params: { inviterLabel: string; idleDays: number | null; dashboardUrl: string },
  ): Promise<boolean> {
    const cleanEmail = this.sanitizeEmail(rawEmail);
    const { inviterLabel, idleDays, dashboardUrl } = params;

    const idleLine =
      idleDays === null
        ? 'Your node has not mined yet.'
        : idleDays === 0
          ? 'Your node went quiet today.'
          : `Your node has been idle for ${idleDays} day${idleDays === 1 ? '' : 's'}.`;

    const subject = `${inviterLabel} is asking you to mine on VOLTARA`;
    const text = [
      `${inviterLabel}, the miner who invited you to VOLTARA, sent you a reminder.`,
      idleLine,
      'Tap Mine once every 24 hours to keep your $VLTR accruing. It costs nothing and needs no hardware.',
      '',
      `Mine now: ${dashboardUrl}`,
      '',
      'You receive this because a miner in your referral network asked us to nudge you. Each referral can be reminded at most once every three days.',
    ].join('\n');

    const html = layout({
      preheader: `${inviterLabel} sent you a nudge. ${idleLine}`,
      eyebrow: 'A nudge from your network',
      heading: `${escapeHtml(inviterLabel)} wants you back at the controls`,
      body: [
        paragraph(
          'The miner who invited you to VOLTARA sent you a reminder. Tap ' +
            '<strong style="color:#F4F1FA;">Mine</strong> once every 24 hours to keep ' +
            'your VOLTS accruing. It costs nothing and needs no hardware.',
        ),
        stat('Your rig', escapeHtml(idleLine)),
        button(escapeHtml(dashboardUrl), 'Mine now'),
        note(
          'You receive this because a miner in your referral network asked us ' +
            'to nudge you. Each referral can be reminded at most once every ' +
            'three days.',
        ),
      ].join(''),
    });

    return this.deliver({ to: cleanEmail, subject, html, text });
  }

  /**
   * "Your starter core is about to burn out" — the twelve-hour warning on
   * the free VC-1 every new miner is lent.
   *
   * This is the first purchase moment in the funnel: the miner has watched
   * a lit rig for three days and is about to watch it go dark, and the
   * replacement costs a dollar. Said plainly, without a countdown gimmick.
   */
  async sendLoanerExpiryEmail(
    rawEmail: string,
    params: { hoursLeft: number; shopUrl: string },
  ): Promise<boolean> {
    const cleanEmail = this.sanitizeEmail(rawEmail);
    const { hoursLeft, shopUrl } = params;
    const leftLabel = `${hoursLeft} hour${hoursLeft === 1 ? '' : 's'}`;

    const subject = `Your VOLTARA starter core burns out in ${leftLabel}`;
    const text = [
      'The free VC-1 Volt Core you were lent when you joined VOLTARA is about to burn out.',
      `Time left: ${leftLabel}.`,
      '',
      'When it goes, your rig drops back to the bare chassis and your rate falls from 2.9 VOLTS/hour to 0.9. Your own VC-1 costs $1 and runs for 30 days.',
      '',
      `Fit a new core: ${shopUrl}`,
      '',
      'You receive this once, because a part on your rig is expiring.',
    ].join('\n');

    const html = layout({
      preheader: `Your free VC-1 core burns out in ${leftLabel}.`,
      eyebrow: 'Starter core expiring',
      heading: `Your starter core burns out in ${escapeHtml(leftLabel)}`,
      body: [
        paragraph(
          'The free VC-1 Volt Core you were lent when you joined is nearly ' +
            'done. When it goes, your rig drops back to the bare chassis.',
        ),
        stat('Time left', escapeHtml(leftLabel)),
        stat('Rate now', '2.9 VOLTS/h'),
        stat('After it burns out', '0.9 VOLTS/h'),
        paragraph('Your own VC-1 costs $1 and runs for 30 days.'),
        button(escapeHtml(shopUrl), 'Fit a new core'),
        note('You receive this once, because a part on your rig is expiring.'),
      ].join(''),
    });

    return this.deliver({ to: cleanEmail, subject, html, text });
  }

  /**
   * Diagnostic Test Email Endpoint
   */
  async testEmail(rawEmail: string) {
    this.initTransporter();
    const cleanEmail = this.sanitizeEmail(rawEmail);
    const senderEmail = (process.env.SMTP_USER || 'hello@voltaragrid.com').trim().toLowerCase();

    if (!this.transporter) {
      return {
        success: false,
        error: 'No SMTP transporter configured. Check environment variables.',
        // Booleans only. Echoing the configured mailbox back over HTTP
        // hands out half of the SMTP credential pair.
        envState: {
          hasHost: !!process.env.SMTP_HOST,
          hasUser: !!process.env.SMTP_USER,
          hasPass: !!process.env.SMTP_PASS,
        },
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromHeader(),
        to: cleanEmail,
        subject: 'VOLTARA Labs Email Health Test',
        text: 'This is a test email confirming your Spacemail integration on AWS EC2 is working perfectly!',
      });
      return {
        success: true,
        transport: 'Primary Port 465 SSL',
        messageId: info.messageId,
        response: info.response,
      };
    } catch (err: any) {
      if (this.fallbackTransporter) {
        try {
          const info = await this.fallbackTransporter.sendMail({
            from: this.fromHeader(),
            to: cleanEmail,
            subject: 'VOLTARA Labs Email Health Test (Fallback)',
            text: 'This is a test email confirming your Spacemail integration on AWS EC2 is working perfectly!',
          });
          return {
            success: true,
            transport: 'Fallback Port 587 STARTTLS',
            messageId: info.messageId,
            response: info.response,
          };
        } catch (fallbackErr: any) {
          return {
            success: false,
            primaryError: err?.message || err,
            fallbackError: fallbackErr?.message || fallbackErr,
          };
        }
      }
      return {
        success: false,
        primaryError: err?.message || err,
      };
    }
  }
}
