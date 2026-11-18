interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

export default function EmptyState({ icon = '📋', title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-8 gap-2">
      <span className="text-5xl leading-none">{icon}</span>
      <span className="font-semibold text-sm text-gray-400">{title}</span>
      {description && (
        <span className="text-xs text-gray-500 text-center max-w-[260px]">{description}</span>
      )}
    </div>
  );
}
