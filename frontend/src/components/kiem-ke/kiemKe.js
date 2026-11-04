/*
 * Hàm thuần của kiểm kê khoanh vùng (đặc tả BA 03/11): nhãn trạng thái, phạm vi, khóa, tiến trình, tìm / quét mã,
 * lọc dòng, đếm nhanh. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Dữ liệu máy chủ (KiemKeDto):
 * - Đợt: trangThai 0 Nháp · 1 Đang kiểm kê · 2 Chờ duyệt · 3 Đã duyệt · 4 Đã hủy; phienBan gửi lại khi bấm lệnh.
 * - Dòng: một cặp kệ–lô; soLuongHeThong là số chốt lúc bắt đầu; soLuongThucTe null = chưa đếm (khác số 0);
 *   trangThai 0 Chưa kiểm · 1 Đã kiểm · 2 Cần kiểm lại · 3 Đã xác nhận.
 */
import { boDau, docSo, soVN } from "../chung-tu/bangChungTu.js";

export const TT_DOT = Object.freeze({ NHAP: 0, DANG_KIEM_KE: 1, CHO_DUYET: 2, DA_DUYET: 3, DA_HUY: 4 });
export const TT_DONG = Object.freeze({ CHUA_KIEM: 0, DA_KIEM: 1, CAN_KIEM_LAI: 2, DA_XAC_NHAN: 3 });

/** Nhãn trạng thái đợt (constants/trangThai.js → kiemKe tô màu theo tên nhãn). */
export const NHAN_TT_DOT = Object.freeze(["Nháp", "Đang kiểm kê", "Chờ duyệt", "Đã duyệt", "Đã hủy"]);
export const nhanTrangThaiDot = (tt) => NHAN_TT_DOT[Number(tt)] ?? "Không rõ";

export const NHAN_TT_DONG = Object.freeze(["Chưa kiểm", "Đã kiểm", "Cần kiểm lại", "Đã xác nhận"]);

/** Tab danh sách: mã tab nằm trên URL ?trangThai= (dashboard liên kết tới "dang-kiem-ke"). */
export const TAB_DOT = Object.freeze([
  { value: "tat-ca", label: "Tất cả", trangThai: null },
  { value: "nhap", label: "Nháp", trangThai: 0 },
  { value: "dang-kiem-ke", label: "Đang kiểm kê", trangThai: 1 },
  { value: "cho-duyet", label: "Chờ duyệt", trangThai: 2, tone: "warning" },
  { value: "da-duyet", label: "Đã duyệt", trangThai: 3 },
  { value: "da-huy", label: "Đã hủy", trangThai: 4 },
]);

export const LOAI_PHAM_VI = Object.freeze({
  toan_bo: { nhan: "Toàn bộ kho", ngan: "Toàn kho", moTa: "Mọi kệ của kho, kể cả kệ trống. Cả kho tạm dừng nhập xuất." },
  theo_khu_vuc: { nhan: "Theo khu vực", ngan: "Khu vực", moTa: "Một hoặc nhiều khu. Khu khác vẫn vận hành." },
  theo_ke: { nhan: "Theo vị trí kệ", ngan: "Kệ", moTa: "Chọn từng kệ cần đếm. Kệ khác vẫn vận hành." },
  theo_danh_muc: { nhan: "Theo danh mục", ngan: "Danh mục", moTa: "Danh mục và mọi danh mục con. Hàng khác trên cùng kệ vẫn bán." },
  dot_xuat: { nhan: "Đột xuất", ngan: "Đột xuất", moTa: "Đợt cũ" },
});
export const THU_TU_PHAM_VI = Object.freeze(["toan_bo", "theo_khu_vuc", "theo_ke", "theo_danh_muc"]);

export const nhanPhamVi = (loai) => LOAI_PHAM_VI[loai]?.nhan ?? "Toàn bộ kho";

