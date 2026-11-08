import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import DetailDialog from './DetailDialog';
import PhoneActions from './PhoneActions';
import StatusSelect from './StatusSelect';
import DeleteButton from './DeleteButton';
import { DEFAULT_STATUS } from '@/lib/recordStatus';
import { useAdminActions } from './AdminActions';

export default function RecordRow({
  record,
  accentColor,
  onUpdate,
  onDelete,
  meta,
  detailLabel,
  detailTitle,
  detailRows,
  files,
  extraActions,
  notice,
}) {
  const { openClient } = useAdminActions();
  const status = record.status || DEFAULT_STATUS;
  const [notes, setNotes] = useState(record.notes || '');
  const [savedNotes, setSavedNotes] = useState(record.notes || '');
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await onUpdate({ notes });
      setSavedNotes(notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#faf6f1] border-r-4 px-4 py-3" style={{ borderRightColor: accentColor }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-heading text-lg text-[#2a2622]">{record.name}</p>
            {status === DEFAULT_STATUS && (
              <span className="text-[10px] px-2 py-0.5 rounded-full text-white bg-[#5E1D1D]">חדש</span>
            )}
          </div>
          <p className="text-xs text-[#6a6158]">{meta}</p>
          {notice && <p className="text-xs text-[#4A6355] mt-0.5">{notice}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusSelect value={status} onChange={(value) => onUpdate({ status: value })} />
          <PhoneActions phone={record.phone} name={record.name} />
          {extraActions}
          <Button size="sm" variant="outline" className="text-xs" onClick={() => openClient(record)}>
            כרטיס לקוח
          </Button>
          <DetailDialog
            trigger={
              <Button size="sm" variant="outline" className="text-xs">
                {detailLabel}
              </Button>
            }
            title={detailTitle}
            subtitle={meta}
            rows={detailRows}
            files={files}
          />
          {onDelete && <DeleteButton name={record.name} what="השאלון" onDelete={onDelete} />}
        </div>
      </div>

      <div className="mt-3">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="הערות"
          rows={2}
          className="text-sm bg-white border-[#d9cfc2]"
        />
        {notes !== savedNotes && (
          <Button size="sm" className="mt-2 text-xs" onClick={saveNotes} disabled={saving}>
            {saving ? 'שומר...' : 'שמירת הערות'}
          </Button>
        )}
      </div>
    </div>
  );
}