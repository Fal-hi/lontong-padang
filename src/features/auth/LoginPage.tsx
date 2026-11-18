import { useState } from 'react';
import { z } from 'zod';
import { useAuthStore } from '../../stores/authStore';
import { useNavStore } from '../../stores/navStore';
import Logo from '../../components/Logo';
import { mockUser } from '../../mock';
import { APP_VERSION, DEMO_CREDENTIALS, LOGIN_LOADING_MS } from '../../constants';
import { notify } from '../../stores/notificationStore';

const loginSchema = z.object({
  username: z.string().min(1, 'Nama pengguna wajib diisi'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const login = useAuthStore((s) => s.login);
  const navigate = useNavStore((s) => s.navigate);

  const handleLogin = async () => {
    setError(null);

    const result = loginSchema.safeParse({ username, password });
    if (!result.success) {
      const firstError = result.error.issues[0];
      const errMsg = firstError?.message ?? 'Mohon isi semua kolom';
      setError(errMsg);
      notify.warning(errMsg, 'Data Belum Lengkap');
      return;
    }

    if (
      result.data.username !== DEMO_CREDENTIALS.username ||
      result.data.password !== DEMO_CREDENTIALS.password
    ) {
      const errMsg = 'Nama pengguna atau kata sandi tidak cocok';
      setError(errMsg);
      notify.danger(errMsg, 'Gagal Masuk');
      return;
    }

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, LOGIN_LOADING_MS));

    login(mockUser);
    notify.success(`Selamat datang kembali, ${mockUser.fullName}!`, 'Berhasil Masuk');
    navigate('dashboard');
    setLoading(false);
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-primary-50 via-primary-50/40 to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="w-full max-w-[400px] bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3),0_1px_4px_rgba(0,0,0,0.15)]">
        <div className="flex flex-col items-center gap-6">
          <Logo size="md" />

          <div className="flex flex-col items-center gap-1">
            <h4 className="font-bold text-xl text-center dark:text-white">Selamat Datang</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">Masuk ke aplikasi Lontong Padang</p>
          </div>

          {error && (
            <div className="w-full bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 border border-danger-200 dark:border-danger-800 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nama Pengguna</label>
              <input
                type="text"
                placeholder="Masukkan nama pengguna Anda"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                autoComplete="username"
                className="w-full py-2.5 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Kata Sandi</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan kata sandi Anda"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  autoComplete="current-password"
                  className="w-full py-2.5 px-3 pr-12 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-pointer bg-transparent border-0 px-1"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-primary"
              />
              <span>Ingat saya</span>
            </label>

            <button
              disabled={loading}
              onClick={handleLogin}
              className="w-full py-2.5 rounded-lg bg-primary text-white font-semibold text-sm cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>

            <button
              type="button"
              onClick={() => {
                setUsername(DEMO_CREDENTIALS.username);
                setPassword(DEMO_CREDENTIALS.password);
                setError(null);
                notify.info('Akun demo (admin / 123456) diisi otomatis.', 'Kredensial Demo');
              }}
              className="w-full py-2 px-3 rounded-lg border border-primary-200 dark:border-primary-800/60 bg-primary-50/50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-300 text-xs font-medium cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              Gunakan Akun Demo (admin / 123456)
            </button>
          </div>

          <span className="text-gray-500 dark:text-gray-400 text-xs text-center">
            v{APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );
}
