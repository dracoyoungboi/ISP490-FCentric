import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, ChevronRight, CircleCheck, FileText, History, LayoutGrid, Package, Search, ShoppingCart, UserRound, X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { xinRoiTrang } from "@/lib/chanRoiTrang";
import StatusBadge from "@/components/shared/StatusBadge";
import { SIDEBAR_FOOTER_SECTION, SIDEBAR_MENU, SIDEBAR_SECTIONS } from "@/components/backoffice/sidebar.config";
import { useKenhDaKetNoi } from "@/components/channel/kenhDaKetNoi";
import apiClient from "@/services/apiClient";
import { getDonBanHangStatus } from "@/constants/donBanHang";
import { getBaoGiaStatus } from "@/constants/baoGia";
import { getDonMuaHangStatus } from "@/constants/donMuaHang";
import { getGoodsReceiptStatus } from "@/constants/goodsReceipt";
import { getPhieuChuyenKhoStatus } from "@/constants/phieuChuyenKho";
import { getPhieuXuatKhoStatus } from "@/constants/phieuXuatKho";
import { getYeuCauNhapHangStatus } from "@/constants/yeuCauNhapHang";
import { formatCurrency } from "@/utils/formatters";
import { t, tDuLieu } from "@/i18n";

/*
 * Ô tìm kiếm toàn hệ thống trên thanh trên cùng (Ctrl/⌘ + K). Bám bản BA đã chốt 13/11/2026, phương án A.
 * - Chưa gõ: "Đã xem gần đây" (bản ghi đã mở, BR-11); chưa có thì một dòng nhắc theo tab đang chọn.
 * - Gõ từ 2 ký tự: một lời gọi GET /api/v1/tim-kiem trả mọi nhóm; máy chủ lọc theo đúng phạm vi của trang danh sách
 *   (BR-01) và đánh dấu dòng khớp chính xác một mã (BR-03). Màn hình vẫn lọc tại chỗ từ menu bên trái.
 * - Khối "Khớp chính xác" đứng đầu tab Tất cả, dòng được chọn sẵn. Enter bấm trước khi có kết quả (máy quét mã) thì
 *   chờ kết quả rồi mở nếu có đúng một dòng khớp chính xác (BR-04).
 * - Nhóm xếp theo vai trò (BR-05); "Xem tất cả" mở trang danh sách đã điền từ khóa (?q=, BR-12).
 * - Ctrl/⌘ + Enter, bấm chuột giữa hoặc Ctrl/⌘ + bấm: mở ở tab mới.
 */

const SO_KY_TU_TOI_THIEU = 2;
const THOI_GIAN_CHO_MS = 300;
const SO_KET_QUA_MOI_NHOM = 10;
const SO_DONG_XEM_TRUOC = 3;
const SO_DA_XEM = 8;

/** `goiY`: dòng nhắc giữa khung khi đang đứng ở tab đó mà chưa gõ. */
const NHOM = {
  sanPham: { key: "sanPham", label: t("Sản phẩm"), trangDanhSach: "/products", icon: Package, goiY: t("Nhập tên, mã sản phẩm, SKU hoặc mã vạch.") },
  donBan: { key: "donBan", label: t("Đơn bán"), trangDanhSach: "/sales-orders", icon: ShoppingCart, goiY: t("Nhập số đơn, mã đơn sàn hoặc số điện thoại khách.") },
  khachHang: { key: "khachHang", label: t("Khách hàng"), trangDanhSach: "/customers", icon: UserRound, goiY: t("Nhập tên, mã hoặc số điện thoại khách hàng.") },
  nhaCungCap: { key: "nhaCungCap", label: t("Nhà cung cấp"), trangDanhSach: "/supplier", icon: Building2, goiY: t("Nhập tên, mã, mã số thuế hoặc số điện thoại nhà cung cấp.") },
  chungTu: { key: "chungTu", label: t("Chứng từ"), trangDanhSach: null, icon: FileText, goiY: t("Nhập mã phiếu, mã đơn mua, mã báo giá hoặc mã đợt kiểm kê.") },
  manHinh: { key: "manHinh", label: t("Màn hình"), trangDanhSach: null, icon: LayoutGrid, goiY: t("Nhập tên màn hình cần mở.") },
};

/** Thứ tự nhóm theo vai trò (BR-05); Màn hình luôn cuối. Nhóm không có quyền sẽ bị lọc sau. */
const THU_TU_THEO_VAI_TRO = {
  quan_ly_kho: ["sanPham", "chungTu", "donBan", "nhaCungCap"],
  nhan_vien_kho: ["sanPham", "chungTu", "donBan"],
  nhan_vien_ban_hang: ["khachHang", "donBan", "sanPham", "chungTu"],
  nhan_vien_mua_hang: ["nhaCungCap", "chungTu", "sanPham"],
  quan_tri_vien: ["donBan", "sanPham", "khachHang", "chungTu", "nhaCungCap"],
};
const THU_TU_MAC_DINH = ["sanPham", "donBan", "khachHang", "nhaCungCap", "chungTu"];

/** Trang danh sách của các loại chứng từ: có ít nhất một trang được vào thì có nhóm Chứng từ. */
const TRANG_CHUNG_TU = [
  "/goods-issues", "/goods-receipts", "/transfer-tickets", "/purchase-orders", "/purchase-requests", "/stock-take",
  "/sales-quotations",
];

