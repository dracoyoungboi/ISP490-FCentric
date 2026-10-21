import { Link } from "react-router-dom";
import CotThuocTinh, {
  BangThuocTinh,
  ChungTuLienQuan,
  GiaTriSaoChep,
  NhomThuocTinh,
} from "@/components/chung-tu/CotThuocTinh";
import { NhomKhoNhan } from "@/components/order/chi-tiet-yeu-cau/ThuocTinhYeuCau";
import { formatDate } from "@/utils/formatters";

/**
 * Cột phải của Chi tiết báo giá: nhà cung cấp (mở Chi tiết nhà cung cấp; số điện thoại, email sao chép được),
 * kho nhận, giao dự kiến, người gửi yêu cầu và chứng từ liên quan (yêu cầu nhập hàng, so sánh báo giá).
 * `lienQuan`: các mục của ChungTuLienQuan.
 */
export default function ThuocTinhBaoGia({ don, lienQuan }) {
  const ncc = don?.nhaCungCap;

  return (
    <CotThuocTinh nhan="Thông tin báo giá">
      <NhomThuocTinh nhan="Nhà cung cấp">
        {ncc ? (
          <>
            {ncc.id != null ? (
              <Link
                to={`/supplier/${ncc.id}`}
                className="inline-block text-sm font-semibold text-bo-primary hover:text-bo-primary-hover hover:underline"
              >
                {ncc.tenNhaCungCap || ncc.maNhaCungCap || "—"}
              </Link>
            ) : (
              <div className="text-sm font-semibold text-bo-foreground">{ncc.tenNhaCungCap || "—"}</div>
            )}
            {ncc.maNhaCungCap ? <div className="mt-0.5 font-mono text-[13px] text-bo-muted">{ncc.maNhaCungCap}</div> : null}
            {ncc.nguoiLienHe ? <div className="mt-2.5 text-[13px] leading-5 text-bo-foreground">{ncc.nguoiLienHe}</div> : null}
            {ncc.soDienThoai ? (
              <GiaTriSaoChep giaTri={ncc.soDienThoai} nhanSaoChep="Sao chép số điện thoại" className="text-[13px] tabular-nums text-bo-muted" />
            ) : null}
            {ncc.email ? (
              <GiaTriSaoChep giaTri={ncc.email} nhanSaoChep="Sao chép email" className="text-[13px] text-bo-muted" />
            ) : null}
          </>
        ) : (
          <div className="text-[13px] text-bo-muted">Báo giá chưa gắn nhà cung cấp.</div>
        )}
      </NhomThuocTinh>
      <NhomKhoNhan kho={don?.khoNhap} coQuanLy={false} />
      <NhomThuocTinh>
        <BangThuocTinh
          rongNhan={124}
          muc={[
            { ma: "giao", nhan: "Giao dự kiến", giaTri: don?.ngayGiaoDuKien ? <span className="whitespace-nowrap tabular-nums">{formatDate(don.ngayGiaoDuKien)}</span> : null },
            { ma: "nguoiTao", nhan: "Người gửi yêu cầu", giaTri: don?.nguoiTao?.hoTen },
          ]}
        />
      </NhomThuocTinh>
      <ChungTuLienQuan ds={lienQuan} />
    </CotThuocTinh>
  );
}
