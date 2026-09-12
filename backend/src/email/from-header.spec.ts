import { EmailService } from './email.service';

/**
 * The From header is the one piece of mail config that can take signup down
 * while everything upstream still looks healthy: the transporter verifies
 * green, and only the send fails, with
 *
 *   553 5.7.1 Sender address rejected: not owned by user
 *
 * It is also easy to get wrong. In a .env file the display name has to be
 * escaped, and pasting that same escaped string into a dashboard — which
 * does no unquoting — forwards the backslashes to the mail server.
 */

/** `fromHeader` is private; these tests are about its observable output. */
function headerOf(service: EmailService): string {
  return (service as unknown as { fromHeader(): string }).fromHeader();
}

describe('fromHeader', () => {
  const env = { ...process.env };
  let service: EmailService;

  beforeEach(() => {
    process.env = { ...env };
    process.env.SMTP_USER = 'hello@voltaragrid.com';
    // No password: the constructor then builds no transporter and touches
    // no network, which is all these tests need.
    delete process.env.SMTP_PASS;
    service = new EmailService();
  });

  afterAll(() => {
    process.env = env;
  });

  it('falls back to the default when SMTP_FROM is unset', () => {
    delete process.env.SMTP_FROM;
    expect(headerOf(service)).toBe('"VOLTARA Labs" <hello@voltaragrid.com>');
  });

  it('keeps a well-formed display name', () => {
    process.env.SMTP_FROM = '"VOLTARA" <hello@voltaragrid.com>';
    expect(headerOf(service)).toBe('"VOLTARA" <hello@voltaragrid.com>');
  });

  it('survives the escaped form pasted straight out of a .env file', () => {
    // This exact value produced `<\ VOLTARA"  hello@voltaragrid.com>` on the
    // wire and a 553 from the mail server, with signup dead behind it.
    process.env.SMTP_FROM = '\\"VOLTARA\\" <hello@voltaragrid.com>';
    const header = headerOf(service);

    expect(header).toBe('"VOLTARA" <hello@voltaragrid.com>');
    expect(header).not.toContain('\\');
  });

  it('rewrites an address that is not the authenticated mailbox', () => {
    // A From the login does not own is rejected outright, so the display
    // name is kept and the address is forced back to the real mailbox.
    process.env.SMTP_FROM = '"VOLTARA" <noreply@somewhere-else.com>';
    expect(headerOf(service)).toBe('"VOLTARA" <hello@voltaragrid.com>');
  });

  it('always sends from the authenticated mailbox, whatever it is given', () => {
    for (const value of [
      'garbage',
      '<>',
      '"" <>',
      '\\"\\" <>',
      'VOLTARA <hello@voltaragrid.com>',
    ]) {
      process.env.SMTP_FROM = value;
      expect(headerOf(service)).toContain('<hello@voltaragrid.com>');
    }
  });
});
