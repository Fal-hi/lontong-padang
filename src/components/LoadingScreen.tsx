interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Memuat...' }: LoadingScreenProps) {
  return (
    <div className="w-screen h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-gray-50 dark:from-gray-900 dark:to-gray-900">
      <div className="flex flex-col items-center gap-6">
        <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-500 dark:text-gray-400 text-sm">{message}</span>
      </div>
    </div>
  );
}
