/*
 * Hàm thuần của màn Tạo báo giá bán (/sales-quotations/create): khoảng đơn giá, đọc ô số, tìm biến thể / khách hàng,
 * lý do khóa nút Lưu, thân yêu cầu POST /don-ban-hang/create. Không gọi API, không phụ thuộc React (chạy bằng node --test).
 *
 * Dòng báo giá trong màn: { bienTheId, soLuong, donGia, giaNiemYet, ... } — `soLuong` / `donGia` là số, hoặc "" khi người
 * dùng đang xóa trống ô (rời ô thì màn trả về 1 / giá niêm yết).
 */
import { boDau, docSo, khopTuKhoa, tachTuKhoa } from "../../chung-tu/bangChungTu.js";
import { SO_GOI_Y_KHACH, SO_GOI_Y_SAN_PHAM, TI_LE_GIA_BAO_GIA } from "../../../config/bangChungTu.js";

export const SO_LUONG_TOI_DA = 99999;
const SO_CHU_SO_TIEN_TOI_DA = 12;

// Bỏ sai số dấu phẩy động trước khi làm tròn lên / xuống (vd. 120000 × 0,9 không ra 108000,0000001)
const gon = (x) => Math.round(x * 1e6) / 1e6;

/**
 * Khoảng đơn giá cho phép của một biến thể, làm tròn VÀO TRONG khoảng (tối thiểu làm tròn lên, tối đa làm tròn xuống)
 * — cùng mốc với câu lỗi của máy chủ, nên đơn giá nằm trong khoảng ở màn thì máy chủ cũng nhận.
 */
export function khoangGia(giaNiemYet) {
  const g = docSo(giaNiemYet);
  return {
    toiThieu: Math.ceil(gon(g * TI_LE_GIA_BAO_GIA.toiThieu)),
    toiDa: Math.floor(gon(g * TI_LE_GIA_BAO_GIA.toiDa)),
  };
}

/**
 * Kiểm đơn giá một dòng: `loi` là "chuaCoGia" (biến thể chưa có giá niêm yết: không có khoảng để so, máy chủ chặn) |
 * "trong" (chưa nhập) | "thap" | "cao" | null (hợp lệ), kèm khoảng cho phép và `lech`: phần trăm lệch so với giá niêm
 * yết (âm là giảm), làm tròn 1 chữ số; 0 khi đúng giá niêm yết.
 */
export function kiemTraDonGia(donGia, giaNiemYet) {
  const khoang = khoangGia(giaNiemYet);
  if (!(docSo(giaNiemYet) > 0)) return { loi: "chuaCoGia", lech: null, ...khoang };
  if (donGia === "" || donGia == null) return { loi: "trong", lech: null, ...khoang };
  const gia = docSo(donGia);
  const niemYet = docSo(giaNiemYet);
  const lech = niemYet > 0 ? Math.round(((gia - niemYet) / niemYet) * 1000) / 10 : 0;
  const loi = gia < khoang.toiThieu ? "thap" : gia > khoang.toiDa ? "cao" : null;
  return { loi, lech, ...khoang };
}

/** Ô tiền (đơn giá, phí vận chuyển): chỉ giữ chữ số (dán "120.000 ₫" vẫn ra 120000); trống → "". */
export function docOTien(chu) {
  const so = String(chu ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, SO_CHU_SO_TIEN_TOI_DA);
  return so === "" ? "" : Number(so);
}

/**
 * Ô số lượng: chỉ nhận số nguyên dương. Có ký tự khác chữ số ("3.5", "-2", "2a") thì trả `undefined` để màn GIỮ giá trị
 * cũ — không lặng lẽ đọc "3.5" thành 35. Trống → "" (rời ô thì màn trả về 1). Quá SO_LUONG_TOI_DA thì kẹp lại.
 */
export function docOSoLuong(chu) {
  const tho = String(chu ?? "").trim();
  if (tho === "") return "";
  if (/\D/.test(tho)) return undefined;
  return Math.min(Number(tho), SO_LUONG_TOI_DA);
}

