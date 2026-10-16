// src/pages/stock-take/StockTakeCreate.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import PageContainer from "@/components/backoffice/PageContainer";
import SurfaceCard from "@/components/shared/SurfaceCard";
import TableShell from "@/components/shared/TableShell";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import FormActions from "@/components/shared/FormActions";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Loader2, PackageSearch, Check, CheckCircle2,
  Package, ClipboardList,
} from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { getKhoList } from "@/services/khoService";
import {
  createStockTake,
  getStockTake,
  getStockTakeDetails,
  completeStockTake,
} from "@/services/stockTakeService";

// ── Schema ────────────────────────────────────────────────────────────────
const formSchema = z.object({
  khoId: z.number({ invalid_type_error: "Vui lòng chọn kho" }).min(1, "Vui lòng chọn kho"),
  ghiChu: z.string().optional(),
});

const TH_CLASS =
  "h-10 px-4 text-[11px] font-semibold uppercase tracking-wide text-bo-muted whitespace-nowrap";

/**
 * Số lượng thực tế mặc định của một dòng khi người dùng chưa sửa ô nhập.
 * Máy chủ tạo dòng kiểm kê mới với soLuongThucTe = 0 và chưa có loại chênh lệch (chưa đếm),
 * nên dòng chưa đếm lấy tồn hệ thống; dòng đã đếm (đợt đã hoàn thành) lấy số máy chủ đã ghi.
 * Làm tròn như ô nhập (máy chủ nhận số nguyên).
 */
function soThucTeMacDinh(ct) {
  const daDem = ct.loaiChenhLech != null && ct.soLuongThucTe != null;
  return Math.round(Number(daDem ? ct.soLuongThucTe : ct.soLuongHeThong) || 0);
}

