/**
 * Logic thuần của Chi tiết người dùng, ngăn kéo Phân quyền và Hồ sơ của tôi (chốt PA2 + PB2, 18/10/2026).
 * Không import alias "@/..." để chạy được bằng `node --test`; menu sidebar truyền vào qua tham số.
 *
 * Nguồn dữ liệu (đều lấy từ máy chủ, không cố định ở đây):
 * - Danh sách quyền: GET /dieu-hanh-he-thong/quyen-han/all (id, maQuyen, tenQuyen, moTa, nhomQuyen).
 * - Mẫu quyền theo vai trò, quyền nhạy cảm, quyền máy chủ đang kiểm: GET /dieu-hanh-he-thong/phan-quyen/cau-hinh.
 * Ở đây chỉ giữ phần thuộc về giao diện: tên nhóm theo luồng việc, cặp tạo–duyệt, màn hình dùng từng quyền.
 */

// ───────────────────────────── Vai trò ─────────────────────────────

export const VAI_TRO = [
  { ma: "quan_tri_vien", ten: "Quản trị viên", moTa: "Chủ cửa hàng, người quản lý hệ thống. Toàn quyền ở mọi kho." },
  { ma: "quan_ly_kho", ten: "Quản lý kho", moTa: "Phụ trách một kho: duyệt phiếu, phân việc, xem báo cáo kho." },
  { ma: "nhan_vien_kho", ten: "Nhân viên kho", moTa: "Nhập, xuất, chuyển và kiểm hàng tại kho được phân." },
  { ma: "nhan_vien_mua_hang", ten: "Nhân viên mua hàng", moTa: "Yêu cầu báo giá, đặt hàng và theo dõi nhà cung cấp." },
  { ma: "nhan_vien_ban_hang", ten: "Nhân viên bán hàng", moTa: "Bán tại quầy, báo giá và đơn bán cho khách." },
  { ma: "khach_hang", ten: "Khách hàng", moTa: "Tài khoản bên ngoài. Không dùng màn nội bộ, không có kho." },
];

export const QUAN_TRI_VIEN = "quan_tri_vien";
export const KHACH_HANG = "khach_hang";

/** Vai trò không dùng kho: quản trị viên (toàn quyền mọi kho) và khách hàng (không dùng màn nội bộ). */
export const VAI_TRO_KHONG_DUNG_KHO = [QUAN_TRI_VIEN, KHACH_HANG];

export function tenVaiTro(ma) {
  const vt = VAI_TRO.find((v) => v.ma === ma);
  if (vt) return vt.ten;
  return ma ? String(ma).replaceAll("_", " ") : "Không xác định";
}

export function moTaVaiTro(ma) {
  return VAI_TRO.find((v) => v.ma === ma)?.moTa ?? "";
}

/** Vai trò cần một kho để làm việc. */
export function canKho(vaiTro) {
  return Boolean(vaiTro) && !VAI_TRO_KHONG_DUNG_KHO.includes(vaiTro);
}

// ───────────────────────────── Nhóm quyền ─────────────────────────────

/**
 * Nhóm theo luồng việc (nhom_quyen trong bảng quyen_han → tên hiển thị). Ba nhóm đầu là luồng chính
 * Mua & nhập → Tồn kho → Bán & xuất, vẽ nối nhau bằng mũi tên. `thuTu` là thứ tự đọc trong nhóm;
 * quyền mới chưa có trong `thuTu` xếp sau, theo id.
 */
export const NHOM_QUYEN = [
  {
    ma: "nhap_kho",
    ten: "Mua & nhập kho",
    luong: true,
    thuTu: ["tao_don_mua_hang", "duyet_don_mua_hang", "tao_phieu_nhap", "duyet_phieu_nhap", "huy_phieu_nhap"],
  },
  {
    ma: "quan_ly_kho",
    ten: "Tồn kho",
    luong: true,
    thuTu: ["xem_ton_kho", "xem_chi_tiet_lo", "chuyen_kho", "dieu_chinh_ton_kho"],
  },
  {
    ma: "xuat_kho",
    ten: "Bán & xuất kho",
    luong: true,
    thuTu: ["tao_don_ban_hang", "duyet_don_ban_hang", "tao_phieu_xuat", "duyet_phieu_xuat", "huy_phieu_xuat"],
  },
  {
    ma: "bao_cao",
    ten: "Báo cáo",
    luong: false,
    thuTu: ["xem_bao_cao_ton_kho", "xem_bao_cao_nhap_xuat", "xem_bao_cao_doanh_thu", "xuat_bao_cao"],
  },
  {
    ma: "cai_dat",
    ten: "Danh mục & nhân sự",
    luong: false,
    thuTu: ["quan_ly_san_pham", "quan_ly_nha_cung_cap", "quan_ly_khach_hang", "quan_ly_nhan_vien_kho", "cap_quyen_nhan_vien"],
  },
];

const NHOM_KHAC = { ma: "khac", ten: "Khác", luong: false, thuTu: [] };

