import { formatCurrency, formatDate } from "@/utils/formatters";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { donBanHangService } from "@/services/donBanHangService";
import apiClient from "@/services/apiClient";
import { toast } from "sonner";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import {
  ArrowLeft, Loader2, User, Calculator,
  CheckCircle2, Calendar, XCircle,
  Receipt, Hash, MapPin, SearchX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import PageContainer from "@/components/backoffice/PageContainer";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { BAO_GIA_STATUS, getBaoGiaStatus } from "@/constants/baoGia";

// ── Constants & Helpers ──────────────────────────────────────────────────
const ROLE = {
    QUAN_TRI_VIEN: "quan_tri_vien",
    QUAN_LY_KHO: "quan_ly_kho",
    NHAN_VIEN_KHO: "nhan_vien_kho",
    NHAN_VIEN_MUA_HANG: "nhan_vien_mua_hang",
    NHAN_VIEN_BAN_HANG: "nhan_vien_ban_hang",
};

function parseJwt(token) {
    try {
        const b64 = token.split(".")[1];
        return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch { return null; }
}

function parseRoles(vaiTro) {
    if (!vaiTro) return [];
    return vaiTro.includes(" ") ? vaiTro.split(" ") : [vaiTro];
}

// ── Trạng thái Báo Giá: dùng chung tên với danh sách và bản in (constants/baoGia) ──
const QUOTE_STATUS_MAP = BAO_GIA_STATUS;

export default function BaoGiaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const coDuLieuRef = useRef(false);
  const [userRoles, setUserRoles] = useState([]);

  // State cho Modal Từ chối
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  // Fetch roles
  useEffect(() => {
    const fetchUserInfo = async () => {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return;
            const payload = parseJwt(token);
            if (!payload || !payload.id) return;

            const userResponse = await apiClient.get(`/api/v1/nguoi-dung/get-by-id/${payload.id}`);
            const userData = userResponse.data?.data;
            if (userData && userData.vaiTro) {
                setUserRoles(parseRoles(userData.vaiTro));
            }
        } catch (error) {
            console.error('Lỗi khi lấy thông tin user:', error);
        }
    };
    fetchUserInfo();
  }, []);

  const isKhoRole = userRoles.includes(ROLE.QUAN_LY_KHO) || userRoles.includes(ROLE.NHAN_VIEN_KHO);

  const fetchDetail = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await donBanHangService.getDetail(id);
      setData(res.data);
      coDuLieuRef.current = true;
    }
    catch (error) {
      setLoadError(error);
      // Đang xem báo giá mà tải lại lỗi (sau khi từ chối): giữ nguyên màn, chỉ báo lỗi
      if (coDuLieuRef.current) toast.error(getApiErrorMessage(error, "Không tải được chi tiết báo giá"));
    }
  }, [id]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchDetail());
  }, [fetchDetail]);

  // ── Handlers ──
  const handleReject = async () => {
    if (!rejectReason.trim()) {
        toast.error("Vui lòng nhập lý do từ chối");
        return;
    }
    try {
      setRejectLoading(true);
      await donBanHangService.rejectQuote(id, { reason: rejectReason });
      toast.success("Đã từ chối báo giá");
      setShowRejectModal(false);
      fetchDetail();
    } catch {
      toast.error("Không thể từ chối báo giá");
    } finally {
      setRejectLoading(false);
    }
  };

  const handleApprove = () => {
      toast.success("Đang chuyển sang màn hình chốt đơn...");
      navigate(`/sales-orders/create?quoteId=${id}`);
  };

  if (!data) {
    if (!loadError) {
      return (
        <PageContainer>
          <SurfaceCard>
            <LoadingState rows={4} label="Đang tải chi tiết báo giá" />
          </SurfaceCard>
        </PageContainer>
      );
    }

    // Không tìm thấy báo giá (404) thì mời quay lại danh sách; lỗi khác cho phép thử lại
    const khongTimThay = getApiErrorStatus(loadError) === 404;
    return (
      <PageContainer className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/sales-quotations")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách báo giá
        </button>
        <SurfaceCard contentClassName="p-0 sm:p-0">
          {khongTimThay ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy báo giá"
              description="Báo giá không tồn tại hoặc đã bị xóa khỏi hệ thống."
              action={
                <Button
                  onClick={() => navigate("/sales-quotations")}
                  className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                >
                  Về danh sách báo giá
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Không tải được chi tiết báo giá"
              description={getApiErrorMessage(loadError, "Đã xảy ra lỗi khi tải báo giá. Vui lòng thử lại.")}
              onRetry={fetchDetail}
            />
          )}
        </SurfaceCard>
      </PageContainer>
    );
  }

  const { donBanHang, chiTiet } = data;
  const st = getBaoGiaStatus(donBanHang.trangThai);

  const infoRows = [
    { icon: User,     label: "Khách hàng",     value: donBanHang.khachHang?.tenKhachHang },
    { icon: Calendar, label: "Ngày lập",       value: formatDate(donBanHang.ngayDatHang) },
    { icon: MapPin,   label: "Địa chỉ dự kiến", value: donBanHang.diaChiGiaoHang || "—" },
  ];

  return (
    <PageContainer className="space-y-5">
      {/* ── Header ── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/sales-quotations")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách báo giá
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-bo-foreground">Báo giá {donBanHang.soDonHang}</h1>
            <StatusBadge label={st.label} tone={st.tone} />
          </div>

          {/* Các role thường mới thấy các nút này */}
          {!isKhoRole && (
            <div className="flex flex-wrap items-center gap-2">
              {donBanHang.trangThai === 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectModal(true)}
                    className="gap-1.5 border-bo-danger/40 bg-white text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                  >
                    <XCircle className="size-4" /> Từ chối
                  </Button>
                  <Button
                    onClick={handleApprove}
                    className="gap-1.5 bg-bo-success text-white hover:bg-bo-success/90"
                  >
                    <CheckCircle2 className="size-4" /> Chấp nhận (Chốt đơn)
                  </Button>
                </>
              )}

              <Button
                onClick={() => navigate(`/sales-quotations/${id}/print`)}
                className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
              >
                <Receipt className="size-4" /> In / PDF Báo giá
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── LEFT: Thông tin chung ── */}
        <div className="lg:col-span-1">
          <SurfaceCard title="Chi tiết báo giá" description={donBanHang.soDonHang}>
            <div className="space-y-4">
              {/* Info rows */}
              {infoRows.map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-bo-surface-subtle text-bo-muted">
                    {createElement(icon, { className: "size-3.5" })}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-bo-muted">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold leading-snug text-bo-foreground">{value}</p>
                  </div>
                </div>
              ))}

              {/* Hiển thị lý do từ chối nếu có */}
              {donBanHang.trangThai === 4 && donBanHang.lyDoTuChoi && (
                <div className="mt-4 rounded-md border border-bo-danger/30 bg-bo-danger-soft p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-bo-danger">Lý do từ chối:</p>
                  <p className="text-sm italic text-bo-danger">{donBanHang.lyDoTuChoi}</p>
                </div>
              )}

              {/* Tổng tiền */}
              <div className="space-y-2 border-t border-bo-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase text-bo-muted">Tiền hàng</span>
                  <span className="text-sm font-semibold text-bo-foreground">{formatCurrency(donBanHang.tienHang)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase text-bo-muted">Dự kiến phí VC</span>
                  <span className="text-sm font-semibold text-bo-foreground">{formatCurrency(donBanHang.phiVanChuyen)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-bo-border pt-2">
                  <span className="flex items-center gap-1 text-xs font-bold uppercase text-bo-foreground">
                    <Calculator className="size-3.5" />Tổng báo giá
                  </span>
                  <span className="text-xl font-bold text-bo-foreground">{formatCurrency(donBanHang.tongCong)}</span>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* ── RIGHT: Tables ── */}
        <div className="lg:col-span-2">
          {/* Danh mục sản phẩm */}
          <SurfaceCard
            title="Sản phẩm báo giá"
            description={`${chiTiet.length} mặt hàng trong báo giá`}
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Mặt hàng</th>
                    <th className="h-10 whitespace-nowrap px-3 text-center text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số lượng</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bo-border">
                  {chiTiet.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-bo-foreground">{item.tenSanPham}</span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-xs text-bo-muted">
                          <Hash className="size-3" />{item.sku}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-md bg-bo-surface-subtle px-2 text-xs font-bold text-bo-foreground">
                          {item.soLuongDat}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm italic text-bo-muted">
                        {formatCurrency(item.donGia)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-bold text-bo-foreground">{formatCurrency(item.thanhTien)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Modal Nhập lý do từ chối */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="border-bo-border bg-white sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bo-danger">
                <XCircle className="size-5" /> Từ chối báo giá
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <p className="text-sm text-bo-muted">Vui lòng ghi rõ lý do khách hàng không chấp nhận báo giá này để lưu trữ lịch sử.</p>
                <Textarea
                    placeholder="Khách hàng chê giá đắt / Hàng không đúng yêu cầu..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="resize-none border-bo-border bg-white text-bo-foreground placeholder:text-bo-muted focus-visible:border-bo-primary focus-visible:ring-bo-primary/15"
                />
            </div>
          </div>
          <DialogFooter className="mt-2 flex items-center justify-end gap-3 border-t border-bo-border pt-4">
            <Button
              variant="outline"
              onClick={() => setShowRejectModal(false)}
              className="h-10 border-bo-border bg-white px-4 font-semibold text-bo-foreground hover:bg-bo-surface-subtle"
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejectLoading}
              className="flex h-10 items-center bg-bo-danger px-4 font-semibold text-white hover:bg-bo-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rejectLoading ? (
                <><Loader2 className="mr-2 size-4 animate-spin" /> Đang xử lý...</>
              ) : (
                "Xác nhận từ chối"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
