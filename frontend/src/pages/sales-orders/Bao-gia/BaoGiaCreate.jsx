import { formatCurrency } from "@/utils/formatters";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Plus, Trash2, ArrowLeft, Truck, Check, Loader2, Package,
} from "lucide-react";
import { donBanHangService } from "@/services/donBanHangService";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormActions from "@/components/shared/FormActions";
import SearchInput from "@/components/shared/SearchInput";
import SurfaceCard from "@/components/shared/SurfaceCard";

export default function BaoGiaCreate() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [formData, setFormData] = useState({
    khachHangId: "", phiVanChuyen: 0,
    diaChiGiaoHang: "", ghiChu: "",
  });
  const [orderItems, setOrderItems] = useState([]);

  const loadData = useCallback(async () => {
    try {
      const [variantRes, customerRes] = await Promise.all([
        donBanHangService.getVariantsForCreate(),
        donBanHangService.getCustomersForCreate(),
      ]);
      setVariants(variantRes?.data?.data || []);
      setCustomers(customerRes?.data?.data || []);
    } catch { toast.error("Không thể tải dữ liệu hệ thống"); }
  }, []);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => loadData());
  }, [loadData]);

  const selectedCustomer = useMemo(() =>
    customers.find(c => c.id === Number(formData.khachHangId)),
    [customers, formData.khachHangId]);

  const filteredCustomers = useMemo(() => {
    const lower = customerSearch.toLowerCase();
    if (!lower.trim()) return [];
    return customers.filter(c =>
      c.tenKhachHang?.toLowerCase().includes(lower) || c.soDienThoai?.includes(lower)
    );
  }, [customerSearch, customers]);

  const filteredProducts = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return variants.filter(v =>
      v.tenSanPham?.toLowerCase().includes(lower) || v.maBienThe?.toLowerCase().includes(lower)
    );
  }, [searchTerm, variants]);

  const handleSelectCustomer = (c) => {
    setFormData(prev => ({ ...prev, khachHangId: c.id, diaChiGiaoHang: c.diaChi || "" }));
    setCustomerSearch(c.tenKhachHang);
    setShowCustomerDropdown(false);
  };

  const handleAddProduct = (product) => {
    if (orderItems.some(i => i.bienTheSanPhamId === product.id)) {
      toast.warning("Sản phẩm này đã có trong danh sách");
      return;
    }
    setOrderItems(prev => [...prev, {
      bienTheSanPhamId: product.id,
      maBienThe: product.maBienThe,
      tenSanPham: product.tenSanPham,
      soLuongDat: 1,
      giaGoc: product.giaBan,
      donGia: product.giaBan,
      thanhTien: product.giaBan,
    }]);
    setShowProductDialog(false);
  };

  const handleUpdateQty = (index, value) => {
    const qty = value === "" ? 0 : Number(value);
    setOrderItems(prev => {
      const updated = [...prev];
      updated[index].soLuongDat = qty;
      updated[index].thanhTien = qty * updated[index].donGia;
      return updated;
    });
  };

  const handleUpdatePrice = (index, value) => {
    const price = value === "" ? 0 : Number(value);
    setOrderItems(prev => {
      const updated = [...prev];
      updated[index].donGia = price;
      updated[index].thanhTien = price * updated[index].soLuongDat;
      return updated;
    });
  };

  const totalProductMoney = orderItems.reduce((sum, i) => sum + i.thanhTien, 0);
  const totalOrderMoney = totalProductMoney + Number(formData.phiVanChuyen || 0);

  async function handleCreate() {
    if (!formData.khachHangId) return toast.error("Vui lòng chọn khách hàng");
    if (orderItems.length === 0) return toast.error("Chưa có sản phẩm nào trong báo giá");
    for (const item of orderItems) {
      const minPrice = item.giaGoc * 0.9;
      const maxPrice = item.giaGoc * 1.1;

      if (item.donGia < minPrice) {
        return toast.error(`Sản phẩm "${item.tenSanPham}" có giá bán quá thấp. Tối thiểu là ${formatCurrency(minPrice)}`);
      }
      if (item.donGia > maxPrice) {
        return toast.error(`Sản phẩm "${item.tenSanPham}" có giá bán quá cao. Tối đa là ${formatCurrency(maxPrice)}`);
      }
    }
    try {
      setLoading(true);
      await donBanHangService.create({
        loaiChungTu: "bao_gia", // Đánh dấu là báo giá
        khachHangId: parseInt(formData.khachHangId),
        khoXuatId: null, // Báo giá không cần kho xuất
        phiVanChuyen: formData.phiVanChuyen === "" ? 0 : Number(formData.phiVanChuyen),
        diaChiGiaoHang: formData.diaChiGiaoHang?.trim() || "",
        ghiChu: formData.ghiChu?.trim() || "",
        chiTiet: orderItems.map(item => ({
          bienTheSanPhamId: parseInt(item.bienTheSanPhamId),
          soLuongDat: parseInt(item.soLuongDat),
          donGia: parseFloat(item.donGia),
        })),
      });
      toast.success("Tạo báo giá thành công");
      navigate("/sales-quotations");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.errors?.[0] || "Lỗi tạo báo giá");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer className="space-y-5">
      {/* ── Header ── */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => navigate("/sales-quotations")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách báo giá
        </button>
        <PageHeader
          className="mb-0"
          title="Tạo báo giá mới"
          description="Lập báo giá gửi khách hàng từ danh mục biến thể sản phẩm"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── LEFT: Thông tin ── */}
        <div className="lg:col-span-1">
          <SurfaceCard
            title="Khách hàng & giao nhận"
            description="Chọn khách hàng cần báo giá"
          >
            <div className="space-y-5">
              {/* Khách hàng */}
              <div className="relative space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Khách hàng *
                </Label>
                <SearchInput
                  placeholder="Tên hoặc SĐT khách hàng..."
                  className="sm:max-w-none"
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-[85%] overflow-y-auto rounded-lg border border-bo-border bg-white shadow-lg">
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c)}
                        className="flex cursor-pointer items-center justify-between border-b border-bo-border px-4 py-2.5 transition-colors last:border-0 hover:bg-bo-surface-subtle"
                      >
                        <div>
                          <div className="text-sm font-semibold text-bo-foreground">{c.tenKhachHang}</div>
                          <div className="text-xs text-bo-muted">{c.soDienThoai}</div>
                        </div>
                        {formData.khachHangId === c.id && <Check className="size-4 text-bo-success" />}
                      </div>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="mt-2 space-y-2 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-xs text-bo-muted">
                    <div className="flex justify-between gap-3">
                      <span>SĐT:</span>
                      <b className="text-bo-foreground">{selectedCustomer.soDienThoai}</b>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="shrink-0">Địa chỉ gốc:</span>
                      <b className="ml-4 max-w-[180px] text-right text-bo-foreground">{selectedCustomer.diaChi}</b>
                    </div>
                  </div>
                )}
              </div>

              {/* Phí vận chuyển */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  <Truck className="size-3" /> Phí vận chuyển
                </Label>
                <Input
                  type="number"
                  value={formData.phiVanChuyen}
                  onChange={(e) => setFormData({ ...formData, phiVanChuyen: e.target.value })}
                  className="h-10 border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                />
              </div>

              {/* Địa chỉ nhận */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Địa chỉ nhận hàng
                </Label>
                <Input
                  value={formData.diaChiGiaoHang}
                  placeholder="Nhập địa chỉ cụ thể..."
                  onChange={(e) => setFormData({ ...formData, diaChiGiaoHang: e.target.value })}
                  className="h-10 border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                />
              </div>

              {/* Ghi chú */}
              <div className="space-y-1.5 border-t border-bo-border pt-5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Ghi chú báo giá
                </Label>
                <Textarea
                  value={formData.ghiChu}
                  onChange={(e) => setFormData({ ...formData, ghiChu: e.target.value })}
                  className="resize-none border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                  rows={3}
                />
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* ── RIGHT: Chi tiết ── */}
        <div className="lg:col-span-2">
          <SurfaceCard
            title="Chi tiết mặt hàng"
            description="Sản phẩm và số lượng báo giá"
            action={
              <Button
                onClick={() => setShowProductDialog(true)}
                className="h-9 gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
              >
                <Plus className="size-4" /> Thêm sản phẩm
              </Button>
            }
            className="flex min-h-[400px] flex-col"
            contentClassName="p-0"
          >
            {orderItems.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Chưa có sản phẩm nào"
                description='Nhấn "Thêm sản phẩm" để lập báo giá.'
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-bo-border bg-bo-surface-subtle">
                        <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                        <th className="h-10 w-28 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng</th>
                        <th className="h-10 w-36 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                        <th className="h-10 w-36 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
                        <th className="h-10 w-12 px-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bo-border">
                      {orderItems.map((item, index) => (
                        <tr key={index} className="transition-colors hover:bg-bo-surface-subtle">
                          <td className="px-3 py-3">
                            <span className="font-semibold text-bo-foreground">{item.tenSanPham}</span>
                            <span className="mt-0.5 block font-mono text-xs text-bo-muted">{item.maBienThe}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="number" min="1" value={item.soLuongDat}
                              onChange={(e) => handleUpdateQty(index, e.target.value)}
                              className="h-9 w-20 rounded-md border border-bo-border bg-white text-center font-semibold text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <input
                              type="number" value={item.donGia}
                              onChange={(e) => handleUpdatePrice(index, e.target.value)}
                              className="h-9 w-28 rounded-md border border-bo-border bg-white px-2 text-right font-medium text-bo-foreground focus:border-bo-primary focus:outline-none focus:ring-2 focus:ring-bo-primary/15"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-bold text-bo-foreground">{formatCurrency(item.thanhTien)}</span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== index))}
                              className="inline-flex size-8 items-center justify-center rounded-md border border-bo-border text-bo-muted transition-colors hover:border-bo-danger hover:text-bo-danger"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-auto space-y-2 border-t border-bo-border bg-bo-surface-subtle px-4 py-4 sm:px-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-bo-muted">Tổng tiền hàng:</span>
                    <span className="font-semibold text-bo-foreground">{formatCurrency(totalProductMoney)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-bo-muted">Phí vận chuyển:</span>
                    <span className="font-semibold text-bo-foreground">{formatCurrency(Number(formData.phiVanChuyen) || 0)}</span>
                  </div>
                  <div className="flex justify-between border-t border-bo-border pt-3 text-base">
                    <span className="font-bold text-bo-foreground">Tổng báo giá</span>
                    <span className="text-xl font-bold text-bo-primary">{formatCurrency(totalOrderMoney)}</span>
                  </div>
                </div>
              </>
            )}
          </SurfaceCard>
        </div>
      </div>

      {/* ── Footer actions ── */}
      <FormActions>
        <Button
          onClick={handleCreate}
          disabled={loading}
          className="min-w-[200px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
        >
          {loading
            ? <><Loader2 className="size-4 animate-spin" />Đang tạo...</>
            : "Lưu báo giá"
          }
        </Button>
      </FormActions>

      {/* ── Product Dialog ── */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-2xl overflow-hidden border border-bo-border bg-white p-0 shadow-lg">
          <div className="flex items-center gap-3 border-b border-bo-border bg-bo-surface-subtle px-6 py-5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bo-primary-soft">
              <Package className="size-4 text-bo-primary" />
            </div>
            <div>
              <p className="font-semibold leading-snug text-bo-foreground">Tìm kiếm sản phẩm</p>
              <p className="mt-0.5 text-xs text-bo-muted">Chọn biến thể từ danh mục hệ thống</p>
            </div>
          </div>

          <div className="px-6 py-4">
            <SearchInput
              placeholder="Nhập tên sản phẩm hoặc mã SKU..."
              className="sm:max-w-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto border-t border-bo-border">
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Không tìm thấy sản phẩm"
                description="Thử từ khóa khác hoặc kiểm tra lại danh mục biến thể."
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className="h-10 px-6 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                    <th className="h-10 px-4 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Giá bán</th>
                    <th className="h-10 w-24 px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-bo-border">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                    >
                      <td className="px-6 py-3">
                        <span className="font-semibold leading-snug text-bo-foreground">{product.tenSanPham}</span>
                        <span className="mt-0.5 block font-mono text-xs text-bo-primary">{product.maBienThe}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-bo-muted">{formatCurrency(product.giaBan)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleAddProduct(product); }}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-bo-primary px-3 text-xs font-bold text-white transition-colors hover:bg-bo-primary-hover"
                        >
                          Chọn
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-bo-border bg-bo-surface-subtle px-6 py-4">
            <p className="text-sm text-bo-muted">
              <span className="font-semibold text-bo-primary">{filteredProducts.length}</span> kết quả
            </p>
            <button
              type="button"
              onClick={() => { setShowProductDialog(false); setSearchTerm(""); }}
              className="inline-flex h-8 items-center justify-center rounded-md border border-bo-border bg-white px-4 text-sm font-semibold text-bo-foreground transition-colors hover:bg-bo-surface-subtle"
            >
              Đóng
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
