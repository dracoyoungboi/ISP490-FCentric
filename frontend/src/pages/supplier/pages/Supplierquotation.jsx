import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Building2, Package, Calendar, AlertCircle, CheckCircle,
    Loader2, Send, FileText, Clock, DollarSign, Mail, Phone,
    User, MapPin, ChevronRight, ShieldCheck, Info, TrendingUp,
} from "lucide-react";
import supplierQuotationService from '@/services/supplierQuotationService';
import BrandLogo from '@/components/brand/BrandLogo';
import { useLocation, useNavigate } from 'react-router-dom';

/* ─── MOCK DATA (remove in production) ─── */
const MOCK = {
    id: "PO-2024-00142",
    soDonMua: "PO-2024-00142",
    ngayDatHang: "2024-06-01T08:00:00",
    ngayGiaoDuKien: "2024-06-20T08:00:00",
    ghiChu: "Vui lòng đảm bảo hàng đúng màu sắc, kích cỡ như đã thống nhất. Bao bì cẩn thận.",
    khoNhap: { tenKho: "Kho Miền Nam", diaChi: "123 Nguyễn Văn Linh, Q7, TP.HCM" },
    nguoiTao: { hoTen: "Nguyễn Minh Tuấn", soDienThoai: "0901 234 567", email: "tuan.nguyen@company.vn" },
    chiTietDonMuaHangs: [
        { id: 1, soLuongDat: 200, ghiChu: "", bienTheSanPham: { id: 1, maSku: "SKU-TN-001-RED-L", mauSac: { tenMau: "Đỏ" }, size: { tenSize: "L" }, chatLieu: { tenChatLieu: "Cotton 100%" } } },
        { id: 2, soLuongDat: 150, ghiChu: "", bienTheSanPham: { id: 2, maSku: "SKU-TN-001-BLK-M", mauSac: { tenMau: "Đen" }, size: { tenSize: "M" }, chatLieu: { tenChatLieu: "Cotton 100%" } } },
        { id: 3, soLuongDat: 80, ghiChu: "", bienTheSanPham: { id: 3, maSku: "SKU-TN-002-WHT-XL", mauSac: { tenMau: "Trắng" }, size: { tenSize: "XL" }, chatLieu: { tenChatLieu: "Polyester" } } },
    ],
};

