/*
 * Logic thuần của bản in chuyển kho nội bộ (/transfer-tickets/:id/print/:loai) và màn Phiếu điều chỉnh kho: chọn loại
 * giấy, kiểm giấy đã dùng được chưa, đổi dữ liệu API (PhieuChuyenKhoDto.ChiTiet / PhieuDieuChinh) sang dòng in, định dạng
 * ngày và số. Bố cục giấy theo bản demo đã duyệt (tài liệu BA: Lệnh điều động, Mẫu 03/XKNB, Biên bản giao nhận, Phiếu
 * điều chỉnh kho). Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 */
import { docSo } from "../chung-tu/bangChungTu.js";

/** Loại giấy theo đường dẫn `:loai`. `tieuDe`: tên ở thanh công cụ; `ten`: tiêu đề in trên giấy. */
export const LOAI_IN = Object.freeze({
  "yeu-cau": { tieuDe: "Yêu cầu chuyển kho", ten: "YÊU CẦU CHUYỂN KHO" },
  "lenh-dieu-dong": { tieuDe: "Lệnh điều động nội bộ", ten: "LỆNH ĐIỀU ĐỘNG NỘI BỘ" },
  xknb: { tieuDe: "Phiếu xuất kho kiêm vận chuyển nội bộ (Mẫu 03/XKNB)", ten: "PHIẾU XUẤT KHO KIÊM VẬN CHUYỂN NỘI BỘ" },
  "bien-ban": { tieuDe: "Biên bản giao nhận", ten: "BIÊN BẢN GIAO NHẬN HÀNG HÓA" },
  "dieu-chinh": { tieuDe: "Phiếu điều chỉnh kho", ten: "PHIẾU ĐIỀU CHỈNH KHO" },
});

/**
 * Giấy chưa dùng được cho phiếu này thì trả câu giải thích, dùng được thì null.
 * Lệnh điều động và phiếu XKNB có sau khi duyệt; biên bản có khi nhận hàng có chênh lệch.
 */
export function lyDoChuaIn(loai, ct) {
  if (!LOAI_IN[loai] || loai === "dieu-chinh") return "Không có mẫu in này cho phiếu chuyển kho.";
  if (!ct) return null;
  if ((loai === "lenh-dieu-dong" || loai === "xknb") && !ct.soLenhDieuDong) {
    return ct.trangThai === "DA_HUY"
      ? "Phiếu đã hủy trước khi được duyệt nên không có lệnh điều động, phiếu XKNB."
      : "Lệnh điều động và phiếu XKNB có sau khi Quản lý Kho tổng duyệt phiếu.";
  }
  if (loai === "bien-ban" && !ct.bienBan) {
    return "Phiếu chưa có biên bản giao nhận. Biên bản lập khi kho nhận ghi nhận hàng thiếu hoặc hỏng.";
  }
  return null;
}

const SO_VN = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 });
const TIEN_VN = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

/** Số lượng kiểu Việt Nam, bỏ số 0 thừa của DECIMAL ("12.000" → "12"). Trống → "". */
export function soIn(v) {
  if (v === null || v === undefined || v === "") return "";
  return SO_VN.format(docSo(v));
}

/** Tiền đồng làm tròn tới đồng ("125.000"). Trống → "". */
export function tienIn(v) {
  if (v === null || v === undefined || v === "") return "";
  return TIEN_VN.format(Math.round(docSo(v)));
}

