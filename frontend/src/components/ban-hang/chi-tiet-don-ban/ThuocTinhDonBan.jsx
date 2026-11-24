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
import { dsPhieuXuat, ghiChuKhiXuat, laDonSan, laDonTaiQuay, laGiaTriAnPii, laMaVanDonGiaShopee, lamSachGhiChuDonSan, phieuDaXuatCuoi, tenKenhCua } from "./tinhDonBan";
import { coKhoiBangChung } from "./bangChungDon";
import KhoiBangChungDongGoi from "./KhoiBangChungDongGoi";
import { t } from "@/i18n";

const MO = "text-bo-muted";

/**
 * Cột phải của Chi tiết đơn bán hàng: Khách hàng · Giao hàng (kho xuất; vận chuyển, mã vận đơn, ghi chú khi xuất tách từ
 * ghi chú của phiếu đã xuất) · Bằng chứng đóng gói (chỉ xem, từ bước đóng gói trở đi) · kênh bán (ID đơn trên sàn) ·
 * Người tạo, Ghi chú · Chứng từ liên quan (phiếu nhặt, các phiếu xuất — quá SO_PHIEU_XUAT_HIEN thì gom "Xem thêm").
 *
 * - `ct`: DonBanHangDetailResponse. `laBan`, `laKho`: vai trò (tên khách là liên kết với bán hàng; phiếu nhặt, phiếu xuất
 *   mở màn kho với vai trò kho).
 * - Phiếu xuất với nhân viên bán hàng mở trang xem `/goods-issues/:id/view` như màn cũ.
 */