/** Một dòng mô tả phạm vi của đợt: "Khu A, Khu B" · "A-01-01, A-01-02 +3" · "Quần (gồm 2 danh mục con)". */
export function moTaPhamVi(dot, toiDa = 3) {
  if (!dot) return "";
  const loai = dot.loaiKiemKe;
  if (loai === "toan_bo" || loai === "dot_xuat" || !loai) return dot.kho?.ten ? `Mọi kệ của ${dot.kho.ten}` : "Mọi kệ của kho";
  const gon = (ds) => {
    const ten = ds.filter(Boolean);
    if (!ten.length) return "";
    return ten.length <= toiDa ? ten.join(", ") : `${ten.slice(0, toiDa).join(", ")} +${ten.length - toiDa}`;
  };
  if (loai === "theo_khu_vuc") return gon((dot.khuVuc ?? []).map((k) => k.ten || k.ma)) || "Chưa chọn khu vực";
  if (loai === "theo_ke") return gon((dot.viTri ?? []).map((v) => v.ma)) || "Chưa chọn kệ";
  if (loai === "theo_danh_muc") {
    const goc = dot.danhMuc?.ten || "Chưa chọn danh mục";
    const con = Math.max(0, (dot.danhMucChot?.length ?? 0) - 1);
    return con > 0 ? `${goc} (gồm ${con} danh mục con)` : goc;
  }
  return "";
}

/** Khóa đang giữ của đợt cho danh sách / đầu màn. */
export function moTaKhoa(dot) {
  const tt = Number(dot?.trangThai);
  if (tt === TT_DOT.NHAP) return { kieu: "chua", nhan: "Chưa khóa" };
  if (tt === TT_DOT.DANG_KIEM_KE || tt === TT_DOT.CHO_DUYET) {
    const soKe = Number(dot.soKeKhoa) || 0;
    return dot.cheDoKhoa === "theo_lo"
      ? { kieu: "min", nhan: `Khóa mịn · ${soVN(soKe)} kệ` }
      : { kieu: "toan", nhan: `Khóa toàn kệ · ${soVN(soKe)} kệ` };
  }
  return { kieu: "mo", nhan: tt === TT_DOT.DA_HUY ? "Đã mở khóa (hủy)" : "Đã mở khóa" };
}

/**
 * Bước của thanh tiến trình: Nháp → Bắt đầu & chốt tồn → Kiểm đếm → Chờ duyệt → Đã duyệt (Đã hủy thay bước cuối).
 * `thongKe`: KiemKeDto.ThongKe.
 */
export function buocKiemKe(dot) {
  const tt = Number(dot?.trangThai);
  const tk = dot?.thongKe ?? {};
  const huy = tt === TT_DOT.DA_HUY;
  const daBatDau = Boolean(dot?.ngayBatDau);
  // Đã trình duyệt ít nhất một lần và chưa bị trả về đếm lại
  const daDemXong = tt === TT_DOT.CHO_DUYET || tt === TT_DOT.DA_DUYET || (huy && Boolean(dot?.ngayHoanThanh));
  const trang = (xong, dang) => (xong ? "xong" : dang ? "dangLam" : "chua");
  const buoc = [
    { ma: "nhap", nhan: "Lập kế hoạch", trangThai: "xong", ngay: dot?.ngayTao, ai: dot?.nguoiChuTri?.hoTen },
    { ma: "chot", nhan: "Khóa & chốt sổ", trangThai: trang(daBatDau, tt === TT_DOT.NHAP), ngay: dot?.ngayBatDau, coGio: true },
    {
      ma: "dem",
      nhan: "Kiểm đếm",
      trangThai: trang(daDemXong, tt === TT_DOT.DANG_KIEM_KE),
      phu: daBatDau && tk.tongDong ? `${soVN(tk.daDem)}/${soVN(tk.tongDong)} dòng` : undefined,
    },
    { ma: "duyet", nhan: "Thẩm định", trangThai: trang(tt === TT_DOT.DA_DUYET, tt === TT_DOT.CHO_DUYET), ngay: daDemXong ? dot?.ngayHoanThanh : undefined, coGio: true },
  ];
  buoc.push(huy
    ? { ma: "huy", nhan: "Đã hủy", trangThai: "dung", ngay: dot?.ngayHuy, coGio: true, ai: dot?.nguoiHuy?.hoTen, canhBao: true, phu: "Tồn kho không đổi" }
    : { ma: "xong", nhan: "Duyệt & mở khóa", trangThai: tt === TT_DOT.DA_DUYET ? "xong" : "chua", ngay: dot?.ngayDuyet, coGio: true, ai: dot?.nguoiDuyet?.hoTen });
  return buoc;
}

// ── Số đếm ──────────────────────────────────────────────────────────────────

/** Số đếm từ ô nhập: trống → null; giữ chữ số, cắt ở `toiDa`. */
export function docSoDem(chu, toiDa) {
  const so = String(chu ?? "").replace(/\D/g, "");
  if (!so) return null;
  return Math.min(Number(so), toiDa);
}

