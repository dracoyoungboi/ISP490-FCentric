/*
 * Hàm thuần của màn Chi tiết báo giá bán (`/sales-quotations/:id`): tiến trình, số ngày chờ phản hồi, tìm đơn sinh từ
 * báo giá, dòng thông báo. Không React, không alias "@/…" để chạy `node --test`.
 *
 * Báo giá dùng chung bảng don_ban_hang (loaiChungTu = "bao_gia"), trạng thái backend chỉ gán 3 mã: 0 Chờ phản hồi
 * (cả khi đơn chốt từ báo giá bị hủy), 2 Đã chốt đơn, 4 Bị từ chối. Chốt thành đơn (convert-to-order) đặt mã đơn
 * "BG…" → "SO…", trùng thì thêm "-1", "-2"… và không trả id đơn mới.
 */

import { TRANG_THAI_DON } from "../../../constants/trangThaiXuatBan.js";

export const TT_BAO_GIA = Object.freeze({ CHO_PHAN_HOI: 0, DA_CHOT: 2, TU_CHOI: 4 });

/** Gợi ý chữ cho ô lý do khách từ chối (chỉ là chữ gợi ý, người dùng sửa được). */
export const LY_DO_TU_CHOI_GOI_Y = Object.freeze([
  "Giá cao hơn nơi khác",
  "Khách đổi ý",
  "Hết nhu cầu",
  "Thời gian giao không phù hợp",
  "Không liên lạc được khách",
]);

const MS_NGAY = 24 * 60 * 60 * 1000;

