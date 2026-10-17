import { formatCurrency, formatDate } from "@/utils/formatters";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { donBanHangService } from "@/services/donBanHangService";
import { donBanHangKenhService, isChannelOrderMock } from "@/services/donBanHangKenhService";
import { phieuXuatKhoService } from "@/services/phieuXuatKhoService";
import apiClient from "@/services/apiClient";
import { laKhoAo } from "@/utils/kho";
import { toast } from "@/lib/thongBaoNhanh";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import {
  ArrowLeft, User, Home, Truck, Calculator,
  CheckCircle2, Calendar, Send, XCircle,
  Receipt, Hash, MapPin, ArrowRightLeft, Undo2, AlertTriangle, Store, SearchX, PackageCheck, ClipboardList
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmModal from "@/components/ui/confirm-modal";

import PageContainer from "@/components/backoffice/PageContainer";
import PageHeader from "@/components/backoffice/PageHeader";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import SurfaceCard from "@/components/shared/SurfaceCard";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelOrderPanel from "@/components/channel/ChannelOrderPanel";
import { parseFlags } from "@/constants/channel";
import { DON_BAN_HANG_STATUS, getDonBanHangStatus } from "@/constants/donBanHang";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { TRANG_THAI_DON, TRANG_THAI_PHIEU_XUAT } from "@/constants/trangThaiXuatBan";

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

// ── Trạng thái: dùng chung tên với danh sách và hóa đơn in (constants/donBanHang) ──
const STATUS_MAP = DON_BAN_HANG_STATUS;

/** Đơn đã gom vào phiếu nhặt (kể cả đã nhặt xong) không hủy được (khớp DonBanHangService.cancel). */
const PHIEU_NHAT_KHOA_HUY = ["cho_nhat", "dang_nhat", "da_nhat"];

export default function DonBanHangDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const coDuLieuRef = useRef(false);
  const [userRoles, setUserRoles] = useState([]);

  // Hộp xác nhận "Hủy đơn" / "Xác nhận đã giao": null | "huy" | "da-giao"
  const [xacNhan, setXacNhan] = useState(null);
  const [dangXuLy, setDangXuLy] = useState(false);
  const [taoLaiDangChay, setTaoLaiDangChay] = useState(false);

  // State quản lý hiển thị Modal hoàn trả
  const [showReturnModal, setShowReturnModal] = useState(false);

  // State quản lý Modal chọn kho khi gửi sang kho
  const [showSendWarehouseModal, setShowSendWarehouseModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedKhoId, setSelectedKhoId] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [sendingWarehouse, setSendingWarehouse] = useState(false);

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
  const isAdminOrSaleRole = userRoles.includes(ROLE.QUAN_TRI_VIEN) || userRoles.includes(ROLE.NHAN_VIEN_BAN_HANG);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await donBanHangKenhService.getDetail(id);
      setData(res.data);
      coDuLieuRef.current = true;
    }
    catch (error) {
      setLoadError(error);
      // Đang xem đơn mà tải lại lỗi (sau một thao tác): giữ nguyên màn, chỉ báo lỗi
      if (coDuLieuRef.current) toast.error(getApiErrorMessage(error, "Không tải được chi tiết đơn bán"));
    }
    finally { setLoading(false); }
  }, [id]);

  // Hoãn qua microtask để tránh setState đồng bộ trong effect
  // (react-hooks/set-state-in-effect); dữ liệu vẫn được tải ngay khi mount.
  useEffect(() => {
    queueMicrotask(() => fetchDetail());
  }, [fetchDetail]);

  // Chỉ chạy sau khi người dùng đồng ý ở hộp xác nhận
  async function handleMarkAsDelivered() {
    if (dangXuLy) return;
    try {
      setDangXuLy(true);
      await donBanHangKenhService.markAsDelivered(id);
      toast.success("Đã xác nhận giao hàng thành công.");
      fetchDetail();
    }
    catch (error) { toast.error(getApiErrorMessage(error, "Không thể xác nhận giao hàng")); }
    finally { setDangXuLy(false); setXacNhan(null); }
  }

  // Đơn đã nhặt xong mà phiếu xuất bị hủy: tạo phiếu mới chép lô của phiếu cũ, rồi mở phiếu để đóng gói lại
  async function handleTaoLaiPhieuXuat() {
    if (taoLaiDangChay) return;
    setTaoLaiDangChay(true);
    try {
      const res = await phieuXuatKhoService.taoLaiTheoDon(id);
      const ketQua = res?.data;
      if (ketQua?.canSuaLo?.length) toast.warning(res?.message);
      else toast.success(res?.message || "Đã tạo lại phiếu xuất");
      if (ketQua?.phieuXuatKhoId) navigate(`/goods-issues/${ketQua.phieuXuatKhoId}`);
      else fetchDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không tạo lại được phiếu xuất"));
    } finally {
      setTaoLaiDangChay(false);
    }
  }

  const handleOpenSendWarehouseModal = async () => {
    setShowSendWarehouseModal(true);
    setLoadingWarehouses(true);
    try {
      // Truy vấn tồn khả dụng thực tế của từng kho cho đơn hàng này
      const list = await donBanHangService.getKhoKhaDung(id);
      // Backend đã bỏ Kho Trung Chuyển; lọc thêm ở đây để modal không bao giờ gợi ý kho ảo
      const activeList = (Array.isArray(list) ? list : []).filter((kho) => !laKhoAo(kho));
      setWarehouses(activeList);

      const currentKhoId = data?.donBanHang?.khoXuat?.id;
      // Ưu tiên kho hiện tại nếu kho hiện tại ĐỦ HÀNG, nếu không thì ưu tiên kho đầu tiên (kho đủ hàng được backend xếp đầu)
      const currentKho = activeList.find(w => (w.khoId || w.id) === currentKhoId);
      if (currentKho && currentKho.duHang) {
        setSelectedKhoId(currentKho.khoId || currentKho.id);
      } else if (activeList.length > 0) {
        setSelectedKhoId(activeList[0].khoId || activeList[0].id);
      }
    } catch {
      toast.error("Không tải được thông tin tồn khả dụng của các kho");
    } finally {
      setLoadingWarehouses(false);
    }
  };

  async function confirmSendToWarehouse() {
    if (!selectedKhoId) {
      toast.error("Vui lòng chọn kho xuất để gửi đơn");
      return;
    }
    try {
      setSendingWarehouse(true);
      await donBanHangService.sendToWarehouse(id, { khoId: Number(selectedKhoId) });
      const chosenKho = warehouses.find(w => (w.khoId || w.id) === Number(selectedKhoId));
      toast.success(`Đã gửi đơn hàng sang kho ${chosenKho?.tenKho || ""} thành công.`);
      setShowSendWarehouseModal(false);
      fetchDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể gửi đơn sang kho"));
    } finally {
      setSendingWarehouse(false);
    }
  }

  // Chỉ chạy sau khi người dùng đồng ý ở hộp xác nhận
  async function handleCancel() {
    if (dangXuLy) return;
    try { setDangXuLy(true); await donBanHangService.cancel(id); toast.success("Đã hủy đơn bán"); fetchDetail(); }
    catch (error) { toast.error(getApiErrorMessage(error, "Không thể hủy đơn")); }
    finally { setDangXuLy(false); setXacNhan(null); }
  }

  // Mở modal hoàn trả
  const handleOpenReturnModal = () => {
    setShowReturnModal(true);
  };

  // Xác nhận hoàn trả gọi API
  async function confirmReturnGoods() {
    try {
      setLoading(true);
      setShowReturnModal(false); // Đóng modal ngay khi bấm xác nhận
      await donBanHangService.returnOrder(id);
      toast.success("Đã cập nhật trạng thái đơn hàng thành “Bị hoàn trả”.");
      fetchDetail();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.response?.data?.errors?.[0] || "Không thể hoàn trả đơn hàng");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    if (!loadError) {
      return (
        <PageContainer>
          <SurfaceCard>
            <LoadingState rows={4} label="Đang tải chi tiết đơn hàng" />
          </SurfaceCard>
        </PageContainer>
      );
    }

    // Không tìm thấy đơn (404) thì mời quay lại danh sách; lỗi khác cho phép thử lại
    const khongTimThay = getApiErrorStatus(loadError) === 404;
    return (
      <PageContainer className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/sales-orders")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </button>
        <SurfaceCard contentClassName="p-0 sm:p-0">
          {khongTimThay ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy đơn bán"
              description="Đơn bán không tồn tại hoặc đã bị xóa khỏi hệ thống."
              action={
                <Button
                  onClick={() => navigate("/sales-orders")}
                  className="bg-bo-primary text-white hover:bg-bo-primary-hover"
                >
                  Về danh sách đơn bán
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Không tải được chi tiết đơn bán"
              description={getApiErrorMessage(loadError, "Đã xảy ra lỗi khi tải đơn bán. Vui lòng thử lại.")}
              onRetry={fetchDetail}
            />
          )}
        </SurfaceCard>
      </PageContainer>
    );
  }

  const { donBanHang, chiTiet, phieuXuatKhoList, maPickList, trangThaiPhieuNhat } = data;
  // Mã lạ hiện rõ mã, không mượn tên "Nháp"
  const st = getDonBanHangStatus(donBanHang.trangThai);

  // Kiểm tra xem đơn hàng đã xuất đủ số lượng chưa
  const isFullyExported = chiTiet.every(item => item.soLuongDaGiao >= item.soLuongDat);

  // Đơn từ sàn (BR-OC-22): không dùng nút gửi kho / hủy của đơn thường; "Đã giao" chỉ cho Shopify
  // (Shopify không báo trạng thái giao); hoàn trả chỉ khi có cờ HOAN_HANG.
  const isChannelOrder = donBanHang.ketNoiKenhId != null;
  const maKenh = donBanHang.kenhBanHang?.maKenh;
  const orderFlags = parseFlags(donBanHang.canXuLy);
  const canSendToWarehouse = donBanHang.trangThai === 0 && !isChannelOrder;
  // Đơn đã có phiếu xuất hoàn thành (vd. đã xuất một phần) thì backend không cho hủy
  const coPhieuDaXuat = (phieuXuatKhoList ?? []).some((px) => px.trangThai === TRANG_THAI_PHIEU_XUAT.DA_XUAT);
  const canCancel = donBanHang.trangThai < 3 && !isChannelOrder
    && !PHIEU_NHAT_KHOA_HUY.includes(trangThaiPhieuNhat) && !coPhieuDaXuat;
  // Kho (và quản trị viên) đóng gói / xuất kho ngay trên màn đơn
  const canWarehouseAct = isKhoRole || userRoles.includes(ROLE.QUAN_TRI_VIEN);
  const phieuChoXuat = (phieuXuatKhoList ?? []).find((px) => px.trangThai === TRANG_THAI_PHIEU_XUAT.CHO_XUAT);
  const canReturn = (donBanHang.trangThai === 2 || donBanHang.trangThai === 3) && (!isChannelOrder || orderFlags.includes("HOAN_HANG"));
  const canMarkDelivered = donBanHang.trangThai === 3 && (!isChannelOrder || maKenh === "SHOPIFY");

  const infoRows = [
    { icon: User,     label: "Khách hàng",        value: donBanHang.khachHang?.tenKhachHang },
    { icon: Home,     label: "Kho xuất",          value: donBanHang.khoXuat?.tenKho || "Chưa xác định" },
    { icon: Calendar, label: "Ngày đặt",          value: formatDate(donBanHang.ngayDatHang) },
    { icon: MapPin,   label: "Địa chỉ nhận hàng", value: donBanHang.diaChiGiaoHang || "—" },
    ...(maPickList
      ? [{ icon: ClipboardList, label: "Phiếu nhặt hàng", value: maPickList }]
      : []),
    ...(donBanHang.kenhBanHang
      ? [{
          icon: Store,
          label: "Kênh bán",
          value: `${donBanHang.kenhBanHang.tenKenh}${donBanHang.maDonHangKenh ? ` · #${donBanHang.maDonHangKenh}` : ""}`,
        }]
      : []),
  ];

  return (
    <PageContainer className="space-y-5">
      <MockModeNotice show={isChannelOrderMock} />

      {/* ── Header ── */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/sales-orders")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-bo-primary transition-colors hover:text-bo-primary-hover"
        >
          <ArrowLeft className="size-4" />
          Quay lại danh sách
        </button>

        <PageHeader
          className="mb-0"
          title={`Đơn bán ${donBanHang.soDonHang}`}
          description="Chi tiết đơn bán hàng, sản phẩm và lịch sử xuất kho"
          actions={
            <StatusBadge size="lg" label={st.label} />
          }
        />

        {/* ── Action bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Các role thường mới thấy các nút này */}
          {!isKhoRole && (
            <>
              {canSendToWarehouse && (
                <Button
                  onClick={handleOpenSendWarehouseModal}
                  disabled={loading}
                  className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                >
                  <Send className="size-4" /> Gửi sang kho
                </Button>
              )}

              {canCancel && (
                <Button
                  variant="outline"
                  onClick={() => setXacNhan("huy")}
                  disabled={loading || dangXuLy}
                  className="gap-1.5 border-bo-danger/40 bg-white text-bo-danger hover:bg-bo-danger-soft hover:text-bo-danger"
                >
                  <XCircle className="size-4" /> Hủy đơn
                </Button>
              )}

              {isAdminOrSaleRole && canReturn && (
                <Button
                  variant="outline"
                  onClick={handleOpenReturnModal}
                  disabled={loading}
                  className="gap-1.5 border-bo-warning/40 bg-white text-bo-warning hover:bg-bo-warning-soft hover:text-bo-warning"
                >
                  <Undo2 className="size-4" /> Hoàn trả hàng
                </Button>
              )}

              {canMarkDelivered && (
                <Button
                  onClick={() => setXacNhan("da-giao")}
                  disabled={loading || dangXuLy}
                  className="gap-1.5 bg-bo-success text-white hover:bg-bo-success/90"
                >
                  <CheckCircle2 className="size-4" /> Xác nhận đã giao
                </Button>
              )}

              {donBanHang.trangThai >= 0 && (
                <Button
                  onClick={() => navigate(`/sales-orders/${id}/invoice`)}
                  className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
                >
                  <Receipt className="size-4" /> Xem hóa đơn
                </Button>
              )}
            </>
          )}

          {/* Đóng gói (Scan-to-Pack) và xuất kho — kho và quản trị viên */}
          {canWarehouseAct && donBanHang.trangThai === TRANG_THAI_DON.CHO_DONG_GOI && (
            <Button
              onClick={() => navigate(`/goods-issues/packing/${id}`)}
              className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              <PackageCheck className="size-4" /> Tiến hành đóng gói
            </Button>
          )}
          {canWarehouseAct && donBanHang.trangThai === TRANG_THAI_DON.DA_DONG_GOI && phieuChoXuat && (
            <Button
              onClick={() => navigate(`/goods-issues/${phieuChoXuat.id}`)}
              className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
            >
              <Truck className="size-4" /> Xuất kho
            </Button>
          )}

          {/* Phiếu xuất bán hàng sinh khi hoàn tất nhặt; đơn đã nhặt xong mà phiếu xuất bị hủy → tạo lại (chép lô phiếu cũ) */}
          {canWarehouseAct && (donBanHang.trangThai === 1 || donBanHang.trangThai === 2) && trangThaiPhieuNhat === "da_nhat" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      onClick={handleTaoLaiPhieuXuat}
                      disabled={isFullyExported || loading || taoLaiDangChay}
                      className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowRightLeft className="size-4" /> Tạo lại phiếu xuất
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isFullyExported
                    ? "Đơn hàng đã được xuất kho toàn bộ"
                    : "Phiếu xuất trước đã bị hủy: tạo phiếu mới, dùng lại lô đã nhặt, rồi đóng gói lại"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* ── LEFT: Thông tin chung ── */}
        <div className="space-y-5 lg:col-span-1">
          <SurfaceCard title="Chi tiết đơn hàng" description={donBanHang.soDonHang}>
            <div className="space-y-4">
              {/* Trạng thái */}
              <div className="rounded-md border border-bo-border bg-bo-surface-subtle p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-bo-muted">
                  Trạng thái hiện tại
                </p>
                <StatusBadge label={st.label} />
              </div>

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

              {/* Tổng tiền */}
              <div className="space-y-2 border-t border-bo-border pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase text-bo-muted">Tạm tính</span>
                  <span className="text-sm font-semibold text-bo-foreground">
                    {formatCurrency(donBanHang.tienHang)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1 text-xs font-semibold uppercase text-bo-muted">
                    <Truck className="size-3" />Phí vận chuyển
                  </span>
                  <span className="text-sm font-semibold text-bo-foreground">
                    {formatCurrency(donBanHang.phiVanChuyen)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-bo-border pt-2">
                  <span className="flex items-center gap-1 text-xs font-bold uppercase text-bo-foreground">
                    <Calculator className="size-3.5" />Tổng cộng
                  </span>
                  <span className="text-xl font-bold text-bo-foreground">
                    {formatCurrency(donBanHang.tongCong)}
                  </span>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>

        {/* ── RIGHT: Tables ── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Thông tin kênh bán (đơn từ sàn) */}
          {isChannelOrder && (
            <ChannelOrderPanel donBanHang={donBanHang} onChanged={fetchDetail} />
          )}

          {/* Danh mục sản phẩm */}
          <SurfaceCard
            title="Danh mục sản phẩm"
            description={`${chiTiet.length} mặt hàng trong đơn`}
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-bo-border bg-bo-surface-subtle">
                    <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Thông tin SKU</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Lượng đặt</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đã giao</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Đơn giá</th>
                    <th className="h-10 whitespace-nowrap px-3 text-right text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Tạm tính</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bo-border">
                  {chiTiet.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-bo-surface-subtle">
                      <td className="px-3 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wide text-bo-foreground">
                          {item.tenSanPham}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 font-mono text-xs text-bo-muted">
                          <Hash className="size-3" />{item.sku}
                        </span>
                        {isChannelOrder && <SkuSanLine sku={item.sku} skuSan={item.skuSan} />}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="inline-flex h-7 min-w-[32px] items-center justify-center rounded-md bg-bo-surface-subtle px-2 text-xs font-bold text-bo-foreground">
                          {item.soLuongDat}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold ${item.soLuongDaGiao >= item.soLuongDat
                            ? "bg-bo-success-soft text-bo-success"
                            : "bg-bo-surface-subtle text-bo-muted"}`}
                        >
                          {item.soLuongDaGiao >= item.soLuongDat && <CheckCircle2 className="size-3.5" />}
                          {item.soLuongDaGiao}
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

          {/* Lịch sử xuất hàng */}
          {phieuXuatKhoList && phieuXuatKhoList.length > 0 && (
            <SurfaceCard
              title="Lịch sử xuất hàng"
              description="Các phiếu xuất kho đã tạo cho đơn hàng này"
              contentClassName="p-0"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-bo-border bg-bo-surface-subtle">
                      <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Số hiệu phiếu</th>
                      <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ngày xuất</th>
                      <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Trạng thái</th>
                      <th className="h-10 whitespace-nowrap px-3 text-left text-[11px] font-semibold uppercase tracking-wide text-bo-muted">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bo-border">
                    {phieuXuatKhoList.map((px) => {
                      // Phiếu xuất dùng nhãn của phiếu xuất (trước đây lấy nhầm nhãn của đơn bán hàng)
                      const pxSt = getPhieuXuatKhoStatus(px.trangThai);
                      return (
                        <tr
                          key={px.id}
                          onClick={() => navigate(`/goods-issues/${px.id}/view`)}
                          className="cursor-pointer transition-colors hover:bg-bo-surface-subtle"
                        >
                          <td className="px-3 py-3">
                            <span className="font-mono font-semibold text-bo-primary">{px.soPhieuXuat}</span>
                          </td>
                          <td className="px-3 py-3 text-sm text-bo-muted">
                            {px.ngayXuat ? formatDate(px.ngayXuat) : "Chưa xuất"}
                          </td>
                          <td className="px-3 py-3">
                            {pxSt && (
                              <StatusBadge label={pxSt.label} />
                            )}
                          </td>
                          <td className="px-3 py-3 text-xs italic text-bo-muted">
                            {px.ghiChu || "Không có ghi chú"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>
          )}
        </div>
      </div>

      {/* ── Hộp xác nhận Hủy đơn / Xác nhận đã giao ── */}
      <ConfirmModal
        isOpen={xacNhan === "huy"}
        onClose={() => { if (!dangXuLy) setXacNhan(null); }}
        onConfirm={handleCancel}
        variant="danger"
        title={`Hủy đơn bán ${donBanHang.soDonHang}?`}
        description={
          <>
            Đơn sẽ chuyển sang trạng thái <strong className="font-semibold text-bo-danger">{STATUS_MAP[4].label}</strong> và
            không thể hoàn tác. Hàng đang giữ cho đơn được trả lại tồn khả dụng; phiếu xuất kho nháp của đơn (nếu có) bị thu hồi.
          </>
        }
        confirmText="Hủy đơn"
        cancelText="Giữ đơn"
        isLoading={dangXuLy}
      />
      <ConfirmModal
        isOpen={xacNhan === "da-giao"}
        onClose={() => { if (!dangXuLy) setXacNhan(null); }}
        onConfirm={handleMarkAsDelivered}
        variant="success"
        title={`Xác nhận đơn ${donBanHang.soDonHang} đã giao?`}
        description={
          <>
            Chỉ xác nhận khi khách đã nhận đủ hàng. Đơn sẽ chuyển sang trạng thái{" "}
            <strong className="font-semibold text-bo-success">{STATUS_MAP[5].label}</strong>, số lượng đã giao được ghi bằng
            số lượng đặt và không thể hoàn tác.
          </>
        }
        confirmText="Xác nhận đã giao"
        cancelText="Hủy bỏ"
        isLoading={dangXuLy}
      />

      {/* ── Modal Xác Nhận Hoàn Trả ── */}
      {showReturnModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-bo-border bg-white shadow-lg">
            <div className="p-5">
              <div className="mb-2 flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-bo-warning-soft text-bo-warning">
                  <AlertTriangle className="size-6" />
                </span>
                <div>
                  <h3 className="mb-1.5 text-lg font-bold text-bo-foreground">Xác nhận hoàn trả</h3>
                  <p className="text-sm leading-relaxed text-bo-muted">
                    Bạn có chắc chắn muốn hoàn trả đơn hàng này? Thao tác này sẽ chuyển trạng thái đơn sang <strong className="font-semibold text-bo-danger">Bị hoàn trả</strong> và hệ thống sẽ chờ kho nhập lại hàng hóa.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-bo-border bg-bo-surface-subtle px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setShowReturnModal(false)}
                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={confirmReturnGoods}
                className="border-transparent bg-bo-warning text-white hover:bg-bo-warning/90"
              >
                Xác nhận hoàn trả
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal chọn kho gửi sang kho ── */}
      {showSendWarehouseModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-bo-border bg-white shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="p-5">
              <div className="mb-4 flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-bo-primary/10 text-bo-primary">
                  <Send className="size-5" />
                </span>
                <div>
                  <h3 className="mb-1 text-base font-bold text-bo-foreground">Gửi đơn sang kho xử lý</h3>
                  <p className="text-xs leading-relaxed text-bo-muted">
                    Chọn kho xuất hàng phụ trách xử lý và xuất kho cho đơn <strong className="font-semibold text-bo-primary">{donBanHang?.soDonHang}</strong>. Hệ thống tự động đối soát tồn khả dụng của từng kho.
                  </p>
                </div>
              </div>

              {/* Tóm tắt thông tin đơn hàng */}
              <div className="mb-3 space-y-1.5 rounded-md border border-bo-border/70 bg-bo-surface-subtle p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-bo-muted">Khách hàng:</span>
                  <span className="font-medium text-bo-foreground">{donBanHang.khachHang?.tenKhachHang || "Khách lẻ"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bo-muted">Kho hiện tại:</span>
                  <span className="font-medium text-bo-primary">{donBanHang.khoXuat?.tenKho || "Chưa xác định"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bo-muted">Số mặt hàng:</span>
                  <span className="font-medium text-bo-foreground">{chiTiet?.length || 0} mặt hàng</span>
                </div>
                {donBanHang.diaChiGiaoHang && (
                  <div className="flex justify-between gap-2 border-t border-bo-border/50 pt-1.5">
                    <span className="shrink-0 text-bo-muted">Địa chỉ nhận:</span>
                    <span className="truncate text-right font-medium text-bo-foreground" title={donBanHang.diaChiGiaoHang}>
                      {donBanHang.diaChiGiaoHang}
                    </span>
                  </div>
                )}
              </div>

              {/* Lựa chọn kho xuất kèm trạng thái tồn khả dụng */}
              <div className="space-y-2 mb-3">
                <label className="flex items-center justify-between text-xs font-semibold text-bo-foreground">
                  <span>Kho xuất tiếp nhận <span className="text-bo-danger">*</span></span>
                  {loadingWarehouses && <span className="text-[11px] font-normal text-bo-muted">Đang kiểm tra tồn khả dụng...</span>}
                </label>

                {loadingWarehouses ? (
                  <div className="flex h-16 items-center justify-center rounded-md border border-bo-border bg-bo-surface-subtle text-xs text-bo-muted">
                    Đang truy vấn tồn khả dụng thực tế của từng kho...
                  </div>
                ) : warehouses.length === 0 ? (
                  <div className="rounded-md border border-bo-danger/30 bg-bo-danger-soft p-2.5 text-xs text-bo-danger">
                    Không tìm thấy kho nào đang hoạt động trong hệ thống.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {warehouses.map((kho) => {
                      const kId = kho.khoId || kho.id;
                      const isSelected = selectedKhoId === kId;
                      const isDuHang = Boolean(kho.duHang);
                      return (
                        <div
                          key={kId}
                          onClick={() => setSelectedKhoId(kId)}
                          className={`cursor-pointer rounded-lg border p-2.5 transition-all ${
                            isSelected
                              ? "border-bo-primary bg-bo-primary/5 ring-1 ring-bo-primary"
                              : "border-bo-border bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="warehouse-choice"
                                checked={isSelected}
                                onChange={() => setSelectedKhoId(kId)}
                                className="text-bo-primary focus:ring-bo-primary cursor-pointer"
                              />
                              <span className="font-semibold text-xs text-bo-foreground">
                                {kho.tenKho} <span className="text-[11px] font-normal text-bo-muted">({kho.maKho})</span>
                              </span>
                            </div>
                            {isDuHang ? (
                              <StatusBadge nhom="xong" label={`Đủ hàng (${kho.soLuongMatHangDu ?? kho.tongSoMatHang}/${kho.tongSoMatHang ?? 0})`} />
                            ) : (
                              <StatusBadge nhom="loi" label={`Thiếu hàng (${kho.soLuongMatHangDu ?? 0}/${kho.tongSoMatHang ?? 0})`} />
                            )}
                          </div>
                          {kho.diaChi && (
                            <p className="mt-1 pl-5 text-[11px] text-bo-muted truncate">{kho.diaChi}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cảnh báo kho thiếu hàng nếu user chọn kho không đủ hàng */}
              {(() => {
                const selectedKho = warehouses.find(w => (w.khoId || w.id) === selectedKhoId);
                if (selectedKho && !selectedKho.duHang) {
                  return (
                    <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong>Cảnh báo tồn kho:</strong> Kho <strong>{selectedKho.tenKho}</strong> chỉ có sẵn <strong>{selectedKho.soLuongMatHangDu}/{selectedKho.tongSoMatHang}</strong> mặt hàng. Vui lòng cân nhắc điều chuyển hàng hoặc chọn kho có đủ hàng để tránh trễ đơn xuất kho.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Chi tiết tồn khả dụng theo từng mặt hàng tại kho đã chọn */}
              {(() => {
                const selectedKho = warehouses.find(w => (w.khoId || w.id) === selectedKhoId);
                if (selectedKho?.chiTietTonKho && selectedKho.chiTietTonKho.length > 0) {
                  return (
                    <details className="mb-2 rounded-md border border-bo-border/70 bg-bo-surface-subtle p-2 text-xs">
                      <summary className="cursor-pointer font-semibold text-bo-foreground hover:text-bo-primary flex items-center justify-between">
                        <span>Chi tiết tồn khả dụng tại {selectedKho.tenKho}</span>
                        <span className="text-[11px] text-bo-primary font-normal underline">Xem bảng SKU</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {selectedKho.chiTietTonKho.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between rounded border border-bo-border/60 bg-white px-2.5 py-1.5 text-[11px]">
                            <div className="truncate pr-2">
                              <div className="font-medium text-bo-foreground truncate">{item.tenSanPham || item.maSku}</div>
                              <div className="text-[10px] text-bo-muted">SKU: {item.maSku} {item.tenBienThe ? `· ${item.tenBienThe}` : ""}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div>
                                Cần: <span className="font-semibold text-bo-foreground">{item.soLuongDat}</span> · Khả dụng: <span className={item.duHang ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>{item.tonKhaDung}</span>
                              </div>
                              <div>
                                {item.duHang ? (
                                  <span className="text-[10px] text-emerald-600 font-medium">✓ Đủ hàng</span>
                                ) : (
                                  <span className="text-[10px] text-rose-600 font-medium">✕ Thiếu {(Number(item.soLuongDat) - Number(item.tonKhaDung)) > 0 ? (Number(item.soLuongDat) - Number(item.tonKhaDung)) : 0}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                }
                return null;
              })()}

              <p className="text-[11px] text-bo-muted">
                Đơn hàng sau khi gửi sẽ chuyển sang trạng thái <strong>Chờ nhặt hàng</strong> và xuất hiện trong màn hình gom nhặt hàng của kho này.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-bo-border bg-bo-surface-subtle px-5 py-3.5">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowSendWarehouseModal(false)}
                disabled={sendingWarehouse}
                className="border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
              >
                Hủy bỏ
              </Button>
              <Button
                type="button"
                onClick={confirmSendToWarehouse}
                disabled={sendingWarehouse || loadingWarehouses || warehouses.length === 0 || !selectedKhoId}
                className="gap-1.5 bg-bo-primary text-white hover:bg-bo-primary-hover"
              >
                {sendingWarehouse ? (
                  <>Đang gửi sang kho...</>
                ) : (
                  <>
                    <Send className="size-4" /> Xác nhận gửi sang kho
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageContainer>
  );
}

// Đối chiếu SKU sàn với SKU FCentric của dòng đơn (FO-075). SKU sàn chưa có trong DTO thì hiện "—".
function SkuSanLine({ sku, skuSan }) {
  const normalize = (value) => String(value ?? "").trim().toUpperCase();
  const hasSkuSan = skuSan !== undefined && skuSan !== null && String(skuSan).trim() !== "";
  const matched = hasSkuSan && normalize(skuSan) === normalize(sku);
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-bo-muted">
      <span>Sàn:</span>
      <span className="font-mono text-bo-foreground">{hasSkuSan ? String(skuSan).trim() : "—"}</span>
      {hasSkuSan ? (
        <StatusBadge label={matched ? "Khớp SKU" : "Ghép tay"} />
      ) : null}
    </span>
  );
}
