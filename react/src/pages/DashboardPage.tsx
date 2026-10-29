import { useState, useMemo } from 'react';
import { useClaimData, type ClaimType } from '../lib/data';
import { useTheme } from '../lib/ThemeProvider';
import { FilterBar } from '../components/FilterBar';
import { KpiCards } from '../components/KpiCards';
import { ChartSectionWrapper } from '../components/ChartsSection';
import { MapSectionWrapper } from '../components/MapsSection';
import { LoadingState } from '../components/LoadingState';

export function DashboardPage() {
  const { claims: allClaims, loading } = useClaimData();
  const { theme } = useTheme();
  const [dateRange, setDateRange] = useState({ start: new Date(2025, 9, 1), end: new Date(2026, 9, 26) });
  const [claimType, setClaimType] = useState<ClaimType | 'all'>('all');

  const filtered = useMemo(() => {
    if (!allClaims || allClaims.length === 0) return [];
    return allClaims.filter(c => {
      const sd = new Date(c.submittedDate);
      if (sd < dateRange.start || sd > dateRange.end) return false;
      if (claimType !== 'all' && c.claimType !== claimType) return false;
      return true;
    });
  }, [allClaims, dateRange, claimType]);

  if (loading) {
    return <LoadingState label="Loading claims data…" />;
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header__title">
          <h1>Claims Dashboard</h1>
          <p>Portfolio performance, claim status mix and geographic distribution for the selected period.</p>
        </div>
      </div>
      <FilterBar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        claimType={claimType}
        onClaimTypeChange={setClaimType}
      />
      <KpiCards claims={filtered} />
      {filtered.length > 0 ? <ChartSectionWrapper claims={filtered} theme={theme} /> : null}
      {filtered.length > 0 ? <MapSectionWrapper claims={filtered} /> : null}
    </div>
  );
}

DashboardPage.displayName = 'DashboardPage';