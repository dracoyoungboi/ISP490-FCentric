import { formatCurrency } from "@/utils/formatters";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Search, ShoppingCart,
  Truck, Check, Warehouse, Home, Loader2, ChevronDown,
} from "lucide-react";
import { donBanHangService } from "@/services/donBanHangService";
import { getKhoList } from "@/services/khoService";
import { laKhoGiaoDich } from "@/utils/kho";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import FormActions from "@/components/shared/FormActions";
import LoadingState from "@/components/shared/LoadingState";
import SurfaceCard from "@/components/shared/SurfaceCard";

export default function DonBanHangCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuoteId = searchParams.get("quoteId");
  const [pendingQuotes, setPendingQuotes] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState("");
  const [showQuoteDropdown, setShowQuoteDropdown] = useState(false);

  const [warehouseSearch, setWarehouseSearch] = useState("");
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);

  const [selectedQuoteId, setSelectedQuoteId] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orderItems, setOrderItems] = useState([]);

  const [formData, setFormData] = useState({
    khoXuatId: "", phiVanChuyen: 0,
    diaChiGiaoHang: "", ghiChu: "",
  });

  const handleSelectQuote = useCallback(async (quote) => {
    setQuoteSearch(`${quote.soDonHang} - ${quote.khachHang?.tenKhachHang || 'Khách lẻ'}`);
    setShowQuoteDropdown(false);
    setSelectedQuoteId(quote.id);
    setSelectedCustomer(quote.khachHang);

    try {
      setLoading(true);
      const res = await donBanHangService.getDetail(quote.id);
      const detail = res.data?.donBanHang;
      const chiTiet = res.data?.chiTiet || [];

      setFormData(prev => ({
        ...prev,
        phiVanChuyen: detail.phiVanChuyen || 0,
        diaChiGiaoHang: detail.diaChiGiaoHang || "",
        ghiChu: detail.ghiChu || "",
      }));

      setOrderItems(chiTiet.map(item => ({
        ...item,
        tenSanPham: item.tenSanPham || "",
        maBienThe: item.sku || "",
        thanhTien: item.soLuongDat * item.donGia
      })));
    } catch {
      toast.error("Lỗi khi tải chi tiết báo giá");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      // Fetch các báo giá đang Chờ phản hồi
      const payload = {
        page: 0, size: 100,
        filters: [
          { fieldName: "loaiChungTu", operation: "EQUALS", value: "bao_gia" },
          { fieldName: "trangThai", operation: "EQUALS", value: 0 }
        ]
      };
      const [quotesRes, warehouseRes] = await Promise.all([
        donBanHangService.filter(payload),
        getKhoList(),
      ]);

      const quotes = quotesRes?.content || [];
      setPendingQuotes(quotes);
      setWarehouses((warehouseRes || []).filter(laKhoGiaoDich));

      if (initialQuoteId) {
        let targetQuote = quotes.find(q => q.id.toString() === initialQuoteId);

        if (!targetQuote) {
            const detailRes = await donBanHangService.getDetail(initialQuoteId);
            targetQuote = detailRes.data?.donBanHang;
        }
        if (targetQuote) {
            handleSelectQuote(targetQuote);
        }
      }

    } catch {
      toast.error("Không thể tải dữ liệu hệ thống");
    }
  }, [initialQuoteId, handleSelectQuote]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => loadData());
  }, [loadData]);

  const filteredQuotes = useMemo(() => {
    const lower = quoteSearch.toLowerCase();
    if (!lower.trim()) return pendingQuotes;
    return pendingQuotes.filter(q =>
      q.soDonHang?.toLowerCase().includes(lower) ||
      q.khachHang?.tenKhachHang?.toLowerCase().includes(lower)
    );
  }, [quoteSearch, pendingQuotes]);

  const filteredWarehouses = useMemo(() => {
    const lower = warehouseSearch.toLowerCase();
    if (!lower.trim()) return warehouses;
    return warehouses.filter(w =>
      w.tenKho?.toLowerCase().includes(lower) || w.maKho?.toLowerCase().includes(lower)
    );
  }, [warehouseSearch, warehouses]);

  const handleSelectWarehouse = (w) => {
    setFormData(prev => ({ ...prev, khoXuatId: w.id }));
    setWarehouseSearch(w.tenKho);
    setShowWarehouseDropdown(false);
  };

  const totalProductMoney = orderItems.reduce((sum, i) => sum + i.thanhTien, 0);
  const totalOrderMoney = totalProductMoney + Number(formData.phiVanChuyen || 0);

  async function handleCreateOrder() {
    if (!selectedQuoteId) return toast.error("Vui lòng chọn báo giá để tạo đơn");
    if (!formData.khoXuatId) return toast.error("Vui lòng chọn kho xuất hàng");

    try {
      setLoading(true);
      await donBanHangService.convertToOrder(selectedQuoteId, {
        khoXuatId: parseInt(formData.khoXuatId),
        phiVanChuyen: Number(formData.phiVanChuyen),
        ghiChu: formData.ghiChu,
        diaChiGiaoHang: formData.diaChiGiaoHang
      });

      toast.success("Tạo đơn bán hàng thành công");
      navigate("/sales-orders");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.errors?.[0] || "Lỗi tạo đơn hàng");
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
          onClick={() => navigate("/sales-orders")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách đơn bán hàng
        </button>
        <PageHeader
          className="mb-0"
          title="Tạo đơn bán hàng"
          description="Chọn báo giá đang chờ phản hồi và kho xuất hàng để chuyển thành đơn bán"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── LEFT: Thông tin khởi tạo ── */}
        <div className="lg:col-span-1">
          <SurfaceCard
            title="Thông tin khởi tạo"
            description="Chọn báo giá và kho xuất"
          >
            <div className="space-y-5">
              {/* Chọn báo giá */}
              <div className="relative space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Chọn báo giá *
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 size-4 text-bo-muted" />
                  <Input
                    placeholder="Tìm theo mã BG hoặc tên KH..."
                    value={quoteSearch}
                    onChange={(e) => { setQuoteSearch(e.target.value); setShowQuoteDropdown(true); }}
                    onFocus={() => setShowQuoteDropdown(true)}
                    className="h-10 border-bo-border bg-bo-surface pr-8 pl-9 font-semibold text-bo-primary placeholder:font-normal placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                  />
                  <ChevronDown className="absolute right-3 top-3 size-4 text-bo-muted" />
                </div>
                {showQuoteDropdown && filteredQuotes.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-bo-border bg-bo-surface shadow-lg">
                    {filteredQuotes.map(q => (
                      <div
                        key={q.id}
                        onClick={() => handleSelectQuote(q)}
                        className="cursor-pointer border-b border-bo-border px-4 py-3 transition-colors last:border-0 hover:bg-bo-surface-subtle"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-bo-primary">{q.soDonHang}</span>
                          <span className="text-xs font-semibold text-bo-muted">{formatCurrency(q.tongCong)}</span>
                        </div>
                        <div className="mt-1 text-xs text-bo-muted">{q.khachHang?.tenKhachHang || 'Khách lẻ'}</div>
                      </div>
                    ))}
                  </div>
                )}
                {filteredQuotes.length === 0 && showQuoteDropdown && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-bo-border bg-bo-surface p-4 text-center text-sm text-bo-muted shadow-lg">
                    Không có báo giá nào đang chờ
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="space-y-2 rounded-md border border-bo-border bg-bo-surface-subtle p-3 text-xs text-bo-muted">
                  <div className="flex justify-between gap-3">
                    <span>Khách hàng:</span>
                    <b className="text-bo-foreground">{selectedCustomer.tenKhachHang}</b>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>SĐT:</span>
                    <b className="text-bo-foreground">{selectedCustomer.soDienThoai}</b>
                  </div>
                </div>
              )}

              <div className="border-t border-bo-border" />

              {/* Kho xuất */}
              <div className="relative space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  <Warehouse className="size-3" /> Kho xuất hàng *
                </Label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 size-4 text-bo-muted" />
                  <Input
                    placeholder="Gõ tên hoặc mã kho..."
                    value={warehouseSearch}
                    onChange={(e) => { setWarehouseSearch(e.target.value); setShowWarehouseDropdown(true); }}
                    onFocus={() => setShowWarehouseDropdown(true)}
                    className="h-10 border-bo-border bg-bo-surface pl-9 text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                  />
                </div>
                {showWarehouseDropdown && filteredWarehouses.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-bo-border bg-bo-surface shadow-lg">
                    {filteredWarehouses.map(w => (
                      <div
                        key={w.id}
                        onClick={() => handleSelectWarehouse(w)}
                        className="flex cursor-pointer items-center justify-between border-b border-bo-border px-4 py-2.5 transition-colors last:border-0 hover:bg-bo-surface-subtle"
                      >
                        <div>
                          <div className="text-sm font-semibold text-bo-foreground">{w.tenKho}</div>
                          <div className="font-mono text-xs text-bo-muted">{w.maKho}</div>
                        </div>
                        {formData.khoXuatId === w.id && <Check className="size-4 text-bo-success" />}
                      </div>
                    ))}
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
                  className="h-10 border-bo-border bg-bo-surface text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                />
              </div>

              {/* Địa chỉ nhận */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Địa chỉ nhận hàng
                </Label>
                <Input
                  value={formData.diaChiGiaoHang}
                  onChange={(e) => setFormData({ ...formData, diaChiGiaoHang: e.target.value })}
                  className="h-10 border-bo-border bg-bo-surface text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                />
              </div>

              {/* Ghi chú */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Ghi chú đơn hàng
                </Label>
                <Textarea
                  value={formData.ghiChu}
                  onChange={(e) => setFormData({ ...formData, ghiChu: e.target.value })}
                  className="resize-none border-bo-border bg-bo-surface text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                  rows={3}
                />
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* ── RIGHT: Chi tiết đơn hàng (Từ báo giá) ── */}
        <div className="lg:col-span-2">
          <SurfaceCard
            title="Chi tiết đơn hàng"
            description="Dữ liệu được kế thừa tự động từ báo giá"
            contentClassName="p-0"
            className="flex min-h-[400px] flex-col"
          >
            {loading ? (
              <LoadingState rows={4} label="Đang tải chi tiết báo giá" />
            ) : orderItems.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Chưa chọn báo giá"
                description="Vui lòng tìm và chọn một báo giá bên trái để hiển thị sản phẩm."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-bo-border bg-bo-surface-subtle">
                        <th className="h-10 px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Sản phẩm</th>
                        <th className="h-10 px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng</th>
                        <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                        <th className="h-10 px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
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
                            <span className="inline-block rounded-md bg-bo-surface-subtle px-3 py-1 font-bold text-bo-foreground">
                              {item.soLuongDat}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-semibold text-bo-muted">{formatCurrency(item.donGia)}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <span className="font-bold text-bo-primary">{formatCurrency(item.thanhTien)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer tổng tiền */}
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
                    <span className="font-bold text-bo-foreground">Tổng thanh toán</span>
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
          onClick={handleCreateOrder}
          disabled={loading || !selectedQuoteId}
          className="min-w-[200px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover"
        >
          {loading
            ? <><Loader2 className="size-4 animate-spin" />Đang xử lý...</>
            : "Xác nhận tạo đơn hàng"
          }
        </Button>
      </FormActions>
    </PageContainer>
  );
}
