import { useState } from "react";
import { Link } from "react-router-dom";
import CotThuocTinh, {
  BangThuocTinh,
  ChungTuLienQuan,
  GiaTriSaoChep,
  NhomThuocTinh,
} from "@/components/chung-tu/CotThuocTinh";
import { soVN } from "@/components/chung-tu/bangChungTu";
import { tachGhiChuPhieuXuat } from "@/components/outbound/phieu-xuat/phieuXuat";
import { SO_PHIEU_XUAT_HIEN } from "@/config/bangChungTu";
import { PICK_LIST_STATUS } from "@/constants/outbound";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { WALKIN_CUSTOMER_CODE } from "@/services/posService";
import { dsPhieuXuat, ghiChuKhiXuat, laDonSan, laDonTaiQuay, laGhiChuTuSinh, phieuDaXuatCuoi, tenKenhCua } from "./tinhDonBan";

const MO = "text-bo-muted";

/**
 * Cột phải của Chi tiết đơn bán hàng: Khách hàng · Giao hàng (kho xuất; vận chuyển, mã vận đơn, ghi chú khi xuất tách từ
 * ghi chú của phiếu đã xuất) · kênh bán (ID đơn trên sàn) · Người tạo, Ghi chú · Chứng từ liên quan (báo giá gốc,
 * phiếu nhặt, các phiếu xuất — quá SO_PHIEU_XUAT_HIEN thì gom "Xem thêm").
 *
 * - `ct`: DonBanHangDetailResponse. `laBan`, `laKho`: vai trò (tên khách là liên kết với bán hàng; phiếu nhặt, phiếu xuất
 *   mở màn kho với vai trò kho).
 * - `baoGia`: `{ ma, id?, trangThai? }` báo giá gốc suy từ mã đơn (có `id` khi đã tra được qua /filter) hoặc null.
 * - Phiếu xuất với nhân viên bán hàng mở trang xem `/goods-issues/:id/view` như màn cũ.
 */
