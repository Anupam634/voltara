'use client';

import { useEffect } from 'react';

/**
 * Counts one browsing session.
 *
 * The id lives in `sessionStorage`, so it survives clicking through the site
 * and dies with the tab. No cookie, no id that travels between sites, no IP
 * recorded server side -- which is why this needs no consent banner and why
 * the admin panel is careful to call the number sessions rather than people.
 *
 * Fires once per session, after the page is interactive, and never blocks or
 * shows anything. `keepalive` lets it survive the navigation if a visitor
 * clicks away immediately, which is exactly the visit worth counting.
 */
const KEY = 'vg:visit';

function sessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return null; // already counted this session
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode, or storage blocked. Not counting is the right failure:
    // without the guard every page view would count as a new visit.
    return null;
  }
}

export function VisitBeacon({ locale }: { locale: string }) {
  useEffect(() => {
    const id = sessionId();
    if (!id) return;

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
    const payload = JSON.stringify({
      id,
      locale,
      path: window.location.pathname,
      referrer: document.referrer || null,
    });

    // Deliberately unawaited and deliberately silent. A counter is not worth
    // an error in anyone's console, let alone a failed page.
    void fetch(`${base}/metrics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [locale]);

  return null;
}