/**
 * Mã quét ở ô quét: "12*LO100" (cộng 12 vào dòng của lô LO100), "LO100" (cộng 1), mã kệ ("A-01-01", lọc kệ). Chỉ nhận
 * dấu "*" hoặc "×" làm dấu nhân — "x" dễ trùng mã thật (SKU "2XL-AO").
 * Trả `{ soLuong, ma, coSo }` (`coSo`: có gõ số lượng); số lượng không hợp lệ (0) → soLuong null.
 */
export function phanTichQuet(chu) {
  const gon = String(chu ?? "").trim();
  if (!gon) return null;
  const m = gon.match(/^(\d+)\s*[*×]\s*(.+)$/);
  if (m) {
    const so = Number(m[1]);
    return { soLuong: so > 0 ? so : null, ma: m[2].trim(), coSo: true };
  }
  return { soLuong: 1, ma: gon, coSo: false };
}

const chuan = (s) => boDau(String(s ?? "")).toLowerCase().replace(/\s+/g, "");

/**
 * Tìm đích của mã quét trong các dòng.
 * - Mã kệ (của một dòng, hoặc kệ trống trong `dsKe` = kệ của đợt) → `{ kieu: "ke", viTriId, maKe }`.
 * - Mã lô, rồi mã vạch / SKU của biến thể (trong kệ đang lọc nếu có): đúng một dòng → `{ kieu: "dong", dong, ds }`; nhiều
 *   dòng → `{ kieu: "nhieu", ds, theo: "lo" | "maVach" }`; không có → `{ kieu: "khong" }`. Nhiều dòng thì bắt chọn đúng dòng
 *   (quét thêm mã khác để thu hẹp), không tự cộng vào dòng đầu (BA UC-STK-03). Mã lô trong hệ thống dùng chung cho mọi
 *   biến thể của cùng một phiếu nhập.
 */
export function timDichQuet(dong, ma, keDangLoc = null, dsKe = []) {
  const m = chuan(ma);
  if (!m) return { kieu: "khong" };
  const ke = dong.find((d) => chuan(d.viTri?.ma) === m)?.viTri ?? dsKe.find((k) => chuan(k.ma) === m);
  if (ke) return { kieu: "ke", viTriId: ke.id, maKe: ke.ma };
  const pham = dong.filter((d) => keDangLoc == null || d.viTri?.id === keDangLoc);
  const theoLo = pham.filter((d) => chuan(d.loHang?.ma) === m);
  const theo = theoLo.length ? "lo" : "maVach";
  const ds = theoLo.length
    ? theoLo
    : pham.filter((d) => chuan(d.sanPham?.maVach) === m || chuan(d.sanPham?.maSku) === m);
  if (ds.length === 1) return { kieu: "dong", dong: ds[0], ds };
  if (ds.length > 1) return { kieu: "nhieu", ds, theo };
  return { kieu: "khong" };
}

/**
 * Thu hẹp lần quét bằng các dòng ứng viên của lần quét trước (mã khớp nhiều dòng) — BA UC-STK-03: quét thêm mã để chọn
 * đúng dòng, không tự cộng vào dòng đầu.
 * - `dich`: kết quả timDichQuet của lần quét này. `truoc`: `{ ids: Set, soLuong }` ứng viên lần trước (hoặc null).
 * - `dong`: mọi dòng của đợt (để tìm ứng viên nằm ở kệ vừa quét).
 * Dòng Đã xác nhận (quản lý đã chốt) không bao giờ là ứng viên; mọi dòng khớp đều đã xác nhận → `dich.kieu` "daXacNhan".
 * `truoc.theo` ("lo" | "maVach"): lần trước khớp theo mã lô hay mã vạch, để màn chỉ đúng mã cần quét tiếp.
 * Trả `{ dich, soLuong, ungVien }`:
 * - Quét mã kệ sau lần quét nhiều dòng: còn đúng một ứng viên ở kệ đó → cộng vào dòng đó với số lượng lần trước; còn
 *   nhiều → giữ các ứng viên ở kệ đó (`ungVien`) để lần quét kế thu hẹp tiếp; không còn → xử lý như quét mã kệ thường.
 * - Quét lô / SKU: giao với ứng viên lần trước; còn một → dòng đó (không gõ số thì lấy số lượng lần trước).
 */
