import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ─── Particle canvas ─── */
function ParticleCanvas() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let raf;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const particles = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.3,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.5 + 0.1,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(180, 140, 20, ${p.alpha})`;
                ctx.fill();
            });

            // draw faint lines between close particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(184,134,11,${0.06 * (1 - dist / 100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            raf = requestAnimationFrame(draw);
        };
        draw();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
        />
    );
}

/* ─── Glitch text hook ─── */
function useGlitch(text, active) {
    const [display, setDisplay] = useState(text);
    const CHARS = "!@#$%^&*?/\\|<>[]{}~`";

    useEffect(() => {
        if (!active) { setDisplay(text); return; }
        let frame = 0;
        const id = setInterval(() => {
            if (frame > 12) { setDisplay(text); clearInterval(id); return; }
            setDisplay(
                text
                    .split("")
                    .map((c, i) => (Math.random() < 0.35 ? CHARS[Math.floor(Math.random() * CHARS.length)] : c))
                    .join("")
            );
            frame++;
        }, 40);
        return () => clearInterval(id);
    }, [active, text]);

    return display;
}

/* ─── Floating orb ─── */
function Orb({ style }) {
    return (
        <div
            style={{
                position: "absolute",
                borderRadius: "50%",
                filter: "blur(60px)",
                pointerEvents: "none",
                ...style,
            }}
        />
    );
}

