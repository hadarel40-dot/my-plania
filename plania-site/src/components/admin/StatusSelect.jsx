import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STATUS_OPTIONS, DEFAULT_STATUS } from '@/lib/recordStatus';

export default function StatusSelect({ value, onChange, options = STATUS_OPTIONS }) {
  return (
    <Select value={value || DEFAULT_STATUS} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[140px] text-xs bg-white border-[#d9cfc2] text-[#2a2622]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir="rtl">
        {options.map((status) => (
          <SelectItem key={status} value={status} className="text-xs">
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}