'use client';

import React from 'react';
import type { AdminTab } from './types';
import { Icon } from '../ui';
import type { AdminStats } from '../../lib/admin-api';

interface AdminTopNavProps {
  currentTab: AdminTab;
  onToggleSidebar: () => void;
  stats: AdminStats | null;
  onRefresh: () => void;
}

export function AdminTopNav({
  currentTab,
  onToggleSidebar,
  stats,
  onRefresh,
}: AdminTopNavProps) {
  const titles: Record<AdminTab, string> = {
    dashboard: 'Dashboard & Platform Telemetry',
    users: 'Miner Accounts & Identity Directory',
    'mining-engine': 'Mining Engine & Accrual Controller',
    grid: 'Grid Operations — Events, Weather & Collective Goal',
    seasons: 'Weekly Seasons & Prize Settlement',
    social: 'Duels, Squads, Part Market & Challenges',
    boosters: 'Hashrate Booster Plans & Subscriptions',
    referrals: '6-Tier Viral Referral Network Matrix',
    withdrawals: 'Withdrawals Queue & Payout Escrow',
    blockchain: 'BNB Smart Chain (BEP-20) Infrastructure',
    kyc: 'Identity Verification (KYC) Queue',
    tasks: 'Tasks, Quizzes & Lucky Wheel 360°',
    payments: 'On-Chain Booster Payment Audits',
    revenue: 'Booster Revenue Analytics & Payer Ledger',
    support: 'Customer Support Helpdesk',
    cms: 'Content Management & Platform Legal Terms',
    reports: 'Automated Reports & CSV Data Exporter',
    security: 'Security, Anti-Abuse & Sybil Defense',
    system: 'System Health, RPC & Database Config',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-slate-950/80 px-4 sm:px-6 backdrop-blur-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 transition hover:border-violet-500/50 hover:text-white lg:hidden"
          aria-label="Open navigation"
        >
          <Icon name="settings" size={16} />
        </button>
        <div>
          <h1 className="text-sm font-black text-white sm:text-base">{titles[currentTab]}</h1>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <span>Admin</span>
            <span>/</span>
            <span className="capitalize text-violet-300">{currentTab.replace('-', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* What used to sit here was a hardcoded "BNB Mainnet Sync 100%"
            chip with a pulsing dot — a static string that claimed a healthy
            mainnet connection whatever the chain was doing, on a build whose
            WALLET_MODE is still `offchain`. The real chain status lives on
            the Blockchain tab, which reads it; an always-green badge in the
            chrome is worse than none. */}
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:border-violet-500/50 hover:text-white"
        >
          <Icon name="sparkle" size={13} />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>
    </header>
  );
}