// Dạng "dòng chứng từ" của biến thể / khách để tìm bằng khopTuKhoa (nhớ theo đối tượng: chữ tìm chỉ tính một lần)
const DONG_TIM = new WeakMap();
function dongTimCua(doiTuong, taoDong) {
  if (!doiTuong || typeof doiTuong !== "object") return {};
  if (!DONG_TIM.has(doiTuong)) DONG_TIM.set(doiTuong, taoDong(doiTuong));
  return DONG_TIM.get(doiTuong);
}
const dongTimBienThe = (v) => dongTimCua(v, (x) => ({
  tenSanPham: x.tenSanPham, sku: x.maBienThe, maVach: x.maVachSku, tenMau: x.tenMau, kichCo: x.tenSize, chuTimThem: x.tenChatLieu,
}));
// Tên + mã khách đã bỏ dấu, tách thành từ (nhớ theo đối tượng khách)
const TU_KHACH = new WeakMap();
function tuKhachCua(k) {
  if (!k || typeof k !== "object") return { chu: "", tu: [] };
  if (!TU_KHACH.has(k)) {
    const chu = boDau(`${k.tenKhachHang ?? ""} ${k.maKhachHang ?? ""}`);
    TU_KHACH.set(k, { chu, tu: chu.split(/[\s\-_/.,()]+/).filter(Boolean) });
  }
  return TU_KHACH.get(k);
}
// Chỉ số và dấu ngăn của số điện thoại: "0905", "0912 345", "+84 905…"
const LA_SO_DIEN_THOAI = /^[\d\s.+()-]+$/;

/**
 * Tìm biến thể theo tên, SKU, mã vạch, màu, cỡ, chất liệu — cùng cách tìm của bảng chứng từ (khopTuKhoa: không dấu,
 * mọi từ phải có, từ 1–2 ký tự như cỡ "L" phải trùng nguyên một từ). Trả `ds` (tối đa `gioiHan`) và `tong` (số biến thể
 * khớp). Từ khóa trống: các biến thể đầu danh sách.
 */
export function timBienThe(dsBienThe, tuKhoa, gioiHan = SO_GOI_Y_SAN_PHAM) {
  const ds = Array.isArray(dsBienThe) ? dsBienThe : [];
  const tu = tachTuKhoa(tuKhoa);
  const khop = tu.length ? ds.filter((v) => khopTuKhoa(dongTimBienThe(v), tu)) : ds;
  return { ds: khop.slice(0, gioiHan), tong: khop.length };
}

/**
 * Enter ở ô tìm / máy quét: trùng đúng SKU hoặc mã vạch thì lấy biến thể đó; không thì chỉ lấy khi còn đúng một kết quả
 * (tránh mã lạ là chuỗi con của mã khác cộng nhầm). Trả `{ bienThe }`, `{ loi: "nhieu" | "khong" }`, hoặc null khi trống.
 */
export function chonKhiEnter(dsBienThe, tuKhoa) {
  const tho = String(tuKhoa ?? "").trim();
  if (!tho) return null;
  const thuong = tho.toLowerCase();
  const ds = Array.isArray(dsBienThe) ? dsBienThe : [];
  const trung = ds.find((v) => v?.maBienThe?.toLowerCase() === thuong || v?.maVachSku?.toLowerCase() === thuong);
  if (trung) return { bienThe: trung };
  const { ds: kq, tong } = timBienThe(ds, tho, 1);
  if (tong === 1) return { bienThe: kq[0] };
  return { loi: tong > 1 ? "nhieu" : "khong" };
}

/**
 * Lọc khách (dữ liệu /khach-hang/for-sales-order, chỉ khách đang hoạt động) theo tên / mã khách, không dấu, mọi từ
 * phải có: từ 1–2 ký tự khớp ĐẦU một từ ("ng" ra "Nguyễn", "tr" ra "Trần"), từ dài hơn khớp ở bất kỳ đâu. Gõ toàn chữ
 * số (từ 3 số) thì tìm theo số điện thoại. Từ khóa trống: các khách đầu danh sách.
 */
