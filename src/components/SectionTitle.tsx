import { ChevronRightIcon } from '../utils/icons';

interface SectionTitleProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function SectionTitle({ title, actionLabel, onAction }: SectionTitleProps) {
  return (
    <div className="flex items-center justify-between mb-2">
      <h5 className="font-bold text-base leading-snug dark:text-white">{title}</h5>
      {actionLabel && onAction && (
        <button
          type="button"
          className="group inline-flex items-center gap-1 cursor-pointer bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-900/60 border border-primary-200/80 dark:border-primary-800/80 py-0.5 px-2.5 rounded-full transition-all duration-150 active:scale-95"
          onClick={onAction}
        >
          <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold whitespace-nowrap">
            {actionLabel}
          </span>
          <ChevronRightIcon
            size={13}
            className="text-primary dark:text-primary-400 group-hover:translate-x-0.5 transition-transform"
          />
        </button>
      )}
    </div>
  );
}