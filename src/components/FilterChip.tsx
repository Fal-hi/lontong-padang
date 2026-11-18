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
      className={`py-1.5 px-3 rounded-full cursor-pointer shrink-0 transition-all duration-150 whitespace-nowrap border text-xs active:scale-95 ${
        active
          ? 'bg-primary text-white border-primary font-semibold shadow-xs shadow-primary/30'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary hover:bg-primary-50/20 font-medium'
      }`}
    >
      {label}
    </button>
  );
}