/* ─── Countdown ticker ─── */
function Ticker() {
    const [count, setCount] = useState(10);
    const navigate = useNavigate();

    useEffect(() => {
        if (count <= 0) { navigate("/dashboard"); return; }
        const t = setTimeout(() => setCount((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [count, navigate]);

    const pct = ((10 - count) / 10) * 283;

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width={48} height={48} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(184,134,11,0.15)" strokeWidth="6" />
                <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="#b8860b"
                    strokeWidth="6"
                    strokeDasharray="283"
                    strokeDashoffset={283 - pct}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.9s linear" }}
                />
            </svg>
            <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 13, color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.06em",
            }}>
                Về trang chủ sau{" "}
                <span style={{ color: "#e8c84a", fontWeight: 700 }}>{count} giây</span>
            </span>
        </div>
    );
}

/* ─── Main 404 Page ─── */
export default function NotFound404() {
    const navigate = useNavigate();
    const [glitchActive, setGlitchActive] = useState(false);
    const [hoverBtn, setHoverBtn] = useState(null);
    const [mounted, setMounted] = useState(false);

    const glitch404 = useGlitch("404", glitchActive);

    useEffect(() => {
        setMounted(true);
        // Trigger glitch on load
        const t1 = setTimeout(() => setGlitchActive(true), 600);
        const t2 = setTimeout(() => setGlitchActive(false), 1200);
        // Periodic glitch
        const interval = setInterval(() => {
            setGlitchActive(true);
            setTimeout(() => setGlitchActive(false), 500);
        }, 4000);
        return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(interval); };
    }, []);

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500;700&display=swap');

        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-18px); }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(30px, -20px) scale(1.05); }
          66%  { transform: translate(-20px, 15px) scale(0.97); }
        }
        @keyframes scanline {
          0%   { top: -4px; }
          100% { top: 100%; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes glitchShift {
          0%, 100% { clip-path: inset(0 0 100% 0); transform: translateX(0); }
          20%       { clip-path: inset(10% 0 60% 0); transform: translateX(-4px); }
          40%       { clip-path: inset(50% 0 20% 0); transform: translateX(4px); }
          60%       { clip-path: inset(70% 0 5% 0);  transform: translateX(-2px); }
          80%       { clip-path: inset(30% 0 40% 0); transform: translateX(3px); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184,134,11,0.5); }
          70%  { transform: scale(1);    box-shadow: 0 0 0 18px rgba(184,134,11,0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(184,134,11,0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .nf-404-wrap * { box-sizing: border-box; margin: 0; padding: 0; }

        .nf-big-num {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(160px, 22vw, 280px);
          line-height: 0.85;
          letter-spacing: 0.02em;
          color: transparent;
          background: linear-gradient(135deg, #c9a227 0%, #f0d060 35%, #b8860b 65%, #e8c84a 100%);
          -webkit-background-clip: text;
          background-clip: text;
          position: relative;
          user-select: none;
          animation: floatY 5s ease-in-out infinite;
          filter: drop-shadow(0 0 40px rgba(184,134,11,0.35));
        }
        .nf-big-num::before,
        .nf-big-num::after {
          content: attr(data-text);
          position: absolute; inset: 0;
          font-family: 'Bebas Neue', sans-serif;
          font-size: inherit;
          background: inherit;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: glitchShift 0.15s steps(1) infinite;
        }
        .nf-big-num::before { color: rgba(255,80,80,0.55); animation-delay: 0.05s; }
        .nf-big-num::after  { color: rgba(80,200,255,0.35); animation-delay: 0.1s; }

        .nf-btn {
          display: inline-flex; align-items: center; gap: 10px;
          padding: 0 28px; height: 52px; border-radius: 12px;
          font-family: 'DM Mono', monospace; font-size: 13px;
          font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          cursor: pointer; border: none; transition: all 0.22s; text-decoration: none;
        }
        .nf-btn-primary {
          background: linear-gradient(135deg, #b8860b, #d4a017);
          color: #fff;
          box-shadow: 0 6px 24px rgba(184,134,11,0.45);
          animation: pulse-ring 2.5s ease-out infinite;
        }
        .nf-btn-primary:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 12px 32px rgba(184,134,11,0.6);
        }
        .nf-btn-outline {
          background: transparent;
          color: rgba(255,255,255,0.6);
          border: 1.5px solid rgba(255,255,255,0.15);
        }
        .nf-btn-outline:hover {
          border-color: rgba(184,134,11,0.6);
          color: #e8c84a;
          background: rgba(184,134,11,0.08);
          transform: translateY(-2px);
        }
      `}</style>

            <div
                className="nf-404-wrap"
                style={{
                    minHeight: "100vh",
                    background: "#0d0b08",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: "'DM Sans', sans-serif",
                }}
            >
                <ParticleCanvas />

                {/* Background orbs */}
                <Orb style={{ width: 500, height: 500, top: -100, left: -150, background: "radial-gradient(circle, rgba(184,134,11,0.12) 0%, transparent 70%)", animation: "floatOrb 12s ease-in-out infinite" }} />
                <Orb style={{ width: 400, height: 400, bottom: -80, right: -100, background: "radial-gradient(circle, rgba(184,134,11,0.09) 0%, transparent 70%)", animation: "floatOrb 16s ease-in-out infinite reverse" }} />
                <Orb style={{ width: 200, height: 200, top: "40%", right: "20%", background: "radial-gradient(circle, rgba(232,200,74,0.06) 0%, transparent 70%)", animation: "floatOrb 9s ease-in-out infinite" }} />

                {/* Scanline effect */}
                <div style={{
                    position: "fixed", left: 0, right: 0, height: 3,
                    background: "linear-gradient(transparent, rgba(184,134,11,0.15), transparent)",
                    animation: "scanline 6s linear infinite",
                    zIndex: 1, pointerEvents: "none",
                }} />

                {/* Noise texture overlay */}
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
                    opacity: 0.4,
                }} />

                {/* Grid lines */}
                <div style={{
                    position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
                    backgroundImage: `
            linear-gradient(rgba(184,134,11,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(184,134,11,0.03) 1px, transparent 1px)
          `,
                    backgroundSize: "60px 60px",
                }} />

                {/* Content */}
                <div
                    style={{
                        position: "relative", zIndex: 2,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", textAlign: "center",
                        gap: 0, padding: "40px 24px",
                        opacity: mounted ? 1 : 0,
                        transition: "opacity 0.6s ease",
                    }}
                >
                    {/* Eyebrow */}
                    <div
                        style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 11, fontWeight: 700,
                            letterSpacing: "0.3em", textTransform: "uppercase",
                            color: "rgba(184,134,11,0.55)",
                            marginBottom: 24,
                            animation: "fadeUp 0.6s ease 0.2s both",
                            display: "flex", alignItems: "center", gap: 10,
                        }}
                    >
                        <span style={{ display: "inline-block", width: 32, height: 1, background: "rgba(184,134,11,0.4)" }} />
                        Trang không tồn tại
                        <span style={{ display: "inline-block", width: 32, height: 1, background: "rgba(184,134,11,0.4)" }} />
                    </div>

                    {/* Giant 404 */}
                    <div style={{ animation: "fadeUp 0.7s ease 0.1s both", position: "relative" }}>
                        <div
                            className="nf-big-num"
                            data-text={glitch404}
                            style={{ opacity: glitchActive ? 0.9 : 1 }}
                        >
                            {glitch404}
                        </div>

                        {/* Decorative ring behind number */}
                        <div style={{
                            position: "absolute", top: "50%", left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "110%", height: "110%",
                            borderRadius: "50%",
                            border: "1px solid rgba(184,134,11,0.08)",
                            pointerEvents: "none",
                        }} />
                    </div>

                    {/* Divider line */}
                    <div
                        style={{
                            width: 120, height: 2, marginTop: 8, marginBottom: 28,
                            background: "linear-gradient(90deg, transparent, #b8860b, transparent)",
                            animation: "fadeUp 0.6s ease 0.4s both",
                        }}
                    />

                    {/* Headline */}
                    <h1
                        style={{
                            fontSize: "clamp(22px, 3vw, 32px)",
                            fontWeight: 600, color: "#fff",
                            letterSpacing: "-0.3px", lineHeight: 1.3,
                            marginBottom: 14,
                            animation: "fadeUp 0.6s ease 0.5s both",
                            background: "linear-gradient(90deg, #fff 0%, rgba(255,255,255,0.75) 100%)",
                            WebkitBackgroundClip: "text", backgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        Ôi! Trang bạn tìm kiếm đã biến mất
                    </h1>

                    {/* Sub */}
                    <p
                        style={{
                            fontSize: 15, color: "rgba(255,255,255,0.4)",
                            maxWidth: 420, lineHeight: 1.7,
                            marginBottom: 40,
                            animation: "fadeUp 0.6s ease 0.6s both",
                        }}
                    >
                        Đường dẫn này không tồn tại hoặc đã bị xóa.
                        Hãy quay lại trang chính hoặc liên hệ quản trị viên.
                    </p>

                    {/* Buttons */}
                    <div
                        style={{
                            display: "flex", gap: 14, flexWrap: "wrap",
                            justifyContent: "center", marginBottom: 44,
                            animation: "fadeUp 0.6s ease 0.7s both",
                        }}
                    >
                        <button
                            className="nf-btn nf-btn-primary"
                            onClick={() => navigate("/dashboard")}
                        >
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <path d="M3 12L12 3l9 9" /><path d="M9 21V9h6v12" />
                            </svg>
                            Về trang tổng quan
                        </button>
                        <button
                            className="nf-btn nf-btn-outline"
                            onClick={() => navigate(-1)}
                        >
                            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M19 12H5" /><path d="M12 5l-7 7 7 7" />
                            </svg>
                            Quay lại
                        </button>
                    </div>

                    {/* Countdown */}
                    <div style={{ animation: "fadeUp 0.6s ease 0.85s both" }}>
                        <Ticker />
                    </div>

                    {/* Bottom label */}
                    <div
                        style={{
                            marginTop: 52,
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 10, letterSpacing: "0.2em",
                            color: "rgba(255,255,255,0.12)",
                            textTransform: "uppercase",
                            animation: "fadeUp 0.6s ease 1s both",
                        }}
                    >
                        FCentric — Hệ thống quản trị
                    </div>
                </div>
            </div>
        </>
    );
}