// ── Step indicator ────────────────────────────────────────────────────────
function StepIndicator({ step }) {
  const steps = [
    { label: "Chọn kho" },
    { label: "Nhập số lượng" },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, idx) => {
        const active = idx + 1 === step;
        const done   = idx + 1 <  step;
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              done   ? "bg-bo-success text-white" :
              active ? "bg-bo-primary text-white" :
                       "bg-bo-surface-subtle text-bo-muted"
            }`}>
              {done ? <Check className="size-4" /> : idx + 1}
            </div>
            <span className={`text-sm font-medium ${
              active ? "text-bo-primary" : done ? "text-bo-success" : "text-bo-muted"
            }`}>
              {s.label}
            </span>
            {idx < steps.length - 1 && (
              <div className={`mx-1 h-px w-12 ${done ? "bg-bo-success/40" : "bg-bo-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatTile({ icon, iconClass, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-bo-border bg-bo-surface p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-bo-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-bo-foreground">{value}</p>
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        {icon}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function StockTakeCreate() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [loading,       setLoading]       = useState(false);
  const [khos,          setKhos]          = useState([]);
  const [dotKiemKeId,   setDotKiemKeId]   = useState(id ? parseInt(id) : null);
  const [selectedKhoId, setSelectedKhoId] = useState(null);
  const [chiTiets,      setChiTiets]      = useState([]);
  const [updates,       setUpdates]       = useState({});
  const [isCompleted,   setIsCompleted]   = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { khoId: 0, ghiChu: "" },
  });

  const init = useCallback(async () => {
    setLoading(true);
    try {
      const khoData = await getKhoList();
      setKhos(khoData);
      if (dotKiemKeId) {
        const [dot, details] = await Promise.all([
          getStockTake(dotKiemKeId),
          getStockTakeDetails(dotKiemKeId),
        ]);
        setSelectedKhoId(dot.kho?.id);
        setIsCompleted(dot.trangThai === 1);
        setChiTiets(details);
        const initMap = {};
        details.forEach((ct) => {
          initMap[ct.id] = soThucTeMacDinh(ct);
        });
        setUpdates(initMap);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [dotKiemKeId]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn tải ngay khi mount/đổi đợt.
  useEffect(() => {
    queueMicrotask(() => init());
  }, [init]);

  const onCreate = async (values) => {
    setLoading(true);
    try {
      const newId = await createStockTake(values);
      setDotKiemKeId(newId);
      setSelectedKhoId(values.khoId);
      const details = await getStockTakeDetails(newId);
      setChiTiets(details);
      toast.success("Tạo đợt kiểm kê thành công! Hãy nhập số lượng thực tế.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Tạo đợt kiểm kê thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleSoLuongChange = (chiTietId, value) => {
    setUpdates((prev) => ({
      ...prev,
      [chiTietId]: parseInt(value) >= 0 ? parseInt(value) : 0,
    }));
  };

  // Số thực tế của một dòng: số người dùng đã nhập, chưa sửa thì đúng số đang hiện trong ô.
  // Dùng chung cho ô nhập, tổng "Thực tế đã nhập", cột chênh lệch và dữ liệu gửi khi hoàn thành.
  const layThucTe = (ct) => (updates[ct.id] !== undefined ? updates[ct.id] : soThucTeMacDinh(ct));

  const onComplete = async () => {
    if (!dotKiemKeId || !selectedKhoId) {
      toast.error("Thiếu thông tin đợt kiểm kê");
      return;
    }
    setLoading(true);
    try {
      const updateList = chiTiets.map((ct) => ({
        chiTietId: ct.id,
        soLuongThucTe: layThucTe(ct),
      }));
      await completeStockTake(dotKiemKeId, selectedKhoId, updateList);
      toast.success("Hoàn thành kiểm kê thành công.");
      navigate("/stock-take");
    } catch (err) {
      toast.error(err.response?.data?.message || "Hoàn thành kiểm kê thất bại");
    } finally {
      setLoading(false);
    }
  };

  // Stats bước 2
  const totalLo      = chiTiets.length;
  const totalHeThong = chiTiets.reduce((s, ct) => s + parseFloat(ct.soLuongHeThong ?? 0), 0);
  const totalThucTe  = chiTiets.reduce((s, ct) => s + layThucTe(ct), 0);

  return (
    <PageContainer className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate("/stock-take")}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </button>
        <StepIndicator step={dotKiemKeId ? 2 : 1} />
      </div>

      {/* ── Stats cards (bước 2) ── */}
      {dotKiemKeId && chiTiets.length > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatTile
            icon={<Package className="size-5" />}
            iconClass="bg-bo-primary-soft text-bo-primary"
            label="Tổng lô hàng"
            value={totalLo}
          />
          <StatTile
            icon={<ClipboardList className="size-5" />}
            iconClass="bg-bo-warning-soft text-bo-warning"
            label="Tồn hệ thống"
            value={totalHeThong.toLocaleString("vi-VN")}
          />
          <StatTile
            icon={<CheckCircle2 className="size-5" />}
            iconClass="bg-bo-success-soft text-bo-success"
            label="Thực tế đã nhập"
            value={totalThucTe.toLocaleString("vi-VN")}
          />
        </section>
      )}

      {/* ══ BƯỚC 1: Form tạo đợt ══ */}
      {!dotKiemKeId && (
        <SurfaceCard
          title="Thông tin đợt kiểm kê"
          description="Vui lòng điền đầy đủ thông tin bên dưới"
          contentClassName="p-0 sm:p-0"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreate)}>
              <div className="space-y-5 p-4 sm:p-5">

                <FormField
                  control={form.control}
                  name="khoId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-bo-foreground">
                        Kho kiểm kê <span className="text-bo-danger">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(parseInt(v))}
                        defaultValue={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 border-bo-border bg-white text-bo-foreground focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15">
                            <SelectValue placeholder="Chọn kho..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent
                          position="popper"
                          className="z-50 rounded-lg border border-bo-border bg-white shadow-lg"
                        >
                          {khos.map((kho) => (
                            <SelectItem
                              key={kho.id}
                              value={kho.id.toString()}
                              className="cursor-pointer text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900 data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-900"
                            >
                              {kho.tenKho}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs text-bo-danger" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ghiChu"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold text-bo-foreground">Ghi chú</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Ghi chú thêm (nếu có)..."
                          className="resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormActions className="mt-0 rounded-b-lg">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                  onClick={() => navigate("/stock-take")}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 min-w-[160px] gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-70"
                >
                  {loading
                    ? <><Loader2 className="size-4 animate-spin" />Đang tạo...</>
                    : <><PackageSearch className="size-4" />Tạo đợt kiểm kê</>
                  }
                </Button>
              </FormActions>
            </form>
          </Form>
        </SurfaceCard>
      )}

      {/* ══ BƯỚC 2: Nhập số lượng ══ */}
      {dotKiemKeId && (
        <TableShell
          title="Danh sách lô hàng"
          description="Nhập số lượng thực tế đếm được cho từng lô"
          footer={chiTiets.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-bo-muted">
                Tổng{" "}
                <span className="font-semibold text-bo-primary">{chiTiets.length}</span>{" "}
                lô hàng
              </p>
              {!isCompleted && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-bo-border bg-white font-medium text-bo-foreground hover:bg-bo-surface-subtle"
                    onClick={() => navigate("/stock-take")}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    disabled={loading}
                    className="h-9 min-w-[180px] gap-2 bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover disabled:opacity-70"
                    onClick={onComplete}
                  >
                    {loading
                      ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
                      : <><CheckCircle2 className="size-4" />Hoàn thành kiểm kê</>
                    }
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        >
          {loading ? (
            <LoadingState rows={6} label="Đang tải danh sách lô hàng" />
          ) : chiTiets.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="Kho không có hàng tồn kho"
              description="Kho này hiện không có lô hàng nào để kiểm kê."
            />
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-bo-border bg-bo-surface-subtle">
                  <th className={`${TH_CLASS} text-left`}>Sản phẩm / Biến thể</th>
                  <th className={`${TH_CLASS} text-left`}>Mã SKU</th>
                  <th className={`${TH_CLASS} text-left`}>Mã lô</th>
                  <th className={`${TH_CLASS} text-right`}>Tồn hệ thống</th>
                  <th className={`${TH_CLASS} text-right`}>Số lượng thực tế</th>
                  <th className={`${TH_CLASS} text-right`}>Chênh lệch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {chiTiets.map((ct) => {
                  const tonHeThong = parseFloat(ct.soLuongHeThong ?? 0);
                  const thucTe     = layThucTe(ct);
                  const chenhLech  = thucTe - tonHeThong;
                  const hasInput   = updates[ct.id] !== undefined;

                  return (
                    <tr key={ct.id} className="transition-colors hover:bg-bo-surface-subtle">

                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-semibold text-bo-foreground">
                          {ct.bienTheSanPham?.tenBienThe || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-mono text-xs text-bo-muted">
                          {ct.bienTheSanPham?.maSku || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 align-middle">
                        <span className="font-mono text-xs text-bo-muted">
                          {ct.loHang?.maLo || "—"}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        <span className="inline-flex items-center justify-end rounded-md bg-bo-surface-subtle px-2.5 py-1">
                          <span className="text-xs font-semibold text-slate-800">
                            {tonHeThong.toLocaleString("vi-VN")}
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        {isCompleted ? (
                          <span className="inline-flex items-center justify-end rounded-md bg-bo-surface-subtle px-2.5 py-1">
                            <span className="text-xs font-semibold text-slate-800">
                              {thucTe.toLocaleString("vi-VN")}
                            </span>
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            defaultValue={thucTe}
                            onChange={(e) => handleSoLuongChange(ct.id, e.target.value)}
                            className="ml-auto w-28 border-bo-border bg-white text-right text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                          />
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right align-middle">
                        {(isCompleted || hasInput) ? (
                          <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${
                            chenhLech > 0
                              ? "bg-bo-success-soft text-bo-success"
                              : chenhLech < 0
                                ? "bg-bo-danger-soft text-bo-danger"
                                : "bg-bo-surface-subtle text-bo-muted"
                          }`}>
                            {chenhLech > 0 ? "+" : ""}
                            {chenhLech.toLocaleString("vi-VN")}
                          </span>
                        ) : (
                          <span className="text-xs text-bo-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </TableShell>
      )}
    </PageContainer>
  );
}
