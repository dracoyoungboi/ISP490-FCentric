/**
 * Logic thuần của màn Danh mục (bản cây dạng bảng PA1, chốt 17/10/2026).
 * Không import alias "@/…" để chạy được bằng `node --test`.
 *
 * Quy tắc trạng thái theo nhánh:
 * - Mỗi danh mục chỉ lưu trạng thái của chính nó (`trangThai` 1/0). Ngừng một danh mục cha
 *   KHÔNG ghi đè trạng thái các con.
 * - Một danh mục chỉ thật sự hoạt động khi chính nó và mọi danh mục cha đều hoạt động.
 *   Con của nhánh đang ngừng hiện "Ngừng theo “X”", với X là danh mục cha gần nhất đang ngừng.
 * - Cho danh mục cha hoạt động lại thì các con trở về đúng trạng thái riêng của chúng.
 */

/** Bỏ dấu, đổi đ → d, chữ thường: để tìm "ao thun" ra "Áo thun". Giữ nguyên số ký tự (để tô chữ khớp). */
export function chuanHoaChu(chuoi) {
  return String(chuoi ?? "")
    .normalize("NFC")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/** Danh mục đang hoạt động theo cờ của chính nó (1 = hoạt động; null/undefined coi như hoạt động như màn cũ). */
export function tuHoatDong(danhMuc) {
  return Number(danhMuc?.trangThai ?? 1) !== 0;
}

/**
 * Dựng cây từ dữ liệu API `/all` (phẳng, mỗi phần tử có `danhMucCha`) hoặc `/get-cay-danh-muc` (lồng `danhMucCons`).
 * Trả về chỉ mục dùng cho mọi hàm khác:
 * - `theoId`: Map id → { id, ma, ten, moTa, trangThai, ngayTao, chaId }
 * - `con`: Map (chaId | null) → mảng id con, theo thứ tự API trả về
 */
export function dungCay(danhSach) {
  const tho = new Map();
  const chaCua = new Map();

  const duyet = (nut, chaSuyRa) => {
    (nut || []).forEach((muc) => {
      if (!muc || muc.id == null) return;
      const chaRo = muc.danhMucChaId ?? muc.danhMucCha?.id ?? null;
      const cha = chaRo ?? chaSuyRa;
      if (!tho.has(muc.id)) tho.set(muc.id, muc);
      if (cha != null && cha !== muc.id) chaCua.set(muc.id, cha);
      else if (!chaCua.has(muc.id)) chaCua.set(muc.id, null);
      if (Array.isArray(muc.danhMucCons) && muc.danhMucCons.length) duyet(muc.danhMucCons, muc.id);
    });
  };
  duyet(Array.isArray(danhSach) ? danhSach : [], null);

  const theoId = new Map();
  tho.forEach((muc, id) => {
    theoId.set(id, {
      id,
      ma: muc.maDanhMuc ?? "",
      ten: muc.tenDanhMuc ?? "",
      moTa: muc.moTa ?? "",
      trangThai: Number(muc.trangThai ?? 1) === 0 ? 0 : 1,
      ngayTao: muc.ngayTao ?? null,
      chaId: null,
    });
  });

  // Cha không có trong dữ liệu, hoặc gắn cha tạo thành vòng (dữ liệu hỏng) → coi là danh mục gốc.
  const taoVong = (id, cha) => {
    const daQua = new Set([id]);
    let hienTai = cha;
    while (hienTai != null) {
      if (daQua.has(hienTai)) return true;
      daQua.add(hienTai);
      hienTai = chaCua.get(hienTai) ?? null;
    }
    return false;
  };
  theoId.forEach((nut, id) => {
    const cha = chaCua.get(id);
    nut.chaId = cha != null && theoId.has(cha) && !taoVong(id, cha) ? cha : null;
  });

  const con = new Map([[null, []]]);
  theoId.forEach((nut) => {
    if (!con.has(nut.chaId)) con.set(nut.chaId, []);
    con.get(nut.chaId).push(nut.id);
  });

  return { theoId, con };
}

export function layCon(cay, id) {
  return cay.con.get(id ?? null) ?? [];
}

/** Từ gốc tới chính danh mục: [gốc, …, danh mục]. */
export function layDuongDan(cay, id) {
  const ketQua = [];
  let nut = cay.theoId.get(id);
  while (nut) {
    ketQua.unshift(nut);
    nut = nut.chaId != null ? cay.theoId.get(nut.chaId) : null;
  }
  return ketQua;
}

/** Cấp tính từ 0 (danh mục gốc = 0). */
export function doSau(cay, id) {
  return Math.max(0, layDuongDan(cay, id).length - 1);
}

/** Số cấp con bên dưới (lá = 0). */
export function chieuCao(cay, id) {
  const cac = layCon(cay, id);
  if (!cac.length) return 0;
  return 1 + Math.max(...cac.map((c) => chieuCao(cay, c)));
}

/** `id` có nằm trong nhánh con cháu của `goc` không (không tính chính `goc`). */
export function laConChau(cay, goc, id) {
  let nut = cay.theoId.get(id);
  while (nut && nut.chaId != null) {
    if (nut.chaId === goc) return true;
    nut = cay.theoId.get(nut.chaId);
  }
  return false;
}

/** Mọi id con cháu của một danh mục. */
export function layConChau(cay, id) {
  const ketQua = [];
  const di = (cha) => layCon(cay, cha).forEach((c) => { ketQua.push(c); di(c); });
  di(id);
  return ketQua;
}

/**
 * Trạng thái hiệu lực của mọi danh mục: Map id → { ngung, tuNgung, doCha }.
 * - ngung: đang ngừng (vì chính nó hoặc vì một danh mục cha)
 * - tuNgung: chính nó đang tắt (trangThai = 0)
 * - doCha: danh mục cha gần nhất đang tự ngừng (null nếu mọi cha đều hoạt động)
 */
export function tinhTrangThai(cay) {
  const ketQua = new Map();
  const tinh = (id) => {
    if (ketQua.has(id)) return ketQua.get(id);
    const nut = cay.theoId.get(id);
    const cha = nut.chaId != null ? tinh(nut.chaId) : null;
    const doCha = cha && cha.ngung ? (cha.tuNgung ? cay.theoId.get(nut.chaId) : cha.doCha) : null;
    const giaTri = { ngung: nut.trangThai === 0 || Boolean(doCha), tuNgung: nut.trangThai === 0, doCha };
    ketQua.set(id, giaTri);
    return giaTri;
  };
  cay.theoId.forEach((_, id) => tinh(id));
  return ketQua;
}

/** Số liệu cho dòng chân bảng. */
export function demThongKe(cay, trangThai = tinhTrangThai(cay)) {
  let ngung = 0;
  trangThai.forEach((tt) => { if (tt.ngung) ngung += 1; });
  const goc = layCon(cay, null);
  const sauNhat = goc.length ? 1 + Math.max(...goc.map((g) => chieuCao(cay, g))) : 0;
  return { tong: cay.theoId.size, goc: goc.length, ngung, hoatDong: cay.theoId.size - ngung, sauNhat };
}

/** Tách tên để tô phần khớp từ khóa (không dấu). */
export function tachChuKhop(ten, tuKhoaChuan) {
  // Tên lưu ở dạng tổ hợp (NFD, dấu tách rời) thì đổi về NFC để vị trí chữ khớp với chuỗi đã bỏ dấu
  const goc = String(ten ?? "").normalize("NFC");
  if (!tuKhoaChuan) return { truoc: goc, khop: "", sau: "" };
  const viTri = chuanHoaChu(goc).indexOf(tuKhoaChuan);
  if (viTri < 0) return { truoc: goc, khop: "", sau: "" };
  return {
    truoc: goc.slice(0, viTri),
    khop: goc.slice(viTri, viTri + tuKhoaChuan.length),
    sau: goc.slice(viTri + tuKhoaChuan.length),
  };
}

export const LOC_TRANG_THAI = {
  TAT_CA: "tat-ca",
  HOAT_DONG: "dang-hoat-dong",
  NGUNG: "ngung-hoat-dong",
};

/** Vào trang là lọc sẵn danh mục đang hoạt động (chốt 17/10/2026). Xóa lọc cũng trở về bộ lọc này. */
export const LOC_MAC_DINH = LOC_TRANG_THAI.HOAT_DONG;

/**
 * Số danh mục con trực tiếp hiện ra theo bộ lọc trạng thái: lọc "Đang hoạt động" thì chỉ đếm con đang hoạt động
 * (con ngừng bị ẩn, đếm vào sẽ lệch với số dòng thấy được); các bộ lọc khác đếm đủ.
 */
export function demConHien(cay, trangThai, id, loc) {
  const cac = layCon(cay, id);
  if (loc !== LOC_TRANG_THAI.HOAT_DONG) return cac.length;
  return cac.filter((c) => !trangThai.get(c).ngung).length;
}

/**
 * Các dòng đang hiện của bảng cây.
 * - `tuKhoa`: tìm theo tên hoặc mã, không cần dấu. Dòng khớp hiện kèm các danh mục cha (chữ mờ) và tự mở nhánh.
 * - `loc`: LOC_TRANG_THAI. "Đang hoạt động" ẩn cả nhánh đang ngừng; "Ngừng hoạt động" hiện danh mục đang ngừng kèm cha.
 * - `moRong`: { [id]: true | false }. true = người dùng mở, false = người dùng đóng (kể cả nhánh tự mở khi tìm).
 *   Khi đang tìm / lọc, nhánh nào còn con cháu khớp thì tự mở.
 * - `goc`: id nhánh đang xem riêng (null = cả cây). Các con của nhánh này là cấp 0 của bảng.
 *
 * Trả về { dong, tatCaDangMo, coNhanhDeMo }:
 * - dong: [{ id, nut, cap, capThat, coCon, soCon, dangMo, khop, laNguCanh, tt }]
 *   (`soCon`: số con trực tiếp, lọc "Đang hoạt động" thì chỉ đếm con đang hoạt động)
 * - tatCaDangMo: mọi nhánh mở được trong phạm vi đang xem đều đang mở (cho nút Mở tất cả / Thu gọn tất cả)
 */
export function taoDongHienThi(cay, { tuKhoa = "", loc = LOC_TRANG_THAI.TAT_CA, moRong = {}, goc = null, trangThai } = {}) {
  const tt = trangThai ?? tinhTrangThai(cay);
  const tu = chuanHoaChu(String(tuKhoa).trim());
  const anNgung = loc === LOC_TRANG_THAI.HOAT_DONG;
  const dangLoc = Boolean(tu) || loc === LOC_TRANG_THAI.NGUNG;
  const khop = (id) => {
    const nut = cay.theoId.get(id);
    if (loc === LOC_TRANG_THAI.NGUNG && !tt.get(id).ngung) return false;
    if (!tu) return true;
    return chuanHoaChu(nut.ten).includes(tu) || chuanHoaChu(nut.ma).includes(tu);
  };
  const conHien = (id) => layCon(cay, id).filter((c) => !(anNgung && tt.get(c).ngung));
  const nho = new Map();
  const coChauKhop = (id) => {
    if (nho.has(id)) return nho.get(id);
    const co = conHien(id).some((c) => khop(c) || coChauKhop(c));
    nho.set(id, co);
    return co;
  };

  const capGoc = goc != null && cay.theoId.has(goc) ? doSau(cay, goc) + 1 : 0;
  const batDau = goc != null && cay.theoId.has(goc) ? conHien(goc) : conHien(null);
  const dong = [];
  const trangThaiMo = [];

  const di = (ids, cap, trongNhanhKhop, dangHien) => {
    ids.forEach((id) => {
      if (anNgung && tt.get(id).ngung) return;
      const laKhop = dangLoc && khop(id);
      const chauKhop = dangLoc && coChauKhop(id);
      if (dangLoc && !trongNhanhKhop && !laKhop && !chauKhop) return;
      const cac = conHien(id);
      // Còn con cháu khớp thì tự mở (kể cả khi nằm trong nhánh đã khớp), trừ khi người dùng đã tự đóng
      const tuMo = dangLoc && chauKhop && moRong[id] !== false;
      const dangMo = cac.length > 0 && (moRong[id] === true || tuMo);
      if (cac.length) trangThaiMo.push(dangMo);
      if (dangHien) {
        dong.push({
          id,
          nut: cay.theoId.get(id),
          cap,
          capThat: capGoc + cap,
          coCon: cac.length > 0,
          soCon: anNgung ? cac.length : layCon(cay, id).length,
          dangMo,
          khop: laKhop && Boolean(tu),
          laNguCanh: dangLoc && !trongNhanhKhop && !laKhop,
          tt: tt.get(id),
        });
      }
      if (cac.length) di(cac, cap + 1, trongNhanhKhop || laKhop, dangHien && dangMo);
    });
  };
  di(batDau, 0, false, true);

  return {
    dong,
    coNhanhDeMo: trangThaiMo.length > 0,
    tatCaDangMo: trangThaiMo.length > 0 && trangThaiMo.every(Boolean),
  };
}

/**
 * Kết quả tìm dạng danh sách phẳng (màn điện thoại, hộp Chuyển đến…): mỗi dòng kèm đường dẫn cha.
 */
export function timPhang(cay, tuKhoa, { loc = LOC_TRANG_THAI.TAT_CA, trangThai } = {}) {
  const tt = trangThai ?? tinhTrangThai(cay);
  const tu = chuanHoaChu(String(tuKhoa).trim());
  if (!tu) return [];
  const ketQua = [];
  const di = (cha) => layCon(cay, cha).forEach((id) => {
    const nut = cay.theoId.get(id);
    const trangThaiNut = tt.get(id);
    const hopLoc =
      loc === LOC_TRANG_THAI.TAT_CA ||
      (loc === LOC_TRANG_THAI.HOAT_DONG && !trangThaiNut.ngung) ||
      (loc === LOC_TRANG_THAI.NGUNG && trangThaiNut.ngung);
    if (hopLoc && (chuanHoaChu(nut.ten).includes(tu) || chuanHoaChu(nut.ma).includes(tu))) {
      ketQua.push({ id, nut, duongDan: layDuongDan(cay, id).slice(0, -1).map((n) => n.ten), tt: trangThaiNut });
    }
    if (!(loc === LOC_TRANG_THAI.HOAT_DONG && trangThaiNut.ngung)) di(id);
  });
  di(null);
  return ketQua;
}

/**
 * Có chuyển `idChuyen` vào dưới `idDich` (null = thành danh mục gốc) được không.
 * Trả về { duoc, lyDo, dangOday }.
 */
export function kiemTraChuyen(cay, idChuyen, idDich, trangThai) {
  const nut = cay.theoId.get(idChuyen);
  if (!nut) return { duoc: false, lyDo: "Không tìm thấy danh mục" };
  const dangOday = (nut.chaId ?? null) === (idDich ?? null);
  if (dangOday) return { duoc: false, lyDo: "Đang ở đây", dangOday: true };
  if (idDich == null) return { duoc: true, lyDo: "" };
  if (idDich === idChuyen) return { duoc: false, lyDo: "Danh mục đang chuyển" };
  if (laConChau(cay, idChuyen, idDich)) return { duoc: false, lyDo: "Nằm trong nhánh đang chuyển" };
  const tt = trangThai ?? tinhTrangThai(cay);
  if (tt.get(idDich)?.ngung) return { duoc: false, lyDo: "Ngừng hoạt động" };
  return { duoc: true, lyDo: "" };
}

/**
 * Sửa được tên / mô tả / trạng thái của danh mục không. Máy chủ từ chối mọi lần cập nhật khi
 * danh mục cha TRỰC TIẾP đang tắt ("Danh mục cha đã bị xoá"), nên khóa sẵn và nói cách gỡ.
 */
export function kiemTraSua(cay, id) {
  const nut = cay.theoId.get(id);
  if (!nut) return { duoc: false, lyDo: "Không tìm thấy danh mục" };
  const cha = nut.chaId != null ? cay.theoId.get(nut.chaId) : null;
  if (cha && cha.trangThai === 0) {
    return {
      duoc: false,
      lyDo: `Danh mục cha “${cha.ten}” đang ngừng hoạt động. Cho danh mục đó hoạt động lại, hoặc chuyển danh mục này sang nhánh khác.`,
    };
  }
  return { duoc: true, lyDo: "" };
}

/** Số danh mục con cháu đang hoạt động sẽ ngừng theo khi ngừng `id`. */
export function demSeNgungTheo(cay, id, trangThai = tinhTrangThai(cay)) {
  return layConChau(cay, id).filter((c) => !trangThai.get(c).ngung).length;
}

/** Số danh mục con cháu sẽ hoạt động lại theo khi cho `id` hoạt động lại. */
export function demSeHoatDongLai(cay, id) {
  const sau = { theoId: new Map(cay.theoId), con: cay.con };
  sau.theoId.set(id, { ...cay.theoId.get(id), trangThai: 1 });
  const truoc = tinhTrangThai(cay);
  const moi = tinhTrangThai(sau);
  return layConChau(cay, id).filter((c) => truoc.get(c).ngung && !moi.get(c).ngung).length;
}

/**
 * Gợi ý mã cho danh mục mới: theo kiểu mã đang dùng nhiều nhất (phần chữ + số), lấy số lớn nhất + 1,
 * giữ độ dài phần số. Không có mã nào theo kiểu đó thì gợi ý "DM001".
 */
export function goiYMaMoi(cay) {
  const nhom = new Map();
  cay.theoId.forEach((nut) => {
    const khop = /^(.*?)(\d+)$/.exec(String(nut.ma).trim());
    if (!khop) return;
    const [, tien, so] = khop;
    const hienTai = nhom.get(tien) ?? { dem: 0, lonNhat: 0, doDai: 0 };
    hienTai.dem += 1;
    hienTai.lonNhat = Math.max(hienTai.lonNhat, Number(so));
    hienTai.doDai = Math.max(hienTai.doDai, so.length);
    nhom.set(tien, hienTai);
  });
  if (!nhom.size) return "DM001";
  let chon = null;
  nhom.forEach((gt, tien) => {
    if (!chon || gt.dem > chon.gt.dem || (gt.dem === chon.gt.dem && gt.lonNhat > chon.gt.lonNhat)) chon = { tien, gt };
  });
  const tiepTheo = String(chon.gt.lonNhat + 1).padStart(chon.gt.doDai, "0");
  const ma = `${chon.tien}${tiepTheo}`;
  const daCo = new Set([...cay.theoId.values()].map((n) => String(n.ma).trim().toLowerCase()));
  if (!daCo.has(ma.toLowerCase())) return ma;
  let n = chon.gt.lonNhat + 2;
  while (daCo.has(`${chon.tien}${String(n).padStart(chon.gt.doDai, "0")}`.toLowerCase())) n += 1;
  return `${chon.tien}${String(n).padStart(chon.gt.doDai, "0")}`;
}

export const GIOI_HAN = { MA: 50, TEN: 100 };

/**
 * Kiểm tra form Thêm / Sửa. Độ dài tối đa theo cột trong CSDL (ma_danh_muc 50, ten_danh_muc 100).
 * `trungTen` chỉ là cảnh báo (máy chủ không chặn), không chặn lưu.
 */
export function kiemTraForm(cay, { ma, ten, chaId, idDangSua = null }) {
  const loi = {};
  const tenGon = String(ten ?? "").trim();
  const maGon = String(ma ?? "").trim();
  if (!tenGon) loi.ten = "Nhập tên danh mục";
  else if (tenGon.length > GIOI_HAN.TEN) loi.ten = `Tên tối đa ${GIOI_HAN.TEN} ký tự`;
  if (idDangSua == null) {
    if (!maGon) loi.ma = "Nhập mã danh mục";
    else if (maGon.length > GIOI_HAN.MA) loi.ma = `Mã tối đa ${GIOI_HAN.MA} ký tự`;
    else if ([...cay.theoId.values()].some((n) => String(n.ma).trim().toLowerCase() === maGon.toLowerCase())) {
      loi.ma = "Mã này đã có";
    }
  }
  const chuanTen = chuanHoaChu(tenGon);
  const trung = tenGon
    ? layCon(cay, chaId ?? null).some((c) => c !== idDangSua && chuanHoaChu(cay.theoId.get(c).ten.trim()) === chuanTen)
    : false;
  return { loi, hopLe: Object.keys(loi).length === 0, trungTen: trung };
}

/** Body gửi PUT /update: máy chủ ghi đè đủ 4 trường, nên luôn gửi lại cha và trạng thái hiện có. */
export function taoBodyCapNhat(nut, thayDoi = {}) {
  return {
    id: nut.id,
    tenDanhMuc: thayDoi.ten ?? nut.ten,
    danhMucChaId: thayDoi.chaId !== undefined ? thayDoi.chaId : nut.chaId ?? null,
    moTa: thayDoi.moTa ?? nut.moTa ?? "",
    trangThai: thayDoi.trangThai ?? nut.trangThai,
  };
}

/**
 * Các dòng của bản điện thoại tại một cấp (`cha` = null là cấp gốc), theo bộ lọc trạng thái.
 * "Ngừng hoạt động": hiện danh mục đang ngừng, kèm danh mục còn hoạt động nhưng có con cháu đang ngừng (để đi tới đó).
 */
export function layDongCap(cay, trangThai, cha, loc) {
  return layCon(cay, cha)
    .filter((id) => {
      const tt = trangThai.get(id);
      if (loc === LOC_TRANG_THAI.HOAT_DONG) return !tt.ngung;
      if (loc === LOC_TRANG_THAI.NGUNG) return tt.ngung || layConChau(cay, id).some((c) => trangThai.get(c).ngung);
      return true;
    })
    .map((id) => ({ id, nut: cay.theoId.get(id), tt: trangThai.get(id), soCon: demConHien(cay, trangThai, id, loc) }));
}

/**
 * Các thao tác của một dòng danh mục, tính sẵn cho cả menu ⋯ (máy tính, điện thoại) và nút trên dòng.
 * Không có quyền thì ẩn hẳn (null); có quyền nhưng chưa làm được thì khóa kèm lý do.
 * `dong`: { nut, tt, coCon }; `kiemTraSua`: kết quả `kiemTraSua(cay, id)`;
 * `soHoatDongLai`: số danh mục con hoạt động lại theo nếu cho danh mục này hoạt động lại.
 */
export function tinhThaoTac({ dong, coTheSua, kiemTraSua: sua, soHoatDongLai = 0 }) {
  const { nut, tt, coCon } = dong;
  const themCon = !coTheSua
    ? null
    : tt.ngung
      ? { khoa: true, lyDo: "Danh mục đang ngừng hoạt động" }
      : { khoa: false, lyDo: "" };
  let trangThai = null;
  if (coTheSua) {
    if (!tt.ngung) {
      trangThai = { loai: "ngung", khoa: false, nhan: "Ngừng hoạt động", phu: "Không chọn được khi thêm sản phẩm mới" };
    } else if (tt.doCha) {
      trangThai = { loai: "bat", khoa: true, nhan: "Cho hoạt động lại", phu: `Đang ngừng theo “${tt.doCha.ten}”` };
    } else {
      trangThai = {
        loai: "bat",
        khoa: false,
        nhan: "Cho hoạt động lại",
        phu: soHoatDongLai > 0 ? `Cùng ${soHoatDongLai} danh mục con` : "Được chọn lại khi thêm sản phẩm",
      };
    }
  }
  return {
    themCon,
    sua: coTheSua ? { khoa: !sua.duoc, lyDo: sua.lyDo } : null,
    chuyen: coTheSua ? { khoa: false } : null,
    xemNhanh: coCon ? { khoa: false } : null,
    trangThai,
    ten: nut.ten,
  };
}

/**
 * Danh sách phẳng chuẩn hóa từ dữ liệu API (phẳng hoặc lồng `danhMucCons`): mỗi danh mục một phần tử,
 * cha ghi ở `danhMucChaId`, thứ tự như khi dựng cây. Dùng để sửa tại chỗ sau mỗi lần lưu
 * (bảng hiện ngay dữ liệu mới, không phải chờ tải lại).
 */
export function phangHoa(danhSach) {
  const cay = dungCay(danhSach);
  return [...cay.theoId.values()].map((n) => ({
    id: n.id,
    maDanhMuc: n.ma,
    tenDanhMuc: n.ten,
    moTa: n.moTa,
    trangThai: n.trangThai,
    ngayTao: n.ngayTao,
    danhMucChaId: n.chaId,
  }));
}

/** Áp body PUT /update vừa lưu thành công vào danh sách phẳng. */
export function apDungCapNhat(danhSach, body) {
  return danhSach.map((x) => (x.id === body.id
    ? { ...x, tenDanhMuc: body.tenDanhMuc, moTa: body.moTa, trangThai: body.trangThai, danhMucChaId: body.danhMucChaId ?? null }
    : x));
}

/**
 * Phản hồi của máy chủ không phải status 200 thì ném lỗi cùng dạng lỗi axios,
 * để `getApiErrorMessage` vẫn đọc được câu báo của máy chủ.
 */
export function kiemTraPhanHoi(phanHoi, macDinh = "Máy chủ không nhận thay đổi") {
  if (phanHoi?.data?.status === 200) return phanHoi;
  const cau = phanHoi?.data?.message || macDinh;
  const loi = new Error(cau);
  loi.response = { data: { message: cau } };
  throw loi;
}
