import { ImageResponse } from 'next/og';

/**
 * The rig card: the image X, Telegram and WhatsApp unfurl when a miner
 * shares their invite link.
 *
 * Every share used to show the same static og-image, so a thousand miners
 * posting produced a thousand identical ads. This renders *their* build —
 * which parts are socketed, what the rig makes, whether it is holding 100%
 * stability — so the post reads as a flex rather than a referral.
 *
 * Edge runtime, not node: on Windows the node build of @vercel/og resolves
 * its bundled font through `fileURLToPath` and produces `.\file:\C:\...`,
 * which throws ERR_INVALID_URL before a single pixel is drawn. The edge
 * build embeds the font instead, and its fetch reaches the API either way.
 *
 * Satori (what ImageResponse renders with) supports only a slice of CSS:
 * every element with more than one child needs an explicit `display: flex`,
 * and layout is flexbox only. That is why the markup below is so blunt.
 */

export const runtime = 'edge';
// The card shows a live rate and a live stability figure, so it must not be
// frozen at build time; the backend already caches it for 30s.
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;

const OBSIDIAN = '#07060b';
const SURFACE = '#171327';
const INK = '#f4f1fa';
const INK_2 = '#b7b0c9';
const INK_3 = '#7a7192';
const BRAND = '#7c3aed';
const BRAND_HI = '#a78bfa';
const CHARGE = '#a3e635';
const HEAT = '#f43f5e';
const WARN = '#fbbf24';

/** Slot pip colour per part kind. Empty slots are drawn as a dashed hole. */
const KIND_COLOUR: Record<string, string> = {
  CORE: BRAND_HI,
  COOLER: '#22d3ee',
  PSU: CHARGE,
  MODULE: '#ec4899',
};

interface CardSlot {
  kind: string;
  code: string | null;
  name: string;
  tier: number;
}

interface RigCard {
  name: string;
  countryCode: string | null;
  ratePerHour: number;
  gridStability: number;
  slots: (CardSlot | null)[];
  partCount: number;
  skin: string;
  streakDays: number;
  joinedAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

async function loadCard(code: string): Promise<RigCard | null> {
  try {
    const res = await fetch(`${API}/rig/card/${encodeURIComponent(code)}`, {
      cache: 'no-store',
      // An unfurl bot will not wait. Better a generic card than a timeout.
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as RigCard;
  } catch {
    return null;
  }
}

/** Colour the stability figure the way the app does: lime, amber, rose. */
function stabilityColour(pct: number): string {
  if (pct >= 95) return CHARGE;
  if (pct >= 60) return WARN;
  return HEAT;
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <svg width="46" height="46" viewBox="0 0 100 100">
        <path
          d="M50 6 88 28v44L50 94 12 72V28z"
          fill="none"
          stroke={BRAND_HI}
          strokeWidth="7"
          strokeLinejoin="round"
        />
        <path d="M56 22 34 54h14l-4 24 22-32H52z" fill={CHARGE} />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 16 }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 700,
            color: INK,
            letterSpacing: 6,
            lineHeight: 1,
          }}
        >
          VOLTARA
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: CHARGE,
            letterSpacing: 5,
            marginTop: 6,
            lineHeight: 1,
          }}
        >
          THE GRID
        </div>
      </div>
    </div>
  );
}

/**
 * One of the six sockets. Filled pips carry the kind colour.
 *
 * Two complete returns rather than a fragment inside one: Satori flattens a
 * React fragment into its parent's flex flow, so `<>{kind}{code}</>` inside
 * a column laid the two lines out side by side instead of stacked.
 */
