import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-md px-3.5 pt-3 pb-[calc(84px+env(safe-area-inset-bottom))] ${className ?? ''}`}>
      {children}
    </div>
  );
}
