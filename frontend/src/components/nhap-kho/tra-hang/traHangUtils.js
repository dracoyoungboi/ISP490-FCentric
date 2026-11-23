/*
 * Hàm thuần cho biên bản trả hàng nhà cung cấp. Nhà cung cấp quyết trên Cổng nhà cung cấp (cách bù, nhận lại hay tiêu
 * hủy hàng lỗi còn ở kho); kho chỉ làm theo. Không phụ thuộc React.
 */
import {
  CACH_GIAO_TRA,
  CACH_XU_LY_HANG,
  TEN_CACH_BU,
  TEN_HANG_LOI_NCC,
} from "../../../constants/nhapKho.js";
import { t } from "../../../i18n/t.js";

const tenTheoMa = (ds, ma) => ds.find((x) => x.ma === ma)?.ten ?? ma;

/** Đường dẫn trang in biên bản trả hàng (mẫu A4, ký 3 bên). */
export const duongDanInBienBan = (id) => `/supplier-returns/${id}/print`;

/** Nhà cung cấp còn việc phải trả lời trên cổng (chọn cách bù, hoặc chọn nhận lại / tiêu hủy hàng lỗi). */
export const choNccTraLoi = (bb) => Boolean(bb?.choNccChonCachBu || bb?.choNccChonHangLoi);

/** Biên bản đã lập, kho chưa ghi người giao hàng đã ký: chưa gửi nhà cung cấp, chưa nhập kho được. */
export const choKyBienBan = (bb) => bb?.kyBienBan === "CHO_KY" && bb?.trangThai !== "DA_HUY";

/** "Lê Văn Tài · Nhà xe Phương Trang · 29C-123.45" (đơn vị chỉ khi người của bên vận chuyển). */
export const tenNguoiGiao = (bb) =>
  [bb?.nguoiGiao, bb?.benKy === "VAN_CHUYEN" ? bb?.donViVanChuyen : null, bb?.bienSoXe].filter(Boolean).join(" · ");

/** Việc ký biên bản giấy cho dòng thông tin; "" với biên bản lập trước khi có bước ký. */
export function moTaKy(bb) {
  switch (bb?.kyBienBan) {
    case "CHO_KY":
      return t("Chờ {{ten}} ký", { ten: tenNguoiGiao(bb) });
    case "DA_KY":
      return bb.benKy === "VAN_CHUYEN"
        ? t("{{ten}} đã ký (bên vận chuyển)", { ten: tenNguoiGiao(bb) })
        : t("{{ten}} đã ký (đại diện nhà cung cấp)", { ten: tenNguoiGiao(bb) });
    default:
      return "";
  }
}

/**
 * Việc kho làm được với hàng lỗi còn ở kho, theo lựa chọn của nhà cung cấp: "giaoTra" (nhà cung cấp nhận lại),
 * "tieuHuy" (nhà cung cấp đồng ý tiêu hủy), hoặc null (chưa chọn, phiếu chưa nhập kho, hàng đã rời kho, biên bản hủy).
 */
export function viecKho(bb) {
  if (!bb || bb.trangThai === "DA_HUY" || !bb.phieuDaNhap || bb.trangThaiHang !== "O_KHO") return null;
  if (bb.hangLoiNcc === "NHAN_LAI") return "giaoTra";
  if (bb.hangLoiNcc === "TIEU_HUY") return "tieuHuy";
  return null;
}

/** Ngày hạn đã qua (hạn là cuối ngày; so theo thời điểm). */
export const quaHan = (han, bayGio = Date.now()) => Boolean(han) && new Date(han).getTime() < bayGio;