/** Ngày từ API: Instant ISO ("2026-10-28T03:15:00Z") hoặc LocalDate ("2026-10-28", đọc theo giờ máy, không lệch ngày). */
export function docNgay(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const hai = (n) => String(n).padStart(2, "0");

/** "28/10/2026"; không có ngày → "……". */
export function ngayDu(v) {
  const d = docNgay(v);
  return d ? `${hai(d.getDate())}/${hai(d.getMonth() + 1)}/${d.getFullYear()}` : "……";
}

/** "14:05"; không có → "". */
export function gioPhut(v) {
  const d = docNgay(v);
  return d ? `${hai(d.getHours())}:${hai(d.getMinutes())}` : "";
}

/** "28/10/2026 14:05"; không có → "". */
export function ngayGio(v) {
  const d = docNgay(v);
  return d ? `${ngayDu(d)} ${gioPhut(d)}` : "";
}

/** Dòng ngày dưới tiêu đề giấy: "Ngày 28 tháng 10 năm 2026"; không có ngày → để trống cho người ký điền tay. */
export function ngayChu(v) {
  const d = docNgay(v);
  return d
    ? `Ngày ${hai(d.getDate())} tháng ${hai(d.getMonth() + 1)} năm ${d.getFullYear()}`
    : "Ngày …… tháng …… năm ……";
}

/** Tên lý do điều động; "Khác" thì lý do là ghi chú của lệnh (máy chủ bắt buộc ghi chú khi chọn Khác). */
export function tenLyDoDieuDong(ma, ghiChuLenh, danhSach = []) {
  if (!ma) return "";
  if (ma === "KHAC") return String(ghiChuLenh ?? "").trim() || "Khác";
  return danhSach.find((x) => x.ma === ma)?.nhan ?? ma;
}

/** "Về việc: …" của lệnh điều động: lý do viết thường, kèm ghi chú lệnh (trừ khi ghi chú chính là lý do "Khác"). */
export function veViec(ct, danhSach = []) {
  const lyDo = tenLyDoDieuDong(ct?.lyDoDieuDong, ct?.ghiChuLenh, danhSach);
  const chu = ct?.lyDoDieuDong === "KHAC" ? lyDo : lyDo.toLowerCase();
  const ghiChu = ct?.lyDoDieuDong !== "KHAC" ? String(ct?.ghiChuLenh ?? "").trim() : "";
  return ghiChu ? `${chu}. ${ghiChu}` : chu;
}

/** Phương án xử lý chênh lệch như trên giấy và màn phiếu điều chỉnh (đúng chữ bản demo đã duyệt). */
export function tenPhuongAn(ma) {
  if (ma === "GHI_GIAM_HAO_HUT") return "Ghi giảm hao hụt / Đền bù";
  if (ma === "GIAO_BU_HANG") return "Giao bù hàng";
  if (ma === "CHUA_XU_LY") return "Chờ xử lý";
  return ma ?? "";
}

/** "Áo thun basic – Đen / M": tên sản phẩm kèm màu, kích cỡ (bỏ phần trống). */
export function tenHangIn(d) {
  const ten = String(d?.tenSanPham ?? "").trim() || String(d?.sku ?? "").trim();
  const bienThe = [d?.tenMau, d?.kichCo].map((x) => String(x ?? "").trim()).filter(Boolean).join(" / ");
  return bienThe ? `${ten} – ${bienThe}` : ten;
}

/** Đơn vị tính in khi sản phẩm chưa khai báo (như bản demo). */
export const DVT_MAC_DINH = "Cái";

const dvtCua = (d) => String(d?.donViTinh ?? "").trim() || DVT_MAC_DINH;

/** Bảng hàng của yêu cầu và lệnh điều động: số lượng chuyển theo biến thể, đơn vị tính của sản phẩm. */
export function dongHangYeuCau(ct) {
  const dong = (ct?.hang ?? []).map((d) => ({
    khoa: `bt-${d.bienTheId}`,
    ten: tenHangIn(d),
    sku: d.sku ?? "",
    dvt: dvtCua(d),
    soLuong: docSo(d.soLuongChuyen),
  }));
  return { dong, tongSoLuong: dong.reduce((s, d) => s + d.soLuong, 0) };
}

/**
 * Bảng hàng của phiếu XKNB. Đã xuất: theo lô đã xuất, đơn giá là giá vốn lô (thành tiền = số × giá vốn). Chưa xuất:
 * số lượng chuyển theo biến thể, chưa có đơn giá (giá vốn lấy theo lô lúc nhặt).
 */
export function dongHangXknb(ct) {
  const theoLo = ct?.hangTheoLo ?? [];
  if (theoLo.length) {
    // Dòng theo lô không mang đơn vị tính: lấy của biến thể ở bảng hàng
    const dvtTheoBienThe = new Map((ct?.hang ?? []).map((h) => [h.bienTheId, dvtCua(h)]));
    const dong = theoLo.map((d) => {
      const soLuong = docSo(d.soLuong);
      const giaVon = d.giaVon == null ? null : docSo(d.giaVon);
      return {
        khoa: `lo-${d.bienTheId}-${d.loHangId}`,
        ten: tenHangIn(d),
        maLo: d.maLo ?? "",
        sku: d.sku ?? "",
        dvt: dvtTheoBienThe.get(d.bienTheId) ?? DVT_MAC_DINH,
        soLuong,
        donGia: giaVon,
        thanhTien: giaVon == null ? null : soLuong * giaVon,
      };
    });
    const coTien = dong.every((d) => d.thanhTien != null);
    return {
      dong,
      tongSoLuong: dong.reduce((s, d) => s + d.soLuong, 0),
      tongTien: coTien ? dong.reduce((s, d) => s + d.thanhTien, 0) : null,
      theoLo: true,
    };
  }
  const { dong, tongSoLuong } = dongHangYeuCau(ct);
  return { dong: dong.map((d) => ({ ...d, maLo: "", donGia: null, thanhTien: null })), tongSoLuong, tongTien: null, theoLo: false };
}

/** Phương tiện trên phiếu XKNB: chuyển phát ghi đơn vị + mã vận đơn, còn lại loại xe + biển số. */
export function phuongTienIn(ct) {
  if (!ct?.hinhThucVanChuyen) return { phuongTien: "", hopDong: "—" };
  const noi = (...phan) => phan.map((x) => String(x ?? "").trim()).filter(Boolean).join(" – ");
  if (ct.hinhThucVanChuyen === "CHUYEN_PHAT") {
    return {
      phuongTien: noi(ct.donViVanChuyen, ct.maVanDonHopDong ? `mã vận đơn ${ct.maVanDonHopDong}` : ""),
      hopDong: "—",
    };
  }
  return {
    phuongTien: noi(ct.loaiPhuongTien, ct.bienSoXe ? `biển số ${ct.bienSoXe}` : ""),
    hopDong: ct.hinhThucVanChuyen === "THUE_NGOAI" && ct.maVanDonHopDong ? ct.maVanDonHopDong : "—",
  };
}

/** Dòng lệch của biên bản (gửi nhiều hơn số đạt) và tổng: lấy tổng biên bản đã lưu, thiếu thì cộng từ dòng. */
export function dongBienBan(bb) {
  const tatCa = (bb?.dong ?? []).map((d) => ({
    khoa: `bb-${d.id ?? `${d.bienTheId}-${d.loHangId}`}`,
    ten: tenHangIn(d),
    sku: d.sku ?? "",
    maLo: d.maLo ?? "",
    gui: docSo(d.gui),
    dat: docSo(d.nhan),
    hong: docSo(d.hong),
    thieu: d.thieu == null ? Math.max(0, docSo(d.gui) - docSo(d.nhan) - docSo(d.hong)) : docSo(d.thieu),
    lyDo: d.lyDo ?? "",
  }));
  const cong = (k) => tatCa.reduce((s, d) => s + d[k], 0);
  return {
    dong: tatCa.filter((d) => d.gui > d.dat),
    tong: {
      gui: bb?.tongGui ?? cong("gui"),
      dat: bb?.tongNhan ?? cong("dat"),
      hong: bb?.tongHong ?? cong("hong"),
      thieu: bb?.tongThieu ?? cong("thieu"),
    },
  };
}

/** Dòng phiếu điều chỉnh kho (số giảm dương) và tổng số lượng / thành tiền. */
export function dongDieuChinh(pdc) {
  const dong = (pdc?.dong ?? []).map((d, i) => {
    const soLuong = Math.abs(docSo(d.soLuong));
    const giaVon = d.giaVon == null ? null : docSo(d.giaVon);
    const thanhTien = d.thanhTien != null ? Math.abs(docSo(d.thanhTien)) : giaVon == null ? null : soLuong * giaVon;
    return {
      khoa: `dc-${i}-${d.bienTheId}-${d.maLo ?? ""}`,
      bienTheId: d.bienTheId,
      ten: tenHangIn(d),
      tenSanPham: d.tenSanPham,
      tenMau: d.tenMau,
      maMauHex: d.maMauHex,
      kichCo: d.kichCo,
      sku: d.sku ?? "",
      maLo: d.maLo ?? "",
      dvt: dvtCua(d),
      soLuong,
      giaVon,
      thanhTien,
      thieu: d.thieu == null ? null : docSo(d.thieu),
      hong: d.hong == null ? null : docSo(d.hong),
      lyDo: d.lyDo ?? "",
    };
  });
  // Không có tổng của phiếu lẫn thành tiền dòng nào (thiếu giá vốn) thì để trống, không in "0"
  const coTienDong = dong.some((d) => d.thanhTien != null);
  const tongTien = pdc?.tongGiaTriGiam != null
    ? Math.abs(docSo(pdc.tongGiaTriGiam))
    : coTienDong ? dong.reduce((s, d) => s + (d.thanhTien ?? 0), 0) : null;
  return { dong, tongSoLuong: dong.reduce((s, d) => s + d.soLuong, 0), tongTien };
}

/** "Thiếu 2 · Hỏng 1" của một dòng điều chỉnh theo biên bản; không có số nào → "". */
export function chuLech(d) {
  return [d?.thieu ? `Thiếu ${soIn(d.thieu)}` : "", d?.hong ? `Hỏng ${soIn(d.hong)}` : ""].filter(Boolean).join(" · ");
}

/** Loại giao dịch sổ kho → chữ. */
export function tenLoaiSoKho(loai) {
  return { dieu_chinh: "Điều chỉnh", nhap_kho: "Nhập kho", xuat_kho: "Xuất kho", chuyen_kho: "Chuyển kho" }[loai] ?? loai ?? "";
}

/** Nhãn trạng thái phiếu điều chỉnh kho (máy chủ lưu 2 khi duyệt xử lý chênh lệch = đã trừ kho). */
export function trangThaiDieuChinh(trangThai) {
  if (trangThai === 2) return { label: "Đã áp dụng", nhom: "xong" };
  if (trangThai === 1) return { label: "Chờ duyệt", nhom: "canChuY" };
  if (trangThai === 0) return { label: "Nháp", nhom: "cho" };
  return { label: "Đã hủy", nhom: "dong" };
}

/** Địa chỉ kho sau tên: " – 12 Lê Lợi" (không có địa chỉ thì bỏ). */
export const sauTen = (diaChi) => (String(diaChi ?? "").trim() ? ` – ${String(diaChi).trim()}` : "");

/** Ba dòng đầu giấy bên trái: tên đăng ký, mã số thuế, địa chỉ của hồ sơ công ty (chưa nhập thì để chấm cho điền tay). */
export function dauCongTy(hoSo) {
  const ten = String(hoSo?.legalName ?? "").trim() || String(hoSo?.name ?? "").trim();
  return {
    ten: ten ? ten.toLocaleUpperCase("vi-VN") : "……………………………………",
    maSoThue: String(hoSo?.taxCode ?? "").trim() || "……………………",
    diaChi: String(hoSo?.address ?? "").trim() || "……………………………………",
  };
}
