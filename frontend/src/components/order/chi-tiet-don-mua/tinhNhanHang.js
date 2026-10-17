/*
 * Hàm thuần cho màn Chi tiết đơn mua hàng (bản "một khối"): tiến độ nhận hàng, bảng theo đợt nhận,
 * các bước của đơn và hạn giao. Không gọi API, không phụ thuộc React, chạy được bằng `node --test`.
 *
 * Quy ước dữ liệu (đọc từ backend nhánh Khang):
 * - Số đã nhận của từng dòng đơn (`soLuongDaNhan`) chỉ được cộng khi phiếu nhập HOÀN TẤT (trạng thái 3),
 *   theo các dòng đã khai báo lô. Đây là số hệ thống ghi nhận nên "Còn thiếu" luôn tính từ số này.
 * - Chi tiết phiếu nhập (`/phieu-nhap-kho/{id}/detail`) trả `items[]` theo biến thể:
 *   `soLuongCanNhap` = số dự kiến nhập đợt này, `soLuongDaKhaiBao` = số đã khai báo lô.
 *   Phiếu hoàn tất: số đã nhập của đợt = `soLuongDaKhaiBao`. Phiếu chưa hoàn tất: chỉ là số dự kiến.
 * - Phiếu đã hủy (4) không thành cột.
 */

const TRANG_THAI_PHIEU_HOAN_TAT = 3;
const TRANG_THAI_PHIEU_HUY = 4;
const MS_MOT_NGAY = 24 * 60 * 60 * 1000;

