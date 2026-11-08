import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import FileLinks from './FileLinks';

export default function DetailDialog({ trigger, title, subtitle, rows, files }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent dir="rtl" className="max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl text-[#2a2622]">{title}</DialogTitle>
        </DialogHeader>
        {subtitle && <p className="text-xs text-[#6a6158] -mt-1">{subtitle}</p>}
        <div className="mt-2">
          <FileLinks files={files} />
          {rows.map((row, index) => (
            <div key={index} className="py-2 border-b border-dashed border-[#e3d9cc] last:border-0">
              <p className="text-xs text-[#6a6158]">{row.label}</p>
              <p className="text-sm text-[#2a2622] whitespace-pre-wrap">{row.value || '—'}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}