/** Danh sách quyền → các nhóm có ít nhất một quyền, đúng thứ tự NHOM_QUYEN; nhóm lạ gom vào "Khác". */
export function nhomTheoLuong(dsQuyen) {
  const ds = Array.isArray(dsQuyen) ? dsQuyen.filter((q) => q && q.id != null) : [];
  const nhom = [...NHOM_QUYEN, NHOM_KHAC].map((n) => ({ ...n, quyen: [] }));
  for (const q of ds) {
    const n = nhom.find((x) => x.ma === q.nhomQuyen) ?? nhom[nhom.length - 1];
    n.quyen.push(q);
  }
  for (const n of nhom) {
    const viTri = (q) => {
      const i = n.thuTu.indexOf(q.maQuyen);
      return i < 0 ? n.thuTu.length : i;
    };
    n.quyen.sort((a, b) => viTri(a) - viTri(b) || a.id - b.id);
  }
  return nhom.filter((n) => n.quyen.length > 0);
}

/** Thứ tự đọc của toàn bộ quyền (theo nhóm rồi theo thứ tự trong nhóm). */
export function thuTuQuyen(dsQuyen) {
  return nhomTheoLuong(dsQuyen).flatMap((n) => n.quyen);
}

/**
 * Cặp tạo – duyệt cùng một loại chứng từ. Một người có cả hai thì tự lập và tự duyệt được:
 * nên để người khác duyệt (tách nhiệm vụ).
 */
export const CAP_TAO_DUYET = [
  { tao: "tao_don_mua_hang", duyet: "duyet_don_mua_hang", ten: "Đơn mua hàng" },
  { tao: "tao_phieu_nhap", duyet: "duyet_phieu_nhap", ten: "Phiếu nhập kho" },
  { tao: "tao_don_ban_hang", duyet: "duyet_don_ban_hang", ten: "Đơn bán hàng" },
  { tao: "tao_phieu_xuat", duyet: "duyet_phieu_xuat", ten: "Phiếu xuất kho" },
];

// ───────────────────────────── Màn hình dùng quyền ─────────────────────────────

/**
 * Màn hình (đường dẫn trên sidebar) nơi quyền được dùng. Vai trò không mở được màn nào trong danh sách
 * thì quyền đó "không có tác dụng" với vai trò này. Quyền chưa khai báo ở đây coi như luôn có tác dụng.
 */
export const MAN_DUNG_QUYEN = {
  xem_ton_kho: ["/reports/inventory"],
  xem_chi_tiet_lo: ["/warehouse/locations", "/inventory-transactions"],
  dieu_chinh_ton_kho: ["/stock-take"],
  chuyen_kho: ["/transfer-tickets"],
  tao_don_mua_hang: ["/purchase-requests", "/purchase-orders"],
  duyet_don_mua_hang: ["/purchase-orders"],
  tao_phieu_nhap: ["/goods-receipts"],
  duyet_phieu_nhap: ["/goods-receipts"],
  huy_phieu_nhap: ["/goods-receipts"],
  tao_don_ban_hang: ["/sales-orders"],
  duyet_don_ban_hang: ["/sales-orders"],
  tao_phieu_xuat: ["/goods-issues"],
  duyet_phieu_xuat: ["/goods-issues"],
  huy_phieu_xuat: ["/goods-issues"],
  xem_bao_cao_ton_kho: ["/reports/inventory"],
  xem_bao_cao_nhap_xuat: ["/reports/stock-movements"],
  xem_bao_cao_doanh_thu: ["/reports/revenue"],
  xuat_bao_cao: ["/reports/inventory", "/reports/revenue", "/reports/stock-movements", "/reports/customers"],
  quan_ly_nhan_vien_kho: ["/warehouse"],
  cap_quyen_nhan_vien: ["/warehouse"],
  quan_ly_san_pham: ["/products"],
  quan_ly_nha_cung_cap: ["/supplier"],
  quan_ly_khach_hang: ["/customers"],
};

const thayDuoc = (muc, vaiTro) => !muc.roles || muc.roles.includes(vaiTro);

/**
 * Các mục sidebar vai trò mở được, cùng quy tắc với BackofficeSidebar: mục cha lọc theo `roles`,
 * mục con không khai báo `roles` thì theo mục cha. Trả về { duongDan: string[], soNhom }.
 */
export function manHinhCuaVaiTro(menu, vaiTro) {
  const duongDan = [];
  let soNhom = 0;
  if (!vaiTro || vaiTro === KHACH_HANG) return { duongDan, soNhom };
  for (const muc of Array.isArray(menu) ? menu : []) {
    if (!thayDuoc(muc, vaiTro)) continue;
    if (Array.isArray(muc.children) && muc.children.length) {
      const con = muc.children.filter((c) => thayDuoc(c, vaiTro) && c.to);
      if (!con.length) continue;
      soNhom += 1;
      con.forEach((c) => duongDan.push(c.to));
    } else if (muc.to) {
      soNhom += 1;
      duongDan.push(muc.to);
    }
  }
  return { duongDan, soNhom };
}

/** Số màn hình vai trò mở được. */
export function soManHinh(menu, vaiTro) {
  return manHinhCuaVaiTro(menu, vaiTro).duongDan.length;
}

