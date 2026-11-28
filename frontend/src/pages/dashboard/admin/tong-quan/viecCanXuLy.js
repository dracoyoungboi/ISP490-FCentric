// "Cần xử lý" của màn Tổng quan quản trị (đặc tả bản 2, mục 7): thuần dữ liệu (không React) để kiểm thử bằng node --test.
import { SAN_BAN_HANG } from "../../../../constants/channel.js";
import { t } from "../../../../i18n/t.js";
import { docNgay } from "./tongQuanFormat.js";

const hai = (n) => String(n).padStart(2, "0");
const nf = new Intl.NumberFormat("vi-VN");
const dm = (d) => `${hai(d.getDate())}/${hai(d.getMonth() + 1)}`;
const hm = (d) => `${hai(d.getHours())}:${hai(d.getMinutes())}`;
/** "Cửa hàng Hà Nội" → "Hà Nội" cho dòng phụ chật. */
const gonKho = (ten) => (ten ? ten.replace(/^Cửa hàng\s+/i, "").trim() : ten);

/** Khoảng thời gian đã chờ: "35 phút", "5 giờ", "3 ngày". */
export function lauChua(moc, bayGio) {
  const a = docNgay(moc);
  const b = docNgay(bayGio);
  if (!a || !b) return "";
  const gio = (b - a) / 3600e3;
  if (gio < 1) return t("{{so}} phút", { so: Math.max(1, Math.round(gio * 60)) });
  if (gio < 48) return t("{{so}} giờ", { so: Math.round(gio) });
  return t("{{so}} ngày", { so: Math.round(gio / 24) });
}

/** Trang sản phẩm của kênh, mở sẵn tab Lỗi; kênh chưa có trang riêng thì mở danh sách kênh. */
export function duongDanLoiDongBo(maKenh) {
  const san = timSan(maKenh);
  return san?.duongDan ? `${san.duongDan}/products?trangThai=loi` : "/channels";
}

function timSan(maKenh) {
  const ma = String(maKenh ?? "").toUpperCase();
  return SAN_BAN_HANG.find((s) => s.hoTro && !s.anTam && (s.maKenh === ma || (ma === "SHOPEE" && s.maKenh === "SHOPEE_OFFICIAL")));
}

/** Trang thiết lập (ủy quyền lại) của kênh. */
export function duongDanKetNoiLai(maKenh) {
  const san = timSan(maKenh);
  return san?.duongDan ? `${san.duongDan}/setup` : "/channels";
}

/**
 * Định nghĩa từng loại việc: nhóm (tab), tên, đơn vị của số, có gấp không, đường dẫn và dòng phụ.
 * khoLamViec: trang đích chỉ xem kho làm việc, bấm vào thì đổi kho làm việc sang kho của việc trước khi mở.
 */
