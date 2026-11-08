import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LEAD_STATUSES, SERVICE_KEYS, serviceMeta } from '@/lib/leadStatus';

const SORTS = [
  { value: 'followup_asc', label: 'תאריך מעקב · מהקרוב לרחוק' },
  { value: 'followup_desc', label: 'תאריך מעקב · מהרחוק לקרוב' },
  { value: 'created', label: 'החדשים קודם' },
];

function Filter({ label, value, onChange, children }) {
  return (
    <div>
      <span className="block text-[11px] text-[#6a6158] mb-1">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs bg-white border-[#d9cfc2] text-[#2a2622]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function LeadFilters({ service, status, sort, onService, onStatus, onSort }) {
  return (
    <div className="bg-[#faf6f1] border border-[#e3d9cc] px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Filter label="סינון לפי שירות" value={service} onChange={onService}>
        <SelectItem value="all" className="text-xs">כל השירותים</SelectItem>
        {SERVICE_KEYS.map((key) => (
          <SelectItem key={key} value={key} className="text-xs">
            {serviceMeta(key).label}
          </SelectItem>
        ))}
      </Filter>

      <Filter label="סינון לפי סטטוס" value={status} onChange={onStatus}>
        <SelectItem value="active" className="text-xs">פעילים (בלי לא רלוונטי)</SelectItem>
        <SelectItem value="all" className="text-xs">כל הסטטוסים</SelectItem>
        {LEAD_STATUSES.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">
            {option}
          </SelectItem>
        ))}
      </Filter>

      <Filter label="מיון" value={sort} onChange={onSort}>
        {SORTS.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </Filter>
    </div>
  );
}