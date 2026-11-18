interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label?: string;
}

export default function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors cursor-pointer border-0 ${
        checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={label}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
