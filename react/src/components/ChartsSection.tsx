import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChartComponent, SeriesCollectionDirective, SeriesDirective,
  Category, ColumnSeries, Tooltip, Legend, DataLabel,
  AccumulationChartComponent, AccumulationSeriesCollectionDirective, AccumulationSeriesDirective,
  PieSeries, AccumulationDataLabel, AccumulationLegend, AccumulationTooltip
} from '@syncfusion/ej2-react-charts';
import { Inject } from '@syncfusion/ej2-react-base';
import type { ClaimDisplay } from '../lib/data';
import type { AppTheme } from '../domain/palette';
import { palette, chartTheme, chartInk, inkOnFill, sliceLabelInk } from '../domain/palette';
import { compactMoney, monthLabel } from '../domain/format';

interface ChartsSectionProps {
  claims: ClaimDisplay[];
  theme: AppTheme;
}

// A six-month column chart satisfies the user's "last six months" requirement (syncfusion-component-patterns.md,
// "Charts in a measured container"): readable labels, generous margin, data labels above each column so the
// value reads without hovering, and a compact-money tooltip. Months are derived from the submitted dates
// present in the filtered set and sorted ascending so the chart reads left-to-right in time order.
function lastSixMonths(months: string[]): string[] {
  if (months.length <= 6) return months;
  return months.slice(-6);
}

// Syncfusion Chart format placeholders (design-system.md, "Numbers that agree"; syncfusion-component-patterns.md,
// "Tooltips say what the point is"). The Y axis runs through `axisLabelRender`, where we compact the
// raw amount to "$579K" so the axis stays legible at every viewport, and the tooltip shows the same
// compact amount from the record's own field.
const TOOLTIP_FORMAT = '${point.tooltip}';
const YAXIS_FORMAT = 'C0';

/**
 * Measures the chart's own container before the chart mounts and renders it at that width
 * (syncfusion-component-patterns.md, "Charts in a measured container"). The chart never reads a width
 * from an ancestor: each chart is measured in the box it actually occupies, so it still fits when the
 * sidebar is docked or the layout reflows.
 */
