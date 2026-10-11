import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Mail, Clock, Package, ChevronRight, ShieldCheck } from "lucide-react";
import BrandLogo from '@/components/brand/BrandLogo';

const STYLES = `
.qs-root {
  min-height: 100vh;
  background: linear-gradient(160deg, #faf8f3 0%, #f5f0e4 55%, #ede9de 100%);
  display: flex; align-items: center; justify-content: center;
  padding: 32px 20px;
  position: relative; overflow: hidden;
  font-family: system-ui, sans-serif;
}

/* Grid */
.qs-grid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(184,134,11,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(184,134,11,0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  animation: qsGrid 35s linear infinite;
}
@keyframes qsGrid { to { background-position: 56px 56px; } }

/* Orbs */
.qs-orb-1 {
  position: fixed; width: 500px; height: 500px; border-radius: 50%;
  background: rgba(184,134,11,0.08); filter: blur(100px);
  top: -180px; right: -120px; pointer-events: none; z-index: 0;
}
.qs-orb-2 {
  position: fixed; width: 360px; height: 360px; border-radius: 50%;
  background: rgba(201,150,12,0.06); filter: blur(90px);
  bottom: -100px; left: -80px; pointer-events: none; z-index: 0;
}

/* Corner accents */
.qs-corner-tl, .qs-corner-br {
  position: fixed; width: 140px; height: 140px;
  border: 1.5px solid rgba(184,134,11,0.2); pointer-events: none; z-index: 0;
}
.qs-corner-tl { top: 28px; left: 28px; border-right: none; border-bottom: none; }
.qs-corner-br { bottom: 28px; right: 28px; border-left: none; border-top: none; }

/* Card */
.qs-card {
  position: relative; z-index: 1;
  width: 100%; max-width: 560px;
  background: #fff;
  border: 1px solid rgba(184,134,11,0.2);
  border-radius: 24px; overflow: hidden;
  box-shadow: 0 8px 40px rgba(100,80,30,0.14), 0 2px 8px rgba(100,80,30,0.07);
  animation: qsCardIn 0.6s cubic-bezier(.4,0,.2,1) both;
}
@keyframes qsCardIn {
  from { opacity: 0; transform: translateY(24px) scale(0.98); }
  to   { opacity: 1; transform: none; }
}

/* Gold top line */
.qs-topline {
  height: 3px;
  background: linear-gradient(90deg, transparent, #b8860b, #e8b923, #b8860b, transparent);
}

/* Card body */
.qs-body { padding: 36px 36px 32px; }

/* ── Logo bar ── */
.qs-logo-bar {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-bottom: 28px;
}
.qs-logo-box {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #b8860b, #e8b923);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px rgba(184,134,11,0.4);
}
.qs-logo-fs { font-size: 18px; font-weight: 900; color: #b8860b; letter-spacing: -0.3px; }
.qs-logo-sep { width: 1px; height: 16px; background: rgba(184,134,11,0.3); }
.qs-logo-wms {
  font-family: ui-monospace, monospace; font-size: 12px;
  font-weight: 500; color: #a89f92; letter-spacing: 0.08em;
}

/* ── Success icon ── */
.qs-icon-wrap {
  display: flex; justify-content: center; margin-bottom: 24px;
}
.qs-icon-ring {
  position: relative; width: 96px; height: 96px;
}
.qs-icon-main {
  width: 96px; height: 96px; border-radius: 50%;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 32px rgba(34,197,94,0.3), 0 0 0 8px rgba(34,197,94,0.08);
  animation: qsIconPulse 2.5s ease-in-out infinite;
}
@keyframes qsIconPulse {
  0%,100% { box-shadow: 0 8px 32px rgba(34,197,94,0.3), 0 0 0 8px rgba(34,197,94,0.08); }
  50%      { box-shadow: 0 8px 32px rgba(34,197,94,0.45), 0 0 0 16px rgba(34,197,94,0.06); }
}
.qs-icon-badge {
  position: absolute; top: -4px; right: -4px;
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #b8860b, #e8b923);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(184,134,11,0.45);
  animation: qsBadgeBounce 1.8s ease-in-out infinite;
  border: 2px solid #fff;
}
@keyframes qsBadgeBounce {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

/* ── Heading ── */
.qs-heading { text-align: center; margin-bottom: 28px; }
.qs-title {
  font-size: 26px; font-weight: 900; color: #1a1612;
  letter-spacing: -0.5px; margin-bottom: 6px; line-height: 1.2;
}
.qs-title span { color: #b8860b; }
.qs-sub { font-size: 14px; color: #a89f92; line-height: 1.6; }

/* ── Info items ── */
.qs-info-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 22px; }
.qs-info-item {
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 16px; border-radius: 14px;
  border: 1px solid; transition: all 0.2s;
}
.qs-info-item.gold  { background: rgba(184,134,11,0.04); border-color: rgba(184,134,11,0.2); }
.qs-info-item.amber { background: rgba(232,185,35,0.04); border-color: rgba(232,185,35,0.25); }
.qs-info-item.green { background: rgba(34,197,94,0.04);  border-color: rgba(34,197,94,0.2); }
.qs-info-item:hover { transform: translateX(3px); }
.qs-info-item.gold:hover  { border-color: rgba(184,134,11,0.4); }
.qs-info-item.amber:hover { border-color: rgba(232,185,35,0.45); }
.qs-info-item.green:hover { border-color: rgba(34,197,94,0.4); }

.qs-info-ico {
  width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.qs-info-ico.gold  { background: rgba(184,134,11,0.12); border: 1px solid rgba(184,134,11,0.2); }
.qs-info-ico.amber { background: rgba(232,185,35,0.12); border: 1px solid rgba(232,185,35,0.25); }
.qs-info-ico.green { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.2); }

.qs-info-title { font-size: 13px; font-weight: 700; color: #1a1612; margin-bottom: 3px; }
.qs-info-desc  { font-size: 12px; color: #7a6e5f; line-height: 1.6; }

/* ── Support box ── */
.qs-support {
  padding: 14px 18px; border-radius: 14px;
  background: linear-gradient(135deg, #2d2106, #3d2e08);
  border: 1px solid rgba(184,134,11,0.3);
  text-align: center; margin-bottom: 22px;
  position: relative; overflow: hidden;
}
.qs-support::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1.5px;
  background: linear-gradient(90deg, transparent, #b8860b, transparent);
}
.qs-support-title {
  font-family: ui-monospace, monospace; font-size: 10px;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: rgba(184,134,11,0.7); margin-bottom: 6px;
}
.qs-support-text { font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.7; }
.qs-support-link { color: #e8b923; font-weight: 600; text-decoration: none; }
.qs-support-link:hover { text-decoration: underline; }

/* ── Action button ── */
.qs-btn {
  width: 100%; height: 50px; border-radius: 13px;
  background: linear-gradient(135deg, #b8860b, #e8b923);
  border: none; color: #fff;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: all 0.3s; box-shadow: 0 5px 20px rgba(184,134,11,0.4);
  position: relative; overflow: hidden;
}
.qs-btn::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.18), transparent);
  opacity: 0; transition: opacity 0.3s;
}
.qs-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(184,134,11,0.55); }
.qs-btn:hover::before { opacity: 1; }
.qs-btn:active { transform: translateY(0); }

/* ── Footer ── */
.qs-footer {
  text-align: center; margin-top: 18px;
  font-family: ui-monospace, monospace; font-size: 10px;
  color: #c9b99a; letter-spacing: 0.1em; position: relative; z-index: 1;
}

/* SVG arc */
.qs-logo-svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); pointer-events: none; }
.qs-logo-track { fill: none; stroke: rgba(184,134,11,0.12); stroke-width: 2; }
.qs-logo-arc {
  fill: none; stroke: #b8860b; stroke-width: 2;
  stroke-dasharray: 340; stroke-dashoffset: 0; stroke-linecap: round;
  opacity: 0.5;
}
`;

