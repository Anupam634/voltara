'use client';

import React from 'react';
import { LogoMark } from '../Logo';
import { Icon, type IconName } from '../ui';
import type { AdminTab } from './types';
import type { AdminStats } from '../../lib/admin-api';

interface AdminSidebarProps {
  currentTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  stats: AdminStats | null;
  onSignOut: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function AdminSidebar({
  currentTab,
  onSelectTab,
  stats,
  onSignOut,
  isOpen,
  onToggle,
}: AdminSidebarProps) {
  const navSections = [
    {
      group: 'MAIN',
      items: [
        { key: 'dashboard' as AdminTab, label: 'Dashboard', icon: 'gauge' as IconName, badge: null },
      ],
    },
    {
      group: 'MINER ACCOUNTS',
      items: [
        { key: 'users' as AdminTab, label: 'All Miners', icon: 'users' as IconName, badge: stats?.totalUsers ? String(stats.totalUsers) : null },
        { key: 'kyc' as AdminTab, label: 'KYC & Verification', icon: 'shield' as IconName, badge: stats?.kycSummary?.pending ? `${stats.kycSummary.pending}` : null },
      ],
    },
    {
      group: 'MINING & PROTOCOL',
      items: [
        { key: 'mining-engine' as AdminTab, label: 'Mining Engine', icon: 'rig' as IconName, badge: 'LIVE' },
        { key: 'grid' as AdminTab, label: 'Grid Operations', icon: 'globe' as IconName, badge: 'LIVE' },
        { key: 'seasons' as AdminTab, label: 'Weekly Seasons', icon: 'trophy' as IconName, badge: 'VOLTS' },
        { key: 'social' as AdminTab, label: 'Competitive & Social', icon: 'swords' as IconName, badge: null },
        { key: 'boosters' as AdminTab, label: 'Hashrate Boosters', icon: 'chip' as IconName, badge: stats?.boostersActive ? `${stats.boostersActive}` : null },
        { key: 'referrals' as AdminTab, label: '6-Tier Referrals', icon: 'share' as IconName, badge: '1×–8×' },
      ],
    },
    {
      group: 'TREASURY & ON-CHAIN',
      items: [
        { key: 'withdrawals' as AdminTab, label: 'Withdrawals Queue', icon: 'wallet' as IconName, badge: stats?.pendingWithdrawals ? `${stats.pendingWithdrawals}` : null },
        { key: 'payments' as AdminTab, label: 'Booster Payments', icon: 'card' as IconName, badge: null },
        { key: 'revenue' as AdminTab, label: 'Revenue Analytics', icon: 'chart' as IconName, badge: 'USD' },
        { key: 'blockchain' as AdminTab, label: 'Blockchain & BSC', icon: 'chain' as IconName, badge: 'BEP-20' },
      ],
    },
    {
      group: 'ECOSYSTEM & COMMERCE',
      items: [
        { key: 'tasks' as AdminTab, label: 'Bounties & Tasks', icon: 'star' as IconName, badge: 'Quiz/Wheel' },
        { key: 'support' as AdminTab, label: 'Support Helpdesk', icon: 'chat' as IconName, badge: null },
        { key: 'cms' as AdminTab, label: 'Content & FAQs', icon: 'doc' as IconName, badge: null },
      ],
    },
    {
      group: 'ENTERPRISE & OPS',
      items: [
        { key: 'reports' as AdminTab, label: 'Reports & Export', icon: 'download' as IconName, badge: 'CSV' },
        { key: 'security' as AdminTab, label: 'Security & Abuse', icon: 'lock' as IconName, badge: stats?.blockedUsers ? `${stats.blockedUsers} Ban` : null },
        { key: 'system' as AdminTab, label: 'System Settings', icon: 'settings' as IconName, badge: null },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.08] bg-slate-950 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
          <div className="flex items-center gap-3">
            <LogoMark size={32} priority />
            <div>
              <span className="font-black tracking-tight text-white">VOLTARA</span>
              <span className="ml-1.5 rounded-full border border-violet-500/30 bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-black text-violet-300">
                PRO
              </span>
              <div className="text-[10px] font-mono text-slate-500">Enterprise Admin Console</div>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 lg:hidden"
            aria-label="Close navigation"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Scrollable Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((section) => (
            <div key={section.group} className="space-y-1">
              <div className="px-3 text-[10px] font-black uppercase tracking-wider text-slate-500">
                {section.group}
              </div>
              <div className="space-y-0.5 pt-1">
                {section.items.map((item) => {
                  const isActive = currentTab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        onSelectTab(item.key);
                        if (window.innerWidth < 1024) onToggle();
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-violet-600 text-white font-black shadow-md shadow-violet-600/25'
                          : 'text-slate-400 hover:bg-slate-900/90 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon name={item.icon} size={15} className="shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        // Lime is reserved for what is genuinely live. Counts
                        // and format labels ("CSV", "BEP-20") are not events,
                        // so they stay neutral — otherwise the one badge that
                        // means "happening now" reads like all the others.
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            item.badge === 'LIVE'
                              ? 'border border-amber-500/40 bg-amber-500/15 text-amber-400'
                              : isActive
                                ? 'bg-slate-950/60 text-violet-200'
                                : 'border border-slate-700 bg-slate-800 text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Operator Account & Sign Out */}
        <div className="border-t border-white/[0.08] p-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-900 p-2.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-xs font-black text-white">
                OP
              </div>
              <div className="overflow-hidden text-left">
                <div className="truncate text-xs font-bold text-white">Super Admin</div>
                <div className="truncate text-[10px] text-slate-400">admin@voltaragrid.com</div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="rounded-lg p-1.5 text-xs text-red-400 hover:bg-red-950/50 hover:text-red-300"
              title="Sign Out"
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