// i18n-giu-nguyen: nhãn tiếng Việt truyền cho StatusBadge (badge tự dịch lúc vẽ)
const TRANG_THAI_SAN_PHAM = {
  1: "Còn hàng", // i18n-giu-nguyen: StatusBadge tự dịch
  0: "Hết hàng", // i18n-giu-nguyen: StatusBadge tự dịch
  2: "Ngừng hoạt động", // i18n-giu-nguyen: StatusBadge tự dịch
};
// i18n-giu-nguyen: nhãn trạng thái đợt kiểm kê theo mã 0–4 (IKiemKe), StatusBadge tự dịch
const TRANG_THAI_KIEM_KE = ["Nháp", "Đang kiểm kê", "Chờ duyệt", "Đã duyệt", "Đã hủy"];

/** Tên loại, trang chi tiết và nhãn trạng thái của từng loại chứng từ. */
const LOAI_CHUNG_TU = {
  phieuXuat: { ten: t("Phiếu xuất kho"), to: (id) => `/goods-issues/${id}`, quyTrinh: "phieuXuat", nhan: (m) => getPhieuXuatKhoStatus(m.trangThai).label },
  phieuNhap: { ten: t("Phiếu nhập kho"), to: (id) => `/goods-receipts/${id}`, quyTrinh: "phieuNhap", nhan: (m) => getGoodsReceiptStatus(m.trangThai).label },
  phieuChuyen: { ten: t("Phiếu chuyển kho"), to: (id) => `/transfer-tickets/${id}`, quyTrinh: "chuyenKho", nhan: (m) => getPhieuChuyenKhoStatus(m.trangThai, m.coChenhLech, m.tuChoi).label },
  donMua: { ten: t("Đơn mua hàng"), to: (id) => `/purchase-orders/${id}`, quyTrinh: "donMua", nhan: (m) => getDonMuaHangStatus(m.trangThai).label },
  yeuCauNhap: { ten: t("Yêu cầu nhập hàng"), to: (id) => `/purchase-requests/${id}`, quyTrinh: "yeuCauNhap", nhan: (m) => getYeuCauNhapHangStatus(m.trangThai).label },
  kiemKe: { ten: t("Đợt kiểm kê"), to: (id) => `/stock-take/${id}`, quyTrinh: "kiemKe", nhan: (m) => TRANG_THAI_KIEM_KE[m.trangThai] },
  baoGia: { ten: t("Báo giá"), to: (id) => `/sales-quotations/${id}`, quyTrinh: "baoGiaBan", nhan: (m) => getBaoGiaStatus(m.trangThai).label },
};

/** Tên trường mã đã khớp, để ghi "Khớp SKU …" (truongKhop do máy chủ trả). Mã chính của dòng thì không ghi. */
const TEN_TRUONG_KHOP = {
  sku: t("SKU"),
  maVachSku: t("mã vạch"),
  maVach: t("mã vạch"),
  maVachNcc: t("mã vạch NCC"),
  maSanPham: t("mã sản phẩm"),
  maDonSan: t("mã đơn sàn"),
  sdt: t("số điện thoại"),
  maSoThue: t("mã số thuế"),
  email: t("email"),
};

/* ---------- Tiện ích ---------- */

const boDau = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const vietHoaChuDau = (text) => (text ? text.charAt(0) + text.slice(1).toLowerCase() : "");

/** Tô đậm phần khớp từ khóa, không phân biệt dấu (bỏ dấu không đổi độ dài chuỗi với chữ tiếng Việt dựng sẵn). */
function ToDam({ text, tuKhoa }) {
  const chuoi = String(text ?? "");
  const tk = boDau(String(tuKhoa ?? "").trim());
  const viTri = tk ? boDau(chuoi).indexOf(tk) : -1;
  if (viTri < 0 || boDau(chuoi).length !== chuoi.length) return chuoi;
  return (
    <>
      {chuoi.slice(0, viTri)}
      <mark className="rounded-sm bg-amber-100 px-px text-inherit">{chuoi.slice(viTri, viTri + tk.length)}</mark>
      {chuoi.slice(viTri + tk.length)}
    </>
  );
}

/** Vai trò được vào một trang, đọc từ menu bên trái (mục con không khai báo thì theo mục cha). */
function vaiTroCuaTrang(duongDan) {
  for (const muc of SIDEBAR_MENU) {
    if (muc.to === duongDan) return muc.roles ?? [];
    const con = muc.children?.find((c) => c.to === duongDan);
    if (con) return con.roles ?? muc.roles ?? [];
  }
  return [];
}

/** Các nhóm kết quả vai trò được xem, theo thứ tự của vai trò; Màn hình luôn cuối. */
function nhomTheoVaiTro(role) {
  const thuTu = THU_TU_THEO_VAI_TRO[role] ?? THU_TU_MAC_DINH;
  const duocXem = thuTu.filter((key) =>
    key === "chungTu"
      ? TRANG_CHUNG_TU.some((trang) => vaiTroCuaTrang(trang).includes(role))
      : vaiTroCuaTrang(NHOM[key].trangDanhSach).includes(role),
  );
  return [...duocXem.map((key) => NHOM[key]), NHOM.manHinh];
}

/**
 * Danh sách màn hình người dùng được vào, lấy từ menu bên trái. Mục của từng sàn (khai báo `maKenh`) chỉ có khi
 * gian hàng đã kết nối, giống menu bên trái; "Tất cả kênh" và mục sàn chờ cấp API bật `hienMenu` (Shopee) luôn có.
 */
