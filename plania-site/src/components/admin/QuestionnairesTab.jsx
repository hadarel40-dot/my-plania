import { useState } from 'react';
import RecordRow from './RecordRow';
import QuoteDialog from './QuoteDialog';
import QuoteViewDialog from './QuoteViewDialog';
import OpenProjectButton from './OpenProjectButton';
import { formatDateTime } from '@/lib/formatDate';

const TIER_LABELS = { basic: 'בסיסי', premium: 'פרימיום' };

const shekel = (value) => `₪${Number(value).toLocaleString('he-IL')}`;

const HIDDEN_STATUS = 'לא רלוונטי';

export default function QuestionnairesTab({
  records,
  emptyText,
  accentColor,
  type,
  onUpdate,
  onDelete,
  projectBySource = {},
  onOpenProject,
  onCreateProject,
  onSynced,
}) {
  const [showHidden, setShowHidden] = useState(false);

  if (!records.length) {
    return <p className="text-center text-sm text-[#6a6158] py-10">{emptyText}</p>;
  }

  const hiddenCount = records.filter((record) => record.status === HIDDEN_STATUS).length;
  const visible = showHidden ? records : records.filter((record) => record.status !== HIDDEN_STATUS);

  return (
    <div className="space-y-3">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden((value) => !value)}
          className="text-xs text-[#6a6158] underline underline-offset-4"
        >
          {showHidden ? 'להסתיר שאלונים לא רלוונטיים' : `להציג גם שאלונים לא רלוונטיים (${hiddenCount})`}
        </button>
      )}
      {visible.length === 0 && (
        <p className="text-center text-sm text-[#6a6158] py-8">אין שאלונים פעילים.</p>
      )}
      {visible.map((record) => {
        const answers = Array.isArray(record.answers) ? record.answers : [];
        const files = Array.isArray(record.files) ? record.files : [];
        const tierLabel = TIER_LABELS[record.plan_tier];
        const contractRows = record.contract_signed
          ? [
              { label: 'הסכם', value: `נחתם על ידי ${record.signer_name} · ת.ז./ח.פ. ${record.signer_id_number} · ${formatDateTime(record.signed_at)} · גרסה ${record.contract_version}` },
              { label: 'נוסח ההסכם שנחתם', value: record.contract_text },
            ]
          : [{ label: 'הסכם', value: 'לא נחתם (שאלון ישן)' }];
        const quoteRows = record.quote_sent_at
          ? [
              { label: 'הצעת מחיר נשלחה', value: formatDateTime(record.quote_sent_at) },
              { label: 'מחיר', value: record.quote_price ? shekel(record.quote_price) : '' },
              { label: 'מקדמה', value: record.quote_deposit ? shekel(record.quote_deposit) : 'לא צוין' },
              { label: 'זמן אספקה', value: record.quote_delivery },
              { label: 'בריף', value: record.quote_brief },
              ...(record.quote_payment_url
                ? [{ label: 'קישור לתשלום מקדמה', value: record.quote_payment_url }]
                : []),
              ...(record.quote_approved_at
                ? [
                    {
                      label: 'ההצעה אושרה',
                      value: `${formatDateTime(record.quote_approved_at)} · ${record.quote_approved_name}`,
                    },
                  ]
                : []),
            ]
          : [];
        const detailRows = [
          { label: 'מייל', value: record.email },
          { label: 'טלפון', value: record.phone },
          ...(tierLabel ? [{ label: 'מסלול', value: tierLabel }] : []),
          ...contractRows,
          ...quoteRows,
          ...answers.map((answer) => ({
            label: answer.section ? `${answer.section} · ${answer.question}` : answer.question,
            value: answer.answer,
          })),
        ];

        return (
          <RecordRow
            key={record.id}
            record={record}
            accentColor={accentColor}
            onUpdate={(patch) => onUpdate(record.id, patch)}
            onDelete={onDelete ? () => onDelete(record.id) : undefined}
            files={files}
            extraActions={
              <>
                {onCreateProject && (
                  <OpenProjectButton
                    project={projectBySource[record.id]}
                    onCreate={() => onCreateProject(record)}
                    onOpen={onOpenProject}
                  />
                )}
                {record.quote_sent_at && <QuoteViewDialog record={record} type={type} />}
                <QuoteDialog
                  record={record}
                  type={type}
                  onSent={(patch, synced) => {
                    onUpdate(record.id, patch);
                    if (onSynced) onSynced(synced);
                  }}
                />
              </>
            }
            notice={
              record.quote_approved_at
                ? `ההצעה אושרה · ${formatDateTime(record.quote_approved_at)} · ${record.quote_approved_name}`
                : record.quote_sent_at
                  ? `הצעת מחיר נשלחה · ${formatDateTime(record.quote_sent_at)}`
                  : ''
            }
            meta={`${formatDateTime(record.created_date)} · ${answers.length} תשובות${tierLabel ? ` · ${tierLabel}` : ''}${record.contract_signed ? ' · הסכם נחתם' : ''}${files.length ? ` · ${files.length} קבצים` : ''}`}
            detailLabel="צפייה בתשובות"
            detailTitle={record.name}
            detailRows={detailRows}
          />
        );
      })}
    </div>
  );
}