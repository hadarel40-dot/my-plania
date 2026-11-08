import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import QuestionField from './QuestionField';
import ContractStep from './ContractStep';
import FormErrorNotice from '@/components/FormErrorNotice';
import { getAttribution } from '@/lib/attribution';
import { getContract, contractToText, CONTRACT_VERSION, TRAVEL_TIERS } from '@/lib/contracts';

const OTHER = '__other__';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const draftKey = (key) => `plania_questionnaire_draft_${key}`;

function loadDraft(key) {
  try {
    const raw = window.localStorage.getItem(draftKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(key, data) {
  try {
    window.localStorage.setItem(draftKey(key), JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(key) {
  try {
    window.localStorage.removeItem(draftKey(key));
  } catch {
    // ignore
  }
}

export function travelersAges(question, values) {
  const raw = Array.isArray(values[question.id]) ? values[question.id] : [];
  return raw
    .map((item) => String(item ?? '').trim())
    .filter((item) => item !== '' && !Number.isNaN(Number(item)))
    .map(Number)
    .sort((a, b) => b - a);
}

function agesText(list) {
  if (!list.length) return '';
  const head = list.length === 1 ? 'נוסע אחד' : `${list.length} נוסעים`;
  return `${head}: ${list.join(', ')}`;
}

function answerFor(question, values, others) {
  if (question.type === 'ages') return agesText(travelersAges(question, values));
  const value = values[question.id];
  if (question.type === 'multi') {
    const list = (Array.isArray(value) ? value : []).filter((v) => v !== OTHER);
    if ((value || []).includes(OTHER) && (others[question.id] || '').trim()) {
      list.push(`אחר: ${others[question.id].trim()}`);
    }
    return list.join(', ');
  }
  if (question.type === 'single' && value === OTHER) {
    return (others[question.id] || '').trim() ? `אחר: ${others[question.id].trim()}` : '';
  }
  return String(value || '').trim();
}

function isAnswered(question, values, others) {
  if (!question.required) return true;
  return answerFor(question, values, others).length > 0;
}

// Maps the chosen plan option text back to its tier key ("basic" / "premium").
function tierFrom(allQuestions, values) {
  const q = allQuestions.find((item) => item.field === 'plan_tier');
  const chosen = q ? values[q.id] : '';
  if (!chosen) return null;
  return Object.keys(TRAVEL_TIERS).find((key) => String(chosen).startsWith(TRAVEL_TIERS[key].label)) || null;
}

export default function QuestionnaireForm({ config }) {
  const [draft] = useState(() => loadDraft(config.key));
  const [step, setStep] = useState(() =>
    draft && Number.isInteger(draft.step) ? Math.min(Math.max(draft.step, 0), config.sections.length) : 0
  );
  const [values, setValues] = useState(() => draft?.values || {});
  const [others, setOthers] = useState(() => draft?.others || {});
  const [errors, setErrors] = useState({});
  // מספר תעודת הזהות וההסכמה לא נשמרים בטיוטה, רק השם
  const [signature, setSignature] = useState({ name: draft?.signatureName || '', idNumber: '', agree: false });
  const [restored, setRestored] = useState(Boolean(draft));
  const [started, setStarted] = useState(Boolean(draft));
  const [savedNote, setSavedNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const allQuestions = config.sections.flatMap((s) =>
    s.questions.map((q) => ({ ...q, sectionTitle: s.title }))
  );
  const total = config.sections.length + 1;
  const isContractStep = step === config.sections.length;
  const section = isContractStep ? null : config.sections[step];
  const stepTitle = isContractStep ? 'חתימה על ההסכם' : section.title;
  const progress = ((step + 1) / total) * 100;
  const tier = tierFrom(allQuestions, values);
  const contract = getContract(config.key, tier);

  const hasContent = Object.keys(values).length > 0 || Object.keys(others).length > 0;

  useEffect(() => {
    if (sent) return;
    if (!hasContent && step === 0) return;
    saveDraft(config.key, { step, values, others, signatureName: signature.name });
  }, [config.key, step, values, others, signature.name, hasContent, sent]);

  const handleSaveForLater = () => {
    const ok = saveDraft(config.key, { step, values, others, signatureName: signature.name });
    setSavedNote(
      ok
        ? 'השאלון נשמר. אפשר לסגור ולחזור בכל זמן מאותו מכשיר ומאותו דפדפן, ותמשיכו מהמקום שעצרתם.'
        : 'השמירה לא הצליחה בדפדפן הזה. כדאי להשלים את השאלון בישיבה אחת.'
    );
  };

  const handleStartOver = () => {
    if (!window.confirm('למחוק את התשובות השמורות ולהתחיל מחדש?')) return;
    clearDraft(config.key);
    setValues({});
    setOthers({});
    setErrors({});
    setSignature({ name: '', idNumber: '', agree: false });
    setRestored(false);
    setSavedNote('');
    goTo(0);
  };

  const setValue = (id, value) => {
    setValues((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const setOther = (id, value) => {
    setOthers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const validateStep = () => {
    const next = {};
    if (isContractStep) {
      if (!signature.name.trim()) next.name = 'יש להקליד שם מלא';
      if (!/^\d{8,9}$/.test(signature.idNumber.trim())) next.idNumber = 'יש להקליד 8–9 ספרות';
      if (!signature.agree) next.agree = 'כדי לשלוח, יש לאשר את ההסכם';
    } else {
      section.questions.forEach((question) => {
        if (!isAnswered(question, values, others)) {
          next[question.id] = 'שדה חובה';
        } else if (question.type === 'email' && !EMAIL_RE.test(answerFor(question, values, others))) {
          next[question.id] = 'כתובת מייל לא תקינה';
        }
      });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goTo = (next) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNext = () => {
    if (!validateStep()) return;
    const next = Math.min(step + 1, total - 1);
    if (next === config.sections.length && !signature.name) {
      const nameQuestion = allQuestions.find((q) => q.field === 'name');
      if (nameQuestion) setSignature((prev) => ({ ...prev, name: answerFor(nameQuestion, values, others) }));
    }
    goTo(next);
  };

  const handleSubmit = async () => {
    if (!validateStep() || sending) return;
    setFailed(false);
    setSending(true);
    try {
      const nameQuestion = allQuestions.find((q) => q.field === 'name');
      const phoneQuestion = allQuestions.find((q) => q.field === 'phone');
      const emailQuestion = allQuestions.find((q) => q.field === 'email');
      const filesQuestion = allQuestions.find((q) => q.field === 'files');

      const name = nameQuestion ? answerFor(nameQuestion, values, others) : '';
      const phone = phoneQuestion ? answerFor(phoneQuestion, values, others) : '';
      const email = emailQuestion ? answerFor(emailQuestion, values, others) : '';
      const files =
        filesQuestion && Array.isArray(values[filesQuestion.id]) ? values[filesQuestion.id] : [];
      const answers = allQuestions
        .filter(
          (q) =>
            q.field !== 'name' && q.field !== 'phone' && q.field !== 'email' && q.field !== 'files'
        )
        .map((q) => ({
          section: q.sectionTitle,
          question: q.label,
          answer: answerFor(q, values, others),
        }))
        .filter((item) => item.answer.length > 0);

      const entity =
        config.key === 'business'
          ? base44.entities.BusinessQuestionnaire
          : base44.entities.TravelQuestionnaire;
      const agesQuestion = allQuestions.find((q) => q.field === 'travelers_ages');
      const record = {
        name,
        phone,
        email,
        files,
        answers,
        contract_signed: true,
        signer_name: signature.name.trim(),
        signer_id_number: signature.idNumber.trim(),
        signed_at: new Date().toISOString(),
        contract_version: CONTRACT_VERSION,
        contract_text: contractToText(contract),
        ...getAttribution(),
      };
      if (agesQuestion) record.travelers_ages = travelersAges(agesQuestion, values);
      if (tier) record.plan_tier = tier;
      await entity.create(record);
      clearDraft(config.key);
      setSent(true);

      try {
        await base44.functions.invoke('submitQuestionnaire', {
          type: config.key,
          name,
          phone,
          email,
          answers,
          files,
        });
      } catch {
        // המייל הוא תוספת בלבד – השאלון כבר נשמר
      }
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="px-6 py-14 text-center">
        <p className="font-heading text-2xl mb-4" style={{ color: config.color }}>
          תודה!
        </p>
        <p className="text-[#2a2622] leading-relaxed max-w-[420px] mx-auto">{config.confirmation}</p>
      </div>
    );
  }

  if (!started) {
    return (
      <div>
        <section className="px-6 pt-8 pb-8">
          <h1 className="font-heading text-2xl md:text-3xl leading-tight" style={{ color: config.color }}>
            {config.title}
          </h1>
          <p className="text-sm text-[#5a5249] mt-3">לפני שמתחילים, כמה דברים שחשוב לדעת:</p>
          <ul className="mt-5 space-y-3.5">
            {config.intro.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-[#2a2622] leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 shrink-0" style={{ background: config.color }} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-8 w-full px-6 py-3 text-sm font-bold"
            style={{ background: config.color, color: config.tabText }}
          >
            מתחילים
          </button>
        </section>
      </div>
    );
  }

  return (
    <div>
      <section className="px-6 pt-8 pb-6">
        <h1 className="font-heading text-2xl md:text-3xl leading-tight" style={{ color: config.color }}>
          {config.title}
        </h1>
        {restored && (
          <p className="text-xs text-[#5a5249] leading-relaxed mt-3 border border-[#e3d9cc] bg-[#f2ece4] px-3 py-2">
            המשכתם מהמקום שבו עצרתם.{' '}
            <button type="button" onClick={handleStartOver} className="underline">
              להתחיל מחדש
            </button>
          </p>
        )}
      </section>

      <div className="px-6">
        <div className="h-1.5 w-full bg-[#e6dccd]">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${progress}%`, background: config.color }}
          />
        </div>
        <p className="text-xs text-[#8a8079] mt-2">
          שלב {step + 1} מתוך {total} · {stepTitle}
        </p>
      </div>

      <section className="px-6 pt-5 pb-7">
        <h2 className="font-heading text-xl mb-5" style={{ color: config.color }}>
          {stepTitle}
        </h2>

        {isContractStep ? (
          <ContractStep
            contract={contract}
            signature={signature}
            onChange={(next) => {
              setSignature(next);
              setErrors({});
            }}
            errors={errors}
            accent={config.color}
            idLabel={config.key === 'business' ? 'מספר תעודת זהות או ח.פ.' : 'מספר תעודת זהות'}
          />
        ) : (
          section.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={values[question.id]}
              otherValue={others[question.id]}
              onChange={(value) => setValue(question.id, value)}
              onOtherChange={(value) => setOther(question.id, value)}
              error={errors[question.id]}
              accent={config.color}
            />
          ))
        )}

        {isContractStep && (
          <p className="text-xs text-[#6a6158] leading-relaxed mt-4">
            הפרטים ישמשו רק למתן השירות, לפי{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              מדיניות הפרטיות
            </a>
            .
          </p>
        )}

        {failed && (
          <div className="mb-3">
            <FormErrorNotice color={config.color} />
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              className="px-6 py-3 text-sm font-bold border-2 transition-colors"
              style={{ borderColor: config.color, color: config.color }}
            >
              הקודם
            </button>
          )}
          {!isContractStep ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 px-6 py-3 text-sm font-bold text-white"
              style={{ background: config.color, color: config.tabText }}
            >
              {step === total - 2 ? 'להסכם ולחתימה' : 'הבא'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              className="flex-1 px-6 py-3 text-sm font-bold disabled:opacity-60"
              style={{ background: config.color, color: config.tabText }}
            >
              {sending ? 'שולחים...' : 'חתימה ושליחה'}
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleSaveForLater}
            className="text-sm underline"
            style={{ color: config.color }}
          >
            שמירה והמשך אחר כך
          </button>
          {savedNote && (
            <p className="text-xs text-[#5a5249] leading-relaxed mt-2" role="status">
              {savedNote}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}