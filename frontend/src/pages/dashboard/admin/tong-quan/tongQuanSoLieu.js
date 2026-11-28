import { t } from "../../../../i18n/t.js";
import { soDiemDaCo, soDiemKyTruoc } from "./kyXem.js";
// Số liệu dùng chung cho dải số đầu trang và biểu đồ của màn Tổng quan quản trị (đặc tả bản 2).

/** 4 chỉ số của kỳ xem; ô đang chọn quyết định biểu đồ bên dưới vẽ chỉ số nào. */
export const CHI_SO = [
  { key: "doanhThu", ten: t("Doanh thu"), tien: true },
  { key: "loiNhuan", ten: t("Lợi nhuận gộp"), tien: true },
  { key: "soDon", ten: t("Đơn đã bán"), tien: false },
  { key: "tbDon", ten: t("Giá trị đơn trung bình"), tien: true },
];

export const CHI_SO_MAC_DINH = "doanhThu";

/**
 * Giá trị một chỉ số của một tổng (TongSo) hoặc một điểm (Diem). Giá trị đơn trung bình chỉ tính khi doanh thu và số đơn
 * đều dương (khách trả nhiều hơn số bán thì không có trung bình), còn lại null.
 */
export function giaTri(x, key) {
  if (!x) return null;
  if (key === "loiNhuan") return x.loiNhuan;
  if (key === "soDon") return x.soDon;
  if (key === "tbDon") return x.soDon > 0 && x.doanhThu > 0 ? x.doanhThu / x.soDon : null;
  return x.doanhThu;
}

/**
 * Hai chuỗi của biểu đồ, đủ số điểm: nay[i] là undefined với điểm chưa tới (kỳ đang chạy), 0 với điểm không có đơn;
 * truoc đủ soDiem điểm. Giá trị đơn trung bình của điểm không có đơn là null (bỏ trống, không vẽ 0).
 */
export function chuoiBieuDo(bieuDo, k, key) {
  if (!k) return { nay: [], truoc: [] };
  const daCo = soDiemDaCo(k);
  const coTruoc = soDiemKyTruoc(k);
  const rong = { doanhThu: 0, loiNhuan: 0, soDon: 0 };
  const theoViTri = (ds) => new Map((ds ?? []).map((d) => [d.viTri, d]));
  const mNay = theoViTri(bieuDo?.nay);
  const mTruoc = theoViTri(bieuDo?.truoc);
  const nay = [];
  const truoc = [];
  for (let i = 0; i < k.soDiem; i++) {
    nay.push(i < daCo ? giaTri(mNay.get(i) ?? rong, key) : undefined);
    truoc.push(i < coTruoc ? giaTri(mTruoc.get(i) ?? rong, key) : undefined);
  }
  return { nay, truoc };
}

/** Nhóm hàng: 4 nhóm lớn nhất, nhiều hơn thì 3 nhóm + "Khác" để cộng đủ 100%. */
export function gopNhom(ds) {
  const sap = [...(ds ?? [])].sort((a, b) => b.doanhThu - a.doanhThu);
  if (sap.length <= 4) return sap;
  const con = sap.slice(3);
  return [
    ...sap.slice(0, 3),
    { danhMucId: "khac", tenNhom: null, khac: true, doanhThu: con.reduce((s, x) => s + x.doanhThu, 0), doanhThuTruoc: con.reduce((s, x) => s + x.doanhThuTruoc, 0) },
  ];
}

/** Bước chia trục đẹp: 1, 2, 2,5, 5 × 10^n. */
export function buocDep(x) {
  if (!(x > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(x));
  const f = x / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

/**
 * Vạch trục tung (4–5 vạch) phủ cả số âm nếu có (khách trả nhiều hơn số bán). Luôn gồm 0. Số đơn là số nguyên.
 * Trả { ticks, day, dinh } với day ≤ 0 ≤ dinh.
 */
export function vachTruc(min, max, laSoNguyen) {
  const thap = Math.min(0, min);
  const cao = Math.max(0, max);
  let buoc = buocDep((cao - thap || 1) / 4);
  if (laSoNguyen) buoc = Math.max(1, Math.ceil(buoc));
  const day = Math.floor(thap / buoc) * buoc;
  const dinh = Math.max(buoc, Math.ceil(cao / buoc) * buoc);
  const ticks = [];
  for (let tt = day; tt <= dinh + buoc / 1e6; tt += buoc) ticks.push(Number(tt.toPrecision(12)));
  return { ticks, day, dinh };
}
