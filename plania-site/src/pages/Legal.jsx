import LegalPage from '@/components/LegalPage';
import { privacy, terms, accessibility } from '@/lib/legal';

export function Privacy() {
  return <LegalPage doc={privacy} />;
}

export function Terms() {
  return <LegalPage doc={terms} />;
}

export function Accessibility() {
  return <LegalPage doc={accessibility} />;
}