/** Quyền có tác dụng với vai trò: vai trò mở được ít nhất một màn dùng quyền đó. */
export function quyenCoTacDung(maQuyen, vaiTro, menu) {
  const man = MAN_DUNG_QUYEN[maQuyen];
  if (!man || vaiTro === QUAN_TRI_VIEN) return true;
  const coThe = new Set(manHinhCuaVaiTro(menu, vaiTro).duongDan);
  return man.some((d) => coThe.has(d));
}

// ───────────────────────────── Phân quyền hiện có ─────────────────────────────

/**
 * Phân quyền kho đang hiệu lực của một người dùng (NguoiDungDto.khoPhuTrach từ GET /admin/users/{id}).
 * Mỗi người tối đa một kho; dữ liệu cũ có thể còn nhiều dòng thì lấy dòng đầu.
 * Vai trò không dùng kho (quản trị viên, khách hàng) luôn trả pq = null.
 * Trả về { pq, quyenIds } — quyenIds chỉ gồm quyền đang bật (trangThai = 1).
 */
export function phanQuyenHienCo(nguoiDung) {
  // Quản trị viên / khách hàng không làm việc theo kho: dữ liệu cũ còn dòng phân quyền kho thì bỏ qua
  if (nguoiDung?.vaiTro && !canKho(nguoiDung.vaiTro)) return { pq: null, quyenIds: [] };
  const ds = Array.isArray(nguoiDung?.khoPhuTrach) ? nguoiDung.khoPhuTrach : [];
  const pq = ds.find((p) => p && Number(p.trangThai) === 1 && p.kho) ?? null;
  const quyenIds = [];
  if (pq && Array.isArray(pq.chiTietQuyenKhos)) {
    for (const ct of pq.chiTietQuyenKhos) {
      const id = ct?.quyenHan?.id;
      if (Number(ct?.trangThai) === 1 && id != null && !quyenIds.includes(id)) quyenIds.push(id);
    }
  }
  quyenIds.sort((a, b) => a - b);
  return { pq, quyenIds };
}

/**
 * Đánh giá tập quyền tại kho so với mẫu của vai trò.
 * - `mau`: id quyền trong mẫu của vai trò (có thể rỗng khi chưa cấu hình).
 * - `nhayCam`: id quyền nhạy cảm.
 * - `daApDung`: mã quyền máy chủ đang kiểm; `null` khi không đọc được (không gắn "Chưa áp dụng").
 */
export function danhGiaQuyen({ vaiTro, quyenIds, dsQuyen, mau = [], nhayCam = [], daApDung = null, menu = [] }) {
  const co = new Set(quyenIds ?? []);
  const trongMau = new Set(mau ?? []);
  // Vai trò chưa có mẫu (hoặc không tải được cấu hình) thì không so với mẫu: không quyền nào "Ngoài mẫu"
  const coMauCauHinh = trongMau.size > 0;
  const nhay = new Set(nhayCam ?? []);
  const apDung = Array.isArray(daApDung) ? new Set(daApDung) : null;
  const coMan = new Set(manHinhCuaVaiTro(menu, vaiTro).duongDan);
  const tacDung = (ma) => {
    const man = MAN_DUNG_QUYEN[ma];
    return !man || vaiTro === QUAN_TRI_VIEN || man.some((d) => coMan.has(d));
  };

  const nhom = nhomTheoLuong(dsQuyen).map((n) => {
    const dong = n.quyen.map((q) => {
      const cap = co.has(q.id);
      return {
        id: q.id,
        ma: q.maQuyen,
        ten: q.tenQuyen || q.maQuyen,
        moTa: q.moTa || "",
        cap,
        trongMau: trongMau.has(q.id),
        ngoaiMau: cap && coMauCauHinh && !trongMau.has(q.id),
        nhayCam: nhay.has(q.id),
        voHieu: cap && !tacDung(q.maQuyen),
        chuaApDung: cap && apDung !== null && !apDung.has(q.maQuyen),
      };
    });
    return { ma: n.ma, ten: n.ten, luong: n.luong, dong, soCap: dong.filter((d) => d.cap).length };
  });

  const tatCa = nhom.flatMap((n) => n.dong);
  const maCo = new Set(tatCa.filter((d) => d.cap).map((d) => d.ma));
  return {
    nhom,
    tong: tatCa.length,
    soCap: tatCa.filter((d) => d.cap).length,
    ngoaiMau: tatCa.filter((d) => d.ngoaiMau),
    thieuMau: tatCa.filter((d) => !d.cap && d.trongMau),
    voHieu: tatCa.filter((d) => d.voHieu),
    chuaApDung: tatCa.filter((d) => d.chuaApDung),
    capTrung: CAP_TAO_DUYET.filter((c) => maCo.has(c.tao) && maCo.has(c.duyet)),
    soMau: trongMau.size,
  };
}

const vietHoaDau = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Các điểm cần xem lại trên trang chi tiết (dải tóm tắt, ô thứ tư). */
export function diemCanXemLai({ vaiTro, coKho, danhGia }) {
  const diem = [];
  if (!canKho(vaiTro)) return diem;
  if (!coKho) {
    diem.push("chưa phụ trách kho nào");
    return diem;
  }
  if (danhGia.capTrung.length) diem.push(`${danhGia.capTrung.length} cặp tạo–duyệt`);
  if (danhGia.ngoaiMau.length) diem.push(`${danhGia.ngoaiMau.length} quyền ngoài mẫu`);
  if (danhGia.voHieu.length) diem.push(`${danhGia.voHieu.length} quyền không có tác dụng`);
  if (danhGia.thieuMau.length) diem.push(`thiếu ${danhGia.thieuMau.length} quyền so với mẫu`);
  return diem;
}