/* ─── HELPERS ─── */
const fmtVND = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
const fmtNum = (n) => Number(n || 0).toLocaleString('vi-VN');

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */
const STYLES = `
/* ── Root ── */
.sq-root {
  min-height: 100vh;
  background: linear-gradient(160deg, #faf8f3 0%, #f5f0e4 55%, #ede9de 100%);
  padding: 28px 24px 64px;
  position: relative;
  font-family: system-ui, sans-serif;
  overflow-x: hidden;
}

/* ── Animated grid ── */
.sq-grid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(184,134,11,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(184,134,11,0.05) 1px, transparent 1px);
  background-size: 56px 56px;
  animation: sqGrid 35s linear infinite;
}
@keyframes sqGrid { to { background-position: 56px 56px; } }

/* ── Orbs ── */
.sq-orb-1 {
  position: fixed; width: 500px; height: 500px; border-radius: 50%;
  background: rgba(184,134,11,0.07); filter: blur(100px);
  top: -180px; right: -120px; pointer-events: none; z-index: 0;
}
.sq-orb-2 {
  position: fixed; width: 360px; height: 360px; border-radius: 50%;
  background: rgba(201,150,12,0.05); filter: blur(90px);
  bottom: -100px; left: -80px; pointer-events: none; z-index: 0;
}

/* ── Inner wrap ── */
.sq-inner {
  position: relative; z-index: 1;
  max-width: 1200px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 20px;
  animation: sqFadeIn 0.5s ease both;
}
@keyframes sqFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

/* ════════════════
   TOP BANNER
════════════════ */
.sq-banner {
  background: linear-gradient(135deg, #2d2106 0%, #3d2e08 100%);
  border: 1px solid rgba(184,134,11,0.35);
  border-radius: 20px; overflow: hidden;
  padding: 18px 24px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 4px 24px rgba(100,80,30,0.2);
  position: relative;
}
.sq-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #b8860b, transparent);
}
.sq-banner-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(184,134,11,0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(184,134,11,0.07) 1px, transparent 1px);
  background-size: 40px 40px;
}
.sq-banner-left {
  display: flex; align-items: center; gap: 14px;
  position: relative; z-index: 1;
}
.sq-banner-logo {
  width: 44px; height: 44px; border-radius: 13px;
  background: linear-gradient(135deg, #b8860b, #e8b923);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(184,134,11,0.5);
}
.sq-banner-eyebrow {
  font-family: ui-monospace, monospace; font-size: 10px;
  letter-spacing: 0.2em; color: rgba(184,134,11,0.7);
  text-transform: uppercase;
}
.sq-banner-title {
  font-size: 18px; font-weight: 900; color: #fff; letter-spacing: -0.5px; line-height: 1;
}
.sq-banner-title span { color: #e8b923; }
.sq-banner-steps {
  display: flex; align-items: center; gap: 8px;
  position: relative; z-index: 1;
}
.sq-step-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 12px; border-radius: 99px;
  font-size: 11px; font-weight: 700; transition: all 0.2s;
}
.sq-step-pill.done  { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
.sq-step-pill.active{ background: linear-gradient(135deg, #b8860b, #e8b923); color: #fff; box-shadow: 0 3px 12px rgba(184,134,11,0.45); }
.sq-step-pill.dim   { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.3); border: 1px solid rgba(255,255,255,0.1); }
.sq-step-dot {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 800;
}
.sq-step-pill.done   .sq-step-dot { background: #22c55e; color: #fff; }
.sq-step-pill.active .sq-step-dot { background: rgba(255,255,255,0.25); color: #fff; }
.sq-step-pill.dim    .sq-step-dot { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
.sq-step-arrow { color: rgba(184,134,11,0.4); }

/* ════════════════
   PAGE TITLE ROW
════════════════ */
.sq-title-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 14px;
}
.sq-order-badge {
  font-family: ui-monospace, monospace; font-size: 11px; font-weight: 600;
  color: #b8860b; background: rgba(184,134,11,0.1);
  border: 1px solid rgba(184,134,11,0.25);
  padding: 3px 12px; border-radius: 99px; letter-spacing: 0.06em;
}
.sq-title-date {
  font-family: ui-monospace, monospace; font-size: 12px; color: #a89f92;
}
.sq-page-title {
  font-size: 24px; font-weight: 900; color: #1a1612; letter-spacing: -0.5px; margin-top: 4px;
}
.sq-page-sub { font-size: 13px; color: #a89f92; margin-top: 4px; }

/* Status badge */
.sq-status {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; border-radius: 14px;
  font-size: 12px; font-weight: 700;
  border: 1px solid; transition: all 0.3s;
}
.sq-status.quoted  { background: rgba(34,197,94,0.08);  border-color: rgba(34,197,94,0.25);  color: #16a34a; }
.sq-status.ready   { background: rgba(34,197,94,0.08);  border-color: rgba(34,197,94,0.25);  color: #16a34a; }
.sq-status.pending { background: rgba(184,134,11,0.08); border-color: rgba(184,134,11,0.25); color: #b8860b; animation: sqPulse 2s infinite; }
@keyframes sqPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }

/* ════════════════
   CARD BASE
════════════════ */
.sq-card {
  background: #fff;
  border: 1px solid rgba(184,134,11,0.15);
  border-radius: 20px; overflow: hidden;
  box-shadow: 0 2px 12px rgba(100,80,30,0.07);
  position: relative;
}
.sq-card::before {
  content: ''; display: block; height: 2px;
  background: linear-gradient(90deg, transparent, #b8860b, transparent);
}
.sq-card-head {
  padding: 16px 24px 14px;
  border-bottom: 1px solid rgba(184,134,11,0.1);
  background: linear-gradient(180deg, rgba(184,134,11,0.03) 0%, transparent 100%);
  display: flex; align-items: center; justify-content: space-between;
}
.sq-card-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700; color: #1a1612;
}
.sq-card-title-icon { color: #b8860b; }
.sq-card-body { padding: 22px 24px; }

/* ════════════════
   INFO FIELDS
════════════════ */
.sq-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 600px) { .sq-info-grid { grid-template-columns: 1fr; } }

.sq-info-field { display: flex; flex-direction: column; gap: 6px; }
.sq-info-lbl {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase; color: rgba(184,134,11,0.7);
}
.sq-info-box {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 12px 14px; border-radius: 12px;
  border: 1px solid; background: #faf8f3;
  transition: border-color 0.2s;
}
.sq-info-box.default { border-color: rgba(184,134,11,0.15); }
.sq-info-box.gold    { border-color: rgba(184,134,11,0.25); background: rgba(184,134,11,0.04); }
.sq-info-box.amber   { border-color: rgba(232,185,35,0.25); background: rgba(232,185,35,0.04); }
.sq-info-box.green   { border-color: rgba(34,197,94,0.2);   background: rgba(34,197,94,0.04); }
.sq-info-icon-default { color: #a89f92; margin-top: 1px; flex-shrink: 0; }
.sq-info-icon-gold    { color: #b8860b; margin-top: 1px; flex-shrink: 0; }
.sq-info-icon-amber   { color: #d97706; margin-top: 1px; flex-shrink: 0; }
.sq-info-icon-green   { color: #16a34a; margin-top: 1px; flex-shrink: 0; }
.sq-info-val { font-size: 13px; font-weight: 700; color: #1a1612; line-height: 1.3; }
.sq-info-sub { font-size: 11px; color: #a89f92; margin-top: 2px; }

/* Remark box */
.sq-remark {
  margin-top: 18px; padding: 14px 16px;
  background: rgba(184,134,11,0.04);
  border: 1px solid rgba(184,134,11,0.15);
  border-radius: 14px;
}
.sq-remark-label {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 600;
  letter-spacing: 0.15em; text-transform: uppercase; color: rgba(184,134,11,0.7);
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.sq-remark-text { font-size: 13px; color: #3d3529; line-height: 1.7; }

/* ════════════════
   CONTACT CARDS
════════════════ */
.sq-contact-list { display: flex; flex-direction: column; gap: 10px; }
.sq-contact-card {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-radius: 13px;
  border: 1px solid rgba(184,134,11,0.12);
  background: #faf8f3;
  transition: border-color 0.2s, background 0.2s;
}
.sq-contact-card:hover { border-color: rgba(184,134,11,0.3); background: rgba(184,134,11,0.04); }
.sq-contact-ico {
  width: 36px; height: 36px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.sq-contact-ico.gold  { background: rgba(184,134,11,0.1);  border: 1px solid rgba(184,134,11,0.2); }
.sq-contact-ico.green { background: rgba(34,197,94,0.08);  border: 1px solid rgba(34,197,94,0.2); }
.sq-contact-ico.blue  { background: rgba(37,99,235,0.07);  border: 1px solid rgba(37,99,235,0.15); }
.sq-contact-lbl {
  font-family: ui-monospace, monospace; font-size: 10px;
  color: #a89f92; letter-spacing: 0.1em; text-transform: uppercase;
}
.sq-contact-val { font-size: 13px; font-weight: 600; color: #1a1612; }

/* ════════════════
   TABLE
════════════════ */
.sq-tbl-wrap { overflow-x: auto; max-height: 540px; overflow-y: auto; }
.sq-tbl { width: 100%; border-collapse: collapse; text-align: left; }
.sq-thead { position: sticky; top: 0; z-index: 5; }
.sq-thead tr {
  background: #faf8f3;
  border-bottom: 1px solid rgba(184,134,11,0.12);
}
.sq-th {
  height: 44px; padding: 0 14px;
  font-family: ui-monospace, monospace; font-size: 10px;
  font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
  color: rgba(184,134,11,0.65); white-space: nowrap;
}
.sq-th.r { text-align: right; }
.sq-th.c { text-align: center; }

.sq-tbody tr { border-bottom: 1px solid rgba(184,134,11,0.07); transition: background 0.15s; }
.sq-tbody tr:last-child { border-bottom: none; }
.sq-tbody tr:hover td { background: rgba(184,134,11,0.04); }
.sq-td { padding: 13px 14px; vertical-align: middle; }
.sq-td.r { text-align: right; }
.sq-td.c { text-align: center; }

/* Row number */
.sq-stt {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(184,134,11,0.08); border: 1px solid rgba(184,134,11,0.15);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: ui-monospace, monospace; font-size: 11px; color: #a89f92;
}
/* SKU */
.sq-sku {
  font-family: ui-monospace, monospace; font-size: 11px; font-weight: 600;
  color: #b8860b; background: rgba(184,134,11,0.08);
  border: 1px solid rgba(184,134,11,0.2);
  padding: 3px 10px; border-radius: 7px; white-space: nowrap;
}
/* Product name */
.sq-prod-name { font-size: 13px; font-weight: 600; color: #1a1612; line-height: 1.4; }
/* Qty badge */
.sq-qty {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 28px; padding: 0 8px;
  border-radius: 8px; background: rgba(184,134,11,0.08);
  border: 1px solid rgba(184,134,11,0.18);
  font-family: ui-monospace, monospace; font-size: 12px; font-weight: 700; color: #3d3529;
}
/* Price input */
.sq-price-wrap { position: relative; display: inline-flex; align-items: center; }
.sq-price-input {
  height: 38px; width: 140px; text-align: right; padding-right: 26px; padding-left: 10px;
  border-radius: 10px; font-size: 13px; font-weight: 700;
  border: 1.5px solid rgba(184,134,11,0.2); background: #faf8f3; outline: none;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  font-family: system-ui, sans-serif; color: #1a1612;
}
.sq-price-input:focus { border-color: #b8860b; background: #fff; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
.sq-price-input.filled { border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.05); color: #15803d; }
.sq-price-input:disabled { opacity: 0.5; cursor: not-allowed; }
.sq-price-unit {
  position: absolute; right: 8px;
  font-family: ui-monospace, monospace; font-size: 10px; color: #a89f92;
  pointer-events: none;
}
/* Qty input */
.sq-qty-input {
  height: 38px; width: 80px; text-align: right; padding: 0 10px;
  border-radius: 10px; font-size: 13px; font-weight: 700;
  border: 1.5px solid rgba(184,134,11,0.2); background: #faf8f3; outline: none;
  transition: all 0.2s;
  font-family: system-ui, sans-serif; color: #1a1612;
}
.sq-qty-input:focus { border-color: #b8860b; background: #fff; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
.sq-qty-input:disabled { opacity: 0.5; cursor: not-allowed; }
/* Note input */
.sq-note-input {
  height: 38px; width: 160px; padding: 0 10px;
  border-radius: 10px; font-size: 12px;
  border: 1.5px solid rgba(184,134,11,0.15); background: #faf8f3; outline: none;
  transition: all 0.2s; color: #1a1612;
}
.sq-note-input:focus { border-color: #b8860b; background: #fff; box-shadow: 0 0 0 3px rgba(184,134,11,0.08); }
.sq-note-input:disabled { opacity: 0.5; cursor: not-allowed; }
/* Total */
.sq-total { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; }
.sq-total.filled { color: #16a34a; }
.sq-total.empty  { color: #d1c5b0; }
/* Tfoot */
.sq-tfoot tr { background: rgba(184,134,11,0.03); border-top: 2px solid rgba(184,134,11,0.15); }
.sq-tfoot-lbl {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700;
  color: rgba(184,134,11,0.6); text-transform: uppercase; letter-spacing: 0.15em;
}
.sq-grand-total {
  font-size: 22px; font-weight: 900; color: #b8860b; letter-spacing: -0.5px;
}
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }

/* ════════════════
   FOOTER GRID
════════════════ */
.sq-footer-grid {
  display: grid; grid-template-columns: 1fr 340px; gap: 20px;
}
@media (max-width: 900px) { .sq-footer-grid { grid-template-columns: 1fr; } }

/* ── Form inputs ── */
.sq-form-lbl {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 500;
  letter-spacing: 0.18em; text-transform: uppercase; color: rgba(184,134,11,0.7);
  display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
}
.sq-form-req { color: #ef4444; }
.sq-date-input {
  width: 100%; height: 44px; padding: 0 14px;
  border: 1.5px solid rgba(184,134,11,0.2); border-radius: 11px;
  background: #faf8f3; outline: none; font-size: 14px; font-weight: 600; color: #1a1612;
  transition: all 0.2s;
}
.sq-date-input:focus { border-color: #b8860b; background: #fff; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
.sq-date-input:disabled { opacity: 0.5; cursor: not-allowed; }
.sq-date-hint { font-size: 11px; color: #a89f92; margin-top: 5px; }
.sq-textarea {
  width: 100%; min-height: 120px; padding: 12px 14px;
  border: 1.5px solid rgba(184,134,11,0.2); border-radius: 12px;
  background: #faf8f3; outline: none; font-size: 13px; color: #1a1612;
  resize: none; transition: all 0.2s; line-height: 1.6;
}
.sq-textarea:focus { border-color: #b8860b; background: #fff; box-shadow: 0 0 0 3px rgba(184,134,11,0.1); }
.sq-textarea:disabled { opacity: 0.5; cursor: not-allowed; }
.sq-textarea::placeholder { color: #a89f92; }

/* ════════════════
   KPI CARDS
════════════════ */
.sq-kpi-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
.sq-kpi {
  background: #fff; border: 1px solid rgba(184,134,11,0.15);
  border-radius: 16px; padding: 18px 20px;
  display: flex; align-items: center; justify-content: space-between;
  box-shadow: 0 2px 8px rgba(100,80,30,0.06);
  transition: all 0.2s;
  position: relative; overflow: hidden;
}
.sq-kpi::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
}
.sq-kpi.k-gold::before  { background: linear-gradient(90deg, transparent, #b8860b, transparent); }
.sq-kpi.k-blue::before  { background: linear-gradient(90deg, transparent, #2563eb, transparent); }
.sq-kpi.k-green::before { background: linear-gradient(90deg, transparent, #16a34a, transparent); }
.sq-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(100,80,30,0.12); border-color: rgba(184,134,11,0.3); }
.sq-kpi-left { display: flex; flex-direction: column; gap: 2px; }
.sq-kpi-lbl {
  font-family: ui-monospace, monospace; font-size: 10px;
  color: #a89f92; letter-spacing: 0.1em; text-transform: uppercase;
}
.sq-kpi-val { font-size: 22px; font-weight: 900; color: #1a1612; letter-spacing: -0.5px; }
.sq-kpi-val.k-gold  { color: #b8860b; }
.sq-kpi-val.k-blue  { color: #2563eb; }
.sq-kpi-val.k-green { color: #16a34a; }
.sq-kpi-sub { font-size: 11px; color: #a89f92; margin-top: 1px; }
.sq-kpi-ico {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
}
.sq-kpi-ico.k-gold  { background: rgba(184,134,11,0.1); }
.sq-kpi-ico.k-blue  { background: rgba(37,99,235,0.08); }
.sq-kpi-ico.k-green { background: rgba(34,197,94,0.08); }

/* ════════════════
   SUBMIT BUTTON
════════════════ */
.sq-submit-btn {
  width: 100%; height: 52px; border-radius: 14px;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border: 1.5px solid; transition: all 0.3s;
  position: relative; overflow: hidden;
}
.sq-submit-btn::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.15), transparent);
  opacity: 0; transition: opacity 0.3s;
}
.sq-submit-btn.active {
  background: linear-gradient(135deg, #b8860b, #e8b923);
  border-color: transparent; color: #fff;
  box-shadow: 0 6px 24px rgba(184,134,11,0.42);
}
.sq-submit-btn.active:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(184,134,11,0.55); }
.sq-submit-btn.active:hover::before { opacity: 1; }
.sq-submit-btn.inactive {
  background: rgba(184,134,11,0.07); border-color: rgba(184,134,11,0.15);
  color: #a89f92; cursor: not-allowed;
}
.sq-submit-btn.back {
  background: linear-gradient(135deg, #2d2106, #3d2e08);
  border-color: rgba(184,134,11,0.4); color: #e8b923;
  box-shadow: 0 4px 18px rgba(100,80,30,0.2);
}
.sq-submit-btn.back:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(100,80,30,0.3); }
.sq-spin { animation: sqSpin 1s linear infinite; }
@keyframes sqSpin { to { transform: rotate(360deg); } }

/* Warning box */
.sq-warning {
  padding: 14px 16px; border-radius: 14px;
  background: rgba(184,134,11,0.06); border: 1px solid rgba(184,134,11,0.2);
}
.sq-warning-title {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700;
  color: #b8860b; text-transform: uppercase; letter-spacing: 0.12em;
  display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
}
.sq-warning-list {
  list-style: disc; list-style-position: inside;
  font-size: 11px; color: #7a6e5f; line-height: 1.8; font-weight: 500;
}

/* ════════════════
   DIALOG
════════════════ */
.sq-dialog {
  background: #fff;
  border: 1px solid rgba(184,134,11,0.2);
  border-radius: 22px; overflow: hidden;
  box-shadow: 0 24px 80px rgba(100,80,30,0.2);
  max-width: 440px; padding: 0;
}
.sq-dialog-head {
  padding: 22px 24px 18px;
  border-bottom: 1px solid rgba(184,134,11,0.12);
  background: linear-gradient(160deg, #2d2106 0%, #3d2e08 100%);
  position: relative; overflow: hidden;
}
.sq-dialog-head::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #b8860b, transparent);
}
.sq-dialog-ttl {
  font-size: 17px; font-weight: 900; color: #fff;
  display: flex; align-items: center; gap: 8px; letter-spacing: -0.3px;
}
.sq-dialog-sub { font-size: 12px; color: rgba(184,134,11,0.6); margin-top: 3px; }
.sq-dialog-body { padding: 22px 24px; }
.sq-dialog-table {
  background: #faf8f3; border: 1px solid rgba(184,134,11,0.15);
  border-radius: 14px; overflow: hidden;
}
.sq-dialog-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 16px;
  border-bottom: 1px solid rgba(184,134,11,0.08);
}
.sq-dialog-row:last-child { border-bottom: none; }
.sq-dialog-key { font-size: 12px; color: #a89f92; }
.sq-dialog-val { font-size: 12px; font-weight: 700; color: #1a1612; }
.sq-dialog-val.gold { color: #b8860b; font-family: ui-monospace, monospace; }
.sq-dialog-val.green { color: #16a34a; font-size: 14px; }
.sq-dialog-notice {
  margin-top: 14px; padding: 11px 14px;
  background: rgba(184,134,11,0.06); border: 1px solid rgba(184,134,11,0.18);
  border-radius: 12px;
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 11px; color: #7a6e5f;
}
.sq-dialog-foot {
  padding: 16px 24px 22px;
  display: flex; gap: 10px;
}
.sq-btn-cancel {
  flex: 1; height: 42px; border-radius: 11px;
  background: #faf8f3; border: 1.5px solid rgba(184,134,11,0.2);
  color: #7a6e5f; font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.2s;
}
.sq-btn-cancel:hover { border-color: #b8860b; color: #b8860b; }
.sq-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.sq-btn-confirm {
  flex: 1; height: 42px; border-radius: 11px;
  background: linear-gradient(135deg, #b8860b, #e8b923);
  border: none; color: #fff; font-size: 13px; font-weight: 800;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
  transition: all 0.2s; box-shadow: 0 4px 16px rgba(184,134,11,0.38);
}
.sq-btn-confirm:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(184,134,11,0.5); }
.sq-btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* 2-col layout */
.sq-two-col { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
@media (max-width: 900px) { .sq-two-col { grid-template-columns: 1fr; } }

/* card count badge */
.sq-count-badge {
  font-family: ui-monospace, monospace; font-size: 10px; font-weight: 700;
  color: #b8860b; background: rgba(184,134,11,0.1);
  border: 1px solid rgba(184,134,11,0.2);
  padding: 3px 10px; border-radius: 99px; letter-spacing: 0.06em;
}
`;