export default function QuoteSuccess() {
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

    return (
        <>
            <style>{STYLES}</style>
            <div className="qs-root">
                <div className="qs-grid" />
                <div className="qs-orb-1" />
                <div className="qs-orb-2" />
                <div className="qs-corner-tl" />
                <div className="qs-corner-br" />

                <div className="qs-card">
                    <div className="qs-topline" />
                    <div className="qs-body">

                        {/* Logo bar */}
                        <div className="qs-logo-bar">
                            <BrandLogo variant="compact" />
                        </div>

                        {/* Success icon */}
                        <div className="qs-icon-wrap">
                            <div className="qs-icon-ring">
                                <div className="qs-icon-main">
                                    <CheckCircle size={44} style={{ color: '#fff' }} strokeWidth={2} />
                                </div>
                                <div className="qs-icon-badge">
                                    <Mail size={14} style={{ color: '#fff' }} strokeWidth={2} />
                                </div>
                            </div>
                        </div>

                        {/* Heading */}
                        <div className="qs-heading">
                            <h2 className="qs-title">
                                Gửi báo giá <span>thành công</span>
                            </h2>
                            <p className="qs-sub">
                                Cảm ơn quý đối tác đã gửi báo giá.<br />
                                Chúng tôi sẽ xem xét và phản hồi sớm nhất.
                            </p>
                        </div>

                        {/* Info items */}
                        <div className="qs-info-list">
                            <div className="qs-info-item gold">
                                <div className="qs-info-ico gold">
                                    <Mail size={16} style={{ color: '#b8860b' }} strokeWidth={1.8} />
                                </div>
                                <div>
                                    <p className="qs-info-title">Email xác nhận đã được gửi</p>
                                    <p className="qs-info-desc">Bạn sẽ nhận được email xác nhận về báo giá đã gửi trong vài phút tới.</p>
                                </div>
                            </div>

                            <div className="qs-info-item amber">
                                <div className="qs-info-ico amber">
                                    <Clock size={16} style={{ color: '#d97706' }} strokeWidth={1.8} />
                                </div>
                                <div>
                                    <p className="qs-info-title">Chờ phản hồi từ khách hàng</p>
                                    <p className="qs-info-desc">Khách hàng sẽ xem xét báo giá và liên hệ lại với bạn trong thời gian sớm nhất.</p>
                                </div>
                            </div>

                            <div className="qs-info-item green">
                                <div className="qs-info-ico green">
                                    <Package size={16} style={{ color: '#16a34a' }} strokeWidth={1.8} />
                                </div>
                                <div>
                                    <p className="qs-info-title">Chuẩn bị hàng hóa</p>
                                    <p className="qs-info-desc">Vui lòng chuẩn bị hàng hóa theo số lượng và thời gian đã cam kết trong báo giá.</p>
                                </div>
                            </div>
                        </div>

                        {/* Support box */}
                        <div className="qs-support">
                            <p className="qs-support-title">Cần hỗ trợ?</p>
                            <p className="qs-support-text">
                                Nếu có bất kỳ thắc mắc nào, vui lòng liên hệ qua{' '}
                                <a href="mailto:support@fswms.vn" className="qs-support-link">support@fswms.vn</a>
                                {' '}hoặc số điện thoại được cung cấp trong đơn hàng.
                            </p>
                        </div>

                        {/* Action */}
                        <button className="qs-btn" onClick={() => navigate('/supplier/login')}>
                            <ChevronRight size={16} style={{ transform: 'rotate(180deg)', opacity: 0.7 }} />
                            Quay về trang đăng nhập
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}