/** Dòng phụ của ô "Quyền tại kho". */
export function moTaSoVoiMau({ vaiTro, coKho, danhGia }) {
  if (!coKho) return "Chưa có quyền tại kho nào";
  const ten = tenVaiTro(vaiTro);
  if (!danhGia.soMau) return "Vai trò chưa có mẫu quyền";
  const them = danhGia.ngoaiMau.length;
  const thieu = danhGia.thieuMau.length;
  if (!them && !thieu) return `Khớp mẫu ${ten}`;
  if (!thieu) return `Mẫu ${ten} có ${danhGia.soMau} quyền · thêm ${them}`;
  if (!them) return `Thiếu ${thieu} quyền so với mẫu ${ten}`;
  return `Thêm ${them} · thiếu ${thieu} so với mẫu`;
}

/**
 * Bốn ô của dải tóm tắt trên trang chi tiết: vai trò, kho phụ trách, quyền tại kho, cần xem lại.
 * `muc` của ô cần xem lại: "cao" (cặp tạo–duyệt hoặc chưa có kho), "vua" (có điểm khác), "khong".
 */
export function tomTatTruyCap({ vaiTro, pq, danhGia, menu }) {
  const ten = tenVaiTro(vaiTro);
  if (vaiTro === QUAN_TRI_VIEN) {
    return {
      vaiTro: { giaTri: ten, phu: "Mở được mọi màn hình" },
      kho: { giaTri: "Mọi kho", phu: "Không cần phân kho" },
      quyen: { giaTri: "Toàn quyền", phu: "Không áp dụng quyền theo kho" },
      canXemLai: { giaTri: "Không có", phu: "Không có điểm cần xem lại", muc: "khong" },
    };
  }
  if (!canKho(vaiTro)) {
    return {
      vaiTro: { giaTri: ten, phu: "Không dùng màn nội bộ" },
      kho: { giaTri: "—", phu: "Tài khoản bên ngoài" },
      quyen: { giaTri: "Không áp dụng", phu: "Không có quyền theo kho" },
      canXemLai: { giaTri: "Không có", phu: "Không có điểm cần xem lại", muc: "khong" },
    };
  }
  const { duongDan, soNhom } = manHinhCuaVaiTro(menu, vaiTro);
  const coKho = Boolean(pq?.kho);
  const diem = diemCanXemLai({ vaiTro, coKho, danhGia });
  const capCao = !coKho || danhGia.capTrung.length > 0;
  return {
    vaiTro: { giaTri: ten, phu: `Mở được ${duongDan.length} màn hình · ${soNhom} nhóm menu` },
    kho: coKho
      ? { giaTri: pq.kho.tenKho || pq.kho.maKho, phu: [pq.kho.maKho, moTaHieuLuc(pq)].filter(Boolean).join(" · ") }
      : { giaTri: "Chưa phân kho", phu: "Cần 1 kho để làm việc", canhBao: true },
    quyen: {
      giaTri: coKho ? `${danhGia.soCap}/${danhGia.tong}` : `0/${danhGia.tong}`,
      phu: moTaSoVoiMau({ vaiTro, coKho, danhGia }),
    },
    // Giá trị là điểm nặng nhất (đã xếp theo mức), dòng phụ là các điểm còn lại
    canXemLai: diem.length
      ? {
          giaTri: vietHoaDau(diem[0]),
          phu: diem.length > 1 ? vietHoaDau(diem.slice(1).join(" · ")) : "Không còn điểm khác",
          muc: capCao ? "cao" : "vua",
        }
      : {
          giaTri: "Không có",
          phu: danhGia.soMau ? "Khớp mẫu, không có cặp tạo–duyệt" : "Không có cặp tạo–duyệt",
          muc: "khong",
        },
  };
}

// ───────────────────────────── Ngày giờ ─────────────────────────────

const pad2 = (n) => String(n).padStart(2, "0");