function SlotPip({ slot }: { slot: CardSlot | null }) {
  const box = {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between' as const,
    width: 164,
    height: 104,
    marginRight: 14,
    marginBottom: 14,
    padding: 14,
    borderRadius: 10,
  };

  if (!slot) {
    return (
      <div
        style={{
          ...box,
          justifyContent: 'center',
          border: `2px dashed ${INK_3}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 2,
            color: INK_3,
          }}
        >
          EMPTY
        </div>
      </div>
    );
  }

  const colour = KIND_COLOUR[slot.kind] ?? BRAND_HI;
  return (
    <div
      style={{
        ...box,
        border: `2px solid ${colour}`,
        backgroundColor: SURFACE,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 2,
          color: colour,
        }}
      >
        {slot.kind}
      </div>
      <div style={{ display: 'flex', fontSize: 22, fontWeight: 700, color: INK }}>
        {slot.code ?? slot.name}
      </div>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: 56,
        backgroundColor: OBSIDIAN,
        // A violet wash falling from the top-left to a lime hint at the
        // bottom-right, so the card reads as VOLTARA at thumbnail size in a
        // crowded timeline. Satori parses only a narrow gradient grammar —
        // the app's two-radius radial blooms throw "Missing comma before
        // color stops" here, so this is a linear stand-in, not a downgrade
        // anyone will notice at 1200x630.
        backgroundImage:
          'linear-gradient(135deg, rgba(124,58,237,0.42) 0%, rgba(76,29,149,0.20) 38%, rgba(7,6,11,0) 66%, rgba(163,230,53,0.16) 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      {children}
    </div>
  );
}

/** Shown when the miner is unknown, blocked, or the API is unreachable. */
function GenericCard() {
  return (
    <Frame>
      <Wordmark />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', fontSize: 68, fontWeight: 700, color: INK }}>
          Build the rig. Hold the grid.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 30,
            color: INK_2,
            marginTop: 22,
            maxWidth: 900,
          }}
        >
          Six slots, real running costs. Cores make heat, coolers cost watts, and
          GRID STABILITY multiplies everything you earn.
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: CHARGE }}>
        VOLTS convert to $VLTR on BNB Chain
      </div>
    </Frame>
  );
}

function RigCardImage({ card, code }: { card: RigCard; code: string }) {
  const stability = stabilityColour(card.gridStability);
  // Always draw six sockets: a half-empty rig is part of the story.
  const slots = [...card.slots];
  while (slots.length < 6) slots.push(null);

  return (
    <Frame>
      {/* Header: brand on the left, the miner on the right. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Wordmark />
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
        >
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: INK }}>
            {card.name}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
              color: INK_3,
              marginTop: 6,
            }}
          >
            {card.partCount} PARTS RUNNING
            {card.streakDays >= 3 ? ` · ${card.streakDays} DAY STREAK` : ''}
          </div>
        </div>
      </div>

      {/* Body: the six sockets on the left, the two numbers on the right. */}
      <div style={{ display: 'flex', flex: 1, marginTop: 40 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: 550,
            alignContent: 'flex-start',
          }}
        >
          {slots.slice(0, 6).map((slot, i) => (
            <SlotPip key={i} slot={slot} />
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            marginLeft: 36,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 4,
              color: INK_3,
            }}
          >
            MINING RATE
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 6 }}>
            <div style={{ display: 'flex', fontSize: 86, fontWeight: 700, color: CHARGE }}>
              {card.ratePerHour.toFixed(1)}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 28,
                fontWeight: 700,
                color: INK_2,
                marginLeft: 12,
                marginBottom: 16,
              }}
            >
              VOLTS / h
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: 4,
              color: INK_3,
              marginTop: 30,
            }}
          >
            GRID STABILITY
          </div>
          <div style={{ display: 'flex', fontSize: 56, fontWeight: 700, color: stability }}>
            {card.gridStability}%
          </div>
          {/* The bar carries the same colour, so the state reads before the
              number does. */}
          <div
            style={{
              display: 'flex',
              width: 420,
              height: 14,
              marginTop: 14,
              borderRadius: 999,
              backgroundColor: 'rgba(167,139,250,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: (420 * Math.max(0, Math.min(100, card.gridStability))) / 100,
                height: 14,
                borderRadius: 999,
                backgroundColor: stability,
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer: the invite code, which is the whole point of the card. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 26,
          paddingTop: 26,
          borderTop: `1px solid rgba(167,139,250,0.22)`,
        }}
      >
        <div style={{ display: 'flex', fontSize: 25, color: INK_2 }}>
          Beat this rig on VOLTARA
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 22px',
            borderRadius: 999,
            border: `2px solid ${CHARGE}`,
            backgroundColor: 'rgba(163,230,53,0.10)',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 3,
              color: INK_3,
              marginRight: 12,
            }}
          >
            INVITE
          </div>
          <div style={{ display: 'flex', fontSize: 25, fontWeight: 700, color: CHARGE }}>
            {code}
          </div>
        </div>
      </div>
    </Frame>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const code = params.code ?? '';
  const card = await loadCard(code);

  return new ImageResponse(
    card ? <RigCardImage card={card} code={code} /> : <GenericCard />,
    { width: WIDTH, height: HEIGHT },
  );
}
