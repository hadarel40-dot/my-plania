// Keeps the lead and the client project in step with a questionnaire's quote.
// Runs with the service role, so it works the same wherever the quote changes
// (sending a quote, or the client approving it from the emailed link).

export function phoneKey(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function shekel(value) {
  return `₪${Number(value).toLocaleString('he-IL')}`;
}

function entry(kind, text) {
  return { at: new Date().toISOString(), kind, text };
}

function isoDay(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// The newest lead with the same phone, preferring the same service.
async function findLead(base44, phone, type) {
  const key = phoneKey(phone);
  if (!key) return null;
  const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 500);
  const matches = (leads || []).filter((lead) => phoneKey(lead.phone) === key);
  return matches.find((lead) => lead.service === type) || matches[0] || null;
}

async function findProject(base44, recordId) {
  if (!recordId) return null;
  const projects = await base44.asServiceRole.entities.ClientProject.filter({ source_id: recordId });
  return (projects || [])[0] || null;
}

// A new quote was sent: the lead moves to "quote sent", its deal value follows the
// quote, a follow-up is set if none is coming up, and the project price follows too.
export async function syncOnQuoteSent(base44, record, type, patch) {
  const synced = { lead: null, project: null };

  try {
    const lead = await findLead(base44, record.phone, type);
    if (lead) {
      const nextStatus = lead.status === 'לקוח פעיל' ? lead.status : 'הצעת מחיר נשלחה';
      const history = [
        ...(Array.isArray(lead.history) ? lead.history : []),
        entry('quote', `נשלחה הצעת מחיר ${shekel(patch.quote_price)}`),
      ];
      if (nextStatus !== lead.status) {
        history.push(entry('status', `סטטוס שונה ל${nextStatus}`));
      }
      const today = isoDay();
      const leadPatch = {
        status: nextStatus,
        deal_value: patch.quote_price,
        follow_up_date:
          !lead.follow_up_date || lead.follow_up_date < today ? isoDay(3) : lead.follow_up_date,
        history,
      };
      await base44.asServiceRole.entities.Lead.update(lead.id, leadPatch);
      synced.lead = { id: lead.id, patch: leadPatch };
    }
  } catch (error) {
    console.error('lead sync failed', error?.message);
  }

  try {
    const project = await findProject(base44, record.id);
    if (project) {
      const projectPatch = {
        price: patch.quote_price,
        log: [
          { at: new Date().toISOString(), text: `נשלחה הצעת מחיר ${shekel(patch.quote_price)}, המחיר בפרויקט עודכן` },
          ...(Array.isArray(project.log) ? project.log : []),
        ],
      };
      await base44.asServiceRole.entities.ClientProject.update(project.id, projectPatch);
      synced.project = { id: project.id, patch: projectPatch };
    }
  } catch (error) {
    console.error('project sync failed', error?.message);
  }

  return synced;
}

// The client approved the quote: leave a mark in the lead's history and bring it to
// today's follow-ups. The status itself is left for the owner to decide.
export async function syncOnQuoteApproved(base44, record, type, approvedName) {
  try {
    const lead = await findLead(base44, record.phone, type);
    if (!lead) return;
    await base44.asServiceRole.entities.Lead.update(lead.id, {
      follow_up_date: isoDay(),
      history: [
        ...(Array.isArray(lead.history) ? lead.history : []),
        entry('quote', `${approvedName || 'הלקוח'} אישר/ה את הצעת המחיר`),
      ],
    });
  } catch (error) {
    console.error('lead approval sync failed', error?.message);
  }
}
