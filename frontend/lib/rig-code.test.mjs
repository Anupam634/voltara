/**
 * Codec tests for RIG DNA.
 *
 * The frontend has no Jest setup, so these run on Node's built-in test
 * runner against a compiled copy of the module:
 *
 *   cd frontend && npx tsc lib/rig-code.ts --outDir .rigcode-test --module esnext \
 *     --target es2022 --moduleResolution bundler && node --test lib/rig-code.test.mjs
 *
 * Simpler: `node --test lib/rig-code.test.mjs` after running
 * `npm run test:rigcode` (see the script added to package.json).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  encodeRigCode,
  decodeRigCode,
  rigCodeFromParts,
  slotsFromCodes,
  rigCodeUrl,
  RIG_CODE_MAX_PARTS,
} from '../.rigcode-test/rig-code.js';

/** The seeded catalogue, exactly as `backend/prisma/seed.js` defines it. */
const CATALOG = [
  { code: 'VC1', kind: 'CORE' },
  { code: 'VC5', kind: 'CORE' },
  { code: 'VC10', kind: 'CORE' },
  { code: 'VC50', kind: 'CORE' },
  { code: 'CX2', kind: 'COOLER' },
  { code: 'CX6', kind: 'COOLER' },
  { code: 'CX20', kind: 'COOLER' },
  { code: 'PS3', kind: 'PSU' },
  { code: 'PS12', kind: 'PSU' },
  { code: 'OD8', kind: 'MODULE' },
];

test('encodes a build in canonical kind order', () => {
  assert.equal(
    encodeRigCode(['PS12', 'CX6', 'VC10', 'OD8'], CATALOG),
    'VC10-OD8-CX6-PS12',
  );
});

test('slot order does not change the code', () => {
  const a = encodeRigCode(['VC10', null, 'CX6', null, 'PS12', null], CATALOG);
  const b = encodeRigCode([null, 'PS12', null, 'CX6', null, 'VC10'], CATALOG);
  assert.equal(a, b);
});

test('empty slots vanish rather than leaving gaps', () => {
  assert.equal(encodeRigCode([null, 'VC1', undefined, '', 'CX2'], CATALOG), 'VC1-CX2');
});

test('encodes nothing as an empty string', () => {
  assert.equal(encodeRigCode([null, null, null], CATALOG), '');
});

test('caps at the chassis slot count', () => {
  const eight = ['VC1', 'VC5', 'VC10', 'VC50', 'CX2', 'CX6', 'CX20', 'PS3'];
  assert.equal(encodeRigCode(eight, CATALOG).split('-').length, RIG_CODE_MAX_PARTS);
});

test('decodes the canonical form', () => {
  assert.deepEqual(decodeRigCode('VC10-CX6-PS12', CATALOG), {
    codes: ['VC10', 'CX6', 'PS12'],
    unknown: [],
  });
});

test('is case-insensitive and tolerates spaces and plus signs', () => {
  for (const input of ['vc10 cx6 ps12', 'VC10 + CX6 + PS12', 'vc10-CX6  ps12', 'VC10,CX6;PS12']) {
    assert.deepEqual(
      decodeRigCode(input, CATALOG).codes,
      ['VC10', 'CX6', 'PS12'],
      `failed on: ${input}`,
    );
  }
});

test('strips a VOLTARA label', () => {
  assert.deepEqual(decodeRigCode('VOLTARA: VC10-CX6', CATALOG).codes, ['VC10', 'CX6']);
  assert.deepEqual(decodeRigCode('voltara VC1', CATALOG).codes, ['VC1']);
});

test('reads the build out of a share URL', () => {
  const url = 'https://voltaragrid.com/en/challenge?build=VC10-CX6-PS12';
  assert.deepEqual(decodeRigCode(url, CATALOG).codes, ['VC10', 'CX6', 'PS12']);
});

test('a URL without a build parameter does not invent parts', () => {
  const r = decodeRigCode('https://voltaragrid.com/en/challenge', CATALOG);
  assert.equal(r?.codes.length ?? 0, 0);
});

test('reports unknown tokens instead of dropping them', () => {
  const r = decodeRigCode('VC10-CX99-PS12', CATALOG);
  assert.deepEqual(r.codes, ['VC10', 'PS12']);
  assert.deepEqual(r.unknown, ['CX99']);
});

test('does not repeat an unknown token', () => {
  assert.deepEqual(decodeRigCode('CX99 CX99 CX99', CATALOG).unknown, ['CX99']);
});

test('returns null when there is nothing to read', () => {
  assert.equal(decodeRigCode('', CATALOG), null);
  assert.equal(decodeRigCode('   ', CATALOG), null);
  assert.equal(decodeRigCode('---', CATALOG), null);
});

test('keeps duplicate parts, because a rig can run two of the same core', () => {
  assert.deepEqual(decodeRigCode('VC1-VC1-CX2', CATALOG).codes, ['VC1', 'VC1', 'CX2']);
});

test('round-trips every subset of the catalogue', () => {
  const n = CATALOG.length;
  let checked = 0;
  for (let mask = 0; mask < 1 << n; mask += 1) {
    const subset = CATALOG.filter((_, i) => mask & (1 << i)).map((p) => p.code);
    if (subset.length === 0 || subset.length > RIG_CODE_MAX_PARTS) continue;
    const code = encodeRigCode(subset, CATALOG);
    const back = decodeRigCode(code, CATALOG);
    assert.deepEqual(
      [...back.codes].sort(),
      [...subset].sort(),
      `round-trip lost parts for ${code}`,
    );
    assert.deepEqual(back.unknown, []);
    checked += 1;
  }
  assert.ok(checked > 300, `expected many subsets, checked ${checked}`);
});

test('encoding is stable under shuffling', () => {
  const build = ['VC10', 'CX6', 'PS12', 'OD8'];
  const target = encodeRigCode(build, CATALOG);
  for (let i = 0; i < 50; i += 1) {
    const shuffled = [...build].sort(() => Math.random() - 0.5);
    assert.equal(encodeRigCode(shuffled, CATALOG), target);
  }
});

test('rigCodeFromParts reads the shape the rig screen holds', () => {
  const slots = [{ code: 'VC10' }, null, { code: 'CX6' }, undefined, { code: null }];
  assert.equal(rigCodeFromParts(slots, CATALOG), 'VC10-CX6');
});

test('slotsFromCodes pads to the chassis width', () => {
  assert.deepEqual(slotsFromCodes(['VC10', 'CX6']), [
    'VC10',
    'CX6',
    null,
    null,
    null,
    null,
  ]);
});

test('rigCodeUrl builds a loadable link', () => {
  assert.equal(
    rigCodeUrl('https://voltaragrid.com/', 'ko', 'VC10-CX6'),
    'https://voltaragrid.com/ko/challenge?build=VC10-CX6',
  );
});
