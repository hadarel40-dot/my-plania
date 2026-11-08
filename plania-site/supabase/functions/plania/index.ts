// One Edge Function for the whole site. Each former Base44 function lives in handlers/<name>.ts
// unchanged, and is reached at /functions/v1/plania/<name> (POST from the site, GET for the ZIP link).
import { serve } from './_shared/base44.ts';
import approveQuote from './handlers/approveQuote.ts';
import downloadProjectFiles from './handlers/downloadProjectFiles.ts';
import downloadProjectZip from './handlers/downloadProjectZip.ts';
import getClientPortal from './handlers/getClientPortal.ts';
import getQuote from './handlers/getQuote.ts';
import instagramStats from './handlers/instagramStats.ts';
import resendQuote from './handlers/resendQuote.ts';
import sendQuote from './handlers/sendQuote.ts';
import submitClientMaterial from './handlers/submitClientMaterial.ts';
import submitLead from './handlers/submitLead.ts';
import submitQuestionnaire from './handlers/submitQuestionnaire.ts';
import syncCalendar from './handlers/syncCalendar.ts';

const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  approveQuote,
  downloadProjectFiles,
  downloadProjectZip,
  getClientPortal,
  getQuote,
  instagramStats,
  resendQuote,
  sendQuote,
  submitClientMaterial,
  submitLead,
  submitQuestionnaire,
  syncCalendar,
};

serve(async (req) => {
  const name = new URL(req.url).pathname.split('/').filter(Boolean).pop() || '';
  const handler = HANDLERS[name];
  if (!handler) return Response.json({ error: `Unknown function ${name}` }, { status: 404 });
  return handler(req);
});
