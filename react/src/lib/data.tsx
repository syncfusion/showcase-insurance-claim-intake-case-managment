import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Data model types and session state for Insurance Claims Portal.

export type ClaimType = 'auto' | 'property' | 'liability' | 'health' | 'life';
export type ClaimStatus = 'submitted' | 'under-review' | 'investigation' | 'settlement' | 'closed-paid' | 'closed-denied';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type MarkerShape = 'Circle' | 'Diamond' | 'Triangle';

export interface ClaimDocument {
  name: string;
  type: string;
  url: string;
}

export interface Claim {
  id: string;
  policyNumber: string;
  claimantName: string;
  claimType: ClaimType;
  status: ClaimStatus;
  submittedDate: string;
  lastUpdatedDate: string;
  incidentDate: string;
  description: string;
  amount: number;
  settlementAmount?: number;
  adjuster: string;
  priority: Priority;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  dob?: string;
  phone?: string;
  email?: string;
  street?: string;
  zip?: string;
  documents: ClaimDocument[];
  notes: string[];
}

export interface ClaimDisplay extends Claim {
  cycleDays: number;
  statusTone: 'success' | 'warning' | 'danger' | 'info';
  priorityTone: 'success' | 'warning' | 'danger' | 'info';
  markerShape: MarkerShape;
}

export type AppTheme = 'light' | 'dark';

export interface DateRange { start: Date; end: Date }

const DEMO_TODAY = new Date('2026-10-26');

function daysBetween(a: string, b: string | Date): number {
  const da = new Date(a + 'T00:00:00Z');
  const db = typeof b === 'string' ? new Date(b + 'T00:00:00Z') : b;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function statusTone(status: ClaimStatus): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'closed-paid') return 'success';
  if (status === 'closed-denied') return 'danger';
  if (status === 'settlement' || status === 'investigation') return 'warning';
  return 'info';
}

function priorityTone(p: Priority): 'success' | 'warning' | 'danger' | 'info' {
  if (p === 'low') return 'info';
  if (p === 'medium') return 'warning';
  return 'danger';
}

function markerShape(status: ClaimStatus): MarkerShape {
  if (status === 'settlement') return 'Diamond';
  if (status === 'closed-paid' || status === 'closed-denied') return 'Triangle';
  return 'Circle';
}

const STORAGE_KEY = 'insurance-claims-portal-v1';

let baselineClaims: Claim[] = [];
let sessionClaims: Map<string, Claim> = new Map();

export async function loadClaims(): Promise<ClaimDisplay[]> {
  if (baselineClaims.length === 0) {
    const res = await fetch('/insurance-claims-intake-portal/react/data/claims.json');
    baselineClaims = await res.json();
  }
  // Merge localStorage edits
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const edits = JSON.parse(stored) as Record<string, Claim>;
      sessionClaims = new Map(Object.entries(edits));
    }
  } catch { sessionClaims = new Map(); }

  const merged = baselineClaims.map(c => ({ ...c, ...(sessionClaims.get(c.id) ?? {}) }));
  return merged.map(c => derive(c));
}

export function derive(c: Claim): ClaimDisplay {
  const closed = c.status.startsWith('closed');
  const ref = closed ? c.lastUpdatedDate : DEMO_TODAY;
  return {
    ...c,
    cycleDays: daysBetween(c.submittedDate, closed ? c.lastUpdatedDate : DEMO_TODAY.toISOString().split('T')[0]),
    statusTone: statusTone(c.status),
    priorityTone: priorityTone(c.priority),
    markerShape: markerShape(c.status)
  };
}

export function saveClaim(id: string, updates: Partial<Claim>): void {
  const base = baselineClaims.find(c => c.id === id) ?? sessionClaims.get(id);
  if (!base) return;
  const merged = { ...base, ...updates, lastUpdatedDate: new Date().toISOString().split('T')[0] };
  sessionClaims.set(id, merged);
  persist();
}

export function resetAll(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionClaims = new Map();
}

function persist(): void {
  const obj: Record<string, Claim> = {};
  for (const [k, v] of sessionClaims) obj[k] = v;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function getTheme(): AppTheme {
  try {
    const stored = localStorage.getItem('insurance-claims-portal-theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveTheme(theme: AppTheme): void {
  localStorage.setItem('insurance-claims-portal-theme', theme);
}

export function getSidebarDocked(): boolean {
  try { return localStorage.getItem('insurance-claims-portal-nav-collapsed') === 'true'; } catch { return false; }
}

// React context for claims + theme

interface ClaimDataValue {
  claims: ClaimDisplay[] | null;
  loading: boolean;
}

const ClaimDataCtx = createContext<ClaimDataValue>({ claims: null, loading: true });

export function ClaimDataProvider({ children }: { children: ReactNode }) {
  const [claims, setClaims] = useState<ClaimDisplay[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadClaims().then(list => {
      if (!cancelled) { setClaims(list); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setClaims([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  return <ClaimDataCtx.Provider value={{ claims, loading }}>{children}</ClaimDataCtx.Provider>;
}

export const useClaimData = () => useContext(ClaimDataCtx);