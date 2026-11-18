import type { TooltipContentProps } from 'recharts';
import { formatCurrency } from '../utils';

export type ChartCustomTooltipProps = Partial<TooltipContentProps> & {
  valueFormatter?: (value: number) => string;
  seriesLabels?: Record<string, string>;
};

export default function ChartCustomTooltip({
  active,
  payload,
  label,
  valueFormatter = formatCurrency,
  seriesLabels = {},
}: ChartCustomTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200/90 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md px-2.5 py-1.5 shadow-md shadow-black/10 z-50 pointer-events-none min-w-[120px] max-w-[210px] select-none">
      {label !== undefined && label !== null && (
        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 border-b border-gray-100 dark:border-gray-700/80 pb-0.5 leading-tight">
          {String(label)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => {
          const color = entry.color || entry.fill || '#059669';
          const rawName = entry.name !== undefined ? String(entry.name) : 'Nilai';
          const displayName = seriesLabels[rawName] || rawName;
          const formattedValue =
            typeof entry.value === 'number'
              ? valueFormatter(entry.value)
              : String(entry.value ?? 0);

          return (
            <div
              key={`tooltip-item-${rawName || index}`}
              className="flex items-center justify-between gap-3 text-xs leading-none py-0.5"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate">
                  {displayName}
                </span>
              </div>
              <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {formattedValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
