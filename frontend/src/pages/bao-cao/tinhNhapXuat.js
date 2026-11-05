// Phần tính của màn Báo cáo nhập xuất (không gọi API): kỳ xem, tham số gửi máy chủ, dữ liệu biểu đồ, bảng, thẻ loại.
import { MOC_NGAY, SO_NAM, khoangMoc, ngayVN } from "./tinhBaoCaoDoanhThu";

export { MOC_NGAY, SO_NAM, khoangMoc, ngayVN };

export const LOAI_KY = [
  { value: "ngay", label: "Theo ngày", don: "ngày" },
  { value: "tuan", label: "Theo tuần", don: "tuần" },
  { value: "thang", label: "Theo tháng", don: "tháng" },
  { value: "nam", label: "Theo năm", don: "năm" },
];

/** Tab của bảng cuối trang (giá trị ghi trên URL ?bang=). */
export const TAB_BANG = ["ky", "san-pham", "kho"];

/** Màu hai chuỗi: cột (đạt tương phản 3:1 trên nền trắng) và chữ số (4,5:1). */
export const MAU = {
  nhap: "#1677ff",
  xuat: "#ea580c",
  chuNhap: "#0d61e4",
  chuXuat: "#c2410c",
};

/** Mã các loại nhập, xuất (khớp BaoCaoNhapXuatService.NHOM ở máy chủ); mã lạ trên URL coi như không lọc. */
export const MA_NHOM = ["N_MUA", "N_CHUYEN", "N_HOAN", "DC_TANG", "N_KHAC", "X_QUAY", "X_DON", "X_CHUYEN", "DC_GIAM", "X_TRA_NCC", "X_KHAC"];

const N = (v) => Number(v) || 0;
const so = (v) => (/^\d{4}$/.test(String(v ?? "")) && Number(v) >= 2000 ? Number(v) : null);
/** yyyy-MM-dd có thật trên lịch (2026-02-30 không nhận). */
const ngayHopLe = (v) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v ?? "")) return null;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(y, m - 1, d);
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d ? v : null;
};

/**
 * Bộ lọc đọc từ URL (?loai=&nam=&moc=&tu=&den=&soNam=&kho=&nhom=); giá trị lạ về mặc định (theo tháng năm nay).
 * homNay để thử.
 */
export function boLocTuUrl(sp, homNay = new Date()) {
  const loai = LOAI_KY.some((x) => x.value === sp.get("loai")) ? sp.get("loai") : "thang";
  const moc = MOC_NGAY.some((x) => x.value === sp.get("moc")) ? sp.get("moc") : "thang-nay";
  const tu = ngayHopLe(sp.get("tu"));
  const den = ngayHopLe(sp.get("den"));
  const soNam = SO_NAM.includes(Number(sp.get("soNam"))) ? Number(sp.get("soNam")) : 5;
  return {
    loai,
    nam: so(sp.get("nam")) ?? homNay.getFullYear(),
    moc,
    khoang: moc === "tuy-chon" && tu && den ? { tuNgay: tu, denNgay: den } : khoangMoc(moc, homNay),
    soNam,
    khoId: /^\d+$/.test(sp.get("kho") ?? "") ? sp.get("kho") : "",
    nhom: MA_NHOM.includes(sp.get("nhom")) ? sp.get("nhom") : "",
  };
}

/** Ghi phần bộ lọc thay đổi lên URL (giá trị mặc định thì bỏ khỏi URL cho gọn). */
export function ghiBoLoc(sp, x, homNay = new Date()) {
  const next = new URLSearchParams(sp);
  const ghi = (k, v) => (v == null || v === "" ? next.delete(k) : next.set(k, String(v)));
  if ("loai" in x) ghi("loai", x.loai === "thang" ? null : x.loai);
  if ("nam" in x) ghi("nam", x.nam === homNay.getFullYear() ? null : x.nam);
  if ("moc" in x) ghi("moc", x.moc === "thang-nay" ? null : x.moc);
  if ("khoang" in x) {
    const tuyChon = (x.moc ?? next.get("moc")) === "tuy-chon";
    ghi("tu", tuyChon ? x.khoang?.tuNgay : null);
    ghi("den", tuyChon ? x.khoang?.denNgay : null);
  }
  if ("soNam" in x) ghi("soNam", x.soNam === 5 ? null : x.soNam);
  if ("khoId" in x) ghi("kho", x.khoId);
  if ("nhom" in x) ghi("nhom", x.nhom);
  return next;
}

/** Tham số gửi máy chủ của kỳ đang xem. */
export function thamSo({ loai, nam, khoang, soNam, khoId, nhom }, homNay = new Date()) {
  const them = { ...(khoId ? { khoId } : {}), ...(nhom ? { nhom } : {}) };
  if (loai === "ngay") return { loai, tuNgay: khoang.tuNgay, denNgay: khoang.denNgay, ...them };
  if (loai === "nam") return { loai, tuNam: homNay.getFullYear() - soNam + 1, denNam: homNay.getFullYear(), ...them };
  return { loai, nam, ...them };
}

