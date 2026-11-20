/* i18n-giu-nguyen-ca-tep: nhãn hằng số và mã lưu CSDL; giao diện dịch lúc hiện bằng t(nhan) */
/**
 * Logic thuần của màn Trả hàng tại quầy (/pos/returns), không React, không gọi API — kiểm được bằng node --test.
 * Máy chủ vẫn là chốt chặn thật (số lượng, giá hoàn, hạn trả); ở đây chỉ để báo lỗi sớm và tính tổng hiển thị.
 */

export const QC_DAT = 'dat';
export const QC_LOI = 'loi';
export const HOAN_TIEN_MAT = 'tien_mat';
export const HOAN_CHUYEN_KHOAN = 'chuyen_khoan';

/** Lý do trả (khớp TraHangQuyTac.LY_DO ở máy chủ). Nhãn tiếng Việt dịch lúc hiện. */
export const LY_DO_TRA = [
  ['mac_chat', 'Khách mặc chật'],
  ['mac_rong', 'Khách mặc rộng'],
  ['khong_ung_mau_kieu', 'Không ưng màu/kiểu'],
  ['loi_san_xuat', 'Lỗi kỹ thuật sản xuất'],
  ['doi_y', 'Khách đổi ý'],
  ['khac', 'Khác'],
];

/** Mã lý do máy chủ tự ghi cho dòng hàng Lỗi (TraHangQuyTac.LY_DO_LOI); hàng Đạt không chọn được. */
export const LY_DO_LOI = 'loi_san_xuat';
/** Mã "Khác" của cả lý do lẫn nhóm lỗi: chọn mã này thì phải ghi rõ. */
export const MA_KHAC = 'khac';
/** Lý do chọn được cho hàng Đạt: bỏ lỗi sản xuất (hàng lỗi thì chấm Lỗi). */
export const LY_DO_TRA_DAT = LY_DO_TRA.filter(([ma]) => ma !== LY_DO_LOI);

/** Nhóm lỗi khi hàng Lỗi (khớp TraHangQuyTac.NHOM_LOI). */
export const NHOM_LOI = [
  ['rach_vai', 'Rách vải'],
  ['hong_khoa', 'Hỏng khóa'],
  ['o_ban', 'Ố bẩn'],
  ['bung_chi', 'Bung chỉ, đường may'],
  ['khac', 'Lỗi khác'],
];

/** Lý do xin duyệt ngoại lệ quá hạn (mockup BA) + Khác (tự nhập). */
export const LY_DO_DUYET = [
  'Lỗi kỹ thuật ẩn từ nhà sản xuất (bảo hành)',
  'Khách VIP / đã báo trước qua hotline CSKH',
  'Sự cố vận chuyển / đổi size quà tặng',
];

/*
 * Chính sách trả hàng: một chỗ khai báo cho cả khung tóm tắt ở chân Phiếu trả, hộp "Xem đầy đủ" và gợi ý dưới công tắc
 * Đạt / Lỗi. Đổi luật thì sửa cả ba khối dưới đây cho khớp nhau (tóm tắt là câu ngắn của bản đầy đủ).
 * Máy đã tự chặn hạn 03 ngày, mã duyệt quá hạn và hóa đơn gốc; điều duy nhất thu ngân phải tự nhìn là tình trạng hàng,
 * nên câu đó có ở cả tóm tắt lẫn gợi ý lúc chấm Đạt / Lỗi.
 */

/** Bốn ý ở khung tóm tắt: [khóa biểu tượng, câu]. Biểu tượng chọn ở màn (han, tem, duyet, hoan). */
export const CHINH_SACH_TOM_TAT = [
  ['han', 'Nhận trả trong 03 ngày kể từ lúc thanh toán, ở mọi cửa hàng.'],
  ['tem', 'Hàng còn nguyên tem mác, chưa sử dụng, không ám mùi, không bẩn.'],
  ['duyet', 'Quá hạn: cần quản lý cửa hàng duyệt bằng mã.'],
  ['hoan', 'Hoàn theo giá khách thực trả, tiền mặt hoặc chuyển khoản.'],
];