function danhSachManHinh(role, kenhDaKetNoi) {
  const tenNhom = Object.fromEntries(SIDEBAR_SECTIONS.map((s) => [s.key, vietHoaChuDau(s.label)]));
  // Mục ghim ở đáy sidebar (Cấu hình) không thuộc nhóm có tiêu đề
  tenNhom[SIDEBAR_FOOTER_SECTION] = t("Hệ thống");
  const ketQua = [];
  for (const muc of SIDEBAR_MENU) {
    if (!muc.roles?.includes(role)) continue;
    if (muc.maKenh && !kenhDaKetNoi.includes(muc.maKenh)) continue;
    // Nhóm không có tiêu đề (Tổng quan, các nhóm nghiệp vụ Sản phẩm, Mua hàng…): mục con chỉ ghi tên nhóm cha,
    // không thêm chữ "Trang chính" phía trước
    const nhom = tenNhom[muc.section] || "";
    if (muc.to) ketQua.push({ id: muc.to, label: muc.label, to: muc.to, viTri: nhom || t("Trang chính") });
    for (const con of muc.children ?? []) {
      if ((con.roles ?? muc.roles).includes(role)) {
        ketQua.push({ id: con.to, label: con.label, to: con.to, viTri: nhom ? `${nhom} › ${muc.label}` : muc.label });
      }
    }
  }
  return ketQua;
}

const pad = (n) => String(n).padStart(2, "0");