/* ─── SUB-COMPONENTS ─── */

function InfoField({ icon: Icon, label, value, variant = 'default', sub }) {
    const box = { default: 'default', indigo: 'gold', amber: 'amber', emerald: 'green' }[variant] || 'default';
    const iconCls = { default: 'sq-info-icon-default', gold: 'sq-info-icon-gold', amber: 'sq-info-icon-amber', green: 'sq-info-icon-green' }[box];
    return (
        <div className="sq-info-field">
            <p className="sq-info-lbl">{label}</p>
            <div className={`sq-info-box ${box}`}>
                <Icon size={14} className={iconCls} />
                <div>
                    <p className="sq-info-val">{value}</p>
                    {sub && <p className="sq-info-sub">{sub}</p>}
                </div>
            </div>
        </div>
    );
}

function ContactCard({ icon: Icon, label, value, color }) {
    const iconColor = { gold: '#b8860b', green: '#16a34a', blue: '#2563eb' }[color];
    return (
        <div className="sq-contact-card">
            <div className={`sq-contact-ico ${color}`}>
                <Icon size={15} style={{ color: iconColor }} />
            </div>
            <div>
                <p className="sq-contact-lbl">{label}</p>
                <p className="sq-contact-val">{value}</p>
            </div>
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, sub, colorKey }) {
    const iconColor = { 'k-gold': '#b8860b', 'k-blue': '#2563eb', 'k-green': '#16a34a' }[colorKey];
    return (
        <div className={`sq-kpi ${colorKey}`}>
            <div className="sq-kpi-left">
                <p className="sq-kpi-lbl">{label}</p>
                <p className={`sq-kpi-val ${colorKey}`}>{value}</p>
                {sub && <p className="sq-kpi-sub">{sub}</p>}
            </div>
            <div className={`sq-kpi-ico ${colorKey}`}>
                <Icon size={18} style={{ color: iconColor }} strokeWidth={1.5} />
            </div>
        </div>
    );
}

