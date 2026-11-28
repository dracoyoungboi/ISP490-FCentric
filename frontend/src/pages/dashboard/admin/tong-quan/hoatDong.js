// Hoạt động gần đây của màn Tổng quan quản trị (đặc tả bản 2, mục 8): gộp sự kiện và viết câu.
// Thuần dữ liệu để kiểm thử bằng node --test.
import { t } from "../../../../i18n/t.js";
import { docNgay, formatTienNgan } from "./tongQuanFormat.js";

const nf = new Intl.NumberFormat("vi-VN");
const PHUT = 60e3;
/** Loại được gộp: bán tại quầy, đơn mới, xuất kho. Hủy, trả, chuyển, kiểm kê luôn đứng riêng. */
const GOP = new Set(["ban_quay", "don_moi", "xuat"]);
/** Đơn từ mức này trở lên luôn đứng riêng. */
export const TIEN_KHONG_GOP = 2_000_000;
const gonKho = (ten) => (ten ? ten.replace(/^Cửa hàng\s+/i, "").trim() : ten);

/** Tên ngắn của kênh trong câu: "Shopee", "TikTok Shop"… (tên gian hàng dài thì giữ nguyên). */
export function tenKenhNgan(e) {
  const ma = String(e.maKenh ?? "").toUpperCase();
  if (ma.startsWith("SHOPEE")) return "Shopee";
  if (ma.startsWith("TIKTOK")) return "TikTok Shop";
  if (ma === "LAZADA") return "Lazada";
  if (ma === "SHOPIFY") return "Shopify";
  return e.tenKenh || t("bán trực tiếp");
}

/** Người hoặc kênh làm việc: gộp theo cái này. */
const ai = (e) => (e.loai === "don_moi" ? `kenh:${e.maKenh ?? ""}` : `nguoi:${e.nguoi ?? ""}`);

/**
 * Gộp sự kiện (đã xếp mới nhất trước): cùng loại + cùng người (hoặc cùng kênh) + cùng kho + cùng ngày, mỗi lần cách
 * nhau ≤ 60 phút và cả nhóm trải ≤ 2 giờ; từ 3 sự kiện mới thành nhóm. Không gộp đơn khách đã yêu cầu hủy và đơn từ 2 triệu ₫.
 * Trả danh sách mục: sự kiện đơn lẻ, hoặc { nhom: true, key, ds: [sự kiện mới nhất trước] }.
 */
export function gopSuKien(ds) {
  const mo = new Map();
  const ra = [];
  for (const e of ds) {
    const d = docNgay(e.thoiGian);
    if (!GOP.has(e.loai) || e.coYeuCauHuy || (e.soTien ?? 0) >= TIEN_KHONG_GOP || !d) {
      ra.push(e);
      continue;
    }
    const khoa = `${e.loai}|${ai(e)}|${e.khoId ?? ""}`;
    const g = mo.get(khoa);
    if (g) {
      const moiNhat = docNgay(g.ds[0].thoiGian);
      const cuoi = docNgay(g.ds[g.ds.length - 1].thoiGian);
      if (cuoi - d <= 60 * PHUT && moiNhat - d <= 120 * PHUT && moiNhat.toDateString() === d.toDateString()) {
        g.ds.push(e);
        continue;
      }
    }
    const moi = { nhom: true, key: `${khoa}|${e.thoiGian}|${e.id}`, ds: [e], thoiGian: e.thoiGian };
    mo.set(khoa, moi);
    ra.push(moi);
  }
  // Nhóm chưa đủ 3 thì trải phẳng; xếp lại theo giờ (nhóm lấy giờ sự kiện mới nhất) để sự kiện trải ra không chen trước
  // sự kiện khác mới hơn. Sự kiện không đọc được giờ giữ chỗ cạnh sự kiện liền trước.
  const phang = ra.flatMap((x) => (x.nhom && x.ds.length < 3 ? x.ds : [x]));
  let truoc = Infinity;
  return phang
    .map((x, i) => {
      const d = docNgay(x.nhom ? x.ds[0].thoiGian : x.thoiGian);
      truoc = d ? d.getTime() : truoc;
      return { x, i, tg: truoc };
    })
    .sort((a, b) => b.tg - a.tg || a.i - b.i)
    .map((m) => m.x);
}

const so = (v) => nf.format(v ?? 0);

/**
 * Câu của một sự kiện: { tieuDe, dam (phần in đậm trong tiêu đề), phu, mau }. xemTatCaKho: dòng phụ ghi tên kho.
 * mau: xanh (bán, xuất, nhận đủ), lam (đơn mới, nhập), do (hủy), cam (trả, nhận thiếu), xam (chuyển, kiểm kê).
 */
