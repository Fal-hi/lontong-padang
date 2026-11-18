import { useSoundStore } from '../stores/soundStore';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) return null;

    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Memainkan nada dengan frekuensi tertentu, tipe gelombang, attack ramp, dan durasi decay.
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume = 0.2,
  type: OscillatorType = 'triangle',
) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Fast 3ms attack ramp untuk menghasilkan hentakan jernih tanpa digital click
    const attackTime = Math.min(0.003, duration * 0.1);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(volume, 0.0001),
      startTime + attackTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  } catch {
    // Ignore audio playback errors on restricted platforms
  }
}

/**
 * Memainkan suara bel meja panggilan restoran (Service Desk Call Bell / "Order Ready Bell").
 * Meniru denting bel kubah logam krom khas meja dapur restoran ("Ting-Ting!"):
 * - Ketukan clapper (sharp transient strike click ~4.8 kHz)
 * - Nada fundamental kubah bel (~2093 Hz / C7)
 * - Detuned shimmer beating (+5 Hz) untuk getaran resonansi alami logam
 * - Overtones logam (3136 Hz dan 5780 Hz) yang meluruh bertahap
 * - Resonansi kedalaman bodi bel (~1046.5 Hz / C6)
 */
function playRestaurantBell(
  ctx: AudioContext,
  startTime: number,
  doubleTap = true,
) {
  const strike = (t: number, volMultiplier = 1.0, isFinal = true) => {
    const dur = isFinal ? 1.7 : 0.35;

    // 1. Transient clapper impact (ketukan logam martil)
    playTone(ctx, 4800, t, 0.025, 0.14 * volMultiplier, 'triangle');

    // 2. Fundamental dome pitch (~2093 Hz / C7)
    playTone(ctx, 2093, t, dur, 0.32 * volMultiplier, 'sine');

    // 3. Acoustic beating shimmer (+5 Hz detune untuk getaran denting logam)
    playTone(ctx, 2098, t, dur * 0.85, 0.15 * volMultiplier, 'sine');

    // 4. Overtones harmonik logam
    playTone(ctx, 3136, t, Math.min(dur, 0.7), 0.16 * volMultiplier, 'sine');
    playTone(ctx, 5780, t, Math.min(dur, 0.45), 0.12 * volMultiplier, 'sine');

    // 5. Body resonance (~1046.5 Hz / C6)
    playTone(ctx, 1046.5, t, dur * 0.75, 0.15 * volMultiplier, 'sine');
  };

  if (doubleTap) {
    // Ketukan pertama (denting cepat pembuka)
    strike(startTime, 0.75, false);
    // Ketukan kedua (denting mantap dengan dengung panjang)
    strike(startTime + 0.15, 1.0, true);
  } else {
    // Ketukan tunggal dengan dengung panjang
    strike(startTime, 1.0, true);
  }
}

export const sound = {
  /**
   * Suara saat pesanan baru berhasil dibuat (Lonceng Kasir 4-Nada Ceria).
   */
  order: () => {
    if (!useSoundStore.getState().soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    // C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz)
    playTone(ctx, 523.25, now, 0.35, 0.22, 'triangle');
    playTone(ctx, 659.25, now + 0.08, 0.38, 0.22, 'triangle');
    playTone(ctx, 783.99, now + 0.16, 0.45, 0.25, 'triangle');
    playTone(ctx, 1046.5, now + 0.24, 0.65, 0.28, 'sine');
  },

  /**
   * Suara bel meja restoran ("Ting-Ting! / Order Ready!").
   * Dipanggil saat pesanan ditandai selesai atau siap diambil pelanggan.
   */
  bell: (options?: { doubleTap?: boolean }) => {
    if (!useSoundStore.getState().soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    playRestaurantBell(ctx, now, options?.doubleTap ?? true);
  },

  /**
   * Suara saat pesanan selesai atau aksi berhasil diselesaikan (Bel Meja Restoran).
   */
  success: (options?: { doubleTap?: boolean }) => {
    if (!useSoundStore.getState().soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    playRestaurantBell(ctx, now, options?.doubleTap ?? true);
  },

  /**
   * Suara klik / tambah menu (Pop halus).
   */
  tap: () => {
    if (!useSoundStore.getState().soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    playTone(ctx, 780, now, 0.06, 0.12, 'sine');
  },

  /**
   * Suara notifikasi standar (Lonceng tunggal).
   */
  notification: () => {
    if (!useSoundStore.getState().soundEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    playTone(ctx, 880, now, 0.4, 0.2, 'sine');
  },

  /**
   * Preview suara bel restoran saat toggle diaktifkan di pengaturan (tanpa cek soundEnabled).
   */
  preview: () => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + 0.02;
    playRestaurantBell(ctx, now, true);
  },
};
