// src/pages/supplier/SupplierDetailView.jsx — trang Chi tiết nhà cung cấp (/supplier/:id), bản "một khối" (chốt 17/10/2026)
import { createElement, useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, CirclePause, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import SurfaceCard from "@/components/shared/SurfaceCard";
import SupplierDeleteDialog from "@/components/supplier/SupplierDeleteDialog";
import SupplierFormDialog from "@/components/supplier/SupplierFormDialog";
import SupplierStatusDialog from "@/components/supplier/SupplierStatusDialog";
import { laHoatDong } from "@/components/supplier/quyTacNhaCungCap";
import DauTrangNcc from "@/components/supplier/chi-tiet/DauTrangNcc";
import TinhHinhNcc from "@/components/supplier/chi-tiet/TinhHinhNcc";
import GiaoDichNcc from "@/components/supplier/chi-tiet/GiaoDichNcc";
import ThuocTinhNcc from "@/components/supplier/chi-tiet/ThuocTinhNcc";
import {
  TRANG_THAI_DA_CHOT,
  demViecDangDo,
  dungHoatDong,
  giaoHangTheoDon,
  phanLoaiDon,
  tinhChiSo,
  tinhLichSuGia,
  timViecDangMo,
} from "@/components/supplier/chi-tiet/tinhNhaCungCap";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getMineKhoList } from "@/services/khoService";
import { phieuNhapKhoService } from "@/services/phieuNhapKhoService";
import purchaseOrderService from "@/services/purchaseOrderService";
import { checkSupplierDelete, getSupplierById } from "@/services/supplierService";
import { getApiErrorMessage, getApiErrorStatus } from "@/utils/apiError";
import { getKhoLamViecId } from "@/utils/khoLamViec";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Khớp quyền ở backend (NhaCungCapController): sửa, đổi trạng thái, xóa. Quản lý kho chỉ xem.
const QUYEN_QUAN_LY_NCC = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];
// Vai trò backend cho xem đơn mua (DonMuaHangController.filter).
const QUYEN_XEM_GIAO_DICH = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_MUA_HANG, ROLES.NHAN_VIEN_KHO];
// Vai trò backend cho xem và tạo phiếu nhập kho (PhieuNhapKhoController).
const QUYEN_PHIEU_NHAP = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];
// Vai trò xem mọi kho; vai trò kho còn lại chỉ thấy đơn của kho mình phụ trách (như trang Đơn mua hàng).
const QUYEN_XEM_MOI_KHO = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_MUA_HANG];

const TAB_HOP_LE = ["dang-mo", "don-mua", "bao-gia", "phieu-nhap", "san-pham", "hoat-dong"];

