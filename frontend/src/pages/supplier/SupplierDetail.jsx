// src/pages/supplier/SupplierDetail.jsx
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
import { Button } from "@/components/ui/button";
import {
    ArrowLeft, Save, Loader2, Phone, Mail, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import FormActions from "@/components/shared/FormActions";
import FormSection from "@/components/shared/FormSection";
import LoadingState from "@/components/shared/LoadingState";
import { getSupplierById, createSupplier, updateSupplier } from "@/services/supplierService";

// ── Schema — validate SĐT Việt Nam ───────────────────────────────────────
const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[0-9]|9[0-9])[0-9]{7}$/;

const formSchema = z.object({
    maNhaCungCap:  z.string().min(1, "Mã nhà cung cấp không được để trống").max(50, "Mã tối đa 50 ký tự"),
    tenNhaCungCap: z.string().min(1, "Tên nhà cung cấp không được để trống").max(200, "Tên tối đa 200 ký tự"),
    nguoiLienHe:   z.string().max(100, "Tên tối đa 100 ký tự").optional().or(z.literal("")),
    soDienThoai: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (val) => !val || val.trim() === "" || PHONE_REGEX.test(val.trim()),
            { message: "Số điện thoại không hợp lệ (VD: 0987654321 hoặc +84987654321)" }
        ),
    email: z
        .string()
        .optional()
        .or(z.literal(""))
        .refine(
            (val) => !val || val.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
            { message: "Email không hợp lệ" }
        ),
    diaChi: z.string().max(500, "Địa chỉ tối đa 500 ký tự").optional().or(z.literal("")),
});

const CONTROL_CLASS =
    "h-10 rounded-md border-bo-border bg-white text-sm text-bo-foreground shadow-none placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15";