export function cauSuKien(e, xemTatCaKho) {
  const kho = xemTatCaKho ? e.tenKho : null;
  const ghep = (...x) => x.filter(Boolean).join(" · ");
  const sl = e.soLuong != null ? t("{{so}} cái", { so: so(e.soLuong) }) : null;
  const tien = e.soTien != null ? formatTienNgan(e.soTien) : null;
  switch (e.loai) {
    case "ban_quay":
      return { truoc: t("Bán tại quầy"), dam: e.ma, sau: "", phu: ghep(tien, sl, kho, e.nguoi), mau: "xanh" };
    case "don_moi":
      return { truoc: t("Đơn mới"), dam: e.ma, sau: t("từ {{kenh}}", { kenh: tenKenhNgan(e) }), phu: ghep(tien, sl, e.coYeuCauHuy ? t("khách đã yêu cầu hủy") : null), mau: "lam" };
    case "xuat":
      return { truoc: t("Đơn"), dam: e.ma, sau: t("đã xuất kho"), phu: ghep(tien, sl, kho, e.nguoi), mau: "xanh" };
    case "huy":
      return { truoc: t("Đơn"), dam: e.ma, sau: t("bị hủy"), phu: ghep(e.maKenh ? t("{{kenh}} báo hủy", { kenh: tenKenhNgan(e) }) : null, tien), mau: "do" };
    case "hoan":
      return { truoc: t("Đơn"), dam: e.ma, sau: t("bị hoàn"), phu: ghep(sl, tien, kho), mau: "cam" };
    case "tra_quay":
      return { truoc: t("Khách trả hàng tại quầy"), dam: e.ma, sau: "", phu: ghep(sl, tien, e.coHangLoi ? t("có hàng lỗi") : null, kho, e.nguoi), mau: "cam" };
    case "nhap_kho":
      return {
        truoc: t("Nhập kho"), dam: e.ma, sau: "",
        phu: ghep(e.soMa != null ? t("{{soMa}} mã, {{soCai}} cái", { soMa: so(e.soMa), soCai: so(e.soLuong), count: e.soMa }) : sl, e.tenKenh, kho, e.nguoi), mau: "lam",
      };
    case "chuyen":
      return { truoc: t("Xuất chuyển kho"), dam: e.ma, sau: "", phu: ghep(sl, `${e.tenKho} → ${e.tenKho2}`, e.nguoi), mau: "xam" };
    case "nhan_du":
      return { truoc: t("{{kho}} nhận đủ hàng chuyển", { kho: gonKho(e.tenKho) }), dam: e.ma, sau: "", phu: ghep(sl, e.nguoi), mau: "xanh" };
    case "nhan_thieu":
      return {
        truoc: t("{{kho}} nhận thiếu hàng chuyển", { kho: gonKho(e.tenKho) }), dam: e.ma, sau: "",
        phu: ghep(t("Nhận {{nhan}}/{{gui}} cái", { nhan: so(e.soNhan), gui: so(e.soLuong) }), e.nguoi), mau: "cam",
      };
    case "kiem_ke":
      return {
        truoc: t("Đếm xong kiểm kê"), dam: e.ma, sau: "",
        phu: ghep(kho, e.trangThai === "2" ? t("đang chờ duyệt chênh lệch") : t("đã duyệt"), e.nguoi), mau: "xam",
      };
    default:
      return { truoc: t("Chứng từ"), dam: e.ma, sau: "", phu: ghep(kho), mau: "xam" };
  }
}

/** Câu của một nhóm đã gộp. */
export function cauNhom(g, xemTatCaKho) {
  const e = g.ds[0];
  const n = g.ds.length;
  const tong = g.ds.reduce((s, x) => s + (x.soTien ?? 0), 0);
  const kho = xemTatCaKho ? e.tenKho : null;
  const phu = [kho, formatTienNgan(tong)].filter(Boolean).join(" · ");
  if (e.loai === "ban_quay") return { truoc: t("{{nguoi}} bán tại quầy", { nguoi: e.nguoi ?? t("Thu ngân") }), dam: t("{{so}} đơn", { so: n, count: n }), sau: "", phu, mau: "xanh" };
  if (e.loai === "don_moi") return { truoc: "", dam: t("{{so}} đơn mới", { so: n }), sau: t("từ {{kenh}}", { kenh: tenKenhNgan(e) }), phu: formatTienNgan(tong), mau: "lam" };
  return { truoc: t("{{nguoi}} xuất kho", { nguoi: e.nguoi ?? t("Kho") }), dam: t("{{so}} đơn", { so: n, count: n }), sau: "", phu, mau: "xanh" };
}

/** Đường dẫn mở chứng từ của sự kiện. */
export function duongDanSuKien(e) {
  switch (e.loai) {
    case "ban_quay":
    case "don_moi":
    case "huy":
    case "hoan":
      return `/sales-orders/${e.id}`;
    case "xuat":
      return `/goods-issues/${e.id}/view`;
    case "nhap_kho":
      return `/goods-receipts/${e.id}`;
    case "chuyen":
    case "nhan_du":
    case "nhan_thieu":
      return `/transfer-tickets/${e.id}`;
    case "kiem_ke":
      return `/stock-take/${e.id}`;
    default:
      return null;
  }
}
