import { useState, useEffect } from 'react';

export function useCurrentTime(): string {
  const [time, setTime] = useState(() => formatTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return time;
}

function formatTime(): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());
}