// ── Status toggle button ──────────────────────────────────────────────────
function StatusToggle({ value, onChange }) {
    return (
        <div className="mt-1 flex flex-wrap gap-3">
            <button
                type="button"
                onClick={() => onChange(true)}
                className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    value
                        ? "border-bo-success bg-bo-success-soft text-bo-success"
                        : "border-bo-border bg-white text-bo-muted hover:border-bo-success/40 hover:text-bo-success"
                }`}
            >
                <CheckCircle2 className={`size-4 ${value ? "text-bo-success" : "text-slate-400"}`} />
                <span className="truncate">Hoạt động</span>
            </button>
            <button
                type="button"
                onClick={() => onChange(false)}
                className={`inline-flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    !value
                        ? "border-slate-300 bg-slate-100 text-bo-foreground"
                        : "border-bo-border bg-white text-bo-muted hover:border-slate-300 hover:text-slate-700"
                }`}
            >
                <XCircle className={`size-4 ${!value ? "text-slate-600" : "text-slate-400"}`} />
                <span className="truncate">Ngừng hoạt động</span>
            </button>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────
export default function SupplierDetail() {
    const { id }   = useParams();
    const navigate = useNavigate();
    const isEdit   = !!id;

    const [loading,   setLoading]   = useState(false);
    const [trangThai, setTrangThai] = useState(true);

    const form = useForm({
        resolver: zodResolver(formSchema),
        defaultValues: {
            maNhaCungCap: "", tenNhaCungCap: "",
            nguoiLienHe: "", soDienThoai: "", email: "", diaChi: "",
        },
    });

    useEffect(() => {
        if (!isEdit) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await getSupplierById(id);
                form.reset({
                    maNhaCungCap:  data.maNhaCungCap  || "",
                    tenNhaCungCap: data.tenNhaCungCap  || "",
                    nguoiLienHe:   data.nguoiLienHe    || "",
                    soDienThoai:   data.soDienThoai    || "",
                    email:         data.email          || "",
                    diaChi:        data.diaChi         || "",
                });
                setTrangThai(data.trangThai === 1);
            } catch (error) {
                toast.error(error.response?.data?.message || "Không thể tải thông tin nhà cung cấp");
                navigate("/supplier");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, form, navigate, isEdit]);

    const onSubmit = async (values) => {
        setLoading(true);
        try {
            const payload = { ...values, trangThai: trangThai ? 1 : 0 };
            if (isEdit) {
                await updateSupplier(id, payload);
                toast.success("Cập nhật nhà cung cấp thành công");
            } else {
                await createSupplier(payload);
                toast.success("Thêm nhà cung cấp mới thành công");
            }
            navigate("/supplier");
        } catch (error) {
            toast.error(error.response?.data?.message || "Có lỗi xảy ra khi lưu. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageContainer className="space-y-5">
            {/* ── Page header ── */}
            <PageHeader
                title={isEdit ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp mới"}
                description={
                    isEdit
                        ? "Cập nhật thông tin liên hệ, địa chỉ và trạng thái hợp tác của nhà cung cấp"
                        : "Nhập thông tin để tạo nhà cung cấp mới trong hệ thống"
                }
                actions={
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate("/supplier")}
                        className="gap-1.5 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                    >
                        <ArrowLeft className="size-4" />
                        Quay lại danh sách
                    </Button>
                }
            />

            {loading && isEdit ? (
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState rows={4} label="Đang tải thông tin nhà cung cấp" />
                </div>
            ) : (
                <Form {...form}>
                    <form id="supplier-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                        {/* ── Row 1: Định danh ── */}
                        <FormSection title="Thông tin cơ bản">
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="maNhaCungCap"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-sm font-medium text-bo-foreground">
                                                Mã định danh <span className="text-bo-danger">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="VD: SUP001"
                                                    className={`${CONTROL_CLASS} font-mono`}
                                                    {...field}
                                                    disabled={isEdit}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-bo-danger" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="tenNhaCungCap"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-sm font-medium text-bo-foreground">
                                                Tên nhà cung cấp <span className="text-bo-danger">*</span>
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="VD: Công ty TNHH ABC Việt Nam"
                                                    className={CONTROL_CLASS}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-bo-danger" />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </FormSection>

                        {/* ── Row 2: Liên hệ + Địa chỉ & Trạng thái ── */}
                        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">

                            {/* Liên hệ */}
                            <FormSection title="Thông tin liên hệ" className="h-full">
                                <FormField
                                    control={form.control}
                                    name="nguoiLienHe"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-sm font-medium text-bo-foreground">
                                                Người đại diện
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="VD: Nguyễn Văn A"
                                                    className={CONTROL_CLASS}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-bo-danger" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="soDienThoai"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-sm font-medium text-bo-foreground">
                                                <Phone className="size-4 text-bo-muted" />
                                                Số điện thoại hotline
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="VD: 0987654321"
                                                    className={`${CONTROL_CLASS} font-mono`}
                                                    maxLength={15}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-bo-danger" />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-sm font-medium text-bo-foreground">
                                                <Mail className="size-4 text-bo-muted" />
                                                Email liên hệ chính
                                            </FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="VD: lienhe@abc.com.vn"
                                                    className={CONTROL_CLASS}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-xs text-bo-danger" />
                                        </FormItem>
                                    )}
                                />
                            </FormSection>

                            {/* Địa chỉ + Trạng thái */}
                            <div className="flex flex-col gap-5">
                                <FormSection title="Địa điểm">
                                    <FormField
                                        control={form.control}
                                        name="diaChi"
                                        render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormLabel className="text-sm font-medium text-bo-foreground">
                                                    Địa chỉ trụ sở chính / Kho
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="VD: Tòa nhà Detech, Số 8 Tôn Thất Thuyết, Cầu Giấy, Hà Nội..."
                                                        className="min-h-[140px] resize-y rounded-md border-bo-border bg-white text-sm text-bo-foreground shadow-none placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-xs text-bo-danger" />
                                            </FormItem>
                                        )}
                                    />
                                </FormSection>

                                {/* Trạng thái */}
                                <FormSection title="Trạng thái hoạt động">
                                    <p className="text-sm text-bo-muted">
                                        Lựa chọn chế độ kích hoạt tài khoản nhà cung cấp này
                                    </p>
                                    <StatusToggle value={trangThai} onChange={setTrangThai} />
                                </FormSection>
                            </div>
                        </div>

                        {/* ── Footer actions ── */}
                        <FormActions className="rounded-lg border border-bo-border shadow-sm">
                            <Button
                                type="button"
                                variant="outline"
                                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                                onClick={() => navigate("/supplier")}
                            >
                                Hủy
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="min-w-[140px] gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                            >
                                {loading ? (
                                    <><Loader2 className="size-4 animate-spin" />Đang lưu...</>
                                ) : (
                                    <><Save className="size-4" />{isEdit ? "Lưu thay đổi" : "Thêm mới"}</>
                                )}
                            </Button>
                        </FormActions>

                    </form>
                </Form>
            )}
        </PageContainer>
    );
}
