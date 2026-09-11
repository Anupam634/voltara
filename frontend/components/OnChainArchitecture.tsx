'use client';

import { Icon, Reveal, type IconName } from './ui';

/** Chain facts and the token split, as a spec sheet plus an allocation bar. */
export function OnChainArchitecture() {
  const specs: { label: string; value: string; icon: IconName }[] = [
    { label: 'Blockchain network', value: 'BNB Smart Chain', icon: 'globe' },
    { label: 'Token standard', value: 'BEP-20', icon: 'chip' },
    { label: 'Conversion', value: '3 VOLTS = 1 $VLTR', icon: 'swap' },
    { label: 'Total supply', value: '900M fixed', icon: 'lock' },
    { label: 'Distribution', value: 'Inflation-capped mining', icon: 'gauge' },
    { label: 'Official domain', value: 'voltaragrid.com', icon: 'shield' },
  ];

  const allocations = [
    { name: 'Mining community', percent: 30, amount: '270M', color: 'rgb(var(--c-charge))', desc: 'Daily rig accrual, part yields and referral multipliers.' },
    { name: 'Ecosystem & growth', percent: 20, amount: '180M', color: 'rgb(var(--c-ok))', desc: 'Grants, partnerships, community bounties.' },
    { name: 'Core team', percent: 20, amount: '180M', color: 'rgb(var(--c-brand-hi))', desc: 'Protocol, contract security, long-term vesting.' },
    { name: 'Public liquidity', percent: 20, amount: '180M', color: '#67e8f9', desc: 'Locked DEX / CEX pools on BNB Chain pairs.' },
    { name: 'Strategic partners', percent: 10, amount: '90M', color: '#f9a8d4', desc: 'Staking partners, advisory, cross-chain infra.' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specs.map((spec, i) => (
          <Reveal key={spec.label} index={i}>
            <div className="v-panel v-panel--lift v-hud flex items-center gap-3 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand-hi">
                <Icon name={spec.icon} size={18} />
              </span>
              <div className="min-w-0">
                <div className="v-eyebrow">{spec.label}</div>
                <div className="mt-0.5 truncate font-mono text-sm font-extrabold text-ink">{spec.value}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="v-panel v-hud relative overflow-hidden rounded-3xl p-6 sm:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-charge/10 blur-3xl" />

          <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="space-y-4 lg:col-span-5">
              <span className="v-chip v-chip--charge">
                <span className="v-dot" />
                Tokenomics
              </span>
              <h3 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-4xl">
                The economic engine of <span className="v-text-brand">VOLTARA</span>
              </h3>
              <p className="text-sm leading-relaxed text-ink-2 sm:text-base">
                The network runs on its native token <strong className="text-ink">$VLTR</strong>. Distribution is
                built to reward early miners, keep the grid secure and fund the ecosystem for the long run.
              </p>

              {/* Stacked allocation bar */}
              <div className="pt-2">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-line/15">
                  {allocations.map((a) => (
                    <span
                      key={a.name}
                      className="h-full transition-all duration-700"
                      style={{ width: `${a.percent}%`, background: a.color }}
                      title={`${a.name} ${a.percent}%`}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                  <div className="v-inset p-3">
                    <div className="text-[9px] font-bold uppercase text-ink-3">Token</div>
                    <div className="text-sm font-bold text-ink">VOLTARA</div>
                  </div>
                  <div className="v-inset p-3">
                    <div className="text-[9px] font-bold uppercase text-ink-3">Supply</div>
                    <div className="text-sm font-bold text-charge">900M fixed</div>
                  </div>
                  <div className="v-inset p-3">
                    <div className="text-[9px] font-bold uppercase text-ink-3">Distribution</div>
                    <div className="text-sm font-bold text-brand-hi">Inflation-capped</div>
                  </div>
                  <div className="v-inset p-3">
                    <div className="text-[9px] font-bold uppercase text-ink-3">Ratio</div>
                    <div className="text-sm font-bold text-ok">3 : 1</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 lg:col-span-7">
              {allocations.map((item, idx) => (
                <Reveal key={item.name} index={idx}>
                  <div className="v-inset p-4">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-sm font-bold text-ink">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        {item.name}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-ink-3">{item.amount} $VLTR</span>
                        <span className="text-sm font-extrabold text-ink">{item.percent}%</span>
                      </div>
                    </div>
                    <div className="v-track mt-2 h-2">
                      <div
                        className="v-track__fill"
                        style={{ width: `${item.percent}%`, background: item.color }}
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] leading-normal text-ink-3">{item.desc}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
