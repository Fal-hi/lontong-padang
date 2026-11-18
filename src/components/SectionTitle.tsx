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
          className="flex items-center gap-0.5 cursor-pointer bg-transparent border-0 p-0"
          onClick={onAction}
        >
          <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">{actionLabel}</span>
          <ChevronRightIcon size={14} color="#059669" />
        </button>
      )}
    </div>
  );
}
