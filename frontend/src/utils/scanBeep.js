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