export function thuHepTheoUngVien(dich, { truoc = null, dong = [], soLuong = 1, coSo = false } = {}) {
  const conDem = (ds) => ds.filter((d) => d.trangThai !== TT_DONG.DA_XAC_NHAN);
  let kq = dich;
  if (kq.kieu === "nhieu") {
    const ds = conDem(kq.ds);
    if (ds.length === 1) kq = { kieu: "dong", dong: ds[0], ds };
    else if (ds.length > 1) kq = { ...kq, ds };
    // Mọi dòng khớp đều đã được quản lý xác nhận: không còn dòng nào cộng được
    else if (!truoc) return { dich: { kieu: "daXacNhan", ds: kq.ds }, soLuong, ungVien: null };
  }
  if (!truoc) return { dich: kq, soLuong, ungVien: null };
  // Số lượng giữ từ lần trước, trừ khi lần này gõ số mới ("3*mã")
  const soGiu = coSo ? soLuong : truoc.soLuong;
  if (kq.kieu === "ke") {
    const oKe = conDem(dong.filter((d) => truoc.ids.has(d.id) && d.viTri?.id === kq.viTriId));
    if (oKe.length === 1) return { dich: { kieu: "dong", dong: oKe[0], ds: oKe, quaKe: kq }, soLuong: truoc.soLuong, ungVien: null };
    if (oKe.length > 1) {
      return {
        dich: { ...kq, conUngVien: oKe.length, theo: truoc.theo },
        soLuong: truoc.soLuong,
        ungVien: { ids: new Set(oKe.map((d) => d.id)), soLuong: truoc.soLuong, theo: truoc.theo },
      };
    }
    return { dich: kq, soLuong, ungVien: null };
  }
  if (kq.kieu === "dong" || kq.kieu === "nhieu") {
    const giao = conDem(kq.ds.filter((d) => truoc.ids.has(d.id)));
    if (giao.length === 1) return { dich: { kieu: "dong", dong: giao[0], ds: giao }, soLuong: soGiu, ungVien: null };
    if (giao.length > 1) return { dich: { ...kq, kieu: "nhieu", ds: giao }, soLuong: soGiu, ungVien: null };
  }
  return { dich: kq, soLuong, ungVien: null };
}

// ── Dòng ────────────────────────────────────────────────────────────────────

/** Dòng đã đếm và lệch (Q ≠ 0). */
export const laLech = (d) => d?.soLuongThucTe != null && docSo(d.chenhLechSoLuong) !== 0;
export const thieuLyDo = (d) => laLech(d) && !String(d?.lyDoChenhLech ?? "").trim();

export const BO_LOC = Object.freeze({
  tatCa: null,
  // Dòng đang gõ (chưa lưu) có số thì tính là đã đếm: trangThai còn là của máy chủ cho tới khi lưu xong
  chua: (d) =>
    d.soLuongThucTe == null || (!d.dangGo && (d.trangThai === TT_DONG.CHUA_KIEM || d.trangThai === TT_DONG.CAN_KIEM_LAI)),
  lech: laLech,
  thieuLyDo,
  khop: (d) => d.soLuongThucTe != null && docSo(d.chenhLechSoLuong) === 0,
  demLai: (d) => d.trangThai === TT_DONG.CAN_KIEM_LAI || (d.lanKiemDem ?? 1) > 1,
  phatSinh: (d) => Boolean(d.phatSinh),
});

export const TEN_LOC = Object.freeze({
  chua: "chưa đếm",
  lech: "lệch",
  thieuLyDo: "lệch chưa có lý do",
  khop: "khớp",
  demLai: "cần kiểm lại",
  phatSinh: "phát sinh",
});

/**
 * Lựa chọn lọc nhanh kèm số: ẩn lựa chọn không có dòng nào, trừ Tất cả và lựa chọn đang chọn (`giu`) — đang lọc "Chưa đếm"
 * đếm xong dòng cuối thì lọc vẫn giữ, dòng vừa đếm không nhảy sang trang khác.
 */
export function luaChonLoc(dong, { muc = ["tatCa", "chua", "lech", "thieuLyDo", "demLai", "phatSinh"], giu = null } = {}) {
  const nhan = { tatCa: "Tất cả", chua: "Chưa đếm", lech: "Lệch", thieuLyDo: "Thiếu lý do", khop: "Khớp", demLai: "Đếm lại", phatSinh: "Phát sinh" };
  return muc
    .map((value) => ({ value, label: nhan[value], count: value === "tatCa" ? dong.length : dong.filter(BO_LOC[value]).length }))
    .filter((x) => x.value === "tatCa" || x.count > 0 || x.value === giu);
}

