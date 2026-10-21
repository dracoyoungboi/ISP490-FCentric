import CotThuocTinh, {
  BangThuocTinh,
  ChungTuLienQuan,
  GiaTriSaoChep,
  NhomThuocTinh,
} from "@/components/chung-tu/CotThuocTinh";
import { trangThaiGiao } from "@/components/order/chi-tiet-don-mua/tinhNhanHang";
import { formatDate } from "@/utils/formatters";

/**
 * Hạn giao: ngày (không bẻ giữa chừng) và dòng dưới "Quá hạn n ngày" / "Hôm nay" / "Còn n ngày" như Chi tiết đơn mua hàng.
 * `conHieuLuc = false` (yêu cầu đã từ chối, đã chốt đơn mua…): chỉ hiện ngày. Màn chỉ vẽ khi có ngày (trống thì "—").
 */
export function HanGiao({ ngay, conHieuLuc = true }) {
  const giao = trangThaiGiao(ngay, !conHieuLuc);
  return (
    <>
      <span className="block whitespace-nowrap tabular-nums">{formatDate(ngay)}</span>
      {giao.loai === "quaHan" ? (
        <span className="block font-medium text-bo-danger">Quá hạn {giao.soNgay} ngày</span>
      ) : giao.loai === "homNay" ? (
        <span className="block font-medium text-bo-warning">Hôm nay</span>
      ) : giao.loai === "conLai" ? (
        <span className="block text-bo-muted">Còn {giao.soNgay} ngày</span>
      ) : null}
    </>
  );
}

/** Nhóm "Kho nhận": tên + mã kho, địa chỉ và (tùy chọn) quản lý kho. Dùng chung cho yêu cầu và báo giá. */
export function NhomKhoNhan({ kho, coQuanLy = true }) {
  return (
    <NhomThuocTinh nhan="Kho nhận">
      <div className="text-sm font-semibold text-bo-foreground">
        {kho?.tenKho || "—"}
        {kho?.maKho ? <span className="ml-1.5 font-mono font-normal text-bo-muted">{kho.maKho}</span> : null}
      </div>
      {kho?.diaChi ? <div className="mt-0.5 text-[13px] leading-5 text-bo-muted">{kho.diaChi}</div> : null}
      {coQuanLy && kho?.quanLy?.hoTen ? (
        <div className="mt-0.5 text-[13px] leading-5 text-bo-muted">
          Quản lý: <span className="text-bo-foreground">{kho.quanLy.hoTen}</span>
        </div>
      ) : null}
    </NhomThuocTinh>
  );
}

/**
 * Cột phải của yêu cầu nhập hàng / yêu cầu báo giá: kho nhận, giao dự kiến, người tạo, (người duyệt), ghi chú,
 * chứng từ liên quan. Người và nơi chỉ ở đây; mốc giờ ở tiến trình.
 *
 * - `nhan`: tên vùng cho trình đọc màn hình.
 * - `conHieuLuc`: còn so hạn giao (hiện quá hạn / còn n ngày).
 * - `coNguoiDuyet`: hiện email người tạo (sao chép được) và người duyệt / người từ chối (màn yêu cầu nhập hàng).
 * - `lienQuan`: các mục của ChungTuLienQuan.
 */
export default function ThuocTinhYeuCau({ yc, nhan, conHieuLuc, coNguoiDuyet = false, lienQuan }) {
  const tuChoi = Number(yc?.trangThai) === 4;
  const nguoiTao = yc?.nguoiTao;
  const nguoiDuyet = yc?.nguoiDuyet;

  return (
    <CotThuocTinh nhan={nhan}>
      <NhomKhoNhan kho={yc?.khoNhap} />
      <NhomThuocTinh>
        <BangThuocTinh
          muc={[
            {
              ma: "giao",
              nhan: "Giao dự kiến",
              giaTri: yc?.ngayGiaoDuKien ? <HanGiao ngay={yc.ngayGiaoDuKien} conHieuLuc={conHieuLuc} /> : null,
            },
            {
              ma: "nguoiTao",
              nhan: "Người tạo",
              giaTri: coNguoiDuyet && nguoiTao?.email ? (
                <>
                  <div>{nguoiTao?.hoTen || "—"}</div>
                  <GiaTriSaoChep giaTri={nguoiTao.email} nhanSaoChep="Sao chép email" className="text-bo-muted" />
                </>
              ) : nguoiTao?.hoTen,
            },
            {
              ma: "nguoiDuyet",
              nhan: tuChoi ? "Người từ chối" : "Người duyệt",
              an: !coNguoiDuyet || !nguoiDuyet,
              giaTri: (
                <>
                  <div>{nguoiDuyet?.hoTen || "—"}</div>
                  {nguoiDuyet?.email ? <div className="truncate text-bo-muted" title={nguoiDuyet.email}>{nguoiDuyet.email}</div> : null}
                </>
              ),
            },
            {
              ma: "ghiChu",
              nhan: "Ghi chú",
              giaTri: yc?.ghiChu ? <span className="whitespace-pre-wrap">{yc.ghiChu}</span> : null,
            },
          ]}
        />
      </NhomThuocTinh>
      <ChungTuLienQuan ds={lienQuan} />
    </CotThuocTinh>
  );
}