/** Bản đầy đủ trong hộp "Xem đầy đủ": [tiêu đề nhóm, các ý]. */
export const CHINH_SACH_DAY_DU = [
  ['Điều kiện nhận trả', [
    'Trong vòng 03 ngày kể từ lúc thanh toán (in trên hóa đơn gốc). Quá hạn cần quản lý cửa hàng duyệt bằng mã.',
    'Hàng còn nguyên tem mác, chưa sử dụng, chưa giặt ủi, không ám mùi, không dính bẩn.',
    'Tra được hóa đơn gốc đã thanh toán trên hệ thống.',
  ]],
  ['Khi nhận trả', [
    'Trả được ở mọi cửa hàng: hàng nhập vào kho cửa hàng nhận trả, doanh thu giảm ở cửa hàng đã bán.',
    'Hoàn theo giá khách thực trả trên từng sản phẩm, bằng tiền mặt hoặc chuyển khoản.',
    'Hàng Đạt cất lên kệ và mở bán lại ngay; hàng Lỗi để riêng, không cộng tồn.',
    'In biên bản 02 liên: khách giữ một liên, cửa hàng giữ một liên.',
  ]],
];

/** Gợi ý dưới công tắc Đạt / Lỗi của từng món: [nhãn in đậm, phần còn lại]. */
export const GOI_Y_QC = {
  [QC_DAT]: ['Đạt:', 'còn tem mác, chưa sử dụng, không ám mùi, không bẩn.'],
  [QC_LOI]: ['Lỗi:', 'để riêng, không cộng tồn. Chọn lỗi bên dưới.'],
};

export const nhanTheoMa = (ds, ma) => ds.find(([m]) => m === ma)?.[1] ?? ma;

/** Trạng thái chọn ban đầu của từng dòng đơn gốc: chưa chọn, SL 1, QC Đạt (mặc định BA), kệ gợi ý. */
export function khoiTaoDong(dong = []) {
  return dong.map((d) => ({
    chiTietId: d.chiTietId,
    chon: false,
    soLuong: Number(d.soLuongConTra) > 0 ? 1 : 0,
    tinhTrang: QC_DAT,
    viTriKhoId: d.keGoiYId ?? null,
    lyDo: '',
    nhomLoi: '',
    ghiChu: '',
  }));
}

/** Số còn trả được của dòng đơn gốc (số nguyên ≥ 0). */
export const conTra = (d) => Math.max(0, Math.floor(Number(d?.soLuongConTra) || 0));

/**
 * Tiền hoàn của một dòng (cùng cách tính máy chủ): trả hết phần còn lại thì hoàn đúng phần tiền còn lại của dòng,
 * ngược lại đơn giá thực trả × số lượng.
 */
export function tienHoanDong(d, soLuong) {
  const sl = Math.max(0, Math.floor(Number(soLuong) || 0));
  if (!d || sl === 0) return 0;
  if (sl >= conTra(d) && d.tienConHoan != null) return Number(d.tienConHoan) || 0;
  return sl * (Number(d.donGiaThucTra) || 0);
}

/** Tổng kết khu bên phải: số sản phẩm chọn, tổng số lượng, số Đạt / Lỗi, tổng tiền hoàn. */
export function tongKet(dongGoc = [], chon = []) {
  const theoId = new Map(dongGoc.map((d) => [d.chiTietId, d]));
  let soSanPham = 0, tongSoLuong = 0, soDat = 0, soLoi = 0, tongTien = 0;
  for (const c of chon) {
    if (!c.chon) continue;
    const d = theoId.get(c.chiTietId);
    const sl = Math.max(0, Math.floor(Number(c.soLuong) || 0));
    if (!d || sl === 0) continue;
    soSanPham += 1;
    tongSoLuong += sl;
    if (c.tinhTrang === QC_LOI) soLoi += sl; else soDat += sl;
    tongTien += tienHoanDong(d, sl);
  }
  return { soSanPham, tongSoLuong, soDat, soLoi, tongTien };
}

/** Dòng phải ghi rõ: hàng Đạt chọn lý do Khác, hoặc hàng Lỗi chọn Lỗi khác (khớp TraHangQuyTac.canGhiRo). */
export const canGhiRo = (c) => (c.tinhTrang === QC_LOI ? c.nhomLoi : c.lyDo) === MA_KHAC;

/**
 * Lỗi theo dòng (chỉ dòng đang chọn): { [chiTietId]: { soLuong?, ke?, lyDo?, nhomLoi?, ghiChu? } } với mã lỗi:
 * soLuong: 'thieu' | 'vuot' (MSG-RET-03); ke: 'thieu' | 'het-cho'; lyDo, nhomLoi, ghiChu: 'thieu'.
 * Hàng Đạt cần kệ (kho có kệ) và lý do; hàng Lỗi chỉ cần nhóm lỗi. Chọn Khác thì phải ghi rõ.
 * 'het-cho': tổng hàng Đạt các món đang xếp vào cùng một kệ vượt số kệ còn chứa được ({@code ke[].conCho}, cùng chốt
 * chặn máy chủ) — báo ngay để thu ngân đổi kệ, không đợi máy chủ từ chối lúc xác nhận.
 */
