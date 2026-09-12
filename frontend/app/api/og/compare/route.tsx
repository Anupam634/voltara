import { ImageResponse } from 'next/og';

/**
 * The launch card: two rigs, near enough the same money, wildly different
 * output.
 *
 * This exists because the pitch does not survive being told. "Heat and power
 * are real constraints" is a sentence people have read on a hundred landing
 * pages; two columns where $20 earns a quarter of what $19 earns is an
 * argument they can check in four seconds.
 *
 * Every figure below came out of the real engine — `rigTelemetry` and
 * `effectiveRateMilli` run over the catalogue in `backend/prisma/seed.js` —
 * not from a designer picking numbers that made the point nicely. They are
 * hardcoded here because this route cannot reach the backend's TypeScript,
 * which means **they go stale if the catalogue moves**. Change a part's heat,
 * watts or price in the seed and this card has to be recomputed, or it is a
 * lie in the one place we cannot take back: a pinned post.
 *
 * Same Satori limits as the rig card: flexbox only, and any element with more
 * than one child needs an explicit `display: flex`. Two quiet ways to trip
 * that rule, both of which cost a debugging round here: a bare number child
 * is not counted as text at all, and `$` next to an expression is a second
 * child rather than part of one string. So every figure on this card is
 * handed over as a single, already-built string.
 */

export const runtime = 'edge';

const WIDTH = 1600;
const HEIGHT = 900;

const OBSIDIAN = '#07060b';
const SURFACE = '#131024';
const LINE = '#2a2440';
const INK = '#f4f1fa';
const INK_2 = '#b7b0c9';
const INK_3 = '#7a7192';
const BRAND_HI = '#a78bfa';
const CHARGE = '#a3e635';
const HEAT = '#f43f5e';
const COOL = '#22d3ee';

interface Build {
  usd: number;
  parts: string;
  /** Slot colours, six entries; null is an empty slot. */
  slots: (string | null)[];
  heat: [number, number];
  power: [number, number];
  stability: number;
  rate: number;
  accent: string;
  verdict: string;
}

// Both rows: rigTelemetry({ parts }) then effectiveRateMilli({ rig, inviteCount: 0 }).
// Bare chassis supplies 12 cooling and 120 W, and the base rate is 0.90/hr,
// which is why the right-hand rig reads 20.90 rather than 20.00.
const OVERBUILT: Build = {
  usd: 20,
  parts: '4 × VC-5 Arc Core',
  slots: [BRAND_HI, BRAND_HI, BRAND_HI, BRAND_HI, null, null],
  heat: [104, 12],
  power: [440, 120],
  stability: 7,
  rate: 2.79,
  accent: HEAT,
  verdict: 'Throttled',
};

const BALANCED: Build = {
  usd: 19,
  parts: '2 × VC-5  ·  CX-6 Cryo Loop  ·  PS-3 Feeder Unit',
  slots: [BRAND_HI, BRAND_HI, COOL, CHARGE, null, null],
  heat: [56, 132],
  power: [260, 380],
  stability: 100,
  rate: 20.9,
  accent: CHARGE,
  verdict: 'Holding',
};

function Slots({ slots }: { slots: (string | null)[] }) {
  return (
    <div style={{ display: 'flex' }}>
      {slots.map((colour, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            width: 52,
            height: 52,
            marginRight: 10,
            borderRadius: 10,
            border: `2px solid ${colour ?? LINE}`,
            background: colour ? `${colour}22` : 'transparent',
          }}
        />
      ))}
    </div>
  );
}

/** One labelled load line: demand against capacity, over-budget in rose. */
function Load({
  label,
  value,
  unit,
}: {
  label: string;
  value: [number, number];
  unit: string;
}) {
  const [demand, capacity] = value;
  const over = demand > capacity;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 18,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 3, color: INK_3 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <div style={{ fontSize: 30, fontWeight: 700, color: over ? HEAT : INK }}>
          {String(demand)}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: INK_3, margin: '0 8px' }}>
          /
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: INK_2 }}>{String(capacity)}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK_3, marginLeft: 8 }}>
          {unit}
        </div>
      </div>
    </div>
  );
}

function Panel({ build }: { build: Build }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 700,
        padding: 40,
        borderRadius: 26,
        border: `2px solid ${build.accent}55`,
        background: SURFACE,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <div style={{ fontSize: 76, fontWeight: 700, color: INK, lineHeight: 1 }}>
          {`$${build.usd}`}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 4,
            color: build.accent,
            marginLeft: 20,
          }}
        >
          {build.verdict.toUpperCase()}
        </div>
      </div>

      <div style={{ fontSize: 22, color: INK_2, marginTop: 14 }}>{build.parts}</div>

      <div style={{ display: 'flex', marginTop: 28 }}>
        <Slots slots={build.slots} />
      </div>

      <Load label="HEAT" value={build.heat} unit="units" />
      <Load label="POWER" value={build.power} unit="W" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 34,
          paddingTop: 26,
          borderTop: `2px solid ${LINE}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, color: INK_3 }}>
            GRID STABILITY
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: build.accent,
              lineHeight: 1.1,
            }}
          >
            {`${build.stability}%`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 3, color: INK_3 }}>
            EARNS
          </div>
          <div style={{ fontSize: 52, fontWeight: 700, color: INK, lineHeight: 1.5 }}>
            {`${build.rate.toFixed(2)}/hr`}
          </div>
        </div>
      </div>
    </div>
  );
}

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: WIDTH,
          height: HEIGHT,
          padding: '54px 60px',
          background: OBSIDIAN,
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="44" height="44" viewBox="0 0 100 100">
              <path
                d="M50 6 88 28v44L50 94 12 72V28z"
                fill="none"
                stroke={BRAND_HI}
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <path d="M56 22 34 54h14l-4 24 22-32H52z" fill={CHARGE} />
            </svg>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 7,
                color: INK,
                marginLeft: 18,
              }}
            >
              VOLTARA
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: INK_2 }}>
            SAME MONEY. SEVEN TIMES THE OUTPUT.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 44,
          }}
        >
          <Panel build={OVERBUILT} />
          <Panel build={BALANCED} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto',
          }}
        >
          <div style={{ fontSize: 26, color: INK_2 }}>
            The rig on the left has twice the hash. It keeps 7% of it.
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: BRAND_HI }}>
            voltaragrid.com
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