/** Đọc số từ BigDecimal của backend (số hoặc chuỗi "80.00"); sai hoặc trống thì 0. */
export function docSo(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function docNgay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dauNgay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Tiến độ nhận hàng của cả đơn.
 * - `conThieu` cộng phần thiếu của TỪNG dòng (dòng nhận vượt không bù cho dòng còn thiếu).
 * - `vuot` cộng phần nhận vượt số đặt (dữ liệu bất thường, cần hiện cho người dùng thấy).
 * - `daDu`: đơn có ít nhất một dòng và mọi dòng đã nhận đủ (giống điều kiện khóa nút Tạo phiếu nhập trước đây).
 */
export function tinhTienDoNhan(chiTiets) {
  const dong = Array.isArray(chiTiets) ? chiTiets : [];
  let dat = 0;
  let daNhan = 0;
  let daNhanTrongMuc = 0;
  let conThieu = 0;
  let vuot = 0;
  for (const ct of dong) {
    const d = Math.max(0, docSo(ct?.soLuongDat));
    const n = Math.max(0, docSo(ct?.soLuongDaNhan));
    dat += d;
    daNhan += n;
    daNhanTrongMuc += Math.min(n, d);
    conThieu += Math.max(0, d - n);
    vuot += Math.max(0, n - d);
  }
  return {
    dat,
    daNhan,
    conThieu,
    vuot,
    phanTram: dat > 0 ? Math.min(100, Math.round((daNhanTrongMuc / dat) * 100)) : 0,
    daDu: dong.length > 0 && conThieu === 0,
    chuaNhan: daNhan === 0,
  };
}

/** Thứ tự cột: các đợt đã nhập theo ngày nhập, sau đó các phiếu đang chờ nhập theo ngày tạo. */
function sapXepPhieu(a, b) {
  if (a.choNhap !== b.choNhap) return a.choNhap ? 1 : -1;
  const ta = docNgay(a.ngay)?.getTime() ?? 0;
  const tb = docNgay(b.ngay)?.getTime() ?? 0;
  if (ta !== tb) return ta - tb;
  return docSo(a.id) - docSo(b.id);
}

/**
 * Bảng "Sản phẩm và các đợt nhận": mỗi phiếu nhập (chưa hủy) là một cột.
 * @param chiTiets  `chiTietDonMuaHangs` của đơn
 * @param phieus    chi tiết các phiếu nhập của đơn (kết quả `getDetail`, có thể kèm `ngayTao` từ danh sách)
 * @returns `{ cot, dong, tong, lechSo }`
 *   - `cot[i]`: `{ id, soPhieu, ngay, choNhap, nguoiNhap }`
 *   - `dong[j].theoDot[i]`: số của dòng j trong đợt i, `null` nếu phiếu không có sản phẩm này
 *   - `lechSo`: các dòng mà tổng các đợt đã nhập khác `soLuongDaNhan` (dữ liệu cũ hoặc lệch)
 */
export function dungBangDotNhan(chiTiets, phieus) {
  const cot = (Array.isArray(phieus) ? phieus : [])
    .filter((p) => p && docSo(p.trangThai) !== TRANG_THAI_PHIEU_HUY)
    .map((p) => {
      const choNhap = docSo(p.trangThai) !== TRANG_THAI_PHIEU_HOAN_TAT;
      const soLuong = new Map();
      for (const it of Array.isArray(p.items) ? p.items : []) {
        if (it?.bienTheSanPhamId == null) continue;
        const sl = choNhap ? docSo(it.soLuongCanNhap) : docSo(it.soLuongDaKhaiBao);
        soLuong.set(it.bienTheSanPhamId, (soLuong.get(it.bienTheSanPhamId) ?? 0) + sl);
      }
      return {
        id: p.id,
        soPhieu: p.soPhieuNhap || `#${p.id}`,
        ngay: choNhap ? p.ngayTao ?? null : p.ngayNhap ?? p.ngayTao ?? null,
        choNhap,
        nguoiNhap: p.tenNguoiNhap || null,
        soLuong,
      };
    })
    .sort(sapXepPhieu);

  const lechSo = [];
  const dong = (Array.isArray(chiTiets) ? chiTiets : []).map((ct, viTri) => {
    const bt = ct?.bienTheSanPham ?? {};
    const dat = Math.max(0, docSo(ct?.soLuongDat));
    const daNhan = Math.max(0, docSo(ct?.soLuongDaNhan));
    const theoDot = cot.map((c) => (c.soLuong.has(bt.id) ? c.soLuong.get(bt.id) : null));
    const tongDaNhapTheoDot = cot.reduce(
      (tong, c, i) => (c.choNhap || theoDot[i] == null ? tong : tong + theoDot[i]),
      0,
    );
    if (cot.some((c) => !c.choNhap) && tongDaNhapTheoDot !== daNhan) {
      lechSo.push({ bienTheId: bt.id ?? null, maSku: bt.maSku ?? null, theoDot: tongDaNhapTheoDot, daNhan });
    }
    return {
      khoa: ct?.id ?? `dong-${viTri}`,
      bienTheId: bt.id ?? null,
      ten: bt.tenSanPham || bt.tenBienThe || bt.maSku || "—",
      sku: bt.maSku || null,
      bienThe: [bt.mauSac?.tenMau, bt.size?.tenSize || bt.size?.maSize].filter(Boolean).join(" · "),
      anh: bt.anhBienThe?.tepTin?.duongDan || null,
      donGia: ct?.donGia ?? null,
      thanhTien: ct?.thanhTien ?? null,
      dat,
      daNhan,
      conThieu: Math.max(0, dat - daNhan),
      vuot: Math.max(0, daNhan - dat),
      theoDot,
    };
  });

  const tong = {
    dat: dong.reduce((s, d) => s + d.dat, 0),
    daNhan: dong.reduce((s, d) => s + d.daNhan, 0),
    conThieu: dong.reduce((s, d) => s + d.conThieu, 0),
    vuot: dong.reduce((s, d) => s + d.vuot, 0),
    thanhTien: dong.reduce((s, d) => s + docSo(d.thanhTien), 0),
    theoDot: cot.map((_, i) => dong.reduce((s, d) => s + (d.theoDot[i] ?? 0), 0)),
  };

  return {
    cot: cot.map((c) => ({ id: c.id, soPhieu: c.soPhieu, ngay: c.ngay, choNhap: c.choNhap, nguoiNhap: c.nguoiNhap })),
    dong,
    tong,
    lechSo,
  };
}

/**
 * Hạn giao so theo ngày lịch trên máy người dùng (cùng cách hiển thị ngày ở utils/formatters).
 * @returns `{ loai: "khongCo" | "daDu" | "quaHan" | "homNay" | "conLai", soNgay }`
 */
export function trangThaiGiao(ngayGiaoDuKien, daDu, homNay = new Date()) {
  const han = docNgay(ngayGiaoDuKien);
  if (!han) return { loai: "khongCo", soNgay: 0 };
  if (daDu) return { loai: "daDu", soNgay: 0 };
  const chenh = Math.round((dauNgay(homNay) - dauNgay(han)) / MS_MOT_NGAY);
  if (chenh > 0) return { loai: "quaHan", soNgay: chenh };
  if (chenh === 0) return { loai: "homNay", soNgay: 0 };
  return { loai: "conLai", soNgay: -chenh };
}

/**
 * 6 bước của đơn mua hàng, theo đúng trạng thái đang dùng (constants/donMuaHang.js):
 * 1 Đã gửi · 2 Đã báo giá · 3 Đang vận chuyển · 4 Không chấp nhận báo giá · 5 Đã nhận đủ (dữ liệu cũ, trước gọi "Đã thanh toán").
 * Mỗi bước: `{ ma, nhan, trangThai: "xong" | "dangLam" | "chua" | "dung", phu, ngay, canhBao }`.
 * `ngay` để màn tự định dạng; `canhBao` là chữ cảnh báo (vd. "quá hạn 1 ngày").
 */
export function tinhBuocDonMua(don, tienDo, cotDot, homNay = new Date()) {
  const trangThai = docSo(don?.trangThai);
  const daChot = trangThai === 3 || trangThai === 5;
  const tuChoi = trangThai === 4;
  const td = tienDo ?? tinhTienDoNhan(don?.chiTietDonMuaHangs);
  const giao = trangThaiGiao(don?.ngayGiaoDuKien, td.daDu, homNay);

  const buocBaoGia = daChot || tuChoi || trangThai === 2
    ? { trangThai: "xong", phu: "Đã có giá" }
    : { trangThai: "dangLam", phu: "Chờ nhà cung cấp" };

  const buocChot = daChot
    ? { trangThai: "xong", phu: "Đã chốt" }
    : tuChoi
      ? { trangThai: "dung", phu: "Không chấp nhận báo giá" }
      : trangThai === 2
        ? { trangThai: "dangLam", phu: "Chờ duyệt báo giá" }
        : { trangThai: "chua", phu: "" };

  let buocNhan;
  if (!daChot) {
    buocNhan = { trangThai: "chua", phu: "", canhBao: "" };
  } else if (td.daDu) {
    buocNhan = { trangThai: "xong", phu: `${td.daNhan}/${td.dat}`, canhBao: "" };
  } else {
    buocNhan = {
      trangThai: "dangLam",
      phu: td.chuaNhan ? "Chưa nhận" : `${td.daNhan}/${td.dat}`,
      canhBao: giao.loai === "quaHan" ? `quá hạn ${giao.soNgay} ngày` : "",
    };
  }

  const dotDaNhap = (Array.isArray(cotDot) ? cotDot : []).filter((c) => !c.choNhap && c.ngay);
  const ngayDotCuoi = dotDaNhap.length ? dotDaNhap[dotDaNhap.length - 1].ngay : null;

  return [
    {
      ma: "yeu-cau",
      nhan: "Yêu cầu nhập hàng",
      trangThai: "xong",
      phu: don?.yeuCauMuaHang?.soYeuCauMuaHang || "",
      ngay: don?.yeuCauMuaHang?.ngayTao ?? null,
      canhBao: "",
    },
    {
      ma: "gui-yeu-cau-bao-gia",
      nhan: "Gửi yêu cầu báo giá",
      trangThai: "xong",
      phu: "",
      ngay: don?.ngayDatHang ?? don?.ngayTao ?? null,
      canhBao: "",
    },
    { ma: "bao-gia", nhan: "Nhà cung cấp báo giá", ngay: null, canhBao: "", ...buocBaoGia },
    { ma: "chot-don", nhan: "Chốt đơn", ngay: null, canhBao: "", ...buocChot },
    { ma: "nhan-hang", nhan: "Nhận hàng", ngay: null, ...buocNhan },
    {
      ma: "nhan-du",
      nhan: "Nhận đủ",
      trangThai: daChot && td.daDu ? "xong" : "chua",
      phu: !daChot ? "" : td.daDu ? "" : `Còn thiếu ${td.conThieu}`,
      ngay: daChot && td.daDu ? ngayDotCuoi : null,
      canhBao: "",
    },
  ];
}
