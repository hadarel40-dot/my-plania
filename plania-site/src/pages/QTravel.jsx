import useNoIndex from '@/hooks/useNoIndex';
import QuestionnaireForm from '@/components/questionnaire/QuestionnaireForm';
import { getQuestionnaire } from '@/lib/questionnaires';

export default function QTravel() {
  useNoIndex();
  const config = getQuestionnaire('travel');

  return (
    <div className="min-h-[100dvh] bg-[#f0e8df] px-3 sm:px-5 py-6">
      <div
        className="mx-auto w-full max-w-[460px] md:max-w-[640px] bg-[#faf6f1] border-t-[8px]"
        style={{ borderTopColor: config.color }}
      >
        <QuestionnaireForm config={config} />
      </div>
    </div>
  );
}