export const LOAI_VIEC = {
  khachYeuCauHuy: { nhom: "ban", ten: t("Khách yêu cầu hủy đơn"), donVi: t("đơn"), gap: true, icon: "ban",
    to: (v) => `/sales-orders?q=${encodeURIComponent(v.ma ?? "")}`,
    phu: (v, b) => t("Đơn sàn chưa xuất kho · lâu nhất chờ {{lau}}", { lau: lauChua(v.moc, b) }) },
  matKetNoi: { nhom: "ban", ten: t("Mất kết nối kênh"), gap: true, icon: "unplug", lam: t("Kết nối lại"),
    tenRieng: (v) => (v.so === 1 && v.ten ? t("{{kenh}} mất kết nối", { kenh: v.ten }) : null),
    to: (v) => duongDanKetNoiLai(v.ma),
    phu: (v) => {
      const d = docNgay(v.moc);
      const luc = d ? t("Hết hạn ủy quyền lúc {{gio}} {{ngay}}", { gio: hm(d), ngay: dm(d) }) : t("Hết hạn ủy quyền");
      return v.so > 1 ? t("{{so}} kênh · {{luc}}", { so: v.so, luc }) : luc;
    } },
  sanBaoDaGiao: { nhom: "ban", ten: t("Sàn báo đã giao, kho chưa xuất"), donVi: t("đơn"), gap: true, icon: "alert",
    to: (v) => `/sales-orders?q=${encodeURIComponent(v.ma ?? "")}`,
    phu: (v) => t("{{ma}} · {{kenh}} báo đã giao", { ma: v.ma, kenh: v.ten ?? t("Sàn") }) },
  loiDongBo: { nhom: "ban", ten: t("Lỗi đồng bộ tồn lên kênh"), donVi: t("mã"), gap: true, icon: "dongBo",
    to: (v) => duongDanLoiDongBo(v.kenh?.[0]?.maKenh),
    phu: (v) => (v.kenh ?? []).map((k) => t("{{kenh}} {{so}} mã", { kenh: k.tenKenh, so: nf.format(k.so), count: k.so })).join(" · ") + t(" · đẩy tồn bị từ chối") },
  donNhap: { nhom: "ban", ten: t("Đơn nháp chưa gửi kho"), donVi: t("đơn"), icon: "nhap",
    to: () => "/sales-orders?trangThai=nhap",
    phu: (v) => (v.so > 1 ? t("{{ma}} và {{con}} đơn khác · chưa bấm gửi kho", { ma: v.ma, con: v.so - 1 }) : t("{{ma}} · chưa bấm gửi kho", { ma: v.ma })) },

  treHen: { nhom: "kho", ten: t("Phiếu chuyển kho trễ hẹn"), donVi: t("phiếu"), gap: true, icon: "treHen", khoLamViec: true,
    to: () => "/transfer-tickets?trangThai=tre-hen",
    phu: (v, b) => t("{{ma}} · {{tu}} → {{den}}, trễ {{lau}}", { ma: v.ma, tu: gonKho(v.kho), den: gonKho(v.kho2), lau: lauChua(v.moc, b) }) },
  kiemKeKhoaKe: { nhom: "kho", ten: t("Đợt kiểm kê khóa kệ quá 1 ngày"), donVi: t("đợt"), gap: true, icon: "khoa",
    to: () => "/stock-take?trangThai=dang-kiem-ke",
    phu: (v, b) => t("{{ma}} · {{kho}}, khóa {{soKe}} kệ, đã {{lau}}", { ma: v.ma, kho: v.kho, soKe: nf.format(v.soPhu), lau: lauChua(v.moc, b) }) },
  choNhat: { nhom: "kho", ten: t("Đơn chờ nhặt hàng"), donVi: t("đơn"), icon: "nhat",
    to: () => "/sales-orders?trangThai=cho-nhat-hang", phu: phuDonKho },
  choDongGoi: { nhom: "kho", ten: t("Đơn chờ đóng gói"), donVi: t("đơn"), icon: "dongGoi",
    to: () => "/sales-orders?trangThai=cho-dong-goi", phu: phuDonKho },
  choGiao: { nhom: "kho", ten: t("Đơn chờ giao vận chuyển"), donVi: t("đơn"), icon: "giao",
    to: () => "/sales-orders?trangThai=cho-xuat-kho", phu: phuDonKho },
  hangVeChoNhap: { nhom: "kho", ten: t("Hàng về chờ nhập kho"), donVi: t("phiếu"), icon: "nhapKho",
    to: () => "/goods-receipts?trangThai=cho-nhap-kho",
    phu: (v) => [v.ma, v.ten, v.soPhu ? t("{{so}} cái", { so: nf.format(v.soPhu) }) : null, v.kho].filter(Boolean).join(" · ") },
  choChuyen: { nhom: "kho", ten: t("Phiếu chuyển kho chờ duyệt, chờ xuất"), donVi: t("phiếu"), icon: "chuyen", khoLamViec: true,
    to: (v) => (v.soPhu ? "/transfer-tickets?trangThai=cho-duyet" : "/transfer-tickets?trangThai=tat-ca"),
    phu: (v) => [v.soPhu ? t("{{so}} chờ duyệt", { so: v.soPhu }) : null, v.soPhu2 ? t("{{so}} chờ xuất", { so: v.soPhu2 }) : null].filter(Boolean).join(" · ") },
  chenhLech: { nhom: "kho", ten: t("Chuyển kho chờ xử lý chênh lệch"), donVi: t("phiếu"), icon: "lech", khoLamViec: true,
    to: () => "/transfer-tickets?trangThai=cho-xu-ly-chenh-lech",
    phu: (v) => t("{{ma}} · {{den}} nhận {{nhan}}/{{gui}} cái", { ma: v.ma, den: gonKho(v.kho2), nhan: nf.format(v.soPhu), gui: nf.format(v.soPhu2) }) },
  hoanKe: { nhom: "kho", ten: t("Hàng trả chờ cất lên kệ"), donVi: t("lệnh"), icon: "hoanKe", khoLamViec: true,
    to: () => "/warehouse/unshelved",
    phu: (v, b) => t("{{so}} cái chưa bán được · lâu nhất chờ {{lau}}", { so: nf.format(v.soPhu), lau: lauChua(v.moc, b) }) },
  hangChuaCoKe: { nhom: "kho", ten: t("Hàng chưa có kệ"), donVi: t("lô"), icon: "chuaKe", khoLamViec: true,
    to: () => "/warehouse/unshelved",
    phu: (v) => [t("{{so}} cái", { so: nf.format(v.soPhu) }), v.kho].filter(Boolean).join(" · ") },
  kiemKeChoDuyet: { nhom: "kho", ten: t("Đợt kiểm kê chờ duyệt"), donVi: t("đợt"), icon: "kiemKe",
    to: () => "/stock-take?trangThai=cho-duyet",
    phu: (v) => {
      const d = docNgay(v.moc);
      return d ? t("{{ma}} · {{kho}}, đếm xong {{ngay}}", { ma: v.ma, kho: v.kho, ngay: dm(d) }) : t("{{ma}} · {{kho}}", { ma: v.ma, kho: v.kho });
    } },
  traNcc: { nhom: "kho", ten: t("Hàng lỗi chờ trả nhà cung cấp"), donVi: t("biên bản"), icon: "traNcc",
    to: () => "/supplier",
    phu: (v) => t("{{kho}} · {{so}} cái chờ xuất trả", { kho: v.kho, so: nf.format(v.soPhu) }) },

  muaQuaHan: { nhom: "mua", ten: t("Đơn mua quá hạn giao"), donVi: t("đơn"), gap: true, icon: "xeTai",
    to: () => "/purchase-orders?trangThai=dang-van-chuyen",
    phu: (v, b) => [v.ma, v.ten, t("trễ {{lau}}", { lau: lauChua(v.moc, b) })].filter(Boolean).join(" · ") },
  yeuCauNhap: { nhom: "mua", ten: t("Yêu cầu nhập hàng chờ duyệt"), donVi: t("phiếu"), icon: "yeuCau",
    to: () => "/purchase-requests?trangThai=cho-duyet",
    phu: (v) => (v.so > 1 ? t("{{ma}} và {{con}} phiếu khác", { ma: v.ma, con: v.so - 1 }) : [v.ma, v.kho].filter(Boolean).join(" · ")) },
};