export default function ThuocTinhDonBan({ ct, laBan = false, laKho = false }) {
  const [xemHetPx, setXemHetPx] = useState(false);
  const don = ct.donBanHang;
  const khach = don.khachHang;
  const laSan = laDonSan(don);
  const laPos = laDonTaiQuay(ct);
  const tenKenh = tenKenhCua(don);

  // ── Khách hàng ──
  const khachLe = !khach?.id || khach?.maKhachHang === WALKIN_CUSTOMER_CODE;
  // Đơn không có khách (máy chủ gán khách lẻ) mới ghi "Khách lẻ"; có khách mà thiếu tên thì "—"
  const tenKhach = khach?.tenKhachHang || (khachLe ? t("Khách lẻ") : null);
  const tenKhachHien = !tenKhach ? (
    <span className={MO}>—</span>
  ) : laBan && !khachLe ? (
    <Link to={`/customers/${khach.id}`} className="font-semibold text-bo-primary hover:underline">
      {tenKhach}
    </Link>
  ) : (
    <span className="font-semibold text-bo-foreground">{tenKhach}</span>
  );

  // ── Giao hàng: ưu tiên dữ liệu đã xuất thực tế, fallback sang metadata đã đồng bộ từ sàn (lọc mã SPXVN giả) ──
  const pxXuat = laPos ? null : phieuDaXuatCuoi(ct);
  const tach = pxXuat ? tachGhiChuPhieuXuat(pxXuat.ghiChu) : null;
  const giaoVan = tach?.giaoVan ?? null;
  const maVanDonTuPx = laMaVanDonGiaShopee(giaoVan?.maVanDon, don.maDonHangKenh) ? "" : (giaoVan?.maVanDon || "");
  const maVanDonTuDon = laMaVanDonGiaShopee(don.maVanDon, don.maDonHangKenh) ? "" : (don.maVanDon || "");
  const maVanDon = maVanDonTuPx || maVanDonTuDon;
  const donViVanChuyen = giaoVan?.donViVanChuyen || don.donViVanChuyen || "";
  const maDinhTuyen = don.maDinhTuyen || "";
  const maTramPhat = don.maTramPhat || "";
  const thanhToanSanNhan = laSan ? (don.nhanThanhToan || "") : "";
  const ghiChuXuat = ghiChuKhiXuat(tach?.ghiChu);
  const ghiChuDon = lamSachGhiChuDonSan(don.ghiChu);

  // ── Chứng từ liên quan ──
  const px = dsPhieuXuat(ct);
  const pxHien = xemHetPx || px.length <= SO_PHIEU_XUAT_HIEN ? px : px.slice(0, SO_PHIEU_XUAT_HIEN);
  const lienQuan = [
    ct.maPickList
      ? {
        khoa: "phieu-nhat",
        loai: t("Phiếu nhặt hàng"),
        ma: ct.maPickList,
        to: laKho && ct.phieuNhatHangId ? `/goods-issues/pick-lists/${ct.phieuNhatHangId}` : undefined,
        trangThai: PICK_LIST_STATUS[ct.trangThaiPhieuNhat]?.label,
        quyTrinh: "phieuNhat",
      }
      : null,
    ...pxHien.map((p) => ({
      khoa: `px-${p.id}`,
      loai: t("Phiếu xuất kho"),
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
        {xemHetPx ? t("Thu gọn") : t("Xem thêm {{so}} phiếu xuất", { count: px.length - SO_PHIEU_XUAT_HIEN, so: soVN(px.length - SO_PHIEU_XUAT_HIEN) })}
      </button>
    ) : null;

  return (
    <CotThuocTinh nhan={t("Thông tin đơn bán hàng")}>
      <NhomThuocTinh nhan={t("Khách hàng")}>
        <div className="text-sm leading-5">{tenKhachHien}</div>
        <BangThuocTinh
          rongNhan={112}
          className="mt-2.5"
          muc={[
            { ma: "ma", nhan: t("Mã khách hàng"), giaTri: khach?.maKhachHang ? <span className="font-mono">{khach.maKhachHang}</span> : null },
            {
              ma: "sdt",
              nhan: t("Điện thoại"),
              giaTri: !khach?.soDienThoai ? null : laGiaTriAnPii(khach.soDienThoai) ? (
                <span className={MO}>{khach.soDienThoai}</span>
              ) : (
                <GiaTriSaoChep giaTri={khach.soDienThoai} nhanSaoChep={t("Sao chép số điện thoại")} className="tabular-nums" />
              ),
            },
            { ma: "email", nhan: "Email", giaTri: khach?.email },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh nhan={t("Giao hàng")}>
        <BangThuocTinh
          rongNhan={112}
          muc={[
            { ma: "dc", nhan: t("Địa chỉ"), giaTri: don.diaChiGiaoHang },
            {
              ma: "kho",
              nhan: t("Kho xuất"),
              giaTri: don.khoXuat?.tenKho ? (
                <>
                  {don.khoXuat.tenKho}
                  {don.khoXuat.maKho ? <span className="ml-1.5 font-mono text-[11px] font-medium text-bo-muted">{don.khoXuat.maKho}</span> : null}
                </>
              ) : null,
            },
            { ma: "dv", nhan: t("Vận chuyển"), an: !donViVanChuyen, giaTri: donViVanChuyen },
            {
              ma: "vd",
              nhan: t("Mã vận đơn"),
              an: !maVanDon,
              giaTri: maVanDon ? (
                <GiaTriSaoChep giaTri={maVanDon} nhanSaoChep={t("Sao chép mã vận đơn")} className="font-mono" />
              ) : null,
            },
            {
              ma: "tuyen",
              nhan: t("Mã chia chọn tuyến"),
              an: !maDinhTuyen,
              giaTri: maDinhTuyen ? (
                <GiaTriSaoChep giaTri={maDinhTuyen} nhanSaoChep={t("Sao chép mã chia chọn tuyến")} className="font-mono" />
              ) : null,
            },
            {
              ma: "tram",
              nhan: t("Mã trạm phát"),
              an: !maTramPhat,
              giaTri: maTramPhat ? (
                <GiaTriSaoChep giaTri={maTramPhat} nhanSaoChep={t("Sao chép mã trạm phát")} className="font-mono" />
              ) : null,
            },
            {
              ma: "ptttSan",
              nhan: t("Thanh toán sàn"),
              an: !thanhToanSanNhan,
              giaTri: thanhToanSanNhan,
            },
            { ma: "gcx", nhan: t("Ghi chú khi xuất"), an: !ghiChuXuat, giaTri: <span className="whitespace-pre-line">{ghiChuXuat}</span> },
          ]}
        />
      </NhomThuocTinh>

      {coKhoiBangChung({ trangThai: don.trangThai, laPos, laBan, laKho }) ? (
        <KhoiBangChungDongGoi donId={don.id} trangThai={don.trangThai} />
      ) : null}

      {laSan ? (
        <NhomThuocTinh nhan={tenKenh}>
          <BangThuocTinh
            rongNhan={112}
            muc={[
              {
                ma: "san",
                nhan: t("ID đơn trên {{tenKenh}}", { tenKenh }),
                // maDonHangKenh là id nội bộ của sàn (khác số đơn "#1021" hiện trên sàn)
                giaTri: don.maDonHangKenh ? (
                  <GiaTriSaoChep giaTri={don.maDonHangKenh} nhanSaoChep={t("Sao chép ID đơn trên {{tenKenh}}", { tenKenh })} className="font-mono" />
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
              nhan: t("Người tạo"),
              giaTri: don.nguoiTao?.hoTen || (laSan ? <span className={MO}>{t("— (đồng bộ từ {{tenKenh}}, không có người tạo)", { tenKenh })}</span> : null),
            },
            { ma: "ghiChu", nhan: t("Ghi chú"), giaTri: ghiChuDon ? <span className="whitespace-pre-line">{ghiChuDon}</span> : null },
          ]}
        />
      </NhomThuocTinh>

      <ChungTuLienQuan ds={lienQuan} chan={nutXemThem} />
    </CotThuocTinh>
  );
}