export function loiTheoDong(dongGoc = [], chon = [], khoCoKe = false, ke = []) {
  const theoId = new Map(dongGoc.map((d) => [d.chiTietId, d]));
  const loi = {};
  const canTheoKe = canXepTheoKe(chon);
  const conChoTheoKe = new Map(ke.map((k) => [k.id, k.conCho]));
  for (const c of chon) {
    if (!c.chon) continue;
    const d = theoId.get(c.chiTietId);
    const e = {};
    const raw = Number(c.soLuong);
    if (!Number.isInteger(raw) || raw < 1) e.soLuong = 'thieu';
    else if (raw > conTra(d)) e.soLuong = 'vuot';
    if (c.tinhTrang === QC_DAT && khoCoKe && !c.viTriKhoId) e.ke = 'thieu';
    else if (c.tinhTrang === QC_DAT && c.viTriKhoId) {
      const conCho = conChoTheoKe.get(c.viTriKhoId);
      if (conCho != null && (canTheoKe.get(c.viTriKhoId) ?? 0) > conCho) e.ke = 'het-cho';
    }
    if (c.tinhTrang === QC_DAT && !c.lyDo) e.lyDo = 'thieu';
    if (c.tinhTrang === QC_LOI && !c.nhomLoi) e.nhomLoi = 'thieu';
    if (canGhiRo(c) && !c.ghiChu?.trim()) e.ghiChu = 'thieu';
    if (Object.keys(e).length) loi[c.chiTietId] = e;
  }
  return loi;
}

/** Tổng số hàng Đạt các món đang chọn xếp vào từng kệ: Map viTriKhoId → số. */
export function canXepTheoKe(chon = []) {
  const m = new Map();
  for (const c of chon) {
    const sl = Number(c.soLuong);
    if (!c.chon || c.tinhTrang !== QC_DAT || !c.viTriKhoId || !Number.isInteger(sl) || sl < 1) continue;
    m.set(c.viTriKhoId, (m.get(c.viTriKhoId) ?? 0) + sl);
  }
  return m;
}

/** Thông tin chuyển khoản hoàn tiền còn thiếu / sai: mảng tên ô. */
export function loiChuyenKhoan(ck = {}) {
  const thieu = [];
  if (!ck.nganHang?.trim()) thieu.push('nganHang');
  if (!/^\d{6,20}$/.test((ck.soTaiKhoan ?? '').trim())) thieu.push('soTaiKhoan');
  if (!ck.tenChuTaiKhoan?.trim()) thieu.push('tenChuTaiKhoan');
  if (!ck.maGiaoDich?.trim()) thieu.push('maGiaoDich');
  return thieu;
}

/** Dữ liệu gửi POST /api/v1/pos/returns. */
export function dungYeuCau({ requestId, don, khoId, chon, phuongThuc, ck, yeuCauDuyetId, lyDoDuyet, ghiChu }) {
  return {
    requestId,
    donBanHangId: don.donBanHangId,
    khoId,
    phuongThucHoan: phuongThuc,
    ...(phuongThuc === HOAN_CHUYEN_KHOAN ? {
      nganHang: ck.nganHang.trim(),
      soTaiKhoan: ck.soTaiKhoan.trim(),
      tenChuTaiKhoan: ck.tenChuTaiKhoan.trim(),
      maGiaoDich: ck.maGiaoDich.trim(),
    } : {}),
    yeuCauDuyetId: yeuCauDuyetId ?? null,
    lyDoDuyet: lyDoDuyet || null,
    ghiChu: ghiChu?.trim() || null,
    dong: chon.filter((c) => c.chon && Number(c.soLuong) > 0).map((c) => ({
      chiTietDonBanHangId: c.chiTietId,
      soLuong: Math.floor(Number(c.soLuong)),
      tinhTrang: c.tinhTrang,
      viTriKhoId: c.tinhTrang === QC_DAT ? (c.viTriKhoId || null) : null,
      lyDo: c.tinhTrang === QC_DAT ? c.lyDo : null,
      nhomLoi: c.tinhTrang === QC_LOI ? c.nhomLoi : null,
      ghiChu: canGhiRo(c) ? c.ghiChu.trim() : null,
    })),
  };
}

/** Khóa so sánh nội dung yêu cầu (bỏ requestId) — đổi nội dung thì phải sinh requestId mới. */
export const khoaNoiDung = (payload) => JSON.stringify({ ...payload, requestId: undefined });
