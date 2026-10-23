import { Link } from "react-router-dom";
import CotThuocTinh, { BangThuocTinh, ChungTuLienQuan, NhomThuocTinh } from "@/components/chung-tu/CotThuocTinh";
import { NutChu } from "@/components/chung-tu/DongThongBao";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { WALKIN_CUSTOMER_CODE } from "@/services/posService";
import { TT_BAO_GIA, cauKhongThayDon } from "./tinhBaoGiaBan";

/**
 * Cột phải của Chi tiết báo giá bán: Khách hàng (tên là liên kết với bán hàng; mã, người liên hệ, điện thoại đã che,
 * email, mã số thuế) · Giao hàng (địa chỉ) · Người lập, Ghi chú · Chứng từ liên quan: các đơn bán sinh từ báo giá
 * (tinhBaoGiaBan.locDonLienQuan, chỉ bán hàng tra được).
 *
 * - `don`: donBanHang của báo giá. `laBan`: quản trị viên / nhân viên bán hàng.
 * - `donLienQuan`: mảng đơn (DonBanHangDto) hoặc `null` khi chưa tra / không tra (vai trò kho).
 * - `loiDonLienQuan`: câu lỗi khi tra đơn liên quan thất bại (kèm nút "Thử lại" gọi `onThuLaiDonLienQuan`).
 */
export default function ThuocTinhBaoGiaBan({ don, laBan = false, donLienQuan = null, loiDonLienQuan = null, onThuLaiDonLienQuan }) {
  const khach = don.khachHang;
  const khachLe = !khach?.id || khach?.maKhachHang === WALKIN_CUSTOMER_CODE;
  const tenKhach = khach?.tenKhachHang || (khachLe ? "Khách lẻ" : "—");
  const tt = Number(don.trangThai);

  const lienQuan = (Array.isArray(donLienQuan) ? donLienQuan : []).map((d) => ({
    khoa: `don-${d.id}`,
    loai: "Đơn bán hàng",
    ma: d.soDonHang,
    to: `/sales-orders/${d.id}`,
    trangThai: getDonBanHangStatus(d.trangThai).label,
    quyTrinh: "donBan",
  }));
  // Đã chốt mà không thấy đơn: danh sách đơn của nhân viên bán hàng chỉ gồm đơn do chính họ tạo
  const khongThay = laBan && Array.isArray(donLienQuan) && donLienQuan.length === 0 && tt === TT_BAO_GIA.DA_CHOT;

  return (
    <CotThuocTinh nhan="Thông tin báo giá">
      <NhomThuocTinh nhan="Khách hàng">
        <div className="text-sm leading-5">
          {laBan && !khachLe ? (
            <Link to={`/customers/${khach.id}`} className="font-semibold text-bo-primary hover:underline">
              {tenKhach}
            </Link>
          ) : (
            <span className="font-semibold text-bo-foreground">{tenKhach}</span>
          )}
        </div>
        <BangThuocTinh
          rongNhan={112}
          className="mt-2.5"
          muc={[
            { ma: "ma", nhan: "Mã khách hàng", giaTri: khach?.maKhachHang ? <span className="font-mono">{khach.maKhachHang}</span> : null },
            { ma: "lh", nhan: "Người liên hệ", an: !khach?.nguoiLienHe, giaTri: khach?.nguoiLienHe },
            // Máy chủ trả số đã che: chỉ hiện, không sao chép
            { ma: "sdt", nhan: "Điện thoại", giaTri: khach?.soDienThoai ? <span className="tabular-nums">{khach.soDienThoai}</span> : null },
            { ma: "email", nhan: "Email", giaTri: khach?.email },
            { ma: "mst", nhan: "Mã số thuế", an: !khach?.maSoThue, giaTri: <span className="tabular-nums">{khach?.maSoThue}</span> },
          ]}
        />
      </NhomThuocTinh>

      <NhomThuocTinh nhan="Giao hàng">
        <BangThuocTinh rongNhan={112} muc={[{ ma: "dc", nhan: "Địa chỉ", giaTri: don.diaChiGiaoHang }]} />
      </NhomThuocTinh>

      <NhomThuocTinh>
        <BangThuocTinh
          rongNhan={112}
          muc={[
            { ma: "nguoiLap", nhan: "Người lập", giaTri: don.nguoiTao?.hoTen },
            { ma: "ghiChu", nhan: "Ghi chú", giaTri: don.ghiChu ? <span className="whitespace-pre-line">{don.ghiChu}</span> : null },
          ]}
        />
      </NhomThuocTinh>

      <ChungTuLienQuan
        ds={lienQuan}
        chan={
          loiDonLienQuan ? (
            <p className="m-0 text-[13px] leading-5 text-bo-muted">
              Không tải được đơn sinh từ báo giá: {loiDonLienQuan}.{" "}
              <NutChu onClick={onThuLaiDonLienQuan}>Thử lại</NutChu>
            </p>
          ) : khongThay ? (
            <p className="m-0 text-[13px] leading-5 text-bo-muted">{cauKhongThayDon(don.nguoiTao?.hoTen)}</p>
          ) : null
        }
      />
    </CotThuocTinh>
  );
}
