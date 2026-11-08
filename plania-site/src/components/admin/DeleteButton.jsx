import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DeleteButton({ name, what = 'הליד', onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async (event) => {
    event.preventDefault();
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`מחיקת ${what} של ${name}`}
          title="מחיקה"
          className="p-2 text-[#8a8079] hover:text-[#c0392b] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl" className="text-right">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle>למחוק את {what} של {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            המחיקה סופית ואי אפשר לשחזר אותה. אם רק רוצים להסתיר, אפשר לסמן "לא רלוונטי" במקום.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:justify-start sm:space-x-0">
          <AlertDialogAction
            onClick={confirm}
            disabled={deleting}
            className="bg-[#c0392b] hover:bg-[#a33224] text-white"
          >
            {deleting ? 'מוחק...' : 'מחיקה'}
          </AlertDialogAction>
          <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