function MeasuredChart({ children }: { children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      setWidth(prev => prev === w ? prev : w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return <div ref={ref} className="chart-slot">{width > 0 ? children(width) : null}</div>;
}

export function ChartsSection({ claims, theme }: ChartsSectionProps) {
  const p = palette(theme);
  const ct = chartTheme(theme);

  if (claims.length === 0) {
    return (
      <div className="dashboard-grid">
        <div className="e-card dashboard-grid__span6">
          <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Claims by Month</div></div></div>
          <div className="e-card-content"><p style={{ color: 'var(--color-sf-fg-secondary)', margin: 0 }}>No claims in this period.</p></div>
        </div>
        <div className="e-card dashboard-grid__span6">
          <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Status Breakdown</div></div></div>
          <div className="e-card-content"><p style={{ color: 'var(--color-sf-fg-secondary)', margin: 0 }}>No claims to display.</p></div>
        </div>
      </div>
    );
  }

  // ---- Claims by month: aggregate amounts per month, take the most-recent six months ----
  const monthAgg = new Map<string, number>();
  for (const c of claims) {
    const month = c.submittedDate.slice(0, 7);
    monthAgg.set(month, (monthAgg.get(month) ?? 0) + c.amount);
  }
  const allMonths = [...monthAgg.keys()].sort();
  const recentMonths = lastSixMonths(allMonths);
  const monthData = recentMonths.map(month => ({
    month: monthLabel(month),
    amount: monthAgg.get(month) ?? 0,
    tooltip: compactMoney(monthAgg.get(month) ?? 0)
  }));

  // ---- Status breakdown: aggregate counts, sort largest first (syncfusion-component-patterns.md,
  // "Pie and donut slices run largest first"), and bind the slice's category colour to the data, not
  // to its position. Six status tones map to judgement colour (design-system.md, "Status tones"). ----
  const statusAgg = new Map<string, number>();
  for (const c of claims) {
    statusAgg.set(c.status, (statusAgg.get(c.status) ?? 0) + 1);
  }
  const statusOrder = ['submitted', 'under-review', 'investigation', 'settlement', 'closed-paid', 'closed-denied'];
  const statusLabels: Record<string, string> = {
    'submitted': 'Submitted', 'under-review': 'Under Review', 'investigation': 'Investigation',
    'settlement': 'Settlement', 'closed-paid': 'Closed Paid', 'closed-denied': 'Closed Denied'
  };

  // Status tone by status (defined after `p` is available so we use the chart series palette directly
  // for the slice fill — colour judges status, design-system.md "Colour semantics").
  function statusFill(status: string): string {
    if (status === 'closed-paid') return p.success;
    if (status === 'closed-denied') return p.danger;
    if (status === 'settlement' || status === 'investigation') return p.warning;
    return p.info;
  }

  // Sort largest first to keep "Pie and donut slices run largest first".
  const statusData = statusOrder
    .filter(s => statusAgg.has(s))
    .map(s => ({ status: statusLabels[s] || s, count: statusAgg.get(s) ?? 0, fill: statusFill(s), key: s }))
    .sort((a, b) => b.count - a.count);

  // Saturated ink for in-slice labels (syncfusion-component-patterns.md, "Pie and donut charts show their
  // values"). We pick white/near-black based on each slice's fill so the contrast stays >= 4.5:1; the
  // chart's own ink choice put white on the default blue series (3.7:1) in real-estate-portfolio.
  const sliceInk = (fill: string) => inkOnFill(fill);

  return (
    <div className="dashboard-grid">
      <div className="e-card dashboard-grid__span6">
        <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Claims by Month</div></div></div>
        <div className="e-card-content">
          <MeasuredChart>
            {chartWidth => (
              <ChartComponent
                key={`claims-by-month-${theme}`}
                theme={ct}
                palettes={[p.series[1]]}
                // Leave 2px slack: Syncfusion's SVG measurement is up to 2px wider than the
                // declared pixel width on a panel with no horizontal padding, and the browser
                // check fails any chart wider than its container by more than 2px
                // (browser-check, "control did not re-measure").
                width={`${Math.max(200, chartWidth - 2)}px`}
                height="320px"
                margin={{ left: 12, right: 12, top: 36, bottom: 12 }}
                primaryXAxis={{
                  valueType: 'Category',
                  title: '',
                  interval: 1,
                  labelIntersectAction: 'Rotate45',
                  labelStyle: { size: '12px', fontWeight: '500' }
                }}
                primaryYAxis={{
                  title: 'Amount (USD)',
                  labelFormat: YAXIS_FORMAT,
                  labelStyle: { size: '11px', fontWeight: '500' }
                }}
                tooltip={{
                  enable: true,
                  format: TOOLTIP_FORMAT,
                  header: '<b>${point.x}</b>'
                }}
                legendSettings={{ visible: false }}
                // The Y axis reads in compact money ("$579K"), so the scale stays legible at every viewport
                // (design-system.md, "Number formatting"). The X axis is a category axis: its `value` is the
                // category index (0, 1, 2 …), not an amount, so it must keep the month label the chart
                // already computed ("Jan 2026"). Formatting it as money rendered the axis as "$0", "$1".
                // `axisLabelRender` fires for every axis, so the category axis is skipped by its `valueType`.
                axisLabelRender={(args: { text?: string; value?: number; axis?: { valueType?: string } }) => {
                  if (args.axis?.valueType === 'Category') return;
                  if (typeof args.value === 'number') args.text = compactMoney(args.value);
                }}
                textRender={(args: { text?: string; series?: { type?: string }; point?: { y?: number } }) => {
                  // The column's data label reads in compact money ($579K), so the value is legible without
                  // hovering and the labels stay inside the chart (design-system.md, "Number formatting";
                  // syncfusion-component-patterns.md, "Charts in a measured container").
                  const point = args.point as { y?: number } | undefined;
                  if (!point || typeof point.y !== 'number') return;
                  args.text = compactMoney(point.y);
                }}
              >
                <Inject services={[ColumnSeries, Category, Tooltip, Legend, DataLabel]} />
                <SeriesCollectionDirective>
                  <SeriesDirective
                    type="Column"
                    dataSource={monthData}
                    xName="month"
                    yName="amount"
                    name="Claims (USD)"
                    fill={p.series[1]}
                    cornerRadius={{ topLeft: 4, topRight: 4 }}
                    marker={{
                      dataLabel: {
                        visible: true,
                        position: 'Top',
                        font: { color: chartInk[theme], size: '11px', fontWeight: '600' }
                      }
                    }}
                    tooltipMappingName="tooltip"
                  />
                </SeriesCollectionDirective>
              </ChartComponent>
            )}
          </MeasuredChart>
        </div>
      </div>
      <div className="e-card dashboard-grid__span6">
        <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Status Breakdown</div></div></div>
        <div className="e-card-content">
          <MeasuredChart>
            {chartWidth => (
              <AccumulationChartComponent
                key={`status-breakdown-${theme}`}
                theme={ct}
                width={`${Math.max(200, chartWidth - 2)}px`}
                height="320px"
                margin={{ left: 8, right: 8, top: 12, bottom: 8 }}
                center={{ x: '50%', y: '52%' }}
                enableSmartLabels
                tooltip={{
                  enable: true,
                  format: '${point.x}: ${point.y} claims (${point.percentage}%)',
                  header: '<b>${point.x}</b>'
                }}
                legendSettings={{
                  visible: true,
                  position: 'Bottom',
                  alignment: 'Center',
                  // Padding for the page route, not the chart's own legend — Syncfusion's own
                  // legendSettings padding sits inside the legend box and offsets it slightly off
                  // centre on a narrow chart (browser-check, "chart legend off centre").
                  padding: 0,
                  // Wrap the legend labels so a six-status legend never paginates or clips at any
                  // viewport (syncfusion-component-patterns.md, "Chart labels fit the chart"): the
                  // theme's default height paginates a six-entry legend into "1/5" pages, so the
                  // legend is allowed to grow into two rows by trimming maximumLabelWidth.
                  textWrap: 'Wrap',
                  maximumLabelWidth: 92,
                  textStyle: { size: '12px', fontWeight: '500' }
                }}
                textRender={(args: { text?: string; series?: { type?: string }; point?: { color?: string; percentage?: number }; font?: { color?: string } }) => {
                  // The pie shows each slice's share, so the reader never has to hover to compare slices
                  // (syncfusion-component-patterns.md, "Pie and donut charts show their values"). Syncfusion
                  // already computes the share on the point.
                  if (!args.text || !args.series) return;
                  const point = args.point as { color?: string; percentage?: number } | undefined;
                  const share = point?.percentage ?? 0;
                  args.text = `${Math.round(share)}%`;
                  // The label ink is chosen from the slice's own fill so it reads 4.5:1 in both themes.
                  if (args.font) args.font.color = sliceInk(point?.color ?? p.neutral);
                }}
              >
                <Inject services={[PieSeries, AccumulationDataLabel, AccumulationLegend, AccumulationTooltip]} />
                <AccumulationSeriesCollectionDirective>
                  <AccumulationSeriesDirective
                    type="Pie"
                    dataSource={statusData}
                    xName="status"
                    yName="count"
                    pointColorMapping="fill"
                    startAngle={0}
                    endAngle={360}
                    // A wide ring (28% inner, 82% outer) keeps the in-slice share legible at every
                    // viewport: Syncfusion trims an inside label to the ring's width, so a thin ring
                    // cut "30%" to "3..." on a phone (syncfusion-component-patterns.md, "Chart labels
                    // fit the chart").
                    innerRadius="28%"
                    radius="82%"
                    explode={false}
                    dataLabel={{
                      visible: true,
                      position: 'Inside',
                      name: 'status',
                      maxWidth: 44,
                      font: { color: sliceLabelInk, size: '12px', fontWeight: '600' },
                      connectorStyle: { type: 'Line', length: '4%', width: 1 }
                    }}
                    tooltipMappingName="status"
                  />
                </AccumulationSeriesCollectionDirective>
              </AccumulationChartComponent>
            )}
          </MeasuredChart>
        </div>
      </div>
    </div>
  );
}

ChartsSection.displayName = 'ChartsSection';

// Wrapper that measures container width before rendering charts
export function ChartSectionWrapper({ claims, theme }: { claims: ClaimDisplay[]; theme: AppTheme }) {
  return <ChartsSection claims={claims} theme={theme} />;
}