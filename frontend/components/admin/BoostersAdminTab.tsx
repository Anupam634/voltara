'use client';
import { Icon } from '../ui';

import React, { useEffect, useState } from 'react';
import {
  AdminBoosterPlan,
  AdminPartInput,
  AdminPartKind,
  AdminBoosterPurchase,
  AdminStats,
  listAdminBoosterPlans,
  createAdminBoosterPlan,
  updateAdminBoosterPlan,
  deleteAdminBoosterPlan,
  listAdminBoosterPurchases,
  forceConfirmBoosterPurchase,
} from '../../lib/admin-api';

const PART_GLYPH: Record<AdminPartKind, string> = {
  CORE: '◈',
  COOLER: '❄',
  PSU: '⚡',
  MODULE: '✦',
};

/** A part with no running cost yet — every create starts from this. */
const BLANK_PART: AdminPartInput = {
  priceUsd: 1,
  rateBonusPoints: 0,
  durationDays: 30,
  active: true,
  kind: 'CORE',
  name: '',
  code: '',
  tier: 1,
  heat: 0,
  cooling: 0,
  watts: 0,
  wattsSupplied: 0,
  hashBoostPercent: 0,
};

export function BoostersAdminTab({ stats }: { stats: AdminStats | null }) {
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'transactions'>('plans');

  // Plans state
  const [plans, setPlans] = useState<AdminBoosterPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [editingPlan, setEditingPlan] = useState<AdminBoosterPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [planForm, setPlanForm] = useState<AdminPartInput>({
    ...BLANK_PART,
    priceUsd: 1,
    rateBonusPoints: 2,
    heat: 10,
    watts: 45,
  });

  // Purchases / Transactions state
  const [purchases, setPurchases] = useState<AdminBoosterPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [forceConfirmingId, setForceConfirmingId] = useState<string | null>(null);
  const [customTxHash, setCustomTxHash] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'transactions') {
      loadPurchases();
    }
  }, [activeSubTab, statusFilter]);

  async function loadPlans() {
    setLoadingPlans(true);
    setError(null);
    try {
      const data = await listAdminBoosterPlans();
      setPlans(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load booster plans.');
    } finally {
      setLoadingPlans(false);
    }
  }

  async function loadPurchases() {
    setLoadingPurchases(true);
    setError(null);
    try {
      const data = await listAdminBoosterPurchases(statusFilter, searchQuery);
      setPurchases(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load booster transactions.');
    } finally {
      setLoadingPurchases(false);
    }
  }

  function handleOpenCreate() {
    setIsCreating(true);
    setEditingPlan(null);
    // Defaults that are a *valid* core rather than a free-to-run one: the
    // server rejects hash with no running cost, and a form that opens on a
    // rejected state teaches the wrong thing.
    setPlanForm({
      ...BLANK_PART,
      priceUsd: 5,
      rateBonusPoints: 10,
      heat: 26,
      watts: 110,
    });
  }

  function handleOpenEdit(p: AdminBoosterPlan) {
    setIsCreating(false);
    setEditingPlan(p);
    setPlanForm({
      priceUsd: p.priceUsd,
      rateBonusPoints: p.rateBonusPoints,
      durationDays: p.durationDays,
      active: p.active,
      kind: p.kind,
      name: p.name ?? '',
      code: p.code ?? '',
      tier: p.tier,
      heat: p.heat,
      cooling: p.cooling,
      watts: p.watts,
      wattsSupplied: p.wattsSupplied,
      hashBoostPercent: p.hashBoostPercent,
    });
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (isCreating) {
        await createAdminBoosterPlan(planForm);
        setSuccessMsg('New booster plan created successfully!');
      } else if (editingPlan) {
        await updateAdminBoosterPlan(editingPlan.id, planForm);
        setSuccessMsg(`Booster plan $${planForm.priceUsd} updated successfully!`);
      }
      setIsCreating(false);
      setEditingPlan(null);
      await loadPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to save booster plan.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePlan(id: string) {
    if (!confirm('Are you sure you want to delete this booster plan?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAdminBoosterPlan(id);
      setSuccessMsg('Booster plan deleted.');
      await loadPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to delete booster plan.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForceConfirm(purchaseId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await forceConfirmBoosterPurchase(purchaseId, customTxHash);
      setSuccessMsg(res.message);
      setForceConfirmingId(null);
      setCustomTxHash('');
      await loadPurchases();
    } catch (err: any) {
      setError(err.message || 'Failed to force activate booster.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <h2 className="text-xl font-black text-white">Hashrate Booster Plans & Transaction Audits</h2>
          <p className="text-xs text-slate-400">
            Manage booster catalog values, price points, and audit on-chain USDT/BNB payments in real-time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3.5 py-1.5 font-mono text-xs font-bold text-amber-400">
            Active Boosters: {stats?.boostersActive ?? 0}
          </div>
          {activeSubTab === 'plans' && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 shadow-md transition-all hover:scale-105"
            >
              + Create Booster Plan
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* Sub Navigation */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('plans')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
            activeSubTab === 'plans'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          ⚡ Booster Plans Catalog ({plans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('transactions')}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
            activeSubTab === 'transactions'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          On-Chain Booster Payments & Audits
        </button>
      </div>

      {/* ───────────────────── TAB 1: PLANS CATALOG ───────────────────── */}
      {activeSubTab === 'plans' && (
        <>
          {loadingPlans ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading booster plans...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`card border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md transition-all ${
                    !p.active ? 'opacity-60 border-dashed' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      {p.durationDays} Days
                    </span>
                    <span className="font-mono text-xl font-black text-amber-400">
                      ${p.priceUsd}.00
                    </span>
                  </div>

                  {/* The catalogue names the part now, so the panel reads it
                      off the row rather than guessing from the price. */}
                  <h3 className="mt-3 text-base font-bold text-white">
                    {PART_GLYPH[p.kind]} {p.name ?? `Unnamed $${p.priceUsd} part`}
                  </h3>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-500">
                    {p.code ?? 'no code'} · {p.kind} · T{p.tier}
                  </div>

                  {/* Gains in green, running costs in amber — the same
                      grammar the miner-facing shop uses. */}
                  <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[10px] font-bold">
                    {p.rateBonusPoints > 0 && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                        +{p.rateBonusPoints.toFixed(1)} VOLTS/h
                      </span>
                    )}
                    {p.hashBoostPercent > 0 && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                        +{p.hashBoostPercent}% hash
                      </span>
                    )}
                    {p.cooling > 0 && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                        −{p.cooling} TU
                      </span>
                    )}
                    {p.wattsSupplied > 0 && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                        +{p.wattsSupplied} W
                      </span>
                    )}
                    {p.heat > 0 && (
                      <span className="rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-orange-300">
                        +{p.heat} TU
                      </span>
                    )}
                    {p.watts > 0 && (
                      <span className="rounded border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-orange-300">
                        −{p.watts} W
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
                    <span>
                      Active: <strong className="text-white">{p.activeSales} miners</strong>
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        p.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {p.active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="flex-1 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs font-bold text-amber-300 transition-all hover:bg-amber-500/20"
                    >
                      ✏️ Edit Values
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id)}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-bold text-rose-300 transition-all hover:bg-rose-500/20"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ───────────────────── TAB 2: TRANSACTIONS & AUDITS ───────────────────── */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-slate-900 p-1 text-xs font-semibold">
              {['ALL', 'CONFIRMED', 'AWAITING_PAYMENT', 'FAILED', 'EXPIRED'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    statusFilter === s
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email, wallet, txHash..."
                className="input-field w-64 text-xs"
              />
              <button
                type="button"
                onClick={loadPurchases}
                className="rounded-xl border border-white/15 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
              >
                Search
              </button>
            </div>
          </div>

          {loadingPurchases ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading transactions...</div>
          ) : purchases.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-8 text-center text-xs text-slate-400">
              No booster transactions found matching this filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-900/80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-950/80 text-slate-400 font-mono">
                    <th className="p-3">User & Email</th>
                    <th className="p-3">Plan & Price</th>
                    <th className="p-3">Amount Required</th>
                    <th className="p-3">Payer Wallet (fromAddress)</th>
                    <th className="p-3">Status & TxHash</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {purchases.map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white">{tx.userEmail}</div>
                        <div className="font-mono text-[10px] text-slate-500">{tx.userId}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-amber-300">${tx.planPriceUsd}.00</span>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          +{tx.rateBonusPoints} /h
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-200">
                        {tx.expectedAmount} {tx.tokenSymbol}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {tx.fromAddress ? (
                          <span title={tx.fromAddress}>
                            {tx.fromAddress.slice(0, 8)}...{tx.fromAddress.slice(-6)}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            tx.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : tx.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : tx.status === 'AWAITING_PAYMENT'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {tx.status}
                        </span>

                        {tx.failureReason && (
                          <div className="mt-1 text-[10px] text-rose-400 font-semibold max-w-xs break-words">
                            {tx.failureReason}
                          </div>
                        )}

                        {tx.txHash && (
                          <div className="mt-1">
                            <a
                              href={`https://bscscan.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[10px] text-cyan-400 underline hover:text-cyan-300"
                            >
                              {tx.txHash.slice(0, 10)}...
                            </a>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">
                        {new Date(tx.createdAt).toLocaleDateString()}{' '}
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 text-right">
                        {tx.status !== 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => setForceConfirmingId(tx.id)}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20"
                          >
                            ⚡ Force Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────── MODAL: CREATE / EDIT PLAN ───────────────────── */}
      {(isCreating || editingPlan) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white">
              {isCreating ? '⚡ Create rig part' : `✏️ Edit part (${editingPlan?.name ?? `$${editingPlan?.priceUsd}`})`}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              A part gives something and costs something to run. Set both — a
              core with no heat and no draw cannot be balanced against, and the
              API rejects it.
            </p>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Kind</label>
                  <select
                    value={planForm.kind ?? 'CORE'}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, kind: e.target.value as AdminPartKind })
                    }
                    className="input-field mt-1 text-sm font-mono"
                  >
                    <option value="CORE">CORE — hash</option>
                    <option value="COOLER">COOLER — removes heat</option>
                    <option value="PSU">PSU — supplies watts</option>
                    <option value="MODULE">MODULE — multiplies hash</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Tier (1–5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={planForm.tier ?? 1}
                    onChange={(e) =>
                      setPlanForm({ ...planForm, tier: parseInt(e.target.value, 10) || 1 })
                    }
                    className="input-field mt-1 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Name</label>
                  <input
                    type="text"
                    placeholder="VC-5 Arc Core"
                    value={planForm.name ?? ''}
                    onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                    className="input-field mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="field-label">Code</label>
                  <input
                    type="text"
                    placeholder="VC5"
                    value={planForm.code ?? ''}
                    onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })}
                    className="input-field mt-1 text-sm font-mono uppercase"
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    The seed matches on this — keep it unique and stable.
                  </p>
                </div>
              </div>

              <div>
                <label className="field-label">Price (USD / USDT)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={planForm.priceUsd}
                  onChange={(e) => setPlanForm({ ...planForm, priceUsd: parseFloat(e.target.value) || 0 })}
                  className="input-field mt-1 text-sm font-mono"
                />
              </div>

              <div>
                <label className="field-label">Hashrate Bonus (+VOLTS/h)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  required
                  value={planForm.rateBonusPoints}
                  onChange={(e) => setPlanForm({ ...planForm, rateBonusPoints: parseFloat(e.target.value) || 0 })}
                  className="input-field mt-1 text-sm font-mono"
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  Cores only. Example: 2.0 = adds +2.0 VOLTS/h to the base rate.
                </p>
              </div>

              {/* ── Running costs ── */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                  Running cost &amp; capacity
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Chassis gives every miner 12 TU of cooling and 120 W free.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Heat produced (TU)</label>
                    <input
                      type="number"
                      min="0"
                      value={planForm.heat ?? 0}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, heat: parseInt(e.target.value, 10) || 0 })
                      }
                      className="input-field mt-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="field-label">Heat removed (TU)</label>
                    <input
                      type="number"
                      min="0"
                      value={planForm.cooling ?? 0}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, cooling: parseInt(e.target.value, 10) || 0 })
                      }
                      className="input-field mt-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="field-label">Power drawn (W)</label>
                    <input
                      type="number"
                      min="0"
                      value={planForm.watts ?? 0}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, watts: parseInt(e.target.value, 10) || 0 })
                      }
                      className="input-field mt-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="field-label">Power supplied (W)</label>
                    <input
                      type="number"
                      min="0"
                      value={planForm.wattsSupplied ?? 0}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          wattsSupplied: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="input-field mt-1 text-sm font-mono"
                    />
                  </div>
                </div>
                {planForm.kind === 'MODULE' && (
                  <div className="mt-3">
                    <label className="field-label">Hash boost (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={planForm.hashBoostPercent ?? 0}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          hashBoostPercent: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="input-field mt-1 text-sm font-mono"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">
                      Applies to total core hash. Modules stack additively.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={planForm.durationDays}
                  onChange={(e) => setPlanForm({ ...planForm, durationDays: parseInt(e.target.value, 10) || 30 })}
                  className="input-field mt-1 text-sm font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="planActiveCheck"
                  checked={planForm.active}
                  onChange={(e) => setPlanForm({ ...planForm, active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="planActiveCheck" className="text-xs font-bold text-white cursor-pointer">
                  Plan is Active (Available for purchase)
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingPlan(null);
                  }}
                  className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-md hover:scale-105"
                >
                  {busy ? 'Saving...' : isCreating ? 'Create Plan' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────── MODAL: FORCE CONFIRM TRANSACTION ───────────────────── */}
      {forceConfirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md border-emerald-500/40 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-black text-white">⚡ Force Confirm & Activate Booster</h3>
            <p className="mt-1 text-xs text-slate-400">
              Override verification and activate the mining hashrate booster for this user immediately (useful for underpayments or manual transfers).
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="field-label">Transaction Hash (Optional)</label>
                <input
                  type="text"
                  value={customTxHash}
                  onChange={(e) => setCustomTxHash(e.target.value)}
                  placeholder="0x... (or leave blank for manual admin approval)"
                  className="input-field mt-1 text-xs font-mono"
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setForceConfirmingId(null)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleForceConfirm(forceConfirmingId)}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-bold text-slate-950 shadow-md hover:scale-105"
                >
                  {busy ? 'Activating...' : 'Confirm & Activate Booster'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
