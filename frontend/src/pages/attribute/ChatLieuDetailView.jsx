// src/pages/material/ChatLieuDetailView.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Loader2, CheckCircle2, XCircle, Edit, Calendar, Hash, FileText } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { getChatLieuById } from "@/services/chatLieuService";

function InfoField({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>{label}</p>
            <p className="font-semibold text-slate-900 leading-snug">{value || "—"}</p>
        </div>
    );
}

export default function ChatLieuDetailView() {
    const { id }     = useParams();
    const navigate   = useNavigate();
    const [loading,  setLoading]  = useState(true);
    const [data,     setData]     = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await getChatLieuById(id);
                setData(result);
            } catch {
                toast.error("Không thể tải thông tin chất liệu");
                navigate("/material");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="p-6 min-h-screen flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #ca8a04 0%, #b45309 100%)" }}>
                <div className="flex items-center gap-2 bg-bo-surface/95 rounded-2xl px-6 py-4 shadow-lg ring-1 ring-white/60">
                    <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
                    <span className="text-sm font-medium text-gray-700">Đang tải...</span>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const isActive = data.trangThai === 1 || data.trangThai === true;

    return (
        <div className="p-6 space-y-6 min-h-screen"
            style={{ background: "linear-gradient(135deg, #ca8a04 0%, #b45309 100%)" }}>

            <div className="space-y-6 max-w-2xl mx-auto">

                {/* ── Top bar ── */}
                <div className="flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => navigate("/material")}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-white/90 hover:text-white transition-colors duration-150"
                    >
                        <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(`/material/${id}`)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition-all duration-150"
                        style={{ background: "#eab308", color: "#ffffff", border: "none" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#ca8a04"}
                        onMouseLeave={e => e.currentTarget.style.background = "#eab308"}
                    >
                        <Edit className="h-4 w-4" /> Chỉnh sửa
                    </button>
                </div>

                {/* ── Page title ── */}
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow">
                        Chi tiết chất liệu
                    </h2>
                    <p className="text-sm text-white/70 mt-1">Xem thông tin đầy đủ của chất liệu</p>
                </div>

                {/* ── Stat chips ── */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-bo-surface/95 shadow-lg ring-1 ring-white/60 p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Mã chất liệu</p>
                                <p className="text-lg font-bold text-yellow-600 mt-1 font-mono">{data.maChatLieu}</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                                <Hash className="h-5 w-5 text-yellow-600" />
                            </div>
                        </div>
                    </div>

                    <div className={`rounded-2xl shadow-lg ring-1 ring-white/60 p-5 ${isActive ? "bg-bo-surface/95" : "bg-bo-surface/95"}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Trạng thái</p>
                                <p className={`text-sm font-bold mt-1 ${isActive ? "text-emerald-600" : "text-slate-500"}`}>
                                    {isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                                </p>
                            </div>
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isActive ? "bg-emerald-100" : "bg-slate-100"}`}>
                                {isActive
                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    : <XCircle className="h-5 w-5 text-slate-400" />
                                }
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Thông tin chi tiết ── */}
                <div className="rounded-2xl bg-bo-surface/95 shadow-lg ring-1 ring-white/60 overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100">
                            <Layers className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900 text-sm">Thông tin chất liệu</p>
                            <p className="text-xs text-slate-500 mt-0.5">Hồ sơ đầy đủ</p>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <InfoField label="Mã chất liệu" value={data.maChatLieu} />
                            <InfoField label="Tên chất liệu" value={data.tenChatLieu} />
                        </div>
                        {data.moTa && (
                            <div className="mt-6 border-t border-slate-100 pt-6">
                                <InfoField label="Mô tả" value={data.moTa} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Nhật ký ── */}
                <div className="rounded-2xl bg-bo-surface/95 shadow-lg ring-1 ring-white/60 overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                            <Calendar className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-900 text-sm">Nhật ký tài khoản</p>
                            <p className="text-xs text-slate-500 mt-0.5">Thời gian tạo và cập nhật</p>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-bo-surface-subtle border border-slate-100">
                                <Calendar className="h-8 w-8 text-slate-300 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ngày khởi tạo</p>
                                    <p className="text-slate-900 font-semibold mt-1">
                                        {data.ngayTao ? new Date(data.ngayTao).toLocaleString('vi-VN') : "—"}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-bo-surface-subtle border border-slate-100">
                                <FileText className="h-8 w-8 text-slate-300 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cập nhật cuối</p>
                                    <p className="text-slate-900 font-semibold mt-1">
                                        {data.ngayCapNhat ? new Date(data.ngayCapNhat).toLocaleString('vi-VN') : "—"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}