/** "Vừa xong", "5 phút trước", "2 giờ trước", "Hôm qua, 16:40", "12/10/2026" (như chuông thông báo). */
function thoiGianTuongDoi(moc, bayGio) {
  const d = new Date(moc);
  if (Number.isNaN(d.getTime())) return "";
  const phut = Math.floor((bayGio.getTime() - d.getTime()) / 60_000);
  if (phut < 1) return t("Vừa xong");
  if (phut < 60) return t("{{count}} phút trước", { count: phut });
  if (d.toDateString() === bayGio.toDateString()) return t("{{count}} giờ trước", { count: Math.floor(phut / 60) });
  const homQua = new Date(bayGio);
  homQua.setDate(homQua.getDate() - 1);
  if (d.toDateString() === homQua.toDateString()) return t("Hôm qua, {{gio}}:{{phut}}", { gio: pad(d.getHours()), phut: pad(d.getMinutes()) });
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function docDaXem(khoa) {
  try {
    const giaTri = JSON.parse(localStorage.getItem(khoa) || "[]");
    return Array.isArray(giaTri) ? giaTri.filter((x) => x && typeof x === "object" && x.to && x.loai).slice(0, SO_DA_XEM) : [];
  } catch {
    return [];
  }
}

function ghiDaXem(khoa, danhSach) {
  try {
    localStorage.setItem(khoa, JSON.stringify(danhSach));
  } catch {
    // Trình duyệt chặn lưu trữ: bỏ qua, chỉ mất phần "Đã xem gần đây"
  }
}

/** Trang chi tiết của một dòng kết quả. */
function duongDanCua(loai, muc) {
  switch (loai) {
    case "manHinh":
      return muc.to;
    case "sanPham":
      return `/products/${muc.id}`;
    case "donBan":
      return `/sales-orders/${muc.id}`;
    case "khachHang":
      return `/customers/${muc.id}`;
    case "nhaCungCap":
      return `/supplier/${muc.id}`;
    case "chungTu":
      return LOAI_CHUNG_TU[muc.loaiChungTu]?.to(muc.id) ?? null;
    default:
      return muc.to ?? null;
  }
}

/** "Khớp SKU POLO-DEN-M · biến thể Đen / M" (khớp chính xác) hoặc "SKU POLO-DEN-M-PV" (khớp một phần). */
function ghiChuKhop(muc) {
  const ten = TEN_TRUONG_KHOP[muc.truongKhop];
  if (!ten || !muc.giaTriKhop) return null;
  const thamSo = { truong: ten, giaTri: muc.giaTriKhop, bienThe: muc.bienThe };
  if (muc.khopChinhXac) {
    return muc.bienThe
      ? t("Khớp {{truong}} {{giaTri}} · biến thể {{bienThe}}", thamSo)
      : t("Khớp {{truong}} {{giaTri}}", thamSo);
  }
  return muc.bienThe ? t("{{truong}} {{giaTri}} · biến thể {{bienThe}}", thamSo) : t("{{truong}} {{giaTri}}", thamSo);
}

/**
 * Gói thông tin cần giữ để hiện lại ở "Đã xem gần đây" (không phụ thuộc lần tìm). Chỉ lưu dữ liệu; tên loại chứng từ,
 * "Khách lẻ" dịch lúc vẽ để đổi ngôn ngữ vẫn đúng.
 */
function tomTatDaXem(loai, muc, to) {
  const ten = {
    sanPham: muc.ten,
    donBan: muc.ma,
    khachHang: muc.ten,
    nhaCungCap: muc.ten,
    chungTu: muc.ma,
  }[loai];
  const phu = {
    sanPham: muc.ma,
    donBan: muc.khach,
    khachHang: muc.soDienThoai || muc.ma,
    nhaCungCap: muc.ma,
    chungTu: null,
  }[loai];
  return { loai, loaiChungTu: muc.loaiChungTu ?? null, id: muc.id, ten: ten ?? "", phu: phu ?? "", anh: muc.anh ?? null, to, luc: Date.now() };
}

/* ---------- Thành phần ---------- */

export default function GlobalSearch({ userId, role, isPhone = false, placeholder = t("Tìm kiếm") }) {
  const navigate = useNavigate();
  const listboxId = useId();
  const khungRef = useRef(null);
  const oNhapRef = useRef(null);
  const lanTimRef = useRef(0);
  // Enter bấm khi chưa có kết quả của từ khóa này (máy quét gửi Enter ngay sau mã): giữ từ khóa để mở khi kết quả về
  const choEnterRef = useRef(null);

  const [mo, setMo] = useState(false);
  const [tuKhoa, setTuKhoa] = useState("");
  const [tab, setTab] = useState("tatCa");
  // -1: chưa chọn dòng nào (lúc chưa gõ không tô sẵn dòng đầu); có kết quả thì chọn dòng đầu
  const [dongChon, setDongChon] = useState(-1);
  const [ketQua, setKetQua] = useState(null); // { tk, trangThai, nhom: { [key]: { trangThai, tong, muc } } }
  const khoaDaXem = `fc_da_xem_gan_day_${userId ?? "khach"}`;
  const [daXem, setDaXem] = useState(() => docDaXem(khoaDaXem));

  // Bỏ khóa "Tìm gần đây" (lưu từ khóa) của bản trước: nay lưu bản ghi đã mở
  useEffect(() => {
    try {
      localStorage.removeItem(`fc_tim_gan_day_${userId ?? "khach"}`);
    } catch {
      // Không xóa được thì thôi
    }
  }, [userId]);

  const kenhDaKetNoi = useKenhDaKetNoi();
  const manHinh = useMemo(() => danhSachManHinh(role, kenhDaKetNoi), [role, kenhDaKetNoi]);
  const nhomDuocXem = useMemo(() => nhomTheoVaiTro(role), [role]);
  const keyDuocXem = useMemo(() => new Set(nhomDuocXem.map((n) => n.key)), [nhomDuocXem]);

  const tk = tuKhoa.trim();
  const daGoDu = tk.length >= SO_KY_TU_TOI_THIEU;
  const tabHienTai = tab === "tatCa" || keyDuocXem.has(tab) ? tab : "tatCa";

  // Màn hình: lọc tại chỗ, không phân biệt dấu
  const manHinhKhop = useMemo(() => {
    if (!daGoDu) return [];
    const k = boDau(tk);
    return manHinh.filter((m) => boDau(`${m.label} ${m.viTri}`).includes(k));
  }, [daGoDu, tk, manHinh]);

  // Một lời gọi khi ngừng gõ; chỉ nhận kết quả của lần gõ mới nhất. Gõ tiếp / đóng ô thì hủy lời gọi đang chạy
  useEffect(() => {
    if (!daGoDu) return undefined;
    const lanTim = ++lanTimRef.current;
    const huy = new AbortController();
    const boQua = () => lanTim !== lanTimRef.current || huy.signal.aborted;
    const hen = setTimeout(() => {
      apiClient
        .get("/api/v1/tim-kiem", { params: { q: tk, size: SO_KET_QUA_MOI_NHOM }, signal: huy.signal })
        .then((res) => {
          if (boQua()) return;
          const nhom = Object.fromEntries((res?.data?.data?.nhom ?? []).map((n) => [n.key, n]));
          setKetQua({ tk, trangThai: "xong", nhom });
          // Kết quả chèn khối khớp chính xác và các nhóm lên trước: chọn lại dòng đầu (dòng khớp chính xác nếu có)
          setDongChon(0);
        })
        .catch(() => {
          if (boQua()) return;
          setKetQua({ tk, trangThai: "loi", nhom: {} });
          setDongChon(0);
        });
    }, THOI_GIAN_CHO_MS);
    return () => {
      clearTimeout(hen);
      huy.abort();
    };
  }, [daGoDu, tk]);

  const coKetQua = daGoDu && ketQua?.tk === tk;
  const conDangTai = daGoDu && !coKetQua;

  // Gom dữ liệu theo nhóm: { key, label, trangThai, tong, muc }. Dòng khớp chính xác tách lên khối riêng.
  const { nhomHienThi, khopChinhXac } = useMemo(() => {
    if (!daGoDu) return { nhomHienThi: [], khopChinhXac: [] };
    const khop = [];
    const ds = nhomDuocXem
      .map((n) => {
        if (n.key === "manHinh") {
          return { ...n, trangThai: "xong", tong: manHinhKhop.length, muc: manHinhKhop };
        }
        if (!coKetQua) return { ...n, trangThai: "dangTai", tong: 0, muc: [] };
        const kq = ketQua.nhom[n.key];
        if (!kq) {
          // Cả lần gọi lỗi thì mọi nhóm báo lỗi; máy chủ không trả nhóm (không có quyền) thì coi như rỗng
          return { ...n, trangThai: ketQua.trangThai === "loi" ? "loi" : "xong", tong: 0, muc: [] };
        }
        if (kq.trangThai === "loi") return { ...n, trangThai: "loi", tong: 0, muc: [] };
        const muc = kq.muc ?? [];
        muc.filter((m) => m.khopChinhXac).forEach((m) => khop.push({ nhom: n.key, muc: m }));
        return { ...n, trangThai: "xong", tong: kq.tong ?? muc.length, muc: muc.filter((m) => !m.khopChinhXac) };
      })
      .filter((n) => tabHienTai === "tatCa" || n.key === tabHienTai);
    const khopTrongTab = khop.filter((k) => tabHienTai === "tatCa" || k.nhom === tabHienTai);
    return { nhomHienThi: ds, khopChinhXac: khopTrongTab };
  }, [daGoDu, nhomDuocXem, manHinhKhop, coKetQua, ketQua, tabHienTai]);

  // Danh sách dòng phẳng để điều khiển bằng bàn phím
  const dongs = useMemo(() => {
    if (!daGoDu) {
      // Đã gõ 1 ký tự thì ẩn "Đã xem gần đây", chỉ còn lời nhắc gõ thêm. Đứng ở tab nào thì chỉ còn bản ghi loại đó
      return (tk.length ? [] : daXem)
        .filter((d) => keyDuocXem.has(d.loai) && (tabHienTai === "tatCa" || d.loai === tabHienTai))
        .map((d) => ({ loai: "daXem", key: `dx-${d.to}`, giaTri: d }));
    }
    const ds = khopChinhXac.map((k) => ({ loai: k.nhom, key: `khop-${k.nhom}-${k.muc.loaiChungTu ?? ""}-${k.muc.id}`, giaTri: k.muc, khop: true }));
    const gioiHan = tabHienTai === "tatCa" ? SO_DONG_XEM_TRUOC : SO_KET_QUA_MOI_NHOM;
    nhomHienThi.forEach((n) => {
      if (n.trangThai !== "xong") return;
      n.muc.slice(0, gioiHan).forEach((item) =>
        ds.push({ loai: n.key, key: `${n.key}-${item.loaiChungTu ?? ""}-${item.id}`, giaTri: item }),
      );
    });
    return ds;
  }, [daGoDu, tk, daXem, keyDuocXem, khopChinhXac, nhomHienThi, tabHienTai]);

  const dongChonHopLe = dongChon < 0 ? -1 : Math.min(dongChon, Math.max(dongs.length - 1, 0));

  /** Đóng ô: bỏ Enter đang chờ (không tự mở trang sau khi đã đóng), lần mở sau về tab Tất cả, dòng đầu. */
  const dong = useCallback(() => {
    choEnterRef.current = null;
    setMo(false);
    setTab("tatCa");
    setDongChon(-1);
    oNhapRef.current?.blur();
  }, []);

  const ghiNhoDaXem = useCallback(
    (muc) => {
      setDaXem((cu) => {
        const moi = [muc, ...cu.filter((x) => x.to !== muc.to)].slice(0, SO_DA_XEM);
        ghiDaXem(khoaDaXem, moi);
        return moi;
      });
    },
    [khoaDaXem],
  );

  /** Mở một dòng; `tabMoi`: mở ở tab mới, giữ ô tìm đang mở. */
  const chonDong = useCallback(
    (d, tabMoi = false) => {
      if (!d) return;
      choEnterRef.current = null;
      let duongDan;
      if (d.loai === "daXem") {
        duongDan = d.giaTri.to;
        ghiNhoDaXem({ ...d.giaTri, luc: Date.now() });
      } else {
        duongDan = duongDanCua(d.loai, d.giaTri);
        if (duongDan && d.loai !== "manHinh") ghiNhoDaXem(tomTatDaXem(d.loai, d.giaTri, duongDan));
      }
      if (!duongDan) return;
      if (tabMoi) {
        window.open(duongDan, "_blank", "noopener");
        return;
      }
      setTuKhoa("");
      setKetQua(null);
      dong();
      // Trang đang sửa dở (vd. trình sửa mẫu in) được hỏi trước khi rời
      xinRoiTrang(() => navigate(duongDan));
    },
    [dong, ghiNhoDaXem, navigate],
  );

  const xemTatCa = useCallback(
    (n) => {
      if (!n.trangDanhSach) {
        setTab(n.key);
        setDongChon(0);
        return;
      }
      const duongDan = `${n.trangDanhSach}?q=${encodeURIComponent(tk)}`;
      setTuKhoa("");
      setKetQua(null);
      dong();
      xinRoiTrang(() => navigate(duongDan));
    },
    [dong, navigate, tk],
  );

  // Enter đã bấm trước khi có kết quả (BR-04): kết quả về mà có đúng một dòng khớp chính xác thì mở luôn.
  // Xét mọi nhóm (không theo tab đang chọn) vì máy quét không chọn tab.
  useEffect(() => {
    const cho = choEnterRef.current;
    if (!coKetQua || !mo || cho?.tk !== tk) return;
    choEnterRef.current = null;
    const khop = nhomDuocXem.flatMap((n) =>
      (ketQua.nhom[n.key]?.muc ?? []).filter((m) => m.khopChinhXac).map((m) => ({ loai: n.key, giaTri: m, khop: true })),
    );
    // Hoãn qua microtask như các trang khác (tránh setState đồng bộ trong effect)
    if (khop.length === 1) queueMicrotask(() => chonDong(khop[0], cho.tabMoi));
  }, [coKetQua, mo, tk, ketQua, nhomDuocXem, chonDong]);

  // Ctrl/⌘ + K ở bất kỳ đâu trong backoffice
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        oNhapRef.current?.focus();
        oNhapRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!mo) return undefined;
    const onDown = (e) => {
      if (!khungRef.current?.contains(e.target)) dong();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mo, dong]);

  // Giữ dòng đang chọn trong vùng nhìn thấy
  useEffect(() => {
    if (!mo) return;
    document.getElementById(`${listboxId}-dong-${dongChonHopLe}`)?.scrollIntoView({ block: "nearest" });
  }, [mo, dongChonHopLe, listboxId]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMo(true);
      setDongChon(Math.max(0, Math.min(dongChonHopLe + 1, dongs.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDongChon(Math.max(dongChonHopLe - 1, 0));
    } else if (e.key === "Enter") {
      // Đang gõ bằng bộ gõ có ghép chữ: Enter để chốt chữ, không mở dòng
      if (e.nativeEvent?.isComposing) return;
      e.preventDefault();
      if (conDangTai) {
        choEnterRef.current = { tk, tabMoi: e.ctrlKey || e.metaKey };
        return;
      }
      // Mới gõ 1 ký tự: dòng đang hiện là "Đã xem gần đây", Enter không tự mở
      if (tk.length > 0 && !daGoDu) return;
      if (dongs[dongChonHopLe]) chonDong(dongs[dongChonHopLe], e.ctrlKey || e.metaKey);
    } else if (e.key === "Escape") {
      e.preventDefault();
      dong();
    }
  };

  const doiTuKhoa = (giaTri) => {
    setTuKhoa(giaTri);
    setDongChon(giaTri.trim().length >= SO_KY_TU_TOI_THIEU ? 0 : -1);
    setMo(true);
    choEnterRef.current = null;
  };

  const xoaDaXem = () => {
    setDaXem([]);
    ghiDaXem(khoaDaXem, []);
  };

  const chiSoDong = (key) => dongs.findIndex((d) => d.key === key);
  const tongKetQua = khopChinhXac.length + nhomHienThi.reduce((s, n) => s + (n.trangThai === "xong" ? n.muc.length : 0), 0);
  const dongDangChon = dongs[dongChonHopLe];
  const bayGio = new Date();

  /* ---------- Vẽ một dòng ---------- */
  const veDong = (d) => {
    const i = chiSoDong(d.key);
    const chon = i === dongChonHopLe;
    const item = d.giaTri;
    let bieuTuong;
    let chinh;
    let phu;
    let benPhai = null;

    if (d.loai === "daXem") {
      const n = NHOM[item.loai];
      const Icon = n?.icon ?? History;
      bieuTuong = item.anh ? <img src={item.anh} alt="" className="size-full rounded-md object-cover" loading="lazy" /> : <Icon className="size-4" />;
      chinh = item.ten;
      // Tên loại chứng từ dịch lúc vẽ; tên khách (dữ liệu máy chủ) qua tDuLieu
      const phuDaXem = item.loai === "chungTu" ? LOAI_CHUNG_TU[item.loaiChungTu]?.ten : tDuLieu(item.phu);
      phu = [phuDaXem, n?.label].filter(Boolean).join(" · ");
      benPhai = <span className="text-xs text-slate-400">{thoiGianTuongDoi(item.luc, bayGio)}</span>;
    } else if (d.loai === "manHinh") {
      bieuTuong = <LayoutGrid className="size-4" />;
      chinh = <ToDam text={item.label} tuKhoa={tk} />;
      phu = item.viTri;
    } else if (d.loai === "sanPham") {
      bieuTuong = item.anh ? (
        <img src={item.anh} alt="" className="size-full rounded-md object-cover" loading="lazy" />
      ) : (
        <Package className="size-4" />
      );
      chinh = <ToDam text={item.ten} tuKhoa={tk} />;
      const khop = ghiChuKhop(item);
      phu = d.khop
        ? khop
        : // Giá bán mặc định là 0 khi sản phẩm hết hàng (máy chủ tính trên biến thể còn hàng): không hiện "0 ₫"
          [item.ma, khop, item.giaTri > 0 ? formatCurrency(item.giaTri) : null, tDuLieu(item.phu)].filter(Boolean).join(" · ") || "—";
      const tt = TRANG_THAI_SAN_PHAM[item.trangThai];
      benPhai = tt ? <StatusBadge label={tt} /> : null;
    } else if (d.loai === "donBan") {
      const tt = getDonBanHangStatus(item.trangThai);
      bieuTuong = <ShoppingCart className="size-4" />;
      chinh = (
        <>
          <ToDam text={item.ma} tuKhoa={tk} /> · {tDuLieu(item.khach) || t("Khách lẻ")}
        </>
      );
      const khop = item.truongKhop === "maDonSan" || item.truongKhop === "sdt" ? ghiChuKhop(item) : null;
      phu = [tDuLieu(item.kenh), khop ?? (item.ngay ? new Date(item.ngay).toLocaleDateString("vi-VN") : null)]
        .filter(Boolean)
        .join(" · ") || "—";
      benPhai = (
        <span className="flex flex-col items-end gap-1">
          {item.giaTri != null ? <span className="text-xs font-medium text-bo-foreground">{formatCurrency(item.giaTri)}</span> : null}
          {tt?.label ? <StatusBadge quyTrinh="donBan" label={tt.label} /> : null}
        </span>
      );
    } else if (d.loai === "khachHang") {
      bieuTuong = <UserRound className="size-4" />;
      chinh = <ToDam text={item.ten} tuKhoa={tk} />;
      const khop = d.khop ? ghiChuKhop(item) : null;
      phu = khop ? (
        [khop, item.ma].filter(Boolean).join(" · ")
      ) : (
        <>
          {item.soDienThoai ? <ToDam text={item.soDienThoai} tuKhoa={tk} /> : null}
          {item.soDienThoai && item.ma ? " · " : null}
          {item.ma ? <ToDam text={item.ma} tuKhoa={tk} /> : null}
          {!item.soDienThoai && !item.ma ? "—" : null}
        </>
      );
    } else if (d.loai === "nhaCungCap") {
      bieuTuong = <Building2 className="size-4" />;
      chinh = <ToDam text={item.ten} tuKhoa={tk} />;
      const khop = d.khop ? ghiChuKhop(item) : null;
      phu = khop
        ? [khop, item.ma].filter(Boolean).join(" · ")
        : [item.ma, item.phu ? t("MST {{mst}}", { mst: item.phu }) : null, item.soDienThoai].filter(Boolean).join(" · ") || "—";
      // i18n-giu-nguyen: nhãn tiếng Việt truyền cho StatusBadge (badge tự dịch lúc vẽ)
      benPhai = item.trangThai != null ? <StatusBadge doiTuong="nguoi" label={item.trangThai === 1 ? "Hoạt động" : "Ngừng hoạt động"} /> : null;
    } else if (d.loai === "chungTu") {
      const lt = LOAI_CHUNG_TU[item.loaiChungTu];
      bieuTuong = <FileText className="size-4" />;
      chinh = <ToDam text={item.ma} tuKhoa={tk} />;
      const noiKho = item.khoXuat && item.khoNhap ? `${tDuLieu(item.khoXuat)} → ${tDuLieu(item.khoNhap)}` : tDuLieu(item.khoXuat || item.khoNhap);
      phu = [lt?.ten, tDuLieu(item.ten), tDuLieu(item.phu) || noiKho].filter(Boolean).join(" · ");
      const nhan = lt?.nhan(item);
      benPhai = nhan ? <StatusBadge quyTrinh={lt.quyTrinh} label={nhan} /> : null;
    }

    return (
      <li
        key={d.key}
        id={`${listboxId}-dong-${i}`}
        role="option"
        aria-selected={chon}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => chonDong(d, e.ctrlKey || e.metaKey)}
        onAuxClick={(e) => {
          if (e.button === 1) chonDong(d, true);
        }}
        onMouseMove={() => i !== dongChonHopLe && setDongChon(i)}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-2 sm:px-5",
          chon ? "bg-bo-primary-soft/70" : "hover:bg-bo-surface-subtle",
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100 text-slate-500">
          {bieuTuong}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-bo-foreground">{chinh}</span>
          {phu ? <span className="mt-0.5 block truncate text-xs text-bo-muted">{phu}</span> : null}
        </span>
        {benPhai ? <span className="shrink-0">{benPhai}</span> : null}
      </li>
    );
  };

  const tieuDeNhom = (noiDung, phai = null) => (
    <div className="flex items-center justify-between px-4 pb-1 pt-3 text-xs font-medium text-bo-muted sm:px-5">
      {noiDung}
      {phai}
    </div>
  );

  /* ---------- Thân khung kết quả ---------- */
  let than;
  if (!daGoDu) {
    const dongDaXem = dongs.filter((d) => d.loai === "daXem");
    const coDaXem = dongDaXem.length > 0;
    than = (
      <>
        {coDaXem ? (
          <>
            {tieuDeNhom(
              t("Đã xem gần đây"),
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={xoaDaXem}
                className="text-xs font-medium text-bo-primary hover:underline"
              >
                {t("Xóa")}
              </button>,
            )}
            <ul role="listbox" aria-label={t("Đã xem gần đây")}>
              {dongDaXem.map(veDong)}
            </ul>
          </>
        ) : (
          // Kính lúp và một dòng nhắc ở giữa khung, như bản trước; nhắc theo tab đang chọn
          <TrangThaiRong>
            {tk.length > 0
              ? t("Gõ thêm ít nhất {{count}} ký tự nữa", { count: SO_KY_TU_TOI_THIEU - tk.length })
              : (NHOM[tabHienTai]?.goiY ?? t("Gõ mã SKU, mã vạch, số đơn, mã đơn sàn, mã phiếu, tên hoặc số điện thoại."))}
          </TrangThaiRong>
        )}
      </>
    );
  } else if (!conDangTai && tongKetQua === 0 && nhomHienThi.every((n) => n.trangThai === "xong")) {
    const tenNhom = nhomHienThi.map((n) => n.label.toLowerCase()).join(", ");
    than = (
      <TrangThaiRong
        ghiChu={`${t("Đã tìm trong {{nhom}}.", { nhom: tenNhom })} ${t("Thử gõ mã SKU, mã vạch, số đơn, mã đơn sàn, mã phiếu hoặc số điện thoại.")}`}
      >
        {t("Không tìm thấy kết quả cho “{{tk}}”", { tk })}
      </TrangThaiRong>
    );
  } else {
    const gioiHan = tabHienTai === "tatCa" ? SO_DONG_XEM_TRUOC : SO_KET_QUA_MOI_NHOM;
    than = (
      <ul role="listbox" aria-label={t("Kết quả tìm kiếm")}>
        {khopChinhXac.length ? (
          <li role="presentation">
            {tieuDeNhom(
              <span className="flex items-center gap-1.5 text-bo-success">
                <CircleCheck className="size-3.5" aria-hidden="true" />
                {t("Khớp chính xác")}
              </span>,
            )}
            <ul role="group" aria-label={t("Khớp chính xác")}>
              {dongs.filter((d) => d.khop).map(veDong)}
            </ul>
          </li>
        ) : null}
        {nhomHienThi.map((n) => {
          if (n.trangThai === "xong" && n.muc.length === 0) return null;
          const soHien = Math.min(gioiHan, n.muc.length);
          // Số còn lại tính trên tổng của nhóm (gồm cả dòng đã lên khối khớp chính xác)
          const soKhop = khopChinhXac.filter((k) => k.nhom === n.key).length;
          const conNua = n.trangThai === "xong" && n.tong > soHien + soKhop;
          const coXemTatCa = conNua && (tabHienTai === "tatCa" || n.trangDanhSach);
          return (
            <li key={n.key} role="presentation">
              {tieuDeNhom(
                n.label,
                coXemTatCa ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => xemTatCa(n)}
                    className="flex items-center gap-0.5 text-xs font-medium text-bo-primary hover:underline"
                  >
                    {n.trangDanhSach
                      ? t("Xem tất cả {{so}}", { so: n.tong.toLocaleString("vi-VN") })
                      : t("Xem {{so}} kết quả", { count: n.tong, so: n.tong.toLocaleString("vi-VN") })}
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null,
              )}
              {n.trangThai === "dangTai" ? (
                <div className="space-y-2 px-4 py-2 sm:px-5" aria-hidden="true">
                  <div className="h-9 animate-pulse rounded-md bg-slate-100" />
                  <div className="h-9 animate-pulse rounded-md bg-slate-100" />
                </div>
              ) : n.trangThai === "loi" ? (
                <p className="px-4 py-2 text-xs text-bo-danger sm:px-5">{t("Không tải được {{nhom}}. Thử lại sau.", { nhom: n.label.toLowerCase() })}</p>
              ) : (
                <ul role="group" aria-label={n.label}>
                  {dongs.filter((d) => d.loai === n.key && !d.khop).map(veDong)}
                </ul>
              )}
              {tabHienTai !== "tatCa" && conNua && !n.trangDanhSach ? (
                <p className="px-4 pb-2 pt-1 text-xs text-bo-muted sm:px-5">
                  {t("Đang hiện {{soHien}} / {{tong}} kết quả, gõ cụ thể hơn để thu hẹp.", {
                    soHien: soHien + soKhop,
                    tong: n.tong.toLocaleString("vi-VN"),
                    count: n.tong,
                  })}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  /**
   * Tab luôn có đủ như bản trước (chọn tab trước khi gõ để tìm riêng một loại). Khi đã có kết quả, nhóm không có dòng
   * nào thì chữ nhạt đi. Không ghi số trên tab: số đã có ở "Xem tất cả" của từng nhóm, ghi thêm thì tab dài, tràn khung.
   */
  const tabs = [{ key: "tatCa", label: t("Tất cả") }, ...nhomDuocXem];
  const nhomRong = (key) => {
    if (!daGoDu || key === "tatCa") return false;
    if (key === "manHinh") return manHinhKhop.length === 0;
    if (!coKetQua || ketQua.trangThai === "loi") return false;
    const kq = ketQua.nhom[key];
    return !kq || (kq.trangThai === "xong" && (kq.tong ?? 0) === 0);
  };
  // Quản trị viên có 7 tab: chữ nhỏ hơn một cỡ, khoảng cách hẹp hơn để vừa khung 560px
  const tabChat = tabs.length > 6;

  return (
    <div ref={khungRef} className="relative w-full min-w-0" style={{ maxWidth: 600 }}>
      <div
        className={cn(
          "flex h-9 items-center gap-2.5 rounded-lg border px-3 transition-[border-color,box-shadow,background-color]",
          mo ? "border-bo-primary bg-bo-surface" : "border-transparent hover:bg-bo-surface-subtle",
        )}
        style={mo ? { boxShadow: "0 0 0 3px rgba(13,97,228,0.12)" } : undefined}
      >
        <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          ref={oNhapRef}
          type="text"
          value={tuKhoa}
          onChange={(e) => doiTuKhoa(e.target.value)}
          onFocus={() => setMo(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-label={t("Tìm kiếm trong hệ thống")}
          aria-expanded={mo}
          aria-controls={mo ? listboxId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={mo && dongDangChon ? `${listboxId}-dong-${dongChonHopLe}` : undefined}
          // Màn cảm ứng: ô nhập trùm lên lề trái và kính lúp (lề âm + đệm bằng nhau, chữ vẫn đứng chỗ cũ) để chạm vào cả khung
          // tìm đều mở ô — điện thoại hẹp có tên kho ở đầu trang, riêng ô nhập chỉ còn ~33px
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-bo-foreground outline-none placeholder:text-slate-400 cam-ung:-ml-[38px] cam-ung:pl-[38px]"
        />
        {tuKhoa ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              doiTuKhoa("");
              oNhapRef.current?.focus();
            }}
            aria-label={t("Xóa từ khóa")}
            className="grid size-6 shrink-0 place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {mo ? (
        <div
          className={cn(
            "z-50 overflow-hidden rounded-xl border border-bo-border bg-bo-surface",
            isPhone ? "fixed inset-x-3" : "absolute inset-x-0",
          )}
          style={{ top: isPhone ? 60 : "calc(100% + 6px)", boxShadow: "0 12px 32px rgba(15,23,42,0.12)" }}
        >
          <div
            className="flex overflow-x-auto overflow-y-hidden border-b border-bo-border px-2"
            style={{ scrollbarWidth: "none" }}
            role="tablist"
            aria-label={t("Nhóm kết quả")}
          >
            {tabs.map((mucTab) => {
              const dangChon = tabHienTai === mucTab.key;
              return (
                <button
                  key={mucTab.key}
                  type="button"
                  role="tab"
                  aria-selected={dangChon}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setTab(mucTab.key);
                    setDongChon(daGoDu ? 0 : -1);
                  }}
                  className={cn(
                    // grow: màn rộng chia đều phần trống cho các tab; màn hẹp co về đúng cỡ chữ rồi cuộn ngang
                    "-mb-px shrink-0 grow whitespace-nowrap border-b-2 py-3 text-center font-medium transition-colors",
                    tabChat ? "px-2 text-[13px]" : "px-3 text-sm",
                    dangChon
                      ? "border-bo-primary text-bo-primary"
                      : nhomRong(mucTab.key)
                        ? "border-transparent text-slate-300 hover:text-bo-muted"
                        : "border-transparent text-bo-muted hover:text-bo-foreground",
                  )}
                >
                  {mucTab.label}
                </button>
              );
            })}
          </div>
          {/* Khung kết quả luôn có khi ô mở: đích của aria-controls */}
          <div id={listboxId} className="overflow-y-auto pb-2" style={{ maxHeight: "min(440px, calc(100dvh - 180px))" }}>{than}</div>
        </div>
      ) : null}
    </div>
  );
}

function TrangThaiRong({ children, ghiChu, className }) {
  return (
    <div className={cn("px-6 py-8 text-center", className)}>
      <Search className="mx-auto mb-2 size-8 text-slate-300" aria-hidden="true" />
      <p className="text-sm text-bo-muted">{children}</p>
      {ghiChu ? <p className="mx-auto mt-1 max-w-[48ch] text-xs text-slate-400">{ghiChu}</p> : null}
    </div>
  );
}
