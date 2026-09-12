import { normalisePath, referrerHost } from './visits.service';

const SELF = ['voltaragrid.com', 'localhost'];

describe('referrerHost', () => {
  it('keeps the host and throws away the rest of the URL', () => {
    expect(
      referrerHost('https://www.reddit.com/r/incremental_games/comments/abc/def/', SELF),
    ).toBe('reddit.com');
  });

  it('treats our own site as no referrer', () => {
    // An internal click is not a channel, and counting it as one would make
    // the site look like its own best source of traffic.
    expect(referrerHost('https://voltaragrid.com/en/faq', SELF)).toBeNull();
    expect(referrerHost('https://www.voltaragrid.com/en', SELF)).toBeNull();
  });

  it('returns null for anything that is not a URL', () => {
    for (const junk of ['', 'not a url', null, undefined, 42, {}]) {
      expect(referrerHost(junk, SELF)).toBeNull();
    }
  });
});

describe('normalisePath', () => {
  it('folds the three locales onto one path', () => {
    for (const p of ['/en/faq', '/zh/faq', '/ko/faq']) {
      expect(normalisePath(p)).toBe('/faq');
    }
  });

  it('keeps the root as a root', () => {
    expect(normalisePath('/en')).toBe('/');
    expect(normalisePath('/')).toBe('/');
  });

  it('does not eat a path that merely starts with those letters', () => {
    expect(normalisePath('/england')).toBe('/england');
  });

  it('drops the query string, which is where referral codes travel', () => {
    expect(normalisePath('/en/login?ref=ABC123')).toBe('/login');
  });

  it('rejects anything that is not a path', () => {
    for (const junk of ['https://evil.com', '', null, undefined, 7]) {
      expect(normalisePath(junk)).toBeNull();
    }
  });
});
