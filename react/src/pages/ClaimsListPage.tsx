import { useRef, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GridComponent, ColumnsDirective, ColumnDirective, Page, Sort, Filter, Toolbar, Inject } from '@syncfusion/ej2-react-grids';
import { useClaimData } from '../lib/data';
import { dateLabel } from '../domain/format';
import { TONE_BADGE } from '../domain/palette';
import { LoadingState } from '../components/LoadingState';

// Module-level column templates (syncfusion-component-patterns.md, "Templates: module level, precomputed fields"):
// they read only fields on the row record and stay stable across renders so the Grid does not redraw every row.
const TONE_BADGE_MAP: Record<string, string> = TONE_BADGE as unknown as Record<string, string>;

type GridRow = {
  id?: string;
  status?: string;
  statusTone?: string;
  priority?: string;
  priorityTone?: string;
  submittedDate?: string;
};

// Case ID cell: renders the id as a link. Click handler is held in a stable ref so the template
// reference stays stable and the Grid does not redraw every row on each render
// (syncfusion-component-patterns.md, "Templates: ... handlerRef ... so the Grid does not re-render every row").
// Modified clicks (cmd/ctrl/shift/alt, non-primary button) keep the browser default (new tab).
function IdCell(props: GridRow) {
  const handler = idCellHandlerRef.current;
  const id = props.id ?? '';
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    handler(id);
  };
  return (
    <a
      className="claim-id-link"
      href={id ? `/claims/${id}` : '#'}
      onClick={onClick}
      aria-label={`Open claim ${id}`}
    >
      {id}
    </a>
  );
}

function StatusCell(props: GridRow) {
  const tone = TONE_BADGE_MAP[String(props.statusTone ?? 'info')] || '';
  const label = String(props.status ?? '').replace(/-/g, ' ');
  return <span className={`badge ${tone}`}>{label}</span>;
}

function PriorityCell(props: GridRow) {
  const tone = TONE_BADGE_MAP[String(props.priorityTone ?? 'info')] || '';
  return <span className={`badge ${tone}`}>{props.priority ?? ''}</span>;
}

function SubmittedCell(props: GridRow) {
  if (!props.submittedDate) return '';
  return dateLabel(new Date(`${props.submittedDate}T00:00:00Z`));
}

// Module-level ref so IdCell's template reference is stable. The hook fills it on mount.
const idCellHandlerRef: { current: (id: string) => void } = { current: () => {} };

export function ClaimsListPage() {
  const { claims, loading } = useClaimData();
  const navigate = useNavigate();
  // Keep the handler ref in sync each render so the cell template always calls the latest navigate.
  const handlerRef = useRef<(id: string) => void>(() => {});
  handlerRef.current = (id: string) => {
    if (!id) return;
    navigate(`/claims/${id}`);
  };
  idCellHandlerRef.current = handlerRef.current;

  if (loading) {
    return <LoadingState label="Loading Claims List…" />;
  }

  const data = claims ?? [];

  if (data.length === 0) {
    return (
      <div className="e-card">
        <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">Claims List</div></div></div>
        <div className="e-card-content"><p style={{ color: 'var(--color-sf-fg-secondary)', margin: 0 }}>No claims loaded.</p></div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header__title">
          <h1>Claims List</h1>
          <p>Search, sort and filter every claim in the selected period. Click any Case ID to open its details.</p>
        </div>
      </div>
      <div className="e-card">
        <div className="e-card-header"><div className="e-card-header-caption"><div className="e-card-header-title">All Claims</div></div></div>
        <div className="e-card-content">
          <GridComponent
            dataSource={data}
            allowPaging={true}
            pageSettings={{ pageSize: 15 }}
            allowSorting={true}
            allowFiltering={true}
            toolbar={['Search']}
            width="100%"
          >
            <Inject services={[Page, Sort, Filter, Toolbar]} />
            <ColumnsDirective>
              <ColumnDirective field="id" headerText="Case ID" width="120" template={IdCell as any} />
              <ColumnDirective field="claimantName" headerText="Claimant" clipMode="EllipsisWithTooltip" />
              <ColumnDirective field="claimType" headerText="Type" width="100" />
              <ColumnDirective field="status" headerText="Status" width="140" template={StatusCell as any} />
              <ColumnDirective field="amount" headerText="Amount" width="120" format="C0" textAlign="Right" />
              <ColumnDirective field="submittedDate" headerText="Submitted" width="130" template={SubmittedCell as any} />
              <ColumnDirective field="adjuster" headerText="Adjuster" clipMode="EllipsisWithTooltip" />
              <ColumnDirective field="priority" headerText="Priority" width="120" template={PriorityCell as any} />
            </ColumnsDirective>
          </GridComponent>
        </div>
      </div>
    </div>
  );
}

ClaimsListPage.displayName = 'ClaimsListPage';