function phuDonKho(v, b, xemTatCaKho) {
  const lau = t("lâu nhất chờ {{lau}}", { lau: lauChua(v.moc, b) });
  return xemTatCaKho && v.kho ? `${v.kho} · ${lau}` : lau;
}

export const NHOM_VIEC = [
  { id: "ban", ten: t("Bán hàng") },
  { id: "kho", ten: t("Kho") },
  { id: "mua", ten: t("Mua hàng") },
];

/**
 * Chia việc máy chủ trả thành các nhóm Bán hàng / Kho / Mua hàng, hiện trong một khối có lăn. Mỗi dòng một LOẠI việc; trong
 * nhóm: gấp trước, dòng có nút làm ngay trước, rồi số lớn trước. Số của nhóm là tổng số việc. Chỉ trả nhóm có việc; nhóm có
 * việc gấp xếp lên trước, cùng mức thì giữ thứ tự Bán hàng, Kho, Mua hàng (quyết định 28/11/2026, thay cho 3 tab).
 */
export function chiaViec(ds, bayGio, xemTatCaKho) {
  const theoNhom = Object.fromEntries(NHOM_VIEC.map((n) => [n.id, []]));
  for (const v of ds ?? []) {
    const l = LOAI_VIEC[v.loai];
    if (!l || !(v.so > 0)) continue;
    theoNhom[l.nhom].push({
      key: v.loai,
      loai: v.loai,
      ten: l.tenRieng?.(v) ?? l.ten,
      phu: l.phu(v, bayGio, xemTatCaKho),
      so: v.so,
      donVi: l.donVi ?? null,
      gap: Boolean(l.gap),
      lam: l.lam ?? null,
      icon: l.icon,
      to: l.to(v),
      khoId: l.khoLamViec ? v.khoId ?? null : null,
    });
  }
  return NHOM_VIEC.map((n) => {
    const dong = theoNhom[n.id].sort((a, b) => Number(b.gap) - Number(a.gap) || Number(Boolean(b.lam)) - Number(Boolean(a.lam)) || b.so - a.so);
    return { ...n, dong, so: dong.reduce((s, d) => s + d.so, 0), gap: dong.some((d) => d.gap) };
  })
    .filter((n) => n.dong.length > 0)
    .sort((a, b) => Number(b.gap) - Number(a.gap));
}