/** Chi tiết hàng lỗi đang ở đâu, hiện cạnh nhãn trạng thái hàng (không nhắc lại nhãn). */
export function moTaHangLoi(bb) {
  if (!bb) return "";
  if (bb.cachXuLyHang === "TRA_NGAY" && bb.trangThaiHang === "DA_TRA") {
    return bb.nguoiNhanHang
      ? t("trả ngay cho người giao hàng {{ten}}", { ten: bb.nguoiNhanHang })
      : t("trả ngay cho người giao hàng");
  }
  if (choKyBienBan(bb) && bb.cachXuLyHang === "TRA_NGAY") return t("chờ {{ten}} ký nhận", { ten: bb.nguoiGiao || "" });
  if (bb.trangThaiHang === "DA_TRA") {
    return bb.cachGiao === "VAN_CHUYEN"
      ? t("gửi {{donVi}}{{phanMa}}", { donVi: bb.nguoiNhanHang || "", phanMa: bb.maVanDon ? ` · ${bb.maVanDon}` : "" })
      : t("{{ten}} đến lấy", { ten: bb.nguoiNhanHang || t("Nhà cung cấp") });
  }
  if (bb.trangThaiHang === "DA_TIEU_HUY") {
    return t("nhà cung cấp đồng ý: {{ten}}", { ten: bb.nguoiNhanHang || "—" });
  }
  if (bb.trangThaiHang === "KHONG_RO") return t("biên bản lập trước khi có bước giao trả");
  return t("{{soLoi}} sản phẩm lỗi", { count: Number(bb.tongSoLuongLoi) || 0, soLoi: Number(bb.tongSoLuongLoi) || 0 });
}

/** Tên cách bù (dịch lúc hiện). */
export const tenCachBu = (ma) => t(TEN_CACH_BU[ma] ?? ma);

/** Tên lựa chọn của nhà cung cấp cho hàng lỗi. */
export const tenHangLoiNcc = (ma) => (ma ? t(TEN_HANG_LOI_NCC[ma] ?? ma) : "");

/** Tên cách xử lý hàng lỗi lúc lập. */
export const tenCachXuLy = (ma) => t(tenTheoMa(CACH_XU_LY_HANG, ma));

/** Tên cách giao trả. */
export const tenCachGiao = (ma) => t(tenTheoMa(CACH_GIAO_TRA, ma));

/** Câu một lần nhà cung cấp trả lời trên cổng: chọn gì, ai xác nhận. */
function cauNccTraLoi(bb, phan, nguoi) {
  return t("{{ncc}} chọn {{luaChon}} trên Cổng nhà cung cấp · người xác nhận: {{xacNhan}}", {
    ncc: bb.tenNhaCungCap || "—",
    luaChon: phan.join(", "),
    xacNhan: nguoi || "—",
  });
}

/**
 * Lịch sử biên bản dựng từ các mốc máy chủ lưu (lập, người giao hàng ký, gửi email, nhập kho, cách bù, lựa chọn hàng lỗi, giao trả /
 * tiêu hủy), cũ trước. Cách bù và hàng lỗi chọn cùng một lần trên cổng thì gộp một dòng. Trả [{ luc: ISO, noiDung }].
 */
