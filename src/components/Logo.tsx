interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { box: 40, icon: 20, text: 'text-xl' },
  md: { box: 56, icon: 28, text: 'text-2xl' },
  lg: { box: 80, icon: 40, text: 'text-3xl' },
};

export default function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex flex-col items-center gap-1 ${className ?? ''}`}>
      <div
        className="flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700"
        style={{ width: s.box, height: s.box }}
      >
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
      </div>
      {showText && (
        <span className={`font-bold bg-gradient-to-br from-emerald-600 to-emerald-800 bg-clip-text text-transparent ${s.text}`}>
          Lontong Padang
        </span>
      )}
    </div>
  );
}