/** Tên tệp Excel khi máy chủ không cho đọc tên (khác nguồn khi chạy dev). */
export function tenTepExcel(ts) {
  const hau = ts.loai === "ngay" ? `${ts.tuNgay}_${ts.denNgay}` : ts.loai === "nam" ? `${ts.tuNam}-${ts.denNam}` : String(ts.nam);
  return `Bao-cao-nhap-xuat_${hau}.xlsx`;
}

/** Đơn vị kỳ con: "ngày", "tuần", "tháng", "năm". */
export const donKy = (loai) => LOAI_KY.find((x) => x.value === loai)?.don ?? "tháng";

/**
 * Dữ liệu biểu đồ: mỗi kỳ con { nhan, nhanDay, nhap, xuat, ... }; cheDo "sl" số lượng, "gt" giá trị. Kỳ chưa tới để
 * trống (null) để không có cột.
 */
export function duLieuBieuDo(data, cheDo) {
  if (!data?.theoKy) return [];
  const gt = cheDo === "gt";
  return data.theoKy.map((k) => ({
    nhan: k.nhan,
    nhanDay: k.nhanDay,
    chuaToi: k.chuaToi,
    nhap: k.chuaToi ? null : N(gt ? k.nhapGt : k.nhapSl),
    xuat: k.chuaToi ? null : N(gt ? k.xuatGt : k.xuatSl),
    nhapSl: N(k.nhapSl), xuatSl: N(k.xuatSl), nhapGt: N(k.nhapGt), xuatGt: N(k.xuatGt),
    phieuNhap: N(k.phieuNhap), phieuXuat: N(k.phieuXuat),
  }));
}

/** Nhãn trục X thưa dần khi nhiều kỳ (luôn có nhãn kỳ cuối), như biểu đồ Báo cáo doanh thu. */
export function nhanTrucX(rows) {
  const buoc = rows.length > 12 ? Math.ceil(rows.length / 6) : 1;
  const viTri = rows.map((_, i) => i).filter((i) => i % buoc === 0);
  const cuoi = rows.length - 1;
  if (cuoi >= 0 && viTri[viTri.length - 1] !== cuoi) {
    if (cuoi - viTri[viTri.length - 1] < buoc / 2) viTri.pop();
    viTri.push(cuoi);
  }
  return viTri.map((i) => rows[i].nhan);
}

/** Dòng bảng Theo kỳ: chỉ các kỳ đã qua có phát sinh (cũ trước, đọc xuôi từ tồn đầu tới tồn cuối). */
export const dongKy = (data) => (data?.theoKy ?? []).filter((k) => !k.chuaToi && (N(k.nhapSl) || N(k.xuatSl) || N(k.nhapGt) || N(k.xuatGt)));

/**
 * Thẻ Nhập từ đâu, xuất đi đâu: hai nhóm, mỗi dòng có tỷ lệ thanh so với dòng lớn nhất cùng chiều (0–1). Dòng số 0 gom
 * thành câu "Không có: …".
 */
export function nhomLoai(data) {
  const ds = data?.theoLoai ?? [];
  return ["nhap", "xuat"].map((chieu) => {
    const cung = ds.filter((l) => l.chieu === chieu);
    const lonNhat = cung.reduce((m, l) => Math.max(m, N(l.soLuong)), 0);
    return {
      chieu,
      ten: chieu === "nhap" ? "Nhập" : "Xuất",
      tong: N(chieu === "nhap" ? data?.nhap?.soLuong : data?.xuat?.soLuong),
      dong: cung.filter((l) => N(l.soLuong)).map((l) => ({ ...l, soLuong: N(l.soLuong), giaTri: N(l.giaTri), tyLe: lonNhat ? N(l.soLuong) / lonNhat : 0 })),
      khongCo: cung.filter((l) => !N(l.soLuong)).map((l) => l.ten),
    };
  });
}

/** Tên một nhóm theo mã (null nếu không thấy). */
export const tenNhom = (data, ma) => (data?.theoLoai ?? []).find((l) => l.ma === ma)?.ten ?? null;

/** Số nhận / chuyển nội bộ giữa các kho (để ghi chú khi xem nhiều kho). */
export function chuyenNoiBo(data) {
  const ds = data?.theoLoai ?? [];
  return {
    nhan: N(ds.find((l) => l.ma === "N_CHUYEN")?.soLuong),
    di: N(ds.find((l) => l.ma === "X_CHUYEN")?.soLuong),
  };
}

/** Đường dẫn Lịch sử giao dịch kho cùng khoảng ngày, kho đang xem. */
export function linkLichSu(data, khoId) {
  const p = new URLSearchParams();
  if (data?.tuNgay) p.set("tu", String(data.tuNgay).slice(0, 10));
  if (data?.denNgay) p.set("den", String(data.denNgay).slice(0, 10));
  if (khoId) p.set("kho", khoId);
  const q = p.toString();
  return `/inventory-transactions${q ? `?${q}` : ""}`;
}

/** "▲ 1.884" / "▼ 12" / "không đổi" của tồn cuối so với tồn đầu. */
export function bienDong(dau, cuoi) {
  const d = N(cuoi) - N(dau);
  return { d, tang: d > 0, giam: d < 0 };
}