function StepPill({ n, label, state }) {
    return (
        <div className={`sq-step-pill ${state}`}>
            <span className="sq-step-dot">{state === 'done' ? '✓' : n}</span>
            {label}
        </div>
    );
}

/* ─── MAIN ─── */
export default function SupplierQuotation() {
    const location = useLocation?.() || {};
    const navigate = useNavigate?.() || (() => { });
    const [orderData] = useState(location.state?.orderData || MOCK);

    const [quoteItems, setQuoteItems] = useState([]);
    const [supplierNote, setSupplierNote] = useState('');
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);

    const isQuoted = orderData?.trangThai === 4;

    useEffect(() => {
        if (!orderData) return;
        setQuoteItems(orderData.chiTietDonMuaHangs.map(item => ({
            id: item.id,
            bienTheSanPhamId: item.bienTheSanPham.id,
            maSku: item.bienTheSanPham.maSku,
            tenSanPham: [item.bienTheSanPham.mauSac?.tenMau, item.bienTheSanPham.size?.tenSize, item.bienTheSanPham.chatLieu?.tenChatLieu].filter(Boolean).join(' · '),
            soLuongDat: item.soLuongDat,
            donGiaDeXuat: item.donGia || '',
            soLuongCoCap: item.soLuongCoCap || item.soLuongDat,
            ghiChu: item.ghiChuNCC || item.ghiChu || '',
        })));
        setSupplierNote(orderData.ghiChuNCC || '');
        setEstimatedDeliveryDate(orderData.ngayGiaoDuKien?.split('T')[0] || '');
    }, [orderData]);

    const update = (i, field, value) => setQuoteItems(p => { const a = [...p]; a[i] = { ...a[i], [field]: value }; return a; });
    const itemTotal = (it) => Number(it.soLuongCoCap) * Number(it.donGiaDeXuat || 0);
    const grandTotal = () => quoteItems.reduce((s, it) => s + itemTotal(it), 0);
    const totalQty = () => quoteItems.reduce((s, it) => s + Number(it.soLuongCoCap), 0);

    const validate = () => {
        if (!estimatedDeliveryDate) { toast.error('Vui lòng chọn ngày giao hàng dự kiến'); return false; }
        for (const it of quoteItems) {
            if (!it.donGiaDeXuat || Number(it.donGiaDeXuat) <= 0) { toast.error(`Nhập đơn giá cho: ${it.tenSanPham}`); return false; }
            if (Number(it.soLuongCoCap) > it.soLuongDat) { toast.error(`SL cấp vượt SL đặt: ${it.tenSanPham}`); return false; }
        }
        return true;
    };

    const handleSubmit = () => { if (validate()) setShowConfirmDialog(true); };

    const confirmSubmit = async () => {
        setSubmitting(true);
        try {
            await supplierQuotationService?.submitQuote?.({
                id: orderData.id,
                ghiChu: supplierNote,
                chiTietDonMuaHangBaoGias: quoteItems.map(it => ({ id: it.id, donGia: Number(it.donGiaDeXuat), ghiChu: it.ghiChu })),
            });
            toast.success('Gửi báo giá thành công! Cảm ơn quý đối tác.');
            setShowConfirmDialog(false);
            setTimeout(() => navigate('/quote-success', { replace: true }), 1000);
        } catch (e) {
            toast.error(e?.response?.data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
        } finally { setSubmitting(false); }
    };

    if (!orderData) return null;

    const filledCount = quoteItems.filter(it => Number(it.donGiaDeXuat) > 0).length;
    const allFilled = filledCount === quoteItems.length && quoteItems.length > 0;

    return (
        <>
            <style>{STYLES}</style>
            <div className="sq-root">
                <div className="sq-grid" />
                <div className="sq-orb-1" />
                <div className="sq-orb-2" />

                <div className="sq-inner">

                    {/* ── TOP BANNER ── */}
                    <div className="sq-banner">
                        <div className="sq-banner-grid" />
                        <div className="sq-banner-left">
                            <BrandLogo variant="sidebar-collapsed" />
                            <div>
                                <p className="sq-banner-eyebrow">Cổng báo giá nhà cung cấp</p>
                                <p className="sq-banner-title">
                                    <span>FCentric</span> · Fashion Warehouse Management
                                </p>
                            </div>
                        </div>
                        <div className="sq-banner-steps">
                            <StepPill n="1" label="Xem đơn" state="done" />
                            <ChevronRight size={13} className="sq-step-arrow" />
                            <StepPill
                                n="2"
                                label={isQuoted ? "Xem báo giá" : "Nhập giá"}
                                state={isQuoted ? "done" : allFilled ? "done" : "active"}
                            />
                            <ChevronRight size={13} className="sq-step-arrow" />
                            <StepPill n="3" label="Hoàn tất" state={isQuoted ? "done" : "dim"} />
                        </div>
                    </div>

                    {/* ── PAGE TITLE ── */}
                    <div className="sq-title-row">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <span className="sq-order-badge">{orderData.soDonMua}</span>
                                <span className="sq-title-date">· Đặt ngày {fmtDate(orderData.ngayDatHang)}</span>
                            </div>
                            <h1 className="sq-page-title">
                                {isQuoted ? 'Xem lại báo giá' : 'Yêu cầu báo giá'}
                            </h1>
                            <p className="sq-page-sub">
                                {isQuoted
                                    ? 'Báo giá này đã được gửi cho hệ thống FCentric'
                                    : 'Vui lòng cung cấp đơn giá và thông tin giao hàng chi tiết'}
                            </p>
                        </div>
                        <div className={`sq-status ${isQuoted ? 'quoted' : allFilled ? 'ready' : 'pending'}`}>
                            {isQuoted ? <ShieldCheck size={14} /> : allFilled ? <CheckCircle size={14} /> : <Info size={14} />}
                            {isQuoted
                                ? 'Đơn hàng đã được báo giá'
                                : allFilled
                                    ? `Sẵn sàng gửi (${quoteItems.length}/${quoteItems.length})`
                                    : `Đang nhập (${filledCount}/${quoteItems.length})`}
                        </div>
                    </div>

                    {/* ── ORDER INFO + CONTACT ── */}
                    <div className="sq-two-col">
                        {/* Order info card */}
                        <div className="sq-card">
                            <div className="sq-card-head">
                                <div className="sq-card-title">
                                    <Building2 size={15} className="sq-card-title-icon" />
                                    Thông tin đơn mua hàng
                                </div>
                            </div>
                            <div className="sq-card-body">
                                <div className="sq-info-grid">
                                    <InfoField icon={FileText} label="Số hiệu đơn" value={orderData.soDonMua} variant="indigo" />
                                    <InfoField icon={Calendar} label="Ngày niêm yết" value={fmtDate(orderData.ngayDatHang)} />
                                    <InfoField icon={Clock} label="Ngày cần giao" value={fmtDate(orderData.ngayGiaoDuKien)} variant="amber" />
                                    <InfoField icon={MapPin} label="Kho tiếp nhận" value={orderData.khoNhap?.tenKho} sub={orderData.khoNhap?.diaChi} variant="emerald" />
                                </div>
                                {orderData.ghiChu && (
                                    <div className="sq-remark">
                                        <div className="sq-remark-label">
                                            <Info size={11} style={{ color: '#b8860b' }} />
                                            Ghi chú từ khách hàng
                                        </div>
                                        <p className="sq-remark-text">{orderData.ghiChu}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contact card */}
                        <div className="sq-card">
                            <div className="sq-card-head">
                                <div className="sq-card-title">
                                    <User size={15} className="sq-card-title-icon" />
                                    Nhân viên phụ trách
                                </div>
                            </div>
                            <div className="sq-card-body">
                                <div className="sq-contact-list">
                                    <ContactCard icon={User} label="Người đặt" value={orderData.nguoiTao?.hoTen} color="gold" />
                                    <ContactCard icon={Phone} label="Hotline" value={orderData.nguoiTao?.soDienThoai} color="green" />
                                    <ContactCard icon={Mail} label="Email liên hệ" value={orderData.nguoiTao?.email} color="blue" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── QUOTE TABLE ── */}
                    <div className="sq-card">
                        <div className="sq-card-head">
                            <div className="sq-card-title">
                                <Package size={15} className="sq-card-title-icon" />
                                Danh sách mặt hàng báo giá
                            </div>
                            <span className="sq-count-badge">{quoteItems.length} sản phẩm</span>
                        </div>
                        <div className="sq-tbl-wrap">
                            <table className="sq-tbl">
                                <thead className="sq-thead">
                                    <tr>
                                        <th className="sq-th c" style={{ width: 50 }}>#</th>
                                        <th className="sq-th">Mã SKU</th>
                                        <th className="sq-th">Thông tin sản phẩm</th>
                                        <th className="sq-th r">SL yêu cầu</th>
                                        <th className="sq-th r">SL có thể cấp</th>
                                        <th className="sq-th r">Đơn giá đề xuất</th>
                                        <th className="sq-th r">Thành tiền</th>
                                        <th className="sq-th">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="sq-tbody">
                                    {quoteItems.map((item, i) => {
                                        const total = itemTotal(item);
                                        const hasPrice = Number(item.donGiaDeXuat) > 0;
                                        return (
                                            <tr key={i}>
                                                <td className="sq-td c">
                                                    <span className="sq-stt">{i + 1}</span>
                                                </td>
                                                <td className="sq-td">
                                                    <span className="sq-sku">{item.maSku}</span>
                                                </td>
                                                <td className="sq-td">
                                                    <p className="sq-prod-name">{item.tenSanPham}</p>
                                                </td>
                                                <td className="sq-td r">
                                                    <span className="sq-qty">{item.soLuongDat}</span>
                                                </td>
                                                <td className="sq-td r">
                                                    <input
                                                        type="number" min="0" max={item.soLuongDat}
                                                        value={item.soLuongCoCap}
                                                        disabled={isQuoted}
                                                        onChange={e => update(i, 'soLuongCoCap', e.target.value)}
                                                        className="sq-qty-input"
                                                        style={{ marginLeft: 'auto' }}
                                                    />
                                                </td>
                                                <td className="sq-td r">
                                                    <div className="sq-price-wrap" style={{ marginLeft: 'auto' }}>
                                                        <input
                                                            type="number" min="0" step="1000"
                                                            value={item.donGiaDeXuat}
                                                            disabled={isQuoted}
                                                            onChange={e => update(i, 'donGiaDeXuat', e.target.value)}
                                                            placeholder="0"
                                                            className={`sq-price-input ${hasPrice ? 'filled' : ''}`}
                                                        />
                                                        <span className="sq-price-unit">₫</span>
                                                    </div>
                                                </td>
                                                <td className="sq-td r">
                                                    <span className={`sq-total ${hasPrice ? 'filled' : 'empty'}`}>
                                                        {hasPrice ? fmtVND(total) : '—'}
                                                    </span>
                                                </td>
                                                <td className="sq-td">
                                                    <input
                                                        value={item.ghiChu}
                                                        disabled={isQuoted}
                                                        onChange={e => update(i, 'ghiChu', e.target.value)}
                                                        placeholder="Lưu ý..."
                                                        className="sq-note-input"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {grandTotal() > 0 && (
                                    <tfoot className="sq-tfoot">
                                        <tr>
                                            <td colSpan={5} className="sq-td">
                                                <span className="sq-tfoot-lbl">Tổng hợp báo giá</span>
                                            </td>
                                            <td className="sq-td r">
                                                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, color: '#7a6e5f', fontWeight: 600 }}>
                                                    {fmtNum(totalQty())} sp
                                                </span>
                                            </td>
                                            <td className="sq-td r">
                                                <span className="sq-grand-total">{fmtVND(grandTotal())}</span>
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* ── FOOTER ── */}
                    <div className="sq-footer-grid">
                        {/* Notes & date card */}
                        <div className="sq-card">
                            <div className="sq-card-head">
                                <div className="sq-card-title">
                                    <FileText size={15} className="sq-card-title-icon" />
                                    Ghi chú & điều khoản
                                </div>
                            </div>
                            <div className="sq-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                <div>
                                    <div className="sq-form-lbl">
                                        <Calendar size={11} style={{ color: '#b8860b' }} />
                                        Ngày giao hàng dự kiến
                                        <span className="sq-form-req">*</span>
                                    </div>
                                    <input
                                        type="date"
                                        value={estimatedDeliveryDate}
                                        readOnly={true}
                                        disabled={isQuoted}
                                        onChange={e => setEstimatedDeliveryDate(e.target.value)}
                                        min={orderData.ngayDatHang?.split('T')[0]}
                                        className="sq-date-input"
                                    />
                                    <p className="sq-date-hint">Lưu ý: Ngày giao tối thiểu phải sau ngày đặt hàng</p>
                                </div>
                                <div>
                                    <div className="sq-form-lbl">Thông tin bổ sung</div>
                                    <textarea
                                        placeholder="Ví dụ: Miễn phí vận chuyển, Thanh toán 50% trước..."
                                        className="sq-textarea"
                                        value={supplierNote}
                                        disabled={isQuoted}
                                        onChange={e => setSupplierNote(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* KPI + Submit */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="sq-kpi-grid">
                                <KpiCard icon={Package} label="Số mặt hàng" value={quoteItems.length} sub={`${filledCount} đã nhập giá`} colorKey="k-gold" />
                                <KpiCard icon={DollarSign} label="Tổng số lượng" value={fmtNum(totalQty())} sub="Tổng cộng" colorKey="k-blue" />
                                <KpiCard icon={CheckCircle} label="Thành tiền" value={grandTotal() > 0 ? fmtVND(grandTotal()) : '—'} sub="Chưa VAT" colorKey="k-green" />
                            </div>

                            <button
                                className={`sq-submit-btn ${isQuoted ? 'back' : allFilled && !submitting ? 'active' : 'inactive'}`}
                                disabled={!isQuoted && (submitting || !allFilled)}
                                onClick={isQuoted ? () => navigate('/supplier/login') : handleSubmit}
                            >
                                {isQuoted ? (
                                    <><ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />Quay lại trang đề xuất</>
                                ) : submitting ? (
                                    <><Loader2 size={16} className="sq-spin" />Đang xử lý...</>
                                ) : allFilled ? (
                                    <><Send size={16} />Gửi báo giá ngay</>
                                ) : (
                                    `Vui lòng nhập đủ giá (${filledCount}/${quoteItems.length})`
                                )}
                            </button>

                            <div className="sq-warning">
                                <div className="sq-warning-title">
                                    <AlertCircle size={12} />
                                    Quy trình quan trọng
                                </div>
                                <ul className="sq-warning-list">
                                    <li>Kiểm tra kỹ trước khi bấm gửi</li>
                                    <li>Hệ thống tự động lưu trữ báo giá</li>
                                    <li>Phản hồi sẽ được gửi qua email</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── CONFIRM DIALOG ── */}
                <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogContent className="sq-dialog p-0 border-0 shadow-none bg-transparent" style={{ maxWidth: 440 }}>
                        <div className="sq-dialog-head">
                            <DialogHeader>
                                <DialogTitle className="sq-dialog-ttl">
                                    <ShieldCheck size={18} style={{ color: '#e8b923' }} />
                                    Xác nhận gửi báo giá
                                </DialogTitle>
                                <p className="sq-dialog-sub">Vui lòng kiểm tra lại thông tin trước khi xác nhận</p>
                            </DialogHeader>
                        </div>
                        <div className="sq-dialog-body">
                            <div className="sq-dialog-table">
                                {[
                                    { label: 'Số đơn', value: orderData.soDonMua, cls: 'gold' },
                                    { label: 'Số mặt hàng', value: `${quoteItems.length} sản phẩm`, cls: '' },
                                    { label: 'Tổng số lượng', value: fmtNum(totalQty()), cls: '' },
                                    { label: 'Tổng giá trị', value: fmtVND(grandTotal()), cls: 'green' },
                                    { label: 'Ngày giao dự kiến', value: fmtDate(estimatedDeliveryDate), cls: '' },
                                ].map(({ label, value, cls }) => (
                                    <div key={label} className="sq-dialog-row">
                                        <span className="sq-dialog-key">{label}</span>
                                        <span className={`sq-dialog-val ${cls}`}>{value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="sq-dialog-notice">
                                <Info size={12} style={{ color: '#b8860b', flexShrink: 0, marginTop: 1 }} />
                                Sau khi gửi, bạn không thể chỉnh sửa báo giá này.
                            </div>
                        </div>
                        <div className="sq-dialog-foot">
                            <button className="sq-btn-cancel" onClick={() => setShowConfirmDialog(false)} disabled={submitting}>
                                Kiểm tra lại
                            </button>
                            <button className="sq-btn-confirm" onClick={confirmSubmit} disabled={submitting}>
                                {submitting
                                    ? <><Loader2 size={14} className="sq-spin" />Đang gửi...</>
                                    : <><Send size={14} />Xác nhận gửi</>}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}