function docNgay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "31/12/2026" theo giờ máy người dùng; trống hoặc sai thì "". */
export function ngayNgan(value) {
  const d = docNgay(value);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

/** "31/12/2026 · 14:05" (cùng kiểu formatDateTime của hệ thống); trống hoặc sai thì "". */
export function ngayGio(value) {
  const d = docNgay(value);
  return d ? `${ngayNgan(d)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : "";
}

/** Giá trị cho <input type="date"> ("2026-12-31") theo giờ máy người dùng. */
export function sangNgayNhap(value) {
  const d = docNgay(value);
  return d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : "";
}

/** Hết ngày đã chọn (23:59:59 giờ máy người dùng) dạng ISO để gửi máy chủ. */
export function cuoiNgay(ngayNhap) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ngayNhap || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "từ 12/10/2026, không thời hạn" / "từ 12/10/2026, đến 31/12/2026". */
export function moTaHieuLuc(pq) {
  if (!pq) return "";
  const tu = ngayNgan(pq.ngayBatDau || pq.ngayTao);
  const den = ngayNgan(pq.ngayKetThuc);
  const dau = tu ? `từ ${tu}, ` : "";
  return `${dau}${den ? `đến ${den}` : "không thời hạn"}`;
}

export { vietHoaDau };

// ───────────────────────────── Ngăn kéo phân quyền ─────────────────────────────

/** Bản nháp ban đầu của ngăn kéo, lấy từ người dùng đang xem. */
export function banNhapTuNguoiDung(nguoiDung) {
  const { pq, quyenIds } = phanQuyenHienCo(nguoiDung);
  return {
    vaiTro: nguoiDung?.vaiTro ?? "",
    khoId: pq?.kho?.id ?? null,
    hieuLuc: pq?.ngayKetThuc ? "den_ngay" : "vo_han",
    ngayKetThuc: pq?.ngayKetThuc ? sangNgayNhap(pq.ngayKetThuc) : "",
    quyenIds,
  };
}

/**
 * Giá trị thật sẽ lưu từ một bản nháp: vai trò không dùng kho thì bỏ kho và quyền;
 * chưa chọn kho thì chưa có quyền; "Không thời hạn" thì bỏ ngày.
 */
export function giaTriHieuLuc(nhap) {
  const dungKho = canKho(nhap?.vaiTro);
  const khoId = dungKho ? nhap?.khoId ?? null : null;
  const coKho = khoId != null;
  return {
    vaiTro: nhap?.vaiTro ?? "",
    khoId,
    ngayKetThuc: coKho && nhap?.hieuLuc === "den_ngay" ? nhap?.ngayKetThuc || "" : "",
    quyenIds: coKho ? [...(nhap?.quyenIds ?? [])].sort((a, b) => a - b) : [],
  };
}

/**
 * Nội dung gửi PUT /admin/users/{id}/phan-quyen. Ngày hết hiệu lực không đổi thì gửi lại đúng giá trị cũ
 * (giữ nguyên giờ đã lưu); đổi ngày thì lấy hết ngày đã chọn.
 */
export function noiDungLuu(nhap, pqGoc) {
  const g = giaTriHieuLuc(nhap);
  let ngayKetThuc = null;
  if (g.ngayKetThuc) {
    const cu = pqGoc?.ngayKetThuc;
    ngayKetThuc =
      cu && pqGoc?.kho?.id === g.khoId && sangNgayNhap(cu) === g.ngayKetThuc ? cu : cuoiNgay(g.ngayKetThuc);
  }
  return { vaiTro: g.vaiTro, khoId: g.khoId, ngayKetThuc, quyenHanIds: g.quyenIds };
}

/**
 * Các thay đổi giữa bản đã lưu và bản nháp, để hiện trong hộp "Lưu phân quyền?".
 * Mỗi dòng: { loai: "doi" | "them" | "bo", chu }.
 */
export function soSanhPhanQuyen(goc, nhap, { dsQuyen = [], tenKho = (id) => `kho ${id}` } = {}) {
  const a = giaTriHieuLuc(goc);
  const b = giaTriHieuLuc(nhap);
  const ten = new Map((dsQuyen ?? []).map((q) => [q.id, q.tenQuyen || q.maQuyen]));
  const thuTu = thuTuQuyen(dsQuyen).map((q) => q.id);
  const sapXep = (ids) =>
    [...ids].sort((x, y) => {
      const i = thuTu.indexOf(x);
      const j = thuTu.indexOf(y);
      return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j) || x - y;
    });

  const ds = [];
  if (a.vaiTro !== b.vaiTro) ds.push({ loai: "doi", chu: `Vai trò: ${tenVaiTro(a.vaiTro)} → ${tenVaiTro(b.vaiTro)}` });

  if (canKho(b.vaiTro)) {
    if (b.khoId != null && b.khoId !== a.khoId) {
      ds.push({
        loai: "doi",
        chu: a.khoId != null ? `Kho: ${tenKho(a.khoId)} → ${tenKho(b.khoId)}` : `Phân kho: ${tenKho(b.khoId)}`,
      });
    }
    if (b.khoId != null && b.ngayKetThuc !== a.ngayKetThuc) {
      ds.push({
        loai: "doi",
        chu: b.ngayKetThuc ? `Hiệu lực: đến ${ngayNgan(cuoiNgay(b.ngayKetThuc))}` : "Hiệu lực: không thời hạn",
      });
    }
    const coA = new Set(a.quyenIds);
    const coB = new Set(b.quyenIds);
    sapXep(b.quyenIds.filter((id) => !coA.has(id))).forEach((id) => ds.push({ loai: "them", chu: ten.get(id) ?? `Quyền ${id}` }));
    sapXep(a.quyenIds.filter((id) => !coB.has(id))).forEach((id) => ds.push({ loai: "bo", chu: ten.get(id) ?? `Quyền ${id}` }));
  } else if (a.khoId != null) {
    ds.push({ loai: "bo", chu: `Thu hồi phân quyền ${tenKho(a.khoId)} (${a.quyenIds.length} quyền)` });
  }
  return ds;
}

/**
 * Tên các quyền nhạy cảm mà lần lưu này cấp mới, theo thứ tự hiển thị, để hộp "Lưu phân quyền?" hỏi lại riêng.
 * Tính là cấp mới khi: chưa có trong bản đã lưu; hoặc đổi sang kho khác (quyền ở kho mới là cấp mới, máy chủ cũng
 * ghi lịch sử như vậy); hoặc trước đây không có tác dụng với vai trò cũ mà nay có (đổi vai trò mở được màn dùng nó)
 * — cần `menu`. Quyền nhạy cảm vốn đã có thì không nhắc lại, kể cả khi vẫn chưa dùng được.
 */
export function quyenNhayCamCapThem(goc, nhap, { dsQuyen = [], nhayCam = [], menu = [] } = {}) {
  const nhay = new Set(nhayCam ?? []);
  if (!nhay.size) return [];
  const a = giaTriHieuLuc(goc);
  const b = giaTriHieuLuc(nhap);
  const ma = new Map((dsQuyen ?? []).map((q) => [q.id, q.maQuyen]));
  const coTruoc = new Set(a.khoId === b.khoId ? a.quyenIds : []);
  const dungDuoc = (id, vaiTro) => !menu?.length || quyenCoTacDung(ma.get(id), vaiTro, menu);
  const moi = b.quyenIds.filter(
    (id) => nhay.has(id) && (!coTruoc.has(id) || (!dungDuoc(id, a.vaiTro) && dungDuoc(id, b.vaiTro))),
  );
  const thuTu = thuTuQuyen(dsQuyen).map((q) => q.id);
  const ten = new Map((dsQuyen ?? []).map((q) => [q.id, q.tenQuyen || q.maQuyen]));
  return [...moi]
    .sort((x, y) => {
      const i = thuTu.indexOf(x);
      const j = thuTu.indexOf(y);
      return (i < 0 ? 1e9 : i) - (j < 0 ? 1e9 : j) || x - y;
    })
    .map((id) => ten.get(id) ?? `Quyền ${id}`);
}

/**
 * Kiểm tra bản nháp trước khi lưu (dải "Kiểm tra" cuối ngăn kéo).
 * Mỗi mục: { loai: "canhBao" | "luuY" | "on", tieuDe, moTa, phu? }. `chanLuu` = có lỗi phải sửa trước khi lưu.
 * Quyền nhạy cảm đang chọn (`nhayCam`: id) là một lưu ý riêng, đứng sau "Khớp mẫu" (không làm mất dòng này);
 * mục có `phu` chỉ để liệt kê, không tính vào `soLuuY` / dòng tóm tắt.
 */
export function kiemTraBanNhap(
  nhap,
  { dsQuyen = [], mau = [], nhayCam = [], daApDung = null, menu = [], homNay = sangNgayNhap(new Date()) } = {},
) {
  const muc = [];
  const them = (loai, tieuDe, moTa) => muc.push({ loai, tieuDe, moTa });
  let chanLuu = false;
  const vaiTro = nhap?.vaiTro;
  const tenVt = tenVaiTro(vaiTro);

  if (!canKho(vaiTro)) {
    them(
      "on",
      "Không cần quyền theo kho",
      vaiTro === QUAN_TRI_VIEN ? "Quản trị viên có toàn quyền ở mọi kho." : "Tài khoản khách hàng không dùng kho.",
    );
  } else if (nhap?.khoId == null) {
    them("canhBao", "Chưa chọn kho", "Mọi thao tác theo kho của người dùng bị chặn cho tới khi có kho.");
  } else {
    if (nhap.hieuLuc === "den_ngay" && !nhap.ngayKetThuc) {
      chanLuu = true;
      them("canhBao", "Chưa chọn ngày hết hiệu lực", "Chọn ngày, hoặc đổi sang Không thời hạn.");
    } else if (nhap.hieuLuc === "den_ngay" && homNay && nhap.ngayKetThuc < homNay) {
      // Ô ngày chỉ chặn ngày cũ trong bộ chọn; gõ tay vẫn nhập được
      chanLuu = true;
      them("canhBao", "Ngày hết hiệu lực đã qua", "Chọn từ hôm nay trở đi, hoặc đổi sang Không thời hạn.");
    }
    const dg = danhGiaQuyen({ vaiTro, quyenIds: nhap.quyenIds, dsQuyen, mau, nhayCam, daApDung, menu });
    if (dg.capTrung.length) {
      them(
        "canhBao",
        `Vừa tạo vừa duyệt ${dg.capTrung.length} loại chứng từ`,
        `${dg.capTrung.map((c) => c.ten).join(", ")}. Nên để người khác duyệt.`,
      );
    }
    if (!dg.soCap) them("canhBao", "Chưa chọn quyền nào", "Người dùng vào được kho nhưng không thao tác được.");
    if (dg.voHieu.length) {
      them(
        "luuY",
        `${dg.voHieu.length} quyền không có tác dụng`,
        `Vai trò ${tenVt} không mở được màn của: ${dg.voHieu.map((d) => d.ten).join(", ")}.`,
      );
    }
    if (dg.ngoaiMau.length) {
      them(
        "luuY",
        `Vượt mẫu ${tenVt}: thêm ${dg.ngoaiMau.length} quyền`,
        `Mẫu có ${dg.soMau} quyền. Bấm Áp dụng mẫu để về đúng mẫu.`,
      );
    }
    if (dg.thieuMau.length) {
      them("luuY", `Thiếu ${dg.thieuMau.length} quyền so với mẫu`, `${dg.thieuMau.map((d) => d.ten).join(", ")}.`);
    }
    if (dg.chuaApDung.length && Array.isArray(daApDung)) {
      const soKiem = dg.nhom.flatMap((n) => n.dong).filter((d) => daApDung.includes(d.ma)).length;
      them(
        "luuY",
        `${dg.chuaApDung.length} quyền chưa áp dụng`,
        `Hệ thống hiện kiểm ${soKiem}/${dg.tong} quyền. Các quyền này bật hay tắt đều chưa chặn thao tác.`,
      );
    }
    // Duyệt, hủy, điều chỉnh tồn, cấp quyền, báo cáo tiền: nhắc người cấp xem lại, không chặn lưu. Quyền nhạy cảm
    // đều nằm trong mẫu thì chỉ liệt kê (`phu`), không tính vào dòng tóm tắt — vai trò đúng mẫu vẫn thấy "Khớp mẫu"
    const nhay = dg.nhom.flatMap((n) => n.dong).filter((d) => d.cap && d.nhayCam);
    if (nhay.length) {
      them("luuY", `${nhay.length} quyền nhạy cảm`, `${nhay.map((d) => d.ten).join(", ")}.`);
      if (dg.soMau && nhay.every((d) => d.trongMau)) muc[muc.length - 1].phu = true;
    }
    if (!muc.some((m) => !m.phu)) {
      muc.unshift({
        loai: "on",
        tieuDe: dg.soMau ? `Khớp mẫu ${tenVt}` : "Không có điểm cần xem lại",
        moTa: "Không có cặp tạo–duyệt, không có quyền thừa.",
      });
    }
  }

  const soCanhBao = muc.filter((m) => m.loai === "canhBao").length;
  const soLuuY = muc.filter((m) => m.loai === "luuY" && !m.phu).length;
  let tomTat;
  let loai;
  if (soCanhBao) {
    tomTat = `${soCanhBao} cảnh báo${soLuuY ? ` · ${soLuuY} lưu ý` : ""}`;
    loai = "canhBao";
  } else if (soLuuY) {
    tomTat = `${soLuuY} lưu ý trước khi lưu`;
    loai = "luuY";
  } else {
    tomTat = muc[0]?.tieuDe ?? "";
    loai = "on";
  }
  return { muc, soCanhBao, soLuuY, tomTat, loai, chanLuu };
}

// ───────────────────────────── Lịch sử phân quyền ─────────────────────────────

const SO_THE_TOI_DA = 3;

/**
 * Câu mô tả và các thẻ thay đổi của một dòng lịch sử (LichSuPhanQuyenDto).
 * Bản ghi mới có vaiTroCu/vaiTroMoi; bản ghi cũ chỉ có kho và danh sách quyền.
 */
export function dienGiaiLichSu(ls) {
  const phan = [];
  const kc = ls?.khoCu ?? null;
  const km = ls?.khoMoi ?? null;
  const cungKho = kc && km && kc.id === km.id;
  const them = Array.isArray(ls?.quyenThem) ? ls.quyenThem : [];
  const bo = Array.isArray(ls?.quyenBo) ? ls.quyenBo : [];
  const tenK = (k) => k?.tenKho || k?.maKho || "kho";

  if (ls?.vaiTroCu && ls?.vaiTroMoi && ls.vaiTroCu !== ls.vaiTroMoi) {
    phan.push(`đổi vai trò ${tenVaiTro(ls.vaiTroCu)} → ${tenVaiTro(ls.vaiTroMoi)}`);
  }
  const den = ngayNgan(ls?.ngayKetThucMoi);
  if (!kc && km) {
    phan.push(`phân ${tenK(km)}${km.maKho && km.tenKho ? ` (${km.maKho})` : ""}, ${den ? `hiệu lực đến ${den}` : "không thời hạn"}`);
    if (them.length) phan.push(`cấp ${them.length} quyền`);
  } else if (kc && km && !cungKho) {
    phan.push(`chuyển ${tenK(kc)} → ${tenK(km)}`);
    if (them.length) phan.push(`cấp ${them.length} quyền`);
  } else if (kc && !km) {
    phan.push(`thu hồi phân quyền ${tenK(kc)}${bo.length ? ` (${bo.length} quyền)` : ""}`);
  } else {
    if (cungKho && ls?.doiHieuLuc) phan.push(den ? `đặt hiệu lực đến ${den}` : "bỏ thời hạn hiệu lực");
    if (them.length) phan.push(`cấp thêm ${them.length} quyền`);
    if (bo.length) phan.push(`thu hồi ${bo.length} quyền`);
  }

  let viec = phan.join(", ");
  if (cungKho && (them.length || bo.length)) viec += ` tại ${tenK(km)}`;
  if (!viec) viec = "cập nhật phân quyền";

  const tatCa = [
    ...(kc && !km ? [] : bo.map((t) => ({ chu: `− ${t}`, loai: "bo" }))),
    ...them.map((t) => ({ chu: `+ ${t}`, loai: "them" })),
  ];
  const the = tatCa.slice(0, SO_THE_TOI_DA);
  if (tatCa.length > SO_THE_TOI_DA) the.push({ chu: `và ${tatCa.length - SO_THE_TOI_DA} thay đổi khác`, loai: "" });
  return { viec, the };
}

// ───────────────────────────── Hồ sơ của tôi ─────────────────────────────

/** Mô tả quyền theo góc nhìn người được cấp (tab Quyền của tôi). Quyền mới chưa có ở đây dùng mô tả trong CSDL. */
export const MO_TA_CHO_NGUOI_DUNG = {
  xem_ton_kho: "Xem số lượng còn của từng sản phẩm trong kho",
  xem_chi_tiet_lo: "Xem lô, hạn dùng và vị trí kệ của hàng",
  dieu_chinh_ton_kho: "Sửa số lượng tồn khi kiểm kê thấy lệch",
  chuyen_kho: "Lập phiếu chuyển hàng sang kho khác",
  tao_don_mua_hang: "Lập yêu cầu và đơn mua hàng",
  duyet_don_mua_hang: "Duyệt hoặc từ chối đơn mua hàng",
  tao_phieu_nhap: "Lập phiếu khi nhận hàng vào kho",
  duyet_phieu_nhap: "Duyệt phiếu nhập do người khác lập",
  huy_phieu_nhap: "Hủy phiếu nhập chưa hoàn tất",
  tao_don_ban_hang: "Lập đơn bán cho khách",
  duyet_don_ban_hang: "Duyệt đơn bán do người khác lập",
  tao_phieu_xuat: "Lập phiếu khi xuất hàng khỏi kho",
  duyet_phieu_xuat: "Duyệt phiếu xuất do người khác lập",
  huy_phieu_xuat: "Hủy phiếu xuất chưa hoàn tất",
  xem_bao_cao_ton_kho: "Xem báo cáo tồn theo sản phẩm, theo kệ",
  xem_bao_cao_nhap_xuat: "Xem báo cáo hàng vào, hàng ra",
  xem_bao_cao_doanh_thu: "Xem doanh thu bán hàng",
  xuat_bao_cao: "Tải báo cáo về máy dạng Excel hoặc PDF",
  quan_ly_nhan_vien_kho: "Thêm hoặc gỡ nhân viên khỏi kho",
  cap_quyen_nhan_vien: "Cấp hoặc thu hồi quyền của nhân viên",
  quan_ly_san_pham: "Thêm, sửa sản phẩm và biến thể",
  quan_ly_nha_cung_cap: "Thêm, sửa nhà cung cấp",
  quan_ly_khach_hang: "Thêm, sửa khách hàng",
};

/**
 * Nội dung tab Quyền của tôi từ QuyenCuaToiDto (GET /nguoi-dung/me/quyen).
 * Liệt kê mọi quyền đang được cấp mà vai trò mở được màn dùng nó (cần `menu`). Quyền hệ thống chưa kiểm
 * (`quyenDaApDung`) vẫn liệt kê: chưa kiểm nghĩa là không bị chặn, người dùng vẫn làm được — nhãn "Chưa áp dụng"
 * chỉ có ở trang quản trị. Quyền vai trò không mở được màn thì tách sang `khongDungDuoc` (trang admin gắn
 * "Không có tác dụng").
 * Trả về { nhom: [{ ten, viec: [{ ma, ten, moTa, moi }] }], soViec, soDaCap, khongDungDuoc: [tên quyền],
 * canDuyet: [tên chứng từ], daThuHoi }.
 */
export function quyenCuaToiTheoNhom(quyenCuaToi, { menu = [] } = {}) {
  const vaiTro = quyenCuaToi?.vaiTro;
  const daCap = (Array.isArray(quyenCuaToi?.quyen) ? quyenCuaToi.quyen : []).filter((q) => q && q.id != null);
  const dungDuoc = (q) => !menu?.length || !vaiTro || quyenCoTacDung(q.maQuyen, vaiTro, menu);
  const ds = daCap.filter(dungDuoc);
  const khongDungDuoc = thuTuQuyen(daCap.filter((q) => !dungDuoc(q))).map((q) => q.tenQuyen || q.maQuyen);
  const moi = new Set(Array.isArray(quyenCuaToi?.quyenMoi) ? quyenCuaToi.quyenMoi : []);
  const nhom = nhomTheoLuong(ds).map((n) => ({
    ma: n.ma,
    ten: n.ten,
    viec: n.quyen.map((q) => ({
      ma: q.maQuyen,
      ten: q.tenQuyen || q.maQuyen,
      moTa: MO_TA_CHO_NGUOI_DUNG[q.maQuyen] || q.moTa || "",
      moi: moi.has(q.maQuyen),
    })),
  }));
  const ma = new Set(ds.map((q) => q.maQuyen));
  return {
    nhom,
    soViec: ds.length,
    soDaCap: daCap.length,
    khongDungDuoc,
    canDuyet: CAP_TAO_DUYET.filter((c) => ma.has(c.tao) && !ma.has(c.duyet)).map((c) => c.ten.toLowerCase()),
    daThuHoi: Array.isArray(quyenCuaToi?.quyenDaThuHoi) ? quyenCuaToi.quyenDaThuHoi : [],
  };
}