/** Từ khóa tìm khớp tên, SKU, mã lô, mã kệ (không dấu, không phân biệt hoa thường). */
export function khopTim(d, tuKhoa) {
  const tu = chuan(tuKhoa);
  if (!tu) return true;
  return [d.sanPham?.tenSanPham, d.sanPham?.maSku, d.sanPham?.maVach, d.loHang?.ma, d.viTri?.ma, d.sanPham?.tenMau, d.sanPham?.kichCo]
    .some((x) => chuan(x).includes(tu));
}

/** `giuLai`: id dòng vừa sửa từ lúc đổi lọc — vẫn hiện dù không còn khớp lọc (đang lọc "Chưa đếm" gõ số xong không mất dòng). */
export function locDongKiemKe(dong, { tuKhoa = "", loc = "tatCa", viTriId = null, giuLai = null } = {}) {
  const ham = BO_LOC[loc];
  return dong.filter(
    (d) => (viTriId == null || d.viTri?.id === viTriId) && (!ham || ham(d) || giuLai?.has(d.id)) && khopTim(d, tuKhoa),
  );
}

/** Thứ tự đi đếm: theo kệ, rồi tên sản phẩm, rồi mã lô. */
export function sapXepDong(dong) {
  const so = (a, b) => String(a ?? "").localeCompare(String(b ?? ""), "vi", { numeric: true });
  return [...dong].sort(
    (a, b) => so(a.viTri?.ma, b.viTri?.ma) || so(a.sanPham?.tenSanPham, b.sanPham?.tenSanPham) || so(a.loHang?.ma, b.loHang?.ma) || a.id - b.id,
  );
}

/** Gom các dòng (đã sắp) theo kệ liền nhau: `[{ viTri, ds }]`. */
export function nhomTheoKe(dong) {
  const nhom = [];
  for (const d of dong) {
    const cuoi = nhom[nhom.length - 1];
    if (cuoi && cuoi.viTri?.id === d.viTri?.id) cuoi.ds.push(d);
    else nhom.push({ viTri: d.viTri, ds: [d] });
  }
  return nhom;
}

/**
 * Gộp phần đang gõ (chưa lưu) vào dòng máy chủ để bảng, bộ lọc và thanh tổng hợp đổi ngay: số thực tế, chênh lệch tạm
 * tính (thực tế − sổ, × giá vốn chốt), lý do. `nhap[id] = { so?, lyDo? }`. Dòng có phần đang gõ mang `dangGo: true`.
 */
export function gopNhap(dong, nhap) {
  if (!nhap || !Object.keys(nhap).length) return dong;
  return dong.map((d) => {
    const n = nhap[d.id];
    if (!n) return d;
    const moi = { ...d, dangGo: true };
    if ("so" in n) {
      moi.soLuongThucTe = n.so;
      if (n.so == null) {
        moi.chenhLechSoLuong = null;
        moi.giaTriChenhLech = null;
      } else {
        const q = n.so - docSo(d.soLuongHeThong);
        moi.chenhLechSoLuong = q;
        moi.giaTriChenhLech = q * docSo(d.giaVonHeThong);
      }
    }
    if ("lyDo" in n) moi.lyDoChenhLech = n.lyDo;
    return moi;
  });
}

/** Gợi ý giải trình (chạm để điền, vẫn sửa được). */
export const GOI_Y_LY_DO = Object.freeze([
  "Hàng lỗi, hỏng",
  "Thất lạc",
  "Để nhầm kệ",
  "Nhập, xuất chưa ghi nhận",
  "Lần đếm trước nhầm",
]);

/**
 * Tiến độ từng kệ trên MỌI dòng của đợt (không theo bộ lọc / trang): `Map(viTriId → { tong, daDem, nguoi })`.
 * `nguoi`: người đếm dòng mới nhất của kệ (theo ngayKiemDem) — để quản lý thấy ai đang ở kệ nào.
 */
export function tienDoTheoKe(dong) {
  const m = new Map();
  for (const d of dong) {
    const id = d.viTri?.id;
    if (id == null) continue;
    const x = m.get(id) ?? { tong: 0, daDem: 0, nguoi: null, luc: 0 };
    x.tong += 1;
    if (d.soLuongThucTe != null) {
      x.daDem += 1;
      const luc = d.ngayKiemDem ? new Date(d.ngayKiemDem).getTime() : 0;
      if (d.nguoiKiemDem?.hoTen && luc >= x.luc) {
        x.nguoi = d.nguoiKiemDem.hoTen;
        x.luc = luc;
      }
    }
    m.set(id, x);
  }
  return m;
}

