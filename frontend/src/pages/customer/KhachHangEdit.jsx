// src/pages/customer/KhachHangEdit.jsx
import { createElement, useState, useEffect, useCallback, useRef } from 'react';
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
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ArrowLeft, Save, User, Phone, Mail, MapPin, Users, Building, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getKhachHangById, updateKhachHang } from "@/services/khachHangService";
import { PHONE_ERROR_MESSAGE, isPhoneValid, sanitizePhoneInput } from "@/utils/phoneValidation";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import FormActions from "@/components/shared/FormActions";
import FormSection from "@/components/shared/FormSection";
import LoadingState from "@/components/shared/LoadingState";

// Cùng quy tắc email với form "Thêm khách hàng" và backend
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SĐT/email để trống là hợp lệ (backend lưu NULL). SĐT dùng chung quy tắc di động 10 số;
// riêng SĐT cũ không bị sửa thì cho qua (getOriginalPhone) để dữ liệu định dạng cũ
// không chặn việc sửa các trường khác — backend cũng chỉ kiểm tra khi SĐT thực sự đổi.
const buildFormSchema = (getOriginalPhone) => z.object({
  tenKhachHang: z.string().trim().min(1, "Tên khách hàng không được để trống").max(200),
  nguoiLienHe: z.string().trim().max(100).optional(),
  soDienThoai: z.string().trim()
    .refine((value) => value === getOriginalPhone() || isPhoneValid(value), PHONE_ERROR_MESSAGE),
  email: z.string().trim().max(100, "Email tối đa 100 ký tự")
    .refine((value) => !value || EMAIL_REGEX.test(value), "Email không hợp lệ"),
  diaChi: z.string().trim().optional(),
  loaiKhachHang: z.enum(["le", "si", "doanh_nghiep"], {
    error: "Vui lòng chọn loại khách hàng hợp lệ",
  }),
  trangThai: z.number().optional(),
});

const LOAI_OPTIONS = [
  { value: "le",           label: "Cá nhân",     sub: "Khách lẻ",         Icon: User },
  { value: "si",           label: "Sỉ",          sub: "Mua số lượng lớn", Icon: Users },
  { value: "doanh_nghiep", label: "Doanh nghiệp", sub: "Công ty, đối tác", Icon: Building },
];

export default function KhachHangEdit() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // SĐT đang lưu trên server (sau trim) — để schema cho qua khi người dùng không sửa SĐT
  const originalPhoneRef = useRef("");
  const [formSchema] = useState(() => buildFormSchema(() => originalPhoneRef.current));

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenKhachHang: "", nguoiLienHe: "", soDienThoai: "",
      email: "", diaChi: "", loaiKhachHang: "le", trangThai: 0,
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKhachHangById(id);
      originalPhoneRef.current = (data.soDienThoai || "").trim();
      form.reset({
        tenKhachHang: data.tenKhachHang || "",
        nguoiLienHe:  data.nguoiLienHe  || "",
        soDienThoai:  data.soDienThoai  || "",
        email:        data.email        || "",
        diaChi:       data.diaChi       || "",
        loaiKhachHang: data.loaiKhachHang || "le",
        trangThai:    data.trangThai    || 0,
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tải thông tin khách hàng");
      navigate("/customers");
    } finally {
      setLoading(false);
    }
  }, [id, form, navigate]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchData());
  }, [fetchData]);

  const onSubmit = async (values) => {
    setLoading(true);
    try {
      await updateKhachHang(id, values);
      toast.success("Cập nhật khách hàng thành công!");
      navigate(`/customers/${id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Có lỗi xảy ra khi cập nhật");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="mx-auto max-w-3xl space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate(`/customers/${id}`)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại chi tiết
        </button>
        <PageHeader
          className="mb-0"
          title="Chỉnh sửa khách hàng"
          description="Cập nhật thông tin chi tiết của khách hàng"
        />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormSection title="Thông tin khách hàng" description="Các trường có dấu * là bắt buộc">
            {loading ? (
              <LoadingState rows={4} label="Đang tải thông tin khách hàng" />
            ) : (
              <div className="space-y-5">
                {/* Tên khách hàng */}
                <FormField control={form.control} name="tenKhachHang" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                      <User className="size-4 text-bo-muted" /> Tên khách hàng <span className="text-bo-danger">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Người liên hệ */}
                <FormField control={form.control} name="nguoiLienHe" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-bo-foreground">Người liên hệ</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Số điện thoại */}
                <FormField control={form.control} name="soDienThoai" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                      <Phone className="size-4 text-bo-muted" /> Số điện thoại
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                        {...field}
                        // Chỉ nhận chữ số, tối đa 10 (SĐT cũ dài hơn vẫn hiển thị nguyên cho tới khi sửa)
                        onChange={(e) => field.onChange(sanitizePhoneInput(e.target.value))}
                        inputMode="numeric"
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Email */}
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                      <Mail className="size-4 text-bo-muted" /> Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Địa chỉ */}
                <FormField control={form.control} name="diaChi" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                      <MapPin className="size-4 text-bo-muted" /> Địa chỉ
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Loại khách hàng */}
                <FormField control={form.control} name="loaiKhachHang" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                      <Users className="size-4 text-bo-muted" /> Loại khách hàng
                    </FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                      >
                        {LOAI_OPTIONS.map(({ value, label, sub, Icon }) => (
                          <FormItem key={value}>
                            <FormControl>
                              <RadioGroupItem value={value} id={value} className="peer sr-only" />
                            </FormControl>
                            <FormLabel
                              htmlFor={value}
                              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-bo-border bg-white p-4 text-center transition-colors hover:border-bo-primary hover:bg-bo-primary-soft peer-data-[state=checked]:border-bo-primary peer-data-[state=checked]:bg-bo-primary-soft"
                            >
                              {createElement(Icon, { className: "mb-2 size-7 text-bo-muted peer-data-[state=checked]:text-bo-primary" })}
                              <span className="text-sm font-bold text-bo-foreground">{label}</span>
                              <span className="mt-0.5 text-xs text-bo-muted">{sub}</span>
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage className="text-xs text-bo-danger" />
                  </FormItem>
                )} />

                {/* Trạng thái */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                  <span className="text-sm font-semibold text-bo-foreground">Trạng thái hoạt động</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${form.watch("trangThai") === 1 ? "text-bo-success" : "text-bo-muted"}`}>
                      {form.watch("trangThai") === 1 ? "Hoạt động" : "Ngừng hoạt động"}
                    </span>
                    <Switch
                      checked={form.watch("trangThai") === 1}
                      onCheckedChange={(checked) => form.setValue("trangThai", checked ? 1 : 0)}
                      className="data-[state=checked]:bg-bo-success"
                    />
                  </div>
                </div>
              </div>
            )}
          </FormSection>

          <FormActions className="rounded-b-lg border border-t-0 border-bo-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/customers/${id}`)}
              className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="min-w-[140px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              {loading
                ? <><Loader2 className="size-4 animate-spin" />Đang lưu...</>
                : <><Save className="size-4" />Cập nhật</>
              }
            </Button>
          </FormActions>
        </form>
      </Form>
    </PageContainer>
  );
}
