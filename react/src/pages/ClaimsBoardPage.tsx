import { KanbanComponent, ColumnsDirective, ColumnDirective } from '@syncfusion/ej2-react-kanban';
import { useClaimData } from '../lib/data';
import { money } from '../domain/format';
import { TONE_BADGE } from '../domain/palette';

// Module-level template (syncfusion-component-patterns.md, "Templates: module level, precomputed fields"):
// it reads only fields on the record, so Kanban's redraw never loses the content.
// Returns JSX, not an HTML string — a string template renders as literal text inside the card
// (the "<div …" artefacts seen when this was a string-returning function).
type CardRecord = {
  id?: string;
  statusTone?: string;
  priorityTone?: string;
  status?: string;
  claimType?: string;
  claimantName?: string;
  amount?: number;
  adjuster?: string;
  priority?: string;
};


function CardTemplate(props: CardRecord) {
  const priority = String(props.priority ?? '');
  const priorityTone = String(props.priorityTone ?? 'info');
  return (
    <div className={`claim-card claim-card--${priorityTone}`}>
      <div className="claim-card__top">
        <span className="claim-card__id">{props.id ?? ''}</span>
        <div className="claim-card__badges">
          <span className={`badge claim-card__priority claim-card__priority--${priorityTone}`}>{priority}</span>
        </div>
      </div>
      <div className="claim-card__name" title={props.claimantName ?? ''}>{props.claimantName ?? ''}</div>
      <div className="claim-card__meta">
        <span className="claim-card__amount">{money(Number(props.amount ?? 0))}</span>
        <span className="claim-card__sep" aria-hidden="true">·</span>
        <span className="claim-card__adjuster">{props.adjuster ?? ''}</span>
      </div>
      <div className="claim-card__type">{String(props.claimType ?? '')}</div>
    </div>
  );
}

export function ClaimsBoardPage() {
  const { claims, loading } = useClaimData();

  if (loading) {
    return <div className="app-loading" role="status"><div className="app-loading__ring" /><div>Loading board…</div></div>;
  }

  const kanbanData = (claims ?? []).map(c => ({
    ...c,
    Id: c.id,
    Title: c.claimantName,
    Status: c.status.replace(/-/g, ' '),
    Summary: `${c.claimType} · ${money(c.amount)} · ${c.adjuster}`
  }));

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header__title">
          <h1>Claims Board</h1>
          <p>Workflow from submission to settlement. Drag a card to move it to the next stage.</p>
        </div>
      </div>
      <KanbanComponent
        dataSource={kanbanData}
        keyField="status"
        allowDragAndDrop
        width={'100%'}
        // The board is read-only in this phase: the default card dialog would show the internal id, the
        // status and an unlabelled text area (syncfusion-component-patterns.md, "Editors"), so it is
        // cancelled and the claim is edited on its own detail page instead.
        dialogOpen={(args: { cancel?: boolean }) => { args.cancel = true; }}
        cardSettings={{
          contentField: 'Summary',
          headerField: 'Id',
          template: CardTemplate as any
        }}
      >
        <ColumnsDirective>
          {/* Each column lists the stages a card may move to (syncfusion-component-patterns.md,
              "Kanban: cards keyed by id, moves the workflow allows"); a closed stage stays closed. */}
          <ColumnDirective headerText="Submitted" keyField="submitted" transitionColumns={['submitted', 'under-review']} />
          <ColumnDirective headerText="Under Review" keyField="under-review" transitionColumns={['submitted', 'under-review', 'investigation']} />
          <ColumnDirective headerText="Investigation" keyField="investigation" transitionColumns={['under-review', 'investigation', 'settlement']} />
          <ColumnDirective headerText="Settlement" keyField="settlement" transitionColumns={['investigation', 'settlement', 'closed-paid']} />
          <ColumnDirective headerText="Closed" keyField="closed-paid" transitionColumns={['closed-paid']} />
        </ColumnsDirective>
      </KanbanComponent>
    </div>
  );
}

ClaimsBoardPage.displayName = 'ClaimsBoardPage';
