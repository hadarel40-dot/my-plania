import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FolderOpen, Loader2 } from 'lucide-react';

// "Open project" from a lead or a questionnaire. If a project already exists for
// the record it jumps to it instead of creating a second one.
export default function OpenProjectButton({ project, onCreate, onOpen }) {
  const [busy, setBusy] = useState(false);

  const click = async () => {
    if (project) {
      onOpen(project.id);
      return;
    }
    setBusy(true);
    try {
      await onCreate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      className="text-xs border-[#5E1D1D] text-[#5E1D1D]"
      onClick={click}
      disabled={busy}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <FolderOpen className="w-3.5 h-3.5 ml-1" />}
      {project ? 'מעבר לפרויקט' : 'פתיחת פרויקט'}
    </Button>
  );
}
