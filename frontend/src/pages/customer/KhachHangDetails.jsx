// src/pages/customer/KhachHangDetails.jsx — trang Chi tiết khách hàng (/customers/:id), bản "một khối" (chốt 18/10/2026)
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CirclePause, Info, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/thongBaoNhanh";

import PageContainer from "@/components/backoffice/PageContainer";
import KhachHangFormDialog from "@/components/khach-hang/KhachHangFormDialog";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import SurfaceCard from "@/components/shared/SurfaceCard";
import DauTrangKhachHang from "@/components/khach-hang/chi-tiet/DauTrangKhachHang";
import GiaoDichKhachHang from "@/components/khach-hang/chi-tiet/GiaoDichKhachHang";
import ThuocTinhKhachHang from "@/components/khach-hang/chi-tiet/ThuocTinhKhachHang";
import TinhHinhMuaHang from "@/components/khach-hang/chi-tiet/TinhHinhMuaHang";
import TrangThaiKhachHangDialog from "@/components/khach-hang/chi-tiet/TrangThaiKhachHangDialog";
import NganKeoLichSu from "@/components/nhat-ky/NganKeoLichSu";
import { layLichSuDanhMuc } from "@/services/nhatKyService";
import { ghiChuPhamVi, laHoatDong, tinhKpi, tongSoDon } from "@/components/khach-hang/chi-tiet/tinhKhachHang";
import useQuayLai from "@/hooks/useQuayLai";
import useTabTrenUrl from "@/hooks/useTabTrenUrl";
import useTaiDuLieu from "@/hooks/useTaiDuLieu";
import { getKhachHangById, getTongQuanMuaHang } from "@/services/khachHangService";
import { WALKIN_CUSTOMER_CODE } from "@/services/posService";
import { getApiErrorStatus, getApiErrorMessage } from "@/utils/apiError";
import { ROLES, hasAnyRole } from "@/utils/roles";

// Khớp quyền ở backend (KhachHangController): sửa hồ sơ và đổi trạng thái.
const QUYEN_SUA_KHACH = [ROLES.QUAN_TRI_VIEN, ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_BAN_HANG];
// DonBanHangController: tạo báo giá / đơn bán (create, convert-to-order).
const QUYEN_BAN_HANG = [ROLES.QUAN_TRI_VIEN, ROLES.NHAN_VIEN_BAN_HANG];
const VAI_TRO_KHO = [ROLES.QUAN_LY_KHO, ROLES.NHAN_VIEN_KHO];

const TAB_HOP_LE = ["don-hang", "bao-gia"];

