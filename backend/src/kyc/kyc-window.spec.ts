import { readKycWindow, KYC_CLOSED_MESSAGE } from './kyc-window';

const LAUNCH = '2026-12-01T00:00:00.000Z';
const before = new Date('2026-11-30T23:59:00Z');
const after = new Date('2026-12-01T00:01:00Z');

describe('readKycWindow', () => {
  it('is closed when nothing is configured', () => {
    // The default has to be closed: KYC gates only the withdrawal path, and
    // that path already refuses everyone while payouts are shut.
    expect(readKycWindow({})).toEqual({
      open: false,
      opensAt: null,
      followsPayouts: true,
    });
  });

  it('follows the payout window when it has no opinion of its own', () => {
    // The footgun this prevents: opening payouts while KYC stays shut makes
    // every withdrawal fail on "KYC must be approved" with no way to comply.
    expect(readKycWindow({ PAYOUTS_OPEN: 'true' })).toMatchObject({
      open: true,
      followsPayouts: true,
    });
    expect(readKycWindow({ PAYOUTS_OPEN: 'false' })).toMatchObject({
      open: false,
      followsPayouts: true,
    });
  });

  it('carries the payout launch date so the UI can say when', () => {
    expect(readKycWindow({ PAYOUTS_OPEN_AT: LAUNCH }, before)).toEqual({
      open: false,
      opensAt: LAUNCH,
      followsPayouts: true,
    });
    expect(readKycWindow({ PAYOUTS_OPEN_AT: LAUNCH }, after)).toMatchObject({
      open: true,
    });
  });

  it('opens ahead of payouts when asked, to spread the review load', () => {
    expect(readKycWindow({ KYC_OPEN: 'true', PAYOUTS_OPEN: 'false' })).toMatchObject({
      open: true,
      followsPayouts: false,
    });
  });

  it('treats an explicit false as a kill switch that beats everything', () => {
    expect(
      readKycWindow({ KYC_OPEN: 'false', PAYOUTS_OPEN: 'true', KYC_OPEN_AT: LAUNCH }, after),
    ).toMatchObject({ open: false });
  });

  it('opens on its own date regardless of payouts', () => {
    expect(readKycWindow({ KYC_OPEN_AT: LAUNCH, PAYOUTS_OPEN: 'false' }, before)).toMatchObject({
      open: false,
      followsPayouts: false,
    });
    expect(readKycWindow({ KYC_OPEN_AT: LAUNCH, PAYOUTS_OPEN: 'false' }, after)).toMatchObject({
      open: true,
    });
  });

  it('ignores a date it cannot parse rather than reading it as launched', () => {
    expect(readKycWindow({ KYC_OPEN_AT: 'soon' })).toMatchObject({
      open: false,
      opensAt: null,
    });
  });

  it('accepts the same truthy spellings the payout flag does', () => {
    for (const v of ['1', 'true', ' YES ', 'on']) {
      expect(readKycWindow({ KYC_OPEN: v }).open).toBe(true);
    }
    for (const v of ['0', 'false', 'no', 'off']) {
      expect(readKycWindow({ KYC_OPEN: v }).open).toBe(false);
    }
  });

  it('explains itself without naming a provider that was never chosen', () => {
    expect(KYC_CLOSED_MESSAGE).toMatch(/token launch/i);
    expect(KYC_CLOSED_MESSAGE).not.toMatch(/sumsub|onfido/i);
  });
});