export function lichSuBienBan(bb) {
  if (!bb) return [];
  const ds = [];
  if (bb.ngayLap) {
    ds.push({
      luc: bb.ngayLap,
      noiDung: bb.cachXuLyHang === "TRA_NGAY"
        ? t("{{nguoi}} lập biên bản, giao luôn cho {{ten}}", { nguoi: bb.nguoiLap || "—", ten: bb.nguoiGiao || bb.nguoiNhanHang || "" })
        : t("{{nguoi}} lập biên bản, để hàng lỗi ở kho chờ trả", { nguoi: bb.nguoiLap || "—" }),
    });
  }
  if (bb.thoiDiemKy && bb.kyBienBan === "DA_KY") {
    const thamSo = { nguoi: bb.nguoiGhiKy || "—", ten: tenNguoiGiao(bb) };
    ds.push({
      luc: bb.thoiDiemKy,
      noiDung: bb.cachXuLyHang === "TRA_NGAY"
        ? t("{{nguoi}} ghi {{ten}} đã ký biên bản và nhận hàng lỗi", thamSo)
        : t("{{nguoi}} ghi {{ten}} đã ký biên bản", thamSo),
    });
  }
  if (bb.emailGuiLuc) {
    ds.push({ luc: bb.emailGuiLuc, noiDung: t("Đã gửi biên bản cho nhà cung cấp qua email {{email}}", { email: bb.emailNcc || "—" }) });
  }
  if (bb.ngayNhapKho) {
    ds.push({
      luc: bb.ngayNhapKho,
      noiDung: t("{{nguoi}} nhập kho phiếu {{soPhieu}}, số lỗi đã khóa", { nguoi: bb.nguoiNhapKho || "—", soPhieu: bb.soPhieuNhap }),
    });
  }
  const coCachBu = Boolean(bb.thoiDiemChot && bb.phuongAn && bb.phuongAn !== "CHO_CHOT");
  const cungLan = coCachBu && bb.nguonChot === "CONG_NCC" && bb.hangLoiNcc && bb.thoiDiemChonHangLoi === bb.thoiDiemChot;
  if (coCachBu) {
    const cach = tenCachBu(bb.phuongAn).toLowerCase();
    let noiDung;
    if (bb.nguonChot === "DONG_DON") {
      noiDung = bb.phuongAn === "TRU_CONG_NO"
        ? t("{{nguoi}} đóng đơn mua, chuyển hàng lỗi chưa xong sang trừ tiền hàng ({{soLuong}} sản phẩm)", { count: Number(bb.soLuongTruTien) || 0, nguoi: bb.nguoiChot || "—", soLuong: Number(bb.soLuongTruTien) || 0 })
        : t("{{nguoi}} đóng đơn mua, hàng bù coi như đã đủ", { nguoi: bb.nguoiChot || "—" });
    } else if (bb.nguonChot === "TU_DONG") {
      noiDung = t("Quá hạn trả lời, hệ thống chuyển hàng lỗi sang trừ tiền hàng");
    } else if (bb.nguonChot === "CONG_NCC") {
      const phan = [cach];
      if (cungLan) phan.push(tenHangLoiNcc(bb.hangLoiNcc).toLowerCase());
      noiDung = cauNccTraLoi(bb, phan, bb.nguoiXacNhanNcc);
    } else {
      noiDung = t("Chốt {{cach}} theo phương án của biên bản cũ", { cach });
    }
    ds.push({ luc: bb.thoiDiemChot, noiDung });
  }
  if (bb.hangLoiNcc && bb.thoiDiemChonHangLoi && !cungLan) {
    ds.push({ luc: bb.thoiDiemChonHangLoi, noiDung: cauNccTraLoi(bb, [tenHangLoiNcc(bb.hangLoiNcc).toLowerCase()], bb.nguoiChonHangLoi) });
  }
  if (bb.thoiDiemTra && bb.cachXuLyHang !== "TRA_NGAY") {
    if (bb.trangThaiHang === "DA_TIEU_HUY") {
      ds.push({ luc: bb.thoiDiemTra, noiDung: t("{{nguoi}} ghi tiêu hủy hàng lỗi, nhà cung cấp đồng ý: {{ten}}", { nguoi: bb.nguoiGhiTra || "—", ten: bb.nguoiNhanHang || "—" }) });
    } else if (bb.trangThaiHang === "DA_TRA") {
      ds.push({ luc: bb.thoiDiemTra, noiDung: t("{{nguoi}} ghi đã giao trả · {{moTa}}", { nguoi: bb.nguoiGhiTra || "—", moTa: moTaHangLoi(bb) }) });
    }
  }
  return ds.sort((a, b) => new Date(a.luc).getTime() - new Date(b.luc).getTime());
}

/** Số trừ tiền và tiền đã trừ của biên bản. */
export function tongTruTien(bb) {
  return { soLuong: Number(bb?.soLuongTruTien) || 0, tien: Number(bb?.tienTruTien) || 0 };
}