function ngayDau(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Số ngày lịch (theo giờ máy) từ ngày lập tới `bayGio`; không đọc được ngày thì null. */
export function soNgayCho(ngayTao, bayGio = new Date()) {
  const dau = ngayDau(ngayTao);
  const nay = ngayDau(bayGio);
  if (!dau || !nay) return null;
  return Math.max(0, Math.round((nay.getTime() - dau.getTime()) / MS_NGAY));
}

/** "Đang chờ · hôm nay" / "Đang chờ · 3 ngày" (thiếu ngày lập: "Đang chờ"). */
export function chuDangCho(ngayTao, bayGio = new Date()) {
  const n = soNgayCho(ngayTao, bayGio);
  if (n == null) return "Đang chờ";
  return `Đang chờ · ${n === 0 ? "hôm nay" : `${n.toLocaleString("vi-VN")} ngày`}`;
}

/**
 * Tiến trình 3 bước: Lập báo giá → Khách phản hồi → Chốt thành đơn.
 * Chờ phản hồi: bước 2 đang làm "Đang chờ · n ngày" (tính từ ngày lập). Đã chốt: cả 3 xong. Bị từ chối: bước 2 dừng
 * "Khách từ chối". Trạng thái lạ: không có tiến trình.
 */
export function buocBaoGia(don, bayGio = new Date()) {
  if (!don) return [];
  const tt = Number(don.trangThai);
  const lap = { ma: "lap", nhan: "Lập báo giá", trangThai: "xong", ngay: don.ngayTao ?? don.ngayDatHang ?? null, coGio: true };
  if (tt === TT_BAO_GIA.CHO_PHAN_HOI) {
    return [
      lap,
      { ma: "phanHoi", nhan: "Khách phản hồi", trangThai: "dangLam", phu: chuDangCho(don.ngayTao ?? don.ngayDatHang, bayGio) },
      { ma: "chot", nhan: "Chốt thành đơn", trangThai: "chua" },
    ];
  }
  if (tt === TT_BAO_GIA.DA_CHOT) {
    return [
      lap,
      { ma: "phanHoi", nhan: "Khách phản hồi", trangThai: "xong", phu: "Đồng ý" },
      { ma: "chot", nhan: "Chốt thành đơn", trangThai: "xong" },
    ];
  }
  if (tt === TT_BAO_GIA.TU_CHOI) {
    return [
      lap,
      { ma: "phanHoi", nhan: "Khách từ chối", trangThai: "dung" },
      { ma: "chot", nhan: "Chốt thành đơn", trangThai: "chua" },
    ];
  }
  return [];
}

/** Mã đơn gốc sinh từ báo giá: "BG202610217" → "SO202610217" (đơn chốt lại thêm "-1", "-2"…). Không phải BG → null. */
export function maDonTuBaoGia(soBaoGia) {
  const so = String(soBaoGia ?? "").trim();
  return /^BG/.test(so) ? so.replace(/^BG/, "SO") : null;
}

const thoatRegex = (chu) => chu.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hauTo = (so, goc) => {
  const m = new RegExp(`^${thoatRegex(goc)}-(\\d+)$`).exec(so);
  return m ? Number(m[1]) : 0;
};

/**
 * Đơn bán sinh từ báo giá, lọc lại kết quả `POST /don-ban-hang/filter` (máy chủ chỉ có LIKE "%x%"): đúng mẫu
 * `^SO…(-n)?$`, cùng khách hàng, không phải đơn tại quầy (đơn tại quầy cũng có tiền tố SO nhưng tạo thẳng ở Đã thanh
 * toán — đơn chốt từ báo giá luôn "chua_thanh_toan" vì chưa có API ghi nhận thanh toán đơn thường), không phải đơn sàn.
 * Xếp đơn mới chốt trước (hậu tố lớn trước).
 */
export function locDonLienQuan(ds, { soBaoGia, khachHangId } = {}) {
  const goc = maDonTuBaoGia(soBaoGia);
  if (!goc) return [];
  const mau = new RegExp(`^${thoatRegex(goc)}(-\\d+)?$`);
  return (Array.isArray(ds) ? ds : [])
    .filter((d) =>
      d
      && d.loaiChungTu !== "bao_gia"
      && mau.test(String(d.soDonHang ?? ""))
      && (khachHangId == null || d.khachHang?.id == null || String(d.khachHang.id) === String(khachHangId))
      && !d.kenhBanHang
      && !String(d.maDonHangKenh ?? "").trim()
      && d.trangThaiThanhToan !== "da_thanh_toan")
    .sort((a, b) => hauTo(String(b.soDonHang), goc) - hauTo(String(a.soDonHang), goc));
}

/**
 * Dòng thông báo `{ ma, tone, chu }`:
 * - Bị từ chối: "Khách từ chối: <lý do>".
 * - Chờ phản hồi mà đã có đơn chốt từ báo giá bị hủy: chốt lại sẽ tạo đơn mới (mã thêm hậu tố).
 * `donLienQuan`: kết quả locDonLienQuan (có thể rỗng khi chưa tải / không xem được).
 */
export function thongBaoBaoGia(don, donLienQuan = []) {
  if (!don) return [];
  const tt = Number(don.trangThai);
  const ds = [];
  if (tt === TT_BAO_GIA.TU_CHOI) {
    const lyDo = String(don.lyDoTuChoi ?? "").trim();
    ds.push({ ma: "tuChoi", tone: "neutral", chu: lyDo ? `Khách từ chối: ${lyDo}` : "Khách từ chối báo giá." });
  }
  if (tt === TT_BAO_GIA.CHO_PHAN_HOI) {
    const daHuy = (Array.isArray(donLienQuan) ? donLienQuan : []).find((d) => Number(d.trangThai) === TRANG_THAI_DON.DA_HUY);
    if (daHuy) {
      ds.push({
        ma: "chotLai",
        tone: "info",
        chu: `Đơn ${daHuy.soDonHang} chốt từ báo giá này đã bị hủy nên báo giá trở lại Chờ phản hồi. Chốt lại sẽ tạo đơn mới (mã thêm hậu tố).`,
      });
    }
  }
  return ds;
}

/** Câu khi báo giá đã chốt mà không tìm thấy đơn trong phạm vi người đang xem (danh sách lọc theo người tạo). */
export const cauKhongThayDon = (nguoiLap) =>
  `Báo giá đã chốt thành đơn nhưng không tìm thấy đơn trong danh sách bạn được xem${nguoiLap ? ` (đơn thuộc ${nguoiLap})` : ""}.`;