export default function ThuocTinhDonBan({ ct, laBan = false, laKho = false, baoGia = null }) {
  const [xemHetPx, setXemHetPx] = useState(false);
  const don = ct.donBanHang;
  const khach = don.khachHang;
  const laSan = laDonSan(don);
  const laPos = laDonTaiQuay(ct);
  const tenKenh = tenKenhCua(don);

  // ── Khách hàng ──
  const khachLe = !khach?.id || khach?.maKhachHang === WALKIN_CUSTOMER_CODE;
  // Đơn không có khách (máy chủ gán khách lẻ) mới ghi "Khách lẻ"; có khách mà thiếu tên thì "—"
  const tenKhach = khach?.tenKhachHang || (khachLe ? "Khách lẻ" : null);
  const tenKhachHien = !tenKhach ? (
    <span className={MO}>—</span>
  ) : laBan && !khachLe ? (
    <Link to={`/customers/${khach.id}`} className="font-semibold text-bo-primary hover:underline">
      {tenKhach}
    </Link>
  ) : (
    <span className="font-semibold text-bo-foreground">{tenKhach}</span>
  );

  // ── Giao hàng: vận chuyển lấy từ ghi chú của phiếu đã xuất gần nhất (đơn tại quầy không có) ──
  const pxXuat = laPos ? null : phieuDaXuatCuoi(ct);
  const tach = pxXuat ? tachGhiChuPhieuXuat(pxXuat.ghiChu) : null;
  const giaoVan = tach?.giaoVan ?? null;
  const ghiChuXuat = ghiChuKhiXuat(tach?.ghiChu);
  const ghiChuDon = laGhiChuTuSinh(don.ghiChu) ? "" : don.ghiChu;

  // ── Chứng từ liên quan ──
  const px = dsPhieuXuat(ct);
  const pxHien = xemHetPx || px.length <= SO_PHIEU_XUAT_HIEN ? px : px.slice(0, SO_PHIEU_XUAT_HIEN);
  const lienQuan = [
    baoGia?.ma
      ? {
        khoa: "bao-gia",
        loai: "Báo giá",
        ma: baoGia.ma,
        to: laBan && baoGia.id ? `/sales-quotations/${baoGia.id}` : undefined,
        trangThai: laBan ? baoGia.trangThai : undefined,
        quyTrinh: "baoGiaBan",
      }
      : null,
    ct.maPickList
      ? {
        khoa: "phieu-nhat",
        loai: "Phiếu nhặt hàng",
        ma: ct.maPickList,
        to: laKho && ct.phieuNhatHangId ? `/goods-issues/pick-lists/${ct.phieuNhatHangId}` : undefined,
        trangThai: PICK_LIST_STATUS[ct.trangThaiPhieuNhat]?.label,
        quyTrinh: "phieuNhat",
      }
      : null,
    ...pxHien.map((p) => ({
      khoa: `px-${p.id}`,
      loai: "Phiếu xuất kho",
      ma: p.soPhieuXuat,
      to: laKho ? `/goods-issues/${p.id}` : `/goods-issues/${p.id}/view`,
      trangThai: getPhieuXuatKhoStatus(p.trangThai).label,
      quyTrinh: "phieuXuat",
    })),
  ];
  const nutXemThem =
    px.length > SO_PHIEU_XUAT_HIEN ? (
      <button
        type="button"
        aria-expanded={xemHetPx}
        onClick={() => setXemHetPx((cu) => !cu)}
        className="rounded text-[13px] font-semibold text-bo-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/30"
      >
        {xemHetPx ? "Thu gọn" : `Xem thêm ${soVN(px.length - SO_PHIEU_XUAT_HIEN)} phiếu xuất`}
      </button>
    ) : null;

  return (
    <CotThuocTinh nhan="Thông tin đơn bán hàng">
      <NhomThuocTinh nhan="Khách hàng">
        <div className="text-sm leading-5">{tenKhachHien}</div>
        <BangThuocTinh
          rongNhan={112}
          className="mt-2.5"
          muc={[
            { ma: "ma", nhan: "Mã khách hàng", giaTri: khach?.maKhachHang ? <span className="font-mono">{khach.maKhachHang}</span> : null },
            // Máy chủ trả số đã che ("09***678"): chỉ hiện, không sao chép
            { ma: "sdt", nhan: "Điện thoại", giaTri: khach?.soDienThoai ? <span className="tabular-nums">{khach.soDienThoai}</span> : null },
            { ma: "email", nhan: "Email", giaTri: khach?.email },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Giao hàng">
        <BangThuocTinh
          rongNhan={112}
          muc={[
            { ma: "dc", nhan: "Địa chỉ", giaTri: don.diaChiGiaoHang },
            {
              ma: "kho",
              nhan: "Kho xuất",
              giaTri: don.khoXuat?.tenKho ? (
                <>
                  {don.khoXuat.tenKho}
                  {don.khoXuat.maKho ? <span className="ml-1.5 font-mono text-[11px] font-medium text-bo-muted">{don.khoXuat.maKho}</span> : null}
                </>
              ) : null,
            },
            { ma: "dv", nhan: "Vận chuyển", an: !giaoVan, giaTri: giaoVan?.donViVanChuyen },
            {
              ma: "vd",
              nhan: "Mã vận đơn",
              an: !giaoVan,
              giaTri: giaoVan?.maVanDon ? (
                <GiaTriSaoChep giaTri={giaoVan.maVanDon} nhanSaoChep="Sao chép mã vận đơn" className="font-mono" />
              ) : null,
            },
            { ma: "gcx", nhan: "Ghi chú khi xuất", an: !ghiChuXuat, giaTri: <span className="whitespace-pre-line">{ghiChuXuat}</span> },
          ]}
        />
      </NhomThuocTinh>

      {laSan ? (
        <NhomThuocTinh nhan={tenKenh}>
          <BangThuocTinh
            rongNhan={112}
            muc={[
              {
                ma: "san",
                nhan: `ID đơn trên ${tenKenh}`,
                // maDonHangKenh là id nội bộ của sàn (khác số đơn "#1021" hiện trên sàn)
                giaTri: don.maDonHangKenh ? (
                  <GiaTriSaoChep giaTri={don.maDonHangKenh} nhanSaoChep={`Sao chép ID đơn trên ${tenKenh}`} className="font-mono" />
                ) : null,
              },
            ]}
          />
        </NhomThuocTinh>
      ) : null}

      <NhomThuocTinh>
        <BangThuocTinh
          rongNhan={112}
          muc={[
            {
              ma: "nguoiTao",
              nhan: "Người tạo",
              giaTri: don.nguoiTao?.hoTen || (laSan ? <span className={MO}>— (đồng bộ từ {tenKenh}, không có người tạo)</span> : null),
            },
            { ma: "ghiChu", nhan: "Ghi chú", giaTri: ghiChuDon ? <span className="whitespace-pre-line">{ghiChuDon}</span> : null },
          ]}
        />
      </NhomThuocTinh>

      <ChungTuLienQuan ds={lienQuan} chan={nutXemThem} />
    </CotThuocTinh>
  );
}
