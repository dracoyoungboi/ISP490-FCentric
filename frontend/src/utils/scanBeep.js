// Âm báo ngắn khi quét mã (Web Audio API, không cần thư viện).
let audioContext = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  return audioContext;
}

export function playScanBeep(ok = true) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = ok ? "sine" : "square";
    oscillator.frequency.value = ok ? 1046 : 220;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.09 : 0.22));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + (ok ? 0.1 : 0.24));
  } catch {
    // Trình duyệt chặn âm thanh: bỏ qua, không ảnh hưởng thao tác quét.
  }
}

/**
 * Tiếng bíp màn Kiểm đếm & khóa lô, mỗi kết quả một kiểu để nhân viên không cần nhìn màn:
 * "ok" 1 tiếng cao (đạt) · "loi" 2 tiếng (không đạt, hoàn tác) · "sai" 1 tiếng trầm dài (mã không dùng được, bị chặn).
 */
export function bipKiemDem(loai) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const nhip = loai === "ok" ? [[1320, 0, 0.07]] : loai === "loi" ? [[520, 0, 0.09], [520, 0.14, 0.09]] : [[220, 0, 0.28]];
    nhip.forEach(([hz, sau, dai]) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = loai === "sai" ? "square" : "sine";
      oscillator.frequency.value = hz;
      const t0 = ctx.currentTime + sau;
      gain.gain.setValueAtTime(0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dai);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(t0);
      oscillator.stop(t0 + dai + 0.01);
    });
  } catch {
    // Trình duyệt chặn âm thanh: bỏ qua, không ảnh hưởng thao tác quét.
  }
}
