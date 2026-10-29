import { ArrowDownRight, ArrowUpRight, ClipboardList, Clock, DollarSign, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ClaimDisplay } from '../lib/data';
import { count, percent } from '../domain/format';

interface KpiCardsProps {
  claims: ClaimDisplay[];
}

interface Kpi {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: 'success' | 'warning' | 'danger' | 'info';
  delta?: { sign: 'up' | 'down' | 'flat'; label: string };
}

function computeKpis(claims: ClaimDisplay[]): Kpi[] {
  const total = claims.length;
  const open = claims.filter(c => !c.status.startsWith('closed')).length;
  const closedCount = total - open;
  const avgCycle = total > 0 ? Math.round(claims.reduce((s, c) => s + c.cycleDays, 0) / total) : 0;
  const settled = claims.filter(c => c.status === 'closed-paid').length;
  const rate = closedCount > 0 ? settled / closedCount : 0;

  // Industry target bands (DESIGN.md, "Color semantics"): ≤30d good, 30-45d watch, >45d bad;
  // settlement rate ≥80% good, 60-80% watch, <60% bad. Neutral for a pure count.
  const avgCycleTone = avgCycle <= 30 ? 'success' : avgCycle <= 45 ? 'warning' : 'danger';
  const rateTone = rate >= 0.8 ? 'success' : rate >= 0.6 ? 'warning' : 'danger';

  // Trend deltas (period-over-period) for the KPI cards. The delta is derived from the claim history in
  // the selected period; when there is no comparable prior month the card carries no movement claim
  // rather than a fabricated one (design-system.md, "A KPI says what it measures, over what scope and period").
  const monthlyCounts = new Map<string, number>();
  for (const c of claims) {
    const k = c.submittedDate.slice(0, 7);
    monthlyCounts.set(k, (monthlyCounts.get(k) ?? 0) + 1);
  }
  const months = [...monthlyCounts.keys()].sort();
  const lastMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const recentClaimCount = months.length >= 2 && lastMonth ? monthlyCounts.get(lastMonth) ?? 0 : 0;
  const priorClaimCount = months.length >= 2 && prevMonth ? monthlyCounts.get(prevMonth) ?? 0 : 0;
  const totalDelta = priorClaimCount > 0 ? (recentClaimCount - priorClaimCount) / priorClaimCount : 0;

  return [
    {
      label: 'Total Claims',
      value: count(total),
      note: total > 0 ? `All types in period` : 'No claims in period',
      icon: ClipboardList,
      tone: 'info',
      ...(priorClaimCount > 0 ? {
        delta: {
          sign: totalDelta >= 0 ? 'up' : 'down',
          label: `${totalDelta >= 0 ? '+' : ''}${percent(Math.abs(totalDelta))} vs prior month`
        }
      } : {})
    },
    {
      label: 'Open Claims',
      value: count(open),
      note: `${count(closedCount)} closed`,
      icon: Clock,
      tone: 'warning',
      ...(open > 0 ? {
        delta: {
          sign: 'flat',
          label: `${percent(rate)} settled`
        }
      } : {})
    },
    {
      label: 'Avg Cycle Time',
      value: `${count(avgCycle)}d`,
      note: total > 0 ? `Industry target: 30d` : 'No data',
      icon: TrendingUp,
      tone: avgCycleTone,
      ...(avgCycle > 0 ? {
        delta: {
          sign: avgCycleTone === 'success' ? 'up' : 'down',
          label: avgCycleTone === 'success' ? 'On target' : avgCycleTone === 'warning' ? 'Watch' : 'Over target'
        }
      } : {})
    },
    {
      label: 'Settlement Rate',
      value: percent(rate),
      note: closedCount > 0 ? `${count(settled)} of ${count(closedCount)} closed claims` : 'No closed claims',
      icon: DollarSign,
      tone: rateTone,
      ...(closedCount > 0 ? {
        delta: {
          sign: rate >= 0.8 ? 'up' : rate >= 0.6 ? 'flat' : 'down',
          label: rate >= 0.8 ? 'Above 80% target' : rate >= 0.6 ? 'Below 80% target' : 'Well below target'
        }
      } : {})
    }
  ];
}

function DeltaIcon({ sign, tone }: { sign: 'up' | 'down' | 'flat'; tone: Kpi['tone'] }) {
  if (sign === 'flat') return <span className="app-kpi__delta app-kpi__delta--neutral" aria-hidden="true">—</span>;
  // Trend direction is paired with the tone (DESIGN.md, "KPI tones follow the value") rather than
  // rendering the band as red/green by itself.
  const Icon = sign === 'up' ? ArrowUpRight : ArrowDownRight;
  const cls =
    sign === 'up' && tone === 'danger' ? 'app-kpi__delta--danger' :
    sign === 'up' ? 'app-kpi__delta--success' :
    sign === 'down' && tone === 'success' ? 'app-kpi__delta--warning' :
    sign === 'down' ? 'app-kpi__delta--danger' :
    'app-kpi__delta--neutral';
  return (
    <span className={`app-kpi__delta ${cls}`} aria-hidden="true">
      <Icon size={14} />
    </span>
  );
}

export function KpiCards({ claims }: KpiCardsProps) {
  const kpis = computeKpis(claims);
  return (
    <div className="dashboard-grid dashboard-grid--kpi">
      {kpis.map(kpi => {
        const Icon = kpi.icon;
        return (
          <article
            key={kpi.label}
            className="e-card app-kpi dashboard-grid__kpi"
            aria-label={`${kpi.label}: ${kpi.value}`}
          >
            <header className="app-kpi__header">
              <div className="app-kpi__label">{kpi.label}</div>
              <div
                className="app-kpi__icon"
                style={{
                  background: `var(--color-sf-bg-${kpi.tone}-primary)`,
                  color: `var(--color-sf-fg-${kpi.tone}-primary)`
                }}
              >
                <Icon size={18} aria-hidden="true" />
              </div>
            </header>
            <div className="app-kpi__value">{kpi.value}</div>
            {kpi.delta ? (
              <div className="app-kpi__footnote">
                <DeltaIcon sign={kpi.delta.sign} tone={kpi.tone} />
                <span className={`app-kpi__delta app-kpi__delta--${kpi.delta.sign === 'up' && kpi.tone === 'danger' ? 'danger' : kpi.delta.sign === 'up' ? 'success' : kpi.delta.sign === 'down' && kpi.tone === 'success' ? 'warning' : kpi.delta.sign === 'down' ? 'danger' : 'neutral'}`}>
                  {kpi.delta.label}
                </span>
              </div>
            ) : null}
            <div className="app-kpi__footnote">
              <span className="app-kpi__note">{kpi.note}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

KpiCards.displayName = 'KpiCards';