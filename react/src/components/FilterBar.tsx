import { DateRangePickerComponent, PresetsDirective, PresetDirective } from '@syncfusion/ej2-react-calendars';
import { DropDownListComponent } from '@syncfusion/ej2-react-dropdowns';
import type { ClaimType } from '../lib/data';

interface FilterBarProps {
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  claimType: ClaimType | 'all';
  onClaimTypeChange: (type: ClaimType | 'all') => void;
}

const PRESETS = [
  { label: 'Q4 2026', start: new Date(2026, 9, 1), end: new Date(2026, 11, 31) },
  { label: 'Q3 2026', start: new Date(2026, 6, 1), end: new Date(2026, 8, 30) },
  { label: 'YTD 2026', start: new Date(2026, 0, 1), end: new Date(2026, 11, 31) },
  { label: 'FY 2025', start: new Date(2025, 0, 1), end: new Date(2025, 11, 31) },
  { label: 'All Claims', start: new Date(2025, 9, 1), end: new Date(2026, 9, 26) }
];

const CLAIM_TYPES: { value: ClaimType | 'all'; text: string }[] = [
  { value: 'all', text: 'All Types' },
  { value: 'auto', text: 'Auto' },
  { value: 'property', text: 'Property' },
  { value: 'liability', text: 'Liability' },
  { value: 'health', text: 'Health' },
  { value: 'life', text: 'Life' }
];

export function FilterBar({ dateRange, onDateRangeChange, claimType, onClaimTypeChange }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="filter-bar__field">
        <span className="filter-bar__label" id="filter-period-label">Period</span>
        <DateRangePickerComponent
          startDate={dateRange.start}
          endDate={dateRange.end}
          format="MM/dd/yyyy"
          width="230px"
          placeholder="Select a period"
          htmlAttributes={{ 'aria-labelledby': 'filter-period-label' }}
          change={(args) => {
            if (args.startDate && args.endDate) {
              onDateRangeChange({ start: args.startDate, end: args.endDate });
            }
          }}
        >
          <PresetsDirective>
            {PRESETS.map(p => (
              <PresetDirective key={p.label} label={p.label} start={p.start} end={p.end} />
            ))}
          </PresetsDirective>
        </DateRangePickerComponent>
      </div>
      <div className="filter-bar__field">
        <span className="filter-bar__label" id="filter-type-label">Claim Type</span>
        <DropDownListComponent
          dataSource={CLAIM_TYPES}
          fields={{ value: 'value', text: 'text' }}
          value={claimType}
          width="200px"
          htmlAttributes={{ 'aria-labelledby': 'filter-type-label' }}
          change={(args) => onClaimTypeChange(args.value as ClaimType | 'all')}
        />
      </div>
    </div>
  );
}