export function locKhach(dsKhach, tuKhoa, gioiHan = SO_GOI_Y_KHACH) {
  const ds = Array.isArray(dsKhach) ? dsKhach : [];
  const tho = String(tuKhoa ?? "").trim();
  if (!tho) return ds.slice(0, gioiHan);
  const tuTim = tachTuKhoa(tho);
  const so = LA_SO_DIEN_THOAI.test(tho) ? tho.replace(/\D/g, "") : "";
  return ds.filter((k) => {
    const { chu, tu } = tuKhachCua(k);
    const khopTen = tuTim.length > 0
      && tuTim.every((t) => (t.length > 2 ? chu.includes(t) : tu.some((w) => w.startsWith(t))));
    if (khopTen) return true;
    return so.length >= 3 && String(k?.soDienThoai ?? "").replace(/\D/g, "").includes(so);
  }).slice(0, gioiHan);
}

/**
 * Dòng như khi gửi: ô số lượng đang trống / 0 tính là 1, ô đơn giá đang trống tính là giá niêm yết — đúng giá trị màn
 * tự điền khi rời ô, để bấm Lưu ngay lúc ô còn trống không bị khóa nút (sự kiện bấm mất vì nút mở khóa sau khi rời ô).
 */
export function chuanHoaDong(d) {
  return {
    ...d,
    soLuong: docSo(d?.soLuong) >= 1 ? d.soLuong : 1,
    donGia: d?.donGia === "" || d?.donGia == null ? d?.giaNiemYet : d.donGia,
  };
}

/** Lý do nút "Lưu báo giá" đang khóa (chuỗi rỗng: lưu được). */
export function lyDoKhoaLuu({ dangTai = false, coKhach = false, dong = [] } = {}) {
  if (dangTai) return "Đang tải dữ liệu";
  if (!coKhach) return "Chọn khách hàng";
  if (!dong.length) return "Thêm ít nhất một sản phẩm";
  const loi = dong.map((d) => kiemTraDonGia(d.donGia, d.giaNiemYet).loi);
  const soChuaCoGia = loi.filter((l) => l === "chuaCoGia").length;
  if (soChuaCoGia) return `${soChuaCoGia} sản phẩm chưa có giá niêm yết`;
  const soSai = loi.filter((l) => l === "thap" || l === "cao").length;
  if (soSai) return `${soSai} dòng có đơn giá ngoài khoảng cho phép`;
  const soTrongGia = loi.filter((l) => l === "trong").length;
  if (soTrongGia) return `${soTrongGia} dòng chưa nhập đơn giá`;
  const soTrongSL = dong.filter((d) => !(docSo(d.soLuong) >= 1)).length;
  if (soTrongSL) return `${soTrongSL} dòng chưa nhập số lượng`;
  return "";
}

/** Thân yêu cầu POST /don-ban-hang/create cho báo giá (máy chủ tự cấp mã, trạng thái Chờ phản hồi). */
export function taoBodyBaoGia({ khachHangId, phiVanChuyen, diaChiGiaoHang, ghiChu }, dong) {
  return {
    loaiChungTu: "bao_gia",
    khachHangId: Number(khachHangId),
    khoXuatId: null, // Báo giá chưa cần kho xuất: chọn kho khi chốt thành đơn
    phiVanChuyen: docSo(phiVanChuyen),
    diaChiGiaoHang: String(diaChiGiaoHang ?? "").trim(),
    ghiChu: String(ghiChu ?? "").trim(),
    chiTiet: (Array.isArray(dong) ? dong : []).map((d) => ({
      bienTheSanPhamId: Number(d.bienTheId),
      soLuongDat: docSo(d.soLuong),
      donGia: docSo(d.donGia),
    })),
  };
}

/** Id báo giá vừa tạo trong phản hồi của POST /don-ban-hang/create ({ data: DonBanHangDto }); không có thì null. */
export function idBaoGiaMoi(phanHoi) {
  const id = phanHoi?.data?.id ?? phanHoi?.id;
  return id != null && String(id) !== "" ? id : null;
}