/** Kệ kế tiếp (theo thứ tự `dsKe`) sau kệ `viTriId` còn dòng chưa đếm; hết thì null. */
export function keTiepChuaXong(dsKe, viTriId, tienDo) {
  const i = dsKe.findIndex((k) => k.id === viTriId);
  if (i < 0) return null;
  const sau = [...dsKe.slice(i + 1), ...dsKe.slice(0, i)];
  return sau.find((k) => {
    const t = tienDo.get(k.id);
    return t && t.daDem < t.tong;
  }) ?? null;
}

/** Kệ có trong các dòng (cho ô lọc kệ), theo mã. */
export function keCuaDong(dong) {
  const m = new Map();
  for (const d of dong) if (d.viTri?.id != null && !m.has(d.viTri.id)) m.set(d.viTri.id, d.viTri.ma);
  return [...m.entries()].map(([id, ma]) => ({ id, ma })).sort((a, b) => String(a.ma).localeCompare(String(b.ma), "vi"));
}

/** Đếm nhanh trên dòng đang có ở máy (thanh tổng hợp cập nhật ngay khi lưu một dòng). */
export function thongKeDong(dong) {
  let daDem = 0, lech = 0, thieu = 0, thua = 0, giaTriThieu = 0, giaTriThua = 0, thieuLD = 0, chua = 0;
  for (const d of dong) {
    if (d.soLuongThucTe != null) daDem += 1;
    if (BO_LOC.chua(d)) chua += 1;
    if (laLech(d)) {
      lech += 1;
      const q = docSo(d.chenhLechSoLuong);
      const v = Math.abs(docSo(d.giaTriChenhLech));
      if (q < 0) {
        thieu -= q;
        giaTriThieu += v;
      } else {
        thua += q;
        giaTriThua += v;
      }
      if (thieuLyDo(d)) thieuLD += 1;
    }
  }
  // Làm tròn phần trăm xuống: còn một dòng chưa đếm thì không hiện 100%
  const phanTram = dong.length ? Math.floor((daDem / dong.length) * 100) : 0;
  return {
    tong: dong.length, daDem, chua, lech, thieu, thua, giaTriThieu, giaTriThua, giaTri: giaTriThua - giaTriThieu,
    thieuLyDo: thieuLD, phanTram,
  };
}

/** Lý do chưa trình duyệt được (null = được). */
export function lyDoChuaTrinh(tk) {
  if (!tk) return null;
  if (tk.tong === 0) return null;
  const phan = [];
  if (tk.chua) phan.push(`${soVN(tk.chua)} dòng chưa đếm`);
  if (tk.thieuLyDo) phan.push(`${soVN(tk.thieuLyDo)} dòng lệch chưa có lý do`);
  return phan.length ? `Còn ${phan.join(", ")}` : null;
}

/** "−1 · thiếu" / "+2 · thừa" / "Khớp" cho cột chênh lệch. */
export function chuChenhLech(d) {
  if (d?.soLuongThucTe == null) return null;
  const q = docSo(d.chenhLechSoLuong);
  if (q === 0) return { kieu: "khop", chu: "Khớp" };
  return q < 0 ? { kieu: "thieu", chu: `Thiếu ${soVN(-q)}` } : { kieu: "thua", chu: `Thừa ${soVN(q)}` };
}

/** Tiền có dấu: "−100.000 đ" / "+30.000 đ" / "0 đ". */
export function tienCoDau(v) {
  const n = Math.round(docSo(v));
  const tri = Math.abs(n).toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  return n < 0 ? `−${tri} đ` : n > 0 ? `+${tri} đ` : "0 đ";
}

// ── Lỗi có mã của máy chủ ────────────────────────────────────────────────────

/** Danh sách vướng mắc trong lỗi STK_* (data.vanDe: [{ ma, noiDung }] hoặc chuỗi). */
export function vanDeTuLoi(error) {
  const ds = error?.response?.data?.data?.vanDe;
  if (!Array.isArray(ds)) return [];
  return ds.map((x) => (typeof x === "string" ? { ma: null, noiDung: x } : x)).filter((x) => x?.noiDung);
}
