// src/pages/material/ChatLieuDetail.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Layers, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { getChatLieuById, createChatLieu, updateChatLieu } from "@/services/chatLieuService";

const formSchema = z.object({
    maChatLieu:  z.string().min(1, "Mã chất liệu không được để trống").max(50, "Mã tối đa 50 ký tự"),
    tenChatLieu: z.string().min(1, "Tên chất liệu không được để trống").max(100, "Tên tối đa 100 ký tự"),
    moTa:        z.string().max(500, "Mô tả tối đa 500 ký tự").optional(),
});

function StatusToggle({ value, onChange }) {
    return (
        <div className="flex gap-3">
            <button
                type="button"
                onClick={() => onChange(1)}
                className="flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                style={value === 1
                    ? { borderColor: "#10b981", background: "#f0fdf4", color: "#065f46" }
                    : { borderColor: "#e5e7eb", background: "#fff", color: "#94a3b8" }}
            >
                <CheckCircle2 className="h-4 w-4" /> Hoạt động
            </button>
            <button
                type="button"
                onClick={() => onChange(0)}
                className="flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all duration-200"
                style={value === 0
                    ? { borderColor: "#94a3b8", background: "#f8fafc", color: "#475569" }
                    : { borderColor: "#e5e7eb", background: "#fff", color: "#94a3b8" }}
            >
                <XCircle className="h-4 w-4" /> Ngừng hoạt động
            </button>
        </div>
    );
}

export default function ChatLieuDetail() {
    const { id }     = useParams();
    const navigate   = useNavigate();
    const isEdit     = !!id;
    const [loading,  setLoading]  = useState(false);
    const [trangThai, setTrangThai] = useState(1);

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: { maChatLieu: "", tenChatLieu: "", moTa: "" },
    });

    useEffect(() => {
        if (!isEdit) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getChatLieuById(id);
                form.reset({
                    maChatLieu:  data.maChatLieu  || "",
                    tenChatLieu: data.tenChatLieu || "",
                    moTa:        data.moTa        || "",
                });
                setTrangThai(data.trangThai === 1 || data.trangThai === true ? 1 : 0);
            } catch {
                toast.error("Không thể tải thông tin chất liệu");
                navigate("/material");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, form, navigate, isEdit]);

    const onSubmit = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, trangThai };
            if (isEdit) {
                await updateChatLieu(id, payload);
                toast.success("Cập nhật chất liệu thành công");
            } else {
                await createChatLieu(payload);
                toast.success("Thêm chất liệu mới thành công");
            }
            navigate("/material");
        } catch {
            toast.error("Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEdit) {
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

    return (
        <div className="p-6 space-y-6 min-h-screen"
            style={{ background: "linear-gradient(135deg, #ca8a04 0%, #b45309 100%)" }}>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl mx-auto">

                    {/* ── Top bar ── */}
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => navigate("/material")}
                            className="inline-flex items-center gap-1.5 text-sm font-bold text-white/90 hover:text-white transition-colors duration-150"
                        >
                            <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
                        </button>
                    </div>

                    {/* ── Page title ── */}
                    <div>
                        <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow">
                            {isEdit ? "Chỉnh sửa chất liệu" : "Thêm chất liệu mới"}
                        </h2>
                        <p className="text-sm text-white/70 mt-1">
                            {isEdit ? "Cập nhật thông tin chất liệu hiện tại" : "Nhập thông tin để tạo chất liệu mới"}
                        </p>
                    </div>

                    {/* ── Thông tin chất liệu ── */}
                    <div className="rounded-2xl bg-bo-surface/95 shadow-lg ring-1 ring-white/60 overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100">
                                <Layers className="h-4 w-4 text-yellow-600" />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm">Thông tin chất liệu</p>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <FormField control={form.control} name="maChatLieu" render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                                            Mã chất liệu *
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="VD: COTTON, NYLON"
                                                style={{
                                                    background: "#ffffff",
                                                    borderColor: fieldState.error ? "#ef4444" : "#e5e7eb",
                                                    color: "#0f172a"
                                                }}
                                                className="h-10 font-mono focus:border-yellow-500 focus:ring-yellow-500"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs text-red-500" />
                                    </FormItem>
                                )} />

                                <FormField control={form.control} name="tenChatLieu" render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                                            Tên chất liệu *
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="VD: Cotton 100%, Polyester"
                                                style={{
                                                    background: "#ffffff",
                                                    borderColor: fieldState.error ? "#ef4444" : "#e5e7eb",
                                                    color: "#0f172a"
                                                }}
                                                className="h-10 focus:border-yellow-500 focus:ring-yellow-500"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage className="text-xs text-red-500" />
                                    </FormItem>
                                )} />

                                <div className="sm:col-span-2">
                                    <FormField control={form.control} name="moTa" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>
                                                Mô tả
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    rows={4}
                                                    placeholder="Mô tả thêm về chất liệu (tùy chọn)"
                                                    style={{ background: "#ffffff", borderColor: "#e5e7eb", color: "#0f172a" }}
                                                    className="focus:border-yellow-500 focus:ring-yellow-500 resize-none"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-red-500" />
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Trạng thái ── */}
                    <div className="rounded-2xl bg-bo-surface/95 shadow-lg ring-1 ring-white/60 overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </div>
                            <p className="font-semibold text-slate-900 text-sm">Trạng thái</p>
                        </div>
                        <div className="p-6 space-y-3">
                            <StatusToggle value={trangThai} onChange={setTrangThai} />
                            <p className="text-xs text-slate-500">
                                Bật để chất liệu này có thể sử dụng trong sản phẩm. Tắt để tạm ngừng.
                            </p>
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => navigate("/material")}
                            className="inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all duration-150"
                            style={{ background: "#ffffff", color: "#374151", border: "1px solid #d1d5db" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#faf7f0"}
                            onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold transition-all duration-150 disabled:opacity-50"
                            style={{ background: "#eab308", color: "#ffffff", border: "none" }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#ca8a04"; }}
                            onMouseLeave={e => e.currentTarget.style.background = "#eab308"}
                        >
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...</>
                                : <><Save className="h-4 w-4" /> {isEdit ? "Cập nhật" : "Thêm mới"}</>
                            }
                        </button>
                    </div>

                </form>
            </Form>
        </div>
    );
}