import type { User } from '../types';

interface AppAvatarProps {
  user: User | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'w-8 h-8 text-sm', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-xl' };

export default function AppAvatar({ user, size = 'md' }: AppAvatarProps) {
  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  return (
    <div
      className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-semibold flex items-center justify-center text-white shrink-0`}
    >
      {initials}
    </div>
  );
}
