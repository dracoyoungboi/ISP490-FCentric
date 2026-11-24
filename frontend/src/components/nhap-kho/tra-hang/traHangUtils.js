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
import { formatCurrency } from "../../../utils/formatters.js";

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

/** Dòng biên bản có lựa chọn theo dòng của máy chủ (màn chi tiết); danh sách không kèm dòng. */
const coDongTheoDong = (bb) => Array.isArray(bb?.items) && bb.items.some((d) => d?.trangThaiHang);

/**
 * Hàng lỗi còn ở kho kho phải làm theo lựa chọn của nhà cung cấp cho từng dòng: `giaoTra` (dòng nhận lại), `tieuHuy`
 * (dòng đồng ý tiêu hủy), mỗi việc { dong, soLuong }. Danh sách không kèm dòng thì lấy số của đầu biên bản (dong rỗng);
 * biên bản cũ một lựa chọn cho cả biên bản thì theo lựa chọn đó.
 */
export function dongKhoCanLam(bb) {
  const rong = { giaoTra: { dong: [], soLuong: 0 }, tieuHuy: { dong: [], soLuong: 0 } };
  if (!bb || bb.trangThai === "DA_HUY" || !bb.phieuDaNhap || bb.trangThaiHang !== "O_KHO") return rong;
  if (coDongTheoDong(bb)) {
    const theo = (hl) => {
      const dong = bb.items.filter((d) => d.trangThaiHang === "O_KHO" && d.hangLoiNcc === hl);
      return { dong, soLuong: dong.reduce((s, d) => s + (Number(d.soLuong) || 0), 0) };
    };
    return { giaoTra: theo("NHAN_LAI"), tieuHuy: theo("TIEU_HUY") };
  }
  const tong = Number(bb.tongSoLuongLoi) || 0;
  const nhanLai = bb.soLuongNhanLai != null ? Number(bb.soLuongNhanLai) || 0 : bb.hangLoiNcc === "NHAN_LAI" ? tong : 0;
  const tieuHuy = bb.soLuongTieuHuy != null ? Number(bb.soLuongTieuHuy) || 0 : bb.hangLoiNcc === "TIEU_HUY" ? tong : 0;
  return { giaoTra: { dong: [], soLuong: nhanLai }, tieuHuy: { dong: [], soLuong: tieuHuy } };
}

/**
 * Việc kho làm được với hàng lỗi còn ở kho, theo lựa chọn của nhà cung cấp: "giaoTra" (còn dòng nhận lại), "tieuHuy"
 * (chỉ còn dòng đồng ý tiêu hủy), hoặc null (chưa chọn, phiếu chưa nhập kho, hàng đã rời kho, biên bản hủy).
 */
export function viecKho(bb) {
  const v = dongKhoCanLam(bb);
  if (v.giaoTra.soLuong > 0) return "giaoTra";
  if (v.tieuHuy.soLuong > 0) return "tieuHuy";
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
  if (bb.trangThaiHang === "DA_XU_LY") return t("đã giao trả và tiêu hủy theo từng sản phẩm");
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

/** Lựa chọn cách bù của một dòng để hiện ở bảng: tên và dòng phụ (nguồn, hàng bù, số tiền). Biên bản chờ ký: null. */
export function cachBuDong(d, bb) {
  if (!d?.cachBu) return null;
  if (d.cachBu === "CHO_CHOT") {
    return { ten: d.nguonCachBu === "NHAP_KHO" ? t("Chờ chọn lại") : t("Chờ chọn"), phu: null, cho: true };
  }
  let phu = null;
  if (d.nguonCachBu === "TU_DONG") phu = t("quá hạn trả lời");
  else if (d.nguonCachBu === "DONG_DON") phu = t("đóng đơn mua");
  if (d.cachBu === "TRU_CONG_NO" && Number(d.giaTri) > 0) phu = [phu, `−${formatCurrency(d.giaTri)}`].filter(Boolean).join(" · ");
  if (d.cachBu === "DOI_HANG" && bb?.phieuDaNhap) phu = [phu, d.buXong ? t("đã nhận đủ hàng bù") : t("chờ hàng bù")].filter(Boolean).join(" · ");
  return { ten: tenCachBu(d.cachBu), phu, cho: false };
}

/** Hàng lỗi của một dòng để hiện ở bảng: đã rời kho, hoặc lựa chọn của nhà cung cấp (chưa chọn: chờ). */
export function hangLoiDong(d) {
  if (d?.trangThaiHang === "DA_TRA") return { ten: t("Đã giao trả"), phu: d.nguoiNhanHang || null, cho: false };
  if (d?.trangThaiHang === "DA_TIEU_HUY") return { ten: t("Đã tiêu hủy"), phu: null, cho: false };
  if (d?.hangLoiNcc) return { ten: tenHangLoiNcc(d.hangLoiNcc), phu: t("ở kho"), cho: false };
  return d?.trangThaiHang ? { ten: t("Chờ chọn"), phu: null, cho: true } : null;
}