/** Dải báo nằm trong khối, ngay dưới đầu khối: đã ngừng hoạt động (xám) hoặc chưa có email (cam). */
function DaiBao({ tone, icon, children, nutNhan, onNut }) {
  const kieu = tone === "warning"
    ? "border-orange-200 bg-bo-warning-soft text-bo-warning"
    : "border-bo-border bg-slate-100 text-slate-700";
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 border-t px-4 py-3 text-[13px] leading-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 ${kieu}`}
    >
      <span className="flex items-start gap-2.5">
        {createElement(icon, { className: "mt-0.5 size-4 shrink-0", "aria-hidden": true })}
        <span>{children}</span>
      </span>
      {nutNhan ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNut}
          className="shrink-0 border-bo-border bg-white text-bo-foreground shadow-none hover:bg-bo-surface-subtle max-sm:h-11"
        >
          {nutNhan}
        </Button>
      ) : null}
    </div>
  );
}

export default function SupplierDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const coTheQuanLy = hasAnyRole(QUYEN_QUAN_LY_NCC);
  const xemGiaoDich = hasAnyRole(QUYEN_XEM_GIAO_DICH);
  const xemPhieu = hasAnyRole(QUYEN_PHIEU_NHAP);
  const gioiHanKho = xemGiaoDich && !hasAnyRole(QUYEN_XEM_MOI_KHO);
  const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);

  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Nhà cung cấp ────────────────────────────────────────────────────────
  const taiNcc = useCallback(() => getSupplierById(id), [id]);
  const nccQ = useTaiDuLieu(taiNcc, `ncc-${id}`, { enabled: Boolean(id) });
  const ncc = nccQ.data && String(nccQ.data.id) === String(id) ? nccQ.data : null;

  // ── Xóa được không (đã phát sinh giao dịch thì menu ⋯ không hiện Xóa) ───
  // Hỏi máy chủ thay vì suy từ dữ liệu trên trang: nhân viên mua hàng không xem được phiếu nhập,
  // lô hàng không tải ở đây, danh sách đơn có thể chỉ là các đơn gần nhất.
  const taiKiemTraXoa = useCallback(() => checkSupplierDelete(id), [id]);
  const xoaQ = useTaiDuLieu(taiKiemTraXoa, `kiem-tra-xoa-ncc-${id}`, { enabled: Boolean(id) && coTheQuanLy });
  // "chua-ro" (kiểm tra lỗi): vẫn hiện Xóa như cũ, hộp thoại xóa tự kiểm tra lại
  const trangThaiXoa = xoaQ.loading
    ? "dang-kiem-tra"
    : xoaQ.error || typeof xoaQ.data?.coTheXoa !== "boolean"
      ? "chua-ro"
      : xoaQ.data.coTheXoa
        ? "duoc"
        : "khong";

  // ── Kho phụ trách (quản lý kho / nhân viên kho) ─────────────────────────
  const khoQ = useTaiDuLieu(getMineKhoList, "kho-phu-trach", { enabled: gioiHanKho });
  const khoPhuTrach = gioiHanKho ? khoQ.data : undefined;
  // undefined = không giới hạn kho (hoặc chưa tải xong danh sách kho phụ trách)
  const khoIds = useMemo(() => (Array.isArray(khoPhuTrach) ? khoPhuTrach.map((k) => k.id) : undefined), [khoPhuTrach]);
  const duKho = !gioiHanKho || Array.isArray(khoIds);
  const khoaKho = gioiHanKho ? (khoIds ?? []).join(",") : "moi-kho";

  // ── Đơn mua và báo giá của nhà cung cấp ─────────────────────────────────
  const taiDon = useCallback(() => purchaseOrderService.layTheoNhaCungCap(id, { khoIds }), [id, khoIds]);
  const donQ = useTaiDuLieu(taiDon, `don-ncc-${id}-${khoaKho}`, { enabled: Boolean(id) && xemGiaoDich && duKho });

  // ── Phiếu nhập kho (không chặn trang khi lỗi) ───────────────────────────
  const taiPhieu = useCallback(() => phieuNhapKhoService.layTheoNhaCungCap(id, { khoIds }), [id, khoIds]);
  const phieuQ = useTaiDuLieu(taiPhieu, `phieu-ncc-${id}-${khoaKho}`, { enabled: Boolean(id) && xemPhieu && duKho });

  // ── Tính toán ───────────────────────────────────────────────────────────
  // Chỉ dùng dữ liệu của đúng nhà cung cấp đang xem (lúc chuyển sang nhà cung cấp khác, dữ liệu cũ còn giữ trong lúc tải)
  const donData = donQ.data?.nhaCungCapId === Number(id) ? donQ.data : undefined;
  const phieuData = phieuQ.data?.nhaCungCapId === Number(id) ? phieuQ.data : undefined;
  const dons = donData?.dons;
  const phieus = xemPhieu && phieuData && !phieuQ.error ? phieuData.phieus : null;
  const tinh = useMemo(() => {
    const { chot, baoGia } = phanLoaiDon(dons);
    const giaoTheoDon = giaoHangTheoDon(chot, phieus);
    const viec = timViecDangMo(chot, baoGia, giaoTheoDon);
    return {
      chot,
      baoGia,
      giaoTheoDon,
      viec,
      chiSo: tinhChiSo(chot, baoGia, giaoTheoDon, { coNgayNhap: phieus != null }),
      lichSuGia: tinhLichSuGia(chot),
    };
  }, [dons, phieus]);
  const suKien = useMemo(() => dungHoatDong({ ncc, dons, phieus }), [ncc, dons, phieus]);

  const loiDon = khoQ.error
    ? getApiErrorMessage(khoQ.error, "Không tải được danh sách kho bạn phụ trách")
    : donQ.error
      ? getApiErrorMessage(donQ.error, "Không tải được đơn mua của nhà cung cấp")
      : null;
  const loiPhieu = xemPhieu && phieuQ.error ? getApiErrorMessage(phieuQ.error, "") || true : null;
  // Chưa có dữ liệu lần nào và chưa lỗi = đang tải (kể cả lúc chờ danh sách kho phụ trách)
  const dangTaiDon = xemGiaoDich && !loiDon && dons === undefined;
  const dangTaiPhieu = xemPhieu && !khoQ.error && !phieuQ.error && phieuData === undefined;

  // ── Tab (lưu trên đường dẫn ?tab=) ──────────────────────────────────────
  const coViec = tinh.viec.length > 0;
  const [tab, setTab] = useTabTrenUrl(
    TAB_HOP_LE.filter((ma) => (ma === "dang-mo" ? coViec || dangTaiDon : ma === "phieu-nhap" ? xemPhieu : true)),
    coViec || dangTaiDon ? "dang-mo" : "don-mua",
    { ten: "tab" },
  );
  const tabs = [
    coViec || dangTaiDon
      ? { ma: "dang-mo", nhan: "Đang mở", so: tinh.viec.length, gap: tinh.viec.some((v) => v.giao?.loai === "quaHan") }
      : null,
    { ma: "don-mua", nhan: "Đơn mua hàng", so: tinh.chot.length },
    { ma: "bao-gia", nhan: "Báo giá", so: tinh.baoGia.length },
    xemPhieu ? { ma: "phieu-nhap", nhan: "Phiếu nhập kho", so: phieus?.length ?? 0 } : null,
    { ma: "san-pham", nhan: "Sản phẩm & giá", so: tinh.lichSuGia.length },
    { ma: "hoat-dong", nhan: "Hoạt động", so: 0 },
  ].filter(Boolean);

  // Đơn được nhập hàng tại đây: đúng vai trò kho và (quản trị viên hoặc đang chọn đúng kho nhận của đơn)
  const khoLamViecId = getKhoLamViecId();
  const nutCuaDon = (don) => {
    const duocNhap =
      xemPhieu &&
      TRANG_THAI_DA_CHOT.includes(Number(don.trangThai)) &&
      (laQuanTriVien || (don.khoNhap?.id != null && khoLamViecId === don.khoNhap.id));
    return duocNhap
      ? { nhan: "Tạo phiếu nhập", href: `/goods-receipts/create?poId=${don.id}` }
      : { nhan: "Xem đơn", href: `/purchase-orders/${don.id}` };
  };

  const ghiChu = [
    gioiHanKho && Array.isArray(khoIds)
      ? khoIds.length
        ? `Chỉ tính đơn và phiếu nhập của kho bạn phụ trách: ${(khoQ.data ?? []).map((k) => k.tenKho).filter(Boolean).join(", ")}.`
        : "Bạn chưa được phân công kho nào nên chưa thấy giao dịch."
      : null,
    donData && donData.tong > donData.dons.length
      ? `Đang tính trên ${donData.dons.length} đơn gần nhất trong tổng số ${donData.tong} đơn.`
      : null,
  ].filter(Boolean).join(" ");

  const lyDoKhongTinhGiao = !xemPhieu
    ? "Cần quyền xem phiếu nhập kho để tính"
    : phieuQ.error
      ? "Chưa tải được phiếu nhập kho"
      : "";

  const quayLai = () => {
    // Mở thẳng bằng đường dẫn (không có trang trước trong ứng dụng) thì về danh sách nhà cung cấp
    if (location.key === "default") navigate("/supplier");
    else navigate(-1);
  };

  // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
  if (!ncc && (nccQ.loading || (!nccQ.error && nccQ.data === undefined))) {
    return (
      <PageContainer>
        <SurfaceCard>
          <LoadingState label="Đang tải thông tin nhà cung cấp" />
        </SurfaceCard>
      </PageContainer>
    );
  }

  if (!ncc) {
    const status = getApiErrorStatus(nccQ.error);
    const khongThay = !nccQ.error || status === 404 || status === 400;
    return (
      <PageContainer>
        <SurfaceCard contentClassName="p-0 sm:p-0">
          {khongThay ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy nhà cung cấp"
              description="Nhà cung cấp có thể đã bị xóa hoặc đường dẫn không đúng."
              action={
                <Button
                  onClick={() => navigate("/supplier")}
                  className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                >
                  Quay lại danh sách
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Không thể tải thông tin nhà cung cấp"
              description={getApiErrorMessage(nccQ.error, "Không thể tải thông tin nhà cung cấp")}
              onRetry={nccQ.reload}
            />
          )}
        </SurfaceCard>
      </PageContainer>
    );
  }

  const dangHoatDong = laHoatDong(ncc);
  const thieuEmail = !ncc.email?.trim();

  const capNhatNcc = (moi) => nccQ.setData((cu) => ({ ...cu, ...moi }));
  const handleSaved = (saved) => {
    capNhatNcc(saved);
    toast.success("Đã lưu thay đổi nhà cung cấp");
  };
  const handleStatusChanged = (updated) => {
    capNhatNcc(updated);
    toast.success(laHoatDong(updated)
      ? "Đã cho phép nhà cung cấp hoạt động lại"
      : "Đã ngừng hoạt động nhà cung cấp");
  };
  const handleDeleted = (deleted) => {
    toast.success(`Đã xóa nhà cung cấp "${deleted.tenNhaCungCap}"`);
    navigate("/supplier", { replace: true });
  };

  return (
    <PageContainer className="flex min-h-full flex-col">
      <article className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
        <DauTrangNcc
          ncc={ncc}
          coTheQuanLy={coTheQuanLy}
          trangThaiXoa={trangThaiXoa}
          onQuayLai={quayLai}
          onChinhSua={() => setEditOpen(true)}
          onDoiTrangThai={() => setStatusOpen(true)}
          onXoa={() => setDeleteOpen(true)}
        />

        {!dangHoatDong ? (
          <DaiBao
            icon={CirclePause}
            nutNhan={coTheQuanLy ? "Cho phép hoạt động" : null}
            onNut={() => setStatusOpen(true)}
          >
            <span className="font-semibold text-bo-foreground">Nhà cung cấp đang ngừng hoạt động.</span>{" "}
            Không được chọn khi gửi yêu cầu báo giá mới. Đơn đang chờ giao vẫn nhận hàng, nhập kho bình thường.
          </DaiBao>
        ) : thieuEmail ? (
          <DaiBao
            tone="warning"
            icon={AlertTriangle}
            nutNhan={coTheQuanLy ? "Thêm email" : null}
            onNut={() => setEditOpen(true)}
          >
            <span className="font-semibold">Chưa có email.</span> Chưa gửi được yêu cầu báo giá cho nhà cung cấp này.
          </DaiBao>
        ) : null}

        {xemGiaoDich && !loiDon ? (
          <TinhHinhNcc chiSo={tinh.chiSo} dangTai={dangTaiDon || dangTaiPhieu} lyDoKhongTinhGiao={lyDoKhongTinhGiao} />
        ) : null}

        <div className="@container grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
          {xemGiaoDich ? (
            <GiaoDichNcc
              tabs={tabs}
              tab={tab}
              onDoiTab={setTab}
              dangTai={dangTaiDon}
              loiDon={loiDon}
              onThuLaiDon={() => (khoQ.error ? khoQ.reload() : donQ.reload())}
              loiPhieu={loiPhieu}
              onThuLaiPhieu={phieuQ.reload}
              ghiChu={ghiChu}
              d={{ ...tinh, phieus, suKien, nutCuaDon }}
            />
          ) : (
            <EmptyState
              className="min-h-72"
              title="Giao dịch chỉ hiện với vai trò mua hàng và kho"
              description="Bạn vẫn xem được thông tin liên hệ của nhà cung cấp ở cột bên cạnh."
            />
          )}
          <ThuocTinhNcc ncc={ncc} />
        </div>
      </article>

      {coTheQuanLy ? (
        <>
          <SupplierFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            supplier={ncc}
            onSaved={handleSaved}
          />
          <SupplierStatusDialog
            supplier={ncc}
            open={statusOpen}
            onOpenChange={setStatusOpen}
            onChanged={handleStatusChanged}
            viecDangDo={dons ? demViecDangDo(tinh.viec) : undefined}
          />
          <SupplierDeleteDialog
            supplier={ncc}
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onDeleted={handleDeleted}
            onStatusChanged={handleStatusChanged}
            onChecked={xoaQ.setData}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
