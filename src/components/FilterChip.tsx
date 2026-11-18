interface FilterChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

export default function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-1.5 px-3 rounded-full cursor-pointer shrink-0 transition-all whitespace-nowrap border ${
        active
          ? 'bg-emerald-50 dark:bg-gray-700 border-emerald-300 dark:border-emerald-600'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}
    >
      <span
        className={`text-xs ${
          active
            ? 'font-semibold text-emerald-700 dark:text-emerald-400'
            : 'font-normal text-gray-500 dark:text-gray-400'
        }`}
      >
        {label}
      </span>
    </button>
  );
}
