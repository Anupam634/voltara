/**
 * Email templates.
 *
 * These are the only VOLTARA screens rendered by somebody else's software,
 * and that changes the rules. What the app can rely on, an inbox cannot:
 *
 *  - **Inline styles only.** Gmail's web client strips much of a `<style>`
 *    block. The previous templates put every colour in one, so a stripped
 *    head left dark-on-dark text — the verification code among it. Signup
 *    depends on that code being readable.
 *  - **Tables, not divs.** Outlook renders through Word and ignores modern
 *    box layout; a `<div>` column collapses to full width.
 *  - **No gradient, shadow or radius as load-bearing decoration.** Outlook
 *    drops them silently, so the design has to survive without them.
 *  - **A preheader.** Otherwise the inbox preview is whatever text comes
 *    first, which was the logo.
 *
 * Colours are the real palette (SPEC §2 / globals.css), not the sky-blue and
 * amber these templates used to carry — which belonged to no VOLTARA screen.
 */

const BG = '#07060B';
const SURFACE = '#100D18';
const SURFACE_2 = '#171327';
const LINE = '#2C2542';
const INK = '#F4F1FA';
const INK_2 = '#B7B0C9';
const INK_3 = '#7A7192';
const BRAND = '#7C3AED';
const BRAND_HI = '#A78BFA';
const CHARGE = '#A3E635';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

export interface LayoutParams {
  /** Inbox preview line. Never shown in the body. */
  preheader: string;
  /** Small uppercase line above the heading. */
  eyebrow: string;
  heading: string;
  /** Already-escaped HTML for the body of the message. */
  body: string;
}

/**
 * The shell every message shares: dark card, brand rule, footer.
 *
 * A light `background-color` is set on the outer table as well as the dark
 * card, so a client that ignores the card still renders readable text rather
 * than dark-on-dark.
 */
export function layout({ preheader, eyebrow, heading, body }: LayoutParams): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<title>VOLTARA</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
<div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG};margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:28px 12px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background-color:${SURFACE};border:1px solid ${LINE};border-radius:16px;">

        <!-- Brand rule: violet into lime, the two colours the product runs on. -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background-color:${BRAND};background:linear-gradient(90deg,${BRAND} 0%,${BRAND_HI} 55%,${CHARGE} 100%);">&nbsp;</td></tr>

        <tr>
          <td style="padding:26px 28px 0 28px;" align="left">
            <div style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:2px;color:${INK};">VOLTARA</div>
            <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:2.5px;color:${CHARGE};text-transform:uppercase;padding-top:3px;">The Grid</div>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 0 28px;" align="left">
            <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1.6px;color:${INK_3};text-transform:uppercase;">${eyebrow}</div>
            <div style="font-family:${FONT};font-size:20px;font-weight:800;color:${INK};padding-top:6px;line-height:1.3;">${heading}</div>
          </td>
        </tr>

        <tr><td style="padding:16px 28px 26px 28px;" align="left">${body}</td></tr>

        <tr><td style="padding:0 28px;"><div style="height:1px;line-height:1px;font-size:0;background-color:${LINE};">&nbsp;</div></td></tr>

        <tr>
          <td style="padding:16px 28px 24px 28px;" align="left">
            <div style="font-family:${FONT};font-size:11px;line-height:1.6;color:${INK_3};">
              &copy; ${year} VOLTARA &middot;
              <a href="https://voltaragrid.com" style="color:${BRAND_HI};text-decoration:none;">voltaragrid.com</a>
            </div>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}

/** A paragraph of body copy. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px 0;font-family:${FONT};font-size:14px;line-height:1.65;color:${INK_2};">${html}</p>`;
}

/**
 * The verification code.
 *
 * Letter-spacing is on a monospace face and the digits sit on their own
 * high-contrast panel, because this is the one thing in the message that
 * has to be read and retyped correctly on a phone.
 */
export function codeBlock(code: string, hint: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;">
  <tr>
    <td align="center" style="background-color:${BG};border:1px solid ${BRAND};border-radius:12px;padding:20px 12px;">
      <div style="font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:9px;color:${CHARGE};line-height:1.2;">${code}</div>
      <div style="font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:1.4px;color:${INK_3};text-transform:uppercase;padding-top:10px;">${hint}</div>
    </td>
  </tr>
</table>`;
}

/**
 * A call-to-action button.
 *
 * Padding on the anchor rather than the cell, so the whole rectangle stays
 * clickable in the clients that shrink-wrap a link to its text.
 */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px 0;">
  <tr>
    <td align="center" style="background-color:${BRAND};border-radius:10px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;">${label}</a>
    </td>
  </tr>
</table>`;
}

/** A quiet aside — security notes, "why you got this". */
export function note(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0 0;">
  <tr>
    <td style="background-color:${SURFACE_2};border-left:3px solid ${BRAND};border-radius:0 8px 8px 0;padding:12px 14px;">
      <div style="font-family:${FONT};font-size:12px;line-height:1.6;color:${INK_2};">${html}</div>
    </td>
  </tr>
</table>`;
}

/** A labelled figure, for "rate falls from X to Y" style lines. */
export function stat(label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px 0;">
  <tr>
    <td style="font-family:${FONT};font-size:12px;color:${INK_3};padding:0;">${label}</td>
    <td align="right" style="font-family:${MONO};font-size:14px;font-weight:700;color:${INK};padding:0;">${value}</td>
  </tr>
</table>`;
}