export default function KhachHangDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const coTheSua = hasAnyRole(QUYEN_SUA_KHACH);
  const coTheBanHang = hasAnyRole(QUYEN_BAN_HANG);
  const laQuanTriVien = hasAnyRole([ROLES.QUAN_TRI_VIEN]);
  const laVaiTroKho = hasAnyRole(VAI_TRO_KHO);
  const laBanHang = hasAnyRole([ROLES.NHAN_VIEN_BAN_HANG]);
  // Vai trò kho chỉ thấy chứng từ của kho mình (máy chủ lọc theo kho xuất); báo giá chưa gắn kho nên không có gì để xem
  const xemBaoGia = laQuanTriVien || (laBanHang && !laVaiTroKho);
  const phamVi = ghiChuPhamVi({ laQuanTriVien, laVaiTroKho, laBanHang });

  const [moTrangThai, setMoTrangThai] = useState(false);
  // Lịch sử thay đổi khách hàng: chỉ quản trị viên (máy chủ cũng chỉ cho quản trị viên)
  const [moLichSu, setMoLichSu] = useState(false);
  // Popup Sửa khách hàng; `oMoDau`: ô đặt con trỏ khi mở (bấm "Chưa có email · Thêm" thì vào ô Email).
  // Đường dẫn cũ /customers/:id/edit chuyển về đây kèm state để mở sẵn popup.
  const [formSua, setFormSua] = useState(() => ({
    open: Boolean(location.state?.moSuaKhach) && coTheSua,
    oMoDau: undefined,
  }));
  const moSua = (oMoDau) => setFormSua({ open: true, oMoDau });

  // Đã mở sẵn popup từ đường dẫn cũ: xóa state để F5 / quay lại không tự mở lại.
  useEffect(() => {
    if (!location.state?.moSuaKhach) return;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location, navigate]);

  // ── Khách hàng ──────────────────────────────────────────────────────────
  const taiKhach = useCallback(() => getKhachHangById(id), [id]);
  const khachQ = useTaiDuLieu(taiKhach, `khach-hang-${id}`, { enabled: Boolean(id) });
  // Chỉ dùng dữ liệu của đúng khách đang xem (chuyển sang khách khác thì dữ liệu cũ còn giữ trong lúc tải)
  const khachHang = khachQ.data && String(khachQ.data.id) === String(id) ? khachQ.data : null;

  // ── Số tổng hợp mua hàng (không chặn trang khi lỗi) ───────────────────────
  const taiTongQuan = useCallback(() => getTongQuanMuaHang(id).then((tq) => ({ ...tq, khachHangId: id })), [id]);
  const tongQuanQ = useTaiDuLieu(taiTongQuan, `tong-quan-kh-${id}`, { enabled: Boolean(id) });
  const tongQuan = tongQuanQ.data?.khachHangId === id ? tongQuanQ.data : undefined;
  const kpi = useMemo(() => tinhKpi(tongQuan), [tongQuan]);
  const loiTongQuan = Boolean(tongQuanQ.error) && !tongQuanQ.loiTaiLai;

  // ── Tab (lưu trên đường dẫn ?tab=) ──────────────────────────────────────
  const [tab, setTab] = useTabTrenUrl(xemBaoGia ? TAB_HOP_LE : ["don-hang"], "don-hang", { ten: "tab" });

  // Có trang trước trong ứng dụng thì lùi lại; mở thẳng bằng đường dẫn thì về danh sách khách hàng
  const quayLai = useQuayLai("/customers");

  // ── Đang tải / lỗi / không tìm thấy ────────────────────────────────────
  if (!khachHang && (khachQ.loading || (!khachQ.error && khachQ.data === undefined))) {
    return (
      <PageContainer>
        <SurfaceCard>
          <LoadingState label="Đang tải thông tin khách hàng" />
        </SurfaceCard>
      </PageContainer>
    );
  }

  if (!khachHang) {
    const status = getApiErrorStatus(khachQ.error);
    const khongThay = !khachQ.error || status === 404 || status === 400;
    return (
      <PageContainer>
        <SurfaceCard contentClassName="p-0 sm:p-0">
          {khongThay ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy khách hàng"
              description="Khách hàng có thể đã bị xóa hoặc đường dẫn không đúng."
              action={
                <Button
                  onClick={() => navigate("/customers")}
                  className="bg-bo-primary font-semibold text-white hover:bg-bo-primary-hover"
                >
                  Quay lại danh sách
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="Không thể tải thông tin khách hàng"
              description={getApiErrorMessage(khachQ.error, "Không thể tải thông tin khách hàng")}
              onRetry={khachQ.reload}
            />
          )}
        </SurfaceCard>
      </PageContainer>
    );
  }

  const dangHoatDong = laHoatDong(khachHang);
  // Khách lẻ mặc định (KHLE) là khách của hệ thống: máy chủ chặn sửa và ngừng (409) nên ẩn các nút đó
  const laKhachLe = khachHang.maKhachHang === WALKIN_CUSTOMER_CODE;
  const suaDuoc = coTheSua && !laKhachLe;
  const chinhSua = suaDuoc ? moSua : undefined;
  const taoBaoGia = () => navigate(`/sales-quotations/create?khachHangId=${id}`);

  // Lưu xong cập nhật tại chỗ (không tải lại trang, không thêm bước vào lịch sử trình duyệt).
  const handleDaSua = (moi) => {
    if (moi) khachQ.setData((cu) => ({ ...cu, ...moi }));
    else khachQ.reload();
    toast.success("Đã lưu thông tin khách hàng");
  };

  const handleTrangThaiDoi = (moi) => {
    khachQ.setData((cu) => ({ ...cu, ...moi }));
    toast.success(laHoatDong(moi) ? "Đã cho phép khách hàng hoạt động lại" : "Đã ngừng hoạt động khách hàng");
  };

  return (
    <PageContainer className="kh-trang flex min-h-full flex-col">
      <article className="kh-khoi flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-bo-border bg-bo-surface shadow-sm">
        <DauTrangKhachHang
          khachHang={khachHang}
          coTheSua={suaDuoc}
          coTheTaoBaoGia={coTheBanHang && !laKhachLe}
          onQuayLai={quayLai}
          onChinhSua={() => moSua()}
          onDoiTrangThai={() => setMoTrangThai(true)}
          onTaoBaoGia={taoBaoGia}
          onLichSu={laQuanTriVien ? () => setMoLichSu(true) : undefined}
        />

        {laKhachLe ? (
          <div
            role="status"
            className="flex items-start gap-2.5 border-t border-bo-border bg-slate-100 px-4 py-3 text-[13px] leading-5 text-slate-700 sm:px-6"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold text-bo-foreground">Khách mặc định của hệ thống.</span>{" "}
              Dùng cho hóa đơn bán tại quầy không lưu thông tin người mua. Không sửa hay ngừng hoạt động được.
            </span>
          </div>
        ) : null}

        {!dangHoatDong ? (
          <div
            role="status"
            className="flex flex-col gap-3 border-t border-bo-border bg-slate-100 px-4 py-3 text-[13px] leading-5 text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          >
            <span className="flex items-start gap-2.5">
              <CirclePause className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold text-bo-foreground">Khách hàng đang ngừng hoạt động.</span>{" "}
                Không chọn được khi tạo báo giá và bán tại quầy. Lịch sử mua hàng giữ nguyên.
              </span>
            </span>
            {suaDuoc ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMoTrangThai(true)}
                className="shrink-0 border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle max-sm:h-11"
              >
                Cho phép hoạt động
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Tổng chi tiêu, số đơn của KHLE là mọi khách lẻ cộng lại, không nói gì về một khách: không hiện */}
        {laKhachLe ? null : (
          <TinhHinhMuaHang
            kpi={kpi}
            dangTai={tongQuan === undefined && !loiTongQuan}
            loi={loiTongQuan}
            onThuLai={tongQuanQ.reload}
          />
        )}

        <div className="kh-than @container grid flex-1 border-t border-bo-border xl:grid-cols-[minmax(0,1fr)_340px]">
          <GiaoDichKhachHang
            key={id}
            khachHangId={id}
            tab={tab}
            onDoiTab={setTab}
            tongDon={tongQuan ? tongSoDon(tongQuan) : undefined}
            kenhMua={tongQuan?.kenhMua}
            xemBaoGia={xemBaoGia}
            coTheTaoBaoGia={coTheBanHang && dangHoatDong && !laKhachLe}
            coTheTaoDon={coTheBanHang}
            onTaoBaoGia={taoBaoGia}
            ghiChuPhamVi={phamVi}
          />
          <ThuocTinhKhachHang khachHang={khachHang} kenhMua={tongQuan?.kenhMua} onChinhSua={chinhSua} />
        </div>
      </article>

      {suaDuoc ? (
        <KhachHangFormDialog
          open={formSua.open}
          onOpenChange={(open) => setFormSua((cu) => ({ ...cu, open }))}
          khachHang={khachHang}
          oMoDau={formSua.oMoDau}
          onSaved={handleDaSua}
        />
      ) : null}

      {suaDuoc ? (
        <TrangThaiKhachHangDialog
          khachHang={khachHang}
          open={moTrangThai}
          onOpenChange={setMoTrangThai}
          onChanged={handleTrangThaiDoi}
          soDonDangXuLy={tongQuan?.soDonDangXuLy}
        />
      ) : null}

      {laQuanTriVien ? (
        <NganKeoLichSu
          open={moLichSu}
          onOpenChange={setMoLichSu}
          tieuDe={`Lịch sử ${khachHang.tenKhachHang || khachHang.maKhachHang || "khách hàng"}`}
          moTa="Thêm, sửa, ngừng hoạt động khách hàng: ai làm, lúc nào, đổi gì."
          tai={() => layLichSuDanhMuc("khach_hang", khachHang.id)}
        />
      ) : null}
    </PageContainer>
  );
}
