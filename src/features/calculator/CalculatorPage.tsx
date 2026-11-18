import { useState, useCallback } from 'react';
import { PageContainer } from '../../components';

interface CalculatorState {
  display: string;
  previousOperand: string;
  operator: string | null;
  waitingForOperand: boolean;
}

const INITIAL_STATE: CalculatorState = {
  display: '0',
  previousOperand: '',
  operator: null,
  waitingForOperand: false,
};

function formatDisplay(value: string): string {
  if (value === 'Error') return 'Error';
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (value.includes('.') && value.endsWith('.')) return value;
  if (value.includes('.')) {
    const [intPart, decPart] = value.split('.');
    const formatted = parseInt(intPart, 10).toLocaleString('id-ID');
    return `${formatted},${decPart}`;
  }
  return num.toLocaleString('id-ID');
}

function calculate(left: string, right: string, op: string): string {
  const a = parseFloat(left);
  const b = parseFloat(right);
  if (isNaN(a) || isNaN(b)) return 'Error';
  switch (op) {
    case '+': return String(a + b);
    case '-': return String(a - b);
    case '×': return String(a * b);
    case '÷': return b === 0 ? 'Error' : String(a / b);
    default: return right;
  }
}

const BUTTONS: { label: string; span?: number; variant: 'num' | 'op' | 'func' }[] = [
  { label: 'AC', variant: 'func' },
  { label: '%', variant: 'func' },
  { label: '⌫', variant: 'func' },
  { label: '÷', variant: 'op' },
  { label: '7', variant: 'num' },
  { label: '8', variant: 'num' },
  { label: '9', variant: 'num' },
  { label: '×', variant: 'op' },
  { label: '4', variant: 'num' },
  { label: '5', variant: 'num' },
  { label: '6', variant: 'num' },
  { label: '-', variant: 'op' },
  { label: '1', variant: 'num' },
  { label: '2', variant: 'num' },
  { label: '3', variant: 'num' },
  { label: '+', variant: 'op' },
  { label: '0', span: 2, variant: 'num' },
  { label: ',', variant: 'num' },
  { label: '=', span: 1, variant: 'op' },
];

const btnClass: Record<string, string> = {
  num: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700',
  op: 'bg-emerald-600 text-white border-0',
  func: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
};

export default function CalculatorPage() {
  const [state, setState] = useState<CalculatorState>(INITIAL_STATE);

  const handleButton = useCallback((label: string) => {
    setState((prev) => {
      if (label === 'AC') return INITIAL_STATE;
      if (label === '⌫') {
        if (prev.waitingForOperand) return prev;
        const newDisplay = prev.display.length > 1 ? prev.display.slice(0, -1) : '0';
        return { ...prev, display: newDisplay };
      }
      if (label === '%') {
        const num = parseFloat(prev.display);
        if (isNaN(num)) return prev;
        return { ...prev, display: String(num / 100) };
      }
      if (label === '=') {
        if (!prev.operator || !prev.previousOperand) return prev;
        const result = calculate(prev.previousOperand, prev.display, prev.operator);
        return { display: result, previousOperand: '', operator: null, waitingForOperand: true };
      }
      if (label === '+' || label === '-' || label === '×' || label === '÷') {
        if (prev.operator && !prev.waitingForOperand) {
          const result = calculate(prev.previousOperand, prev.display, prev.operator);
          return { display: result, previousOperand: result, operator: label, waitingForOperand: true };
        }
        return { ...prev, previousOperand: prev.display, operator: label, waitingForOperand: true };
      }
      if (label === ',') {
        if (prev.waitingForOperand) return { ...prev, display: '0,', waitingForOperand: false };
        if (prev.display.includes('.')) return prev;
        return { ...prev, display: prev.display + '.' };
      }
      if (/^[0-9]$/.test(label)) {
        if (prev.waitingForOperand) return { ...prev, display: label, waitingForOperand: false };
        const newDisplay = prev.display === '0' ? label : prev.display + label;
        return { ...prev, display: newDisplay };
      }
      return prev;
    });
  }, []);

  const expression = state.operator && state.previousOperand
    ? `${formatDisplay(state.previousOperand)} ${state.operator}`
    : '';

  return (
    <PageContainer>
      <section className="flex flex-col gap-4 max-w-[480px] mx-auto">
        <h5 className="font-bold text-lg">Kalkulator</h5>

        <div className="p-5 rounded-xl bg-emerald-800">
          <div className="flex flex-col items-end gap-1 min-w-0">
            {expression && (
              <span className="text-sm text-emerald-200 font-normal leading-none">{expression}</span>
            )}
            <span
              className={`font-bold text-white leading-tight text-right w-full break-all min-h-[40px] ${
                state.display.length > 12 ? 'text-xl' : state.display.length > 8 ? 'text-2xl' : 'text-5xl'
              }`}
            >
              {formatDisplay(state.display)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {BUTTONS.map((btn) => (
            <div
              key={btn.label}
              className={`rounded-xl py-4 text-center cursor-pointer select-none transition-transform active:scale-95 active:opacity-85 calc-btn ${btnClass[btn.variant]} ${btn.span === 2 ? 'col-span-2' : ''}`}
              onClick={() => handleButton(btn.label === ',' ? '.' : btn.label)}
            >
              <span className={`font-semibold ${btn.variant === 'op' || btn.variant === 'num' ? 'text-xl' : 'text-lg'}`}>
                {btn.label}
              </span>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
