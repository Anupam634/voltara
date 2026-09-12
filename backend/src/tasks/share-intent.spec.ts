import { shareIntentFor } from './tasks.service';

/**
 * The share bounty publishes from a miner's own account, which makes it the
 * one string in the product we cannot correct after the fact. These guard the
 * two ways it went wrong: a promise the product does not keep, and a link
 * that throws away the rig card the share is supposed to show.
 */
describe('TWEET share intent', () => {
  const url = () => {
    const intent = shareIntentFor('TWEET', 'ABC123');
    expect(intent).toBeTruthy();
    return new URL(intent as string);
  };

  it('links to the rig card, not the login page', () => {
    const shared = url().searchParams.get('url') ?? '';
    expect(shared).toContain('/r/ABC123');
    expect(shared).not.toContain('login');
  });

  it('claims no payout while payouts are gated shut', () => {
    const text = (url().searchParams.get('text') ?? '').toLowerCase();
    for (const claim of ['payout', 'withdraw', 'on-chain', 'onchain', '$vltr']) {
      expect(text).not.toContain(claim);
    }
  });

  it('fits in a post with the link and hashtags counted', () => {
    const p = url().searchParams;
    const tags = (p.get('hashtags') ?? '').split(',').filter(Boolean);
    const rendered = tags.map((t) => `#${t}`).join(' ');
    // X counts any link as 23 characters regardless of its real length.
    const total = (p.get('text') ?? '').length + 1 + 23 + 1 + rendered.length;
    expect(total).toBeLessThanOrEqual(280);
  });
});
