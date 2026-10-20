import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHUNG_TU,
  VAI_TRO,
  banNhapTuNguoiDung,
  canKho,
  cuoiNgay,
  danhGiaQuyen,
  dienGiaiLichSu,
  giaTriHieuLuc,
  goiYHoSo,
  hieuLucCuaToi,
  khoCuaToiNgan,
  mailtoLienHe,
  hienTenDangNhapRieng,
  kiemTraBanNhap,
  laVaiTroNoiBo,
  maTranQuyen,
  manHinhCuaVaiTro,
  moTaVaiTro,
  nhomTheoLuong,
  nhomHoSo,
  noiDungLuu,
  phanQuyenHienCo,
  quyenCoTacDung,
  quyenCuaToiTheoNhom,
  quyenNhayCamCapThem,
  sangNgayNhap,
  soSanhPhanQuyen,
  tenVaiTro,
  vanDeCanXemLai,
} from "./phanQuyen.js";
import { ROLES } from "../../constants/backend/role.js";

// Bảng quyen_han (23 dòng) như trong Database/MyDB.sql
const QUYEN = [
  [1, "xem_ton_kho", "Xem tồn kho", "quan_ly_kho"],
  [2, "xem_chi_tiet_lo", "Xem chi tiết lô hàng", "quan_ly_kho"],
  [3, "dieu_chinh_ton_kho", "Điều chỉnh tồn kho", "quan_ly_kho"],
  [4, "chuyen_kho", "Chuyển kho", "quan_ly_kho"],
  [5, "tao_don_mua_hang", "Tạo đơn mua hàng", "nhap_kho"],
  [6, "duyet_don_mua_hang", "Duyệt đơn mua hàng", "nhap_kho"],
  [7, "tao_phieu_nhap", "Tạo phiếu nhập kho", "nhap_kho"],
  [8, "duyet_phieu_nhap", "Duyệt phiếu nhập kho", "nhap_kho"],
  [9, "huy_phieu_nhap", "Hủy phiếu nhập kho", "nhap_kho"],
  [10, "tao_don_ban_hang", "Tạo đơn bán hàng", "xuat_kho"],
  [11, "duyet_don_ban_hang", "Duyệt đơn bán hàng", "xuat_kho"],
  [12, "tao_phieu_xuat", "Tạo phiếu xuất kho", "xuat_kho"],
  [13, "duyet_phieu_xuat", "Duyệt phiếu xuất kho", "xuat_kho"],
  [14, "huy_phieu_xuat", "Hủy phiếu xuất kho", "xuat_kho"],
  [15, "xem_bao_cao_ton_kho", "Xem báo cáo tồn kho", "bao_cao"],
  [16, "xem_bao_cao_nhap_xuat", "Xem báo cáo nhập xuất", "bao_cao"],
  [17, "xem_bao_cao_doanh_thu", "Xem báo cáo doanh thu", "bao_cao"],
  [18, "xuat_bao_cao", "Xuất báo cáo", "bao_cao"],
  [19, "quan_ly_nhan_vien_kho", "Quản lý nhân viên kho", "cai_dat"],
  [20, "cap_quyen_nhan_vien", "Cấp quyền nhân viên", "cai_dat"],
  [21, "quan_ly_san_pham", "Quản lý sản phẩm", "cai_dat"],
  [22, "quan_ly_nha_cung_cap", "Quản lý nhà cung cấp", "cai_dat"],
  [23, "quan_ly_khach_hang", "Quản lý khách hàng", "cai_dat"],
].map(([id, maQuyen, tenQuyen, nhomQuyen]) => ({ id, maQuyen, tenQuyen, nhomQuyen, moTa: `Mô tả ${maQuyen}` }));

// Cùng cấu trúc vai trò/đường dẫn với components/backoffice/sidebar.config.js (bỏ icon, nhãn)
const QTV = "quan_tri_vien", QLK = "quan_ly_kho", NVK = "nhan_vien_kho", NVM = "nhan_vien_mua_hang", NVB = "nhan_vien_ban_hang";
// Vai trò Khách hàng đã bỏ (19/10/2026): nay chỉ là một vai trò lạ, không có màn hình, kho hay quyền
const VAI_TRO_DA_BO = "khach_hang";
const MENU = [
  { to: "/dashboard", roles: [QTV, QLK, NVK, NVM, NVB] },
  { to: "/users", roles: [QTV] },
  {
    roles: [QTV, QLK, NVK, NVM, NVB],
    children: [{ to: "/categories" }, { to: "/attributes" }, { to: "/products" }, { to: "/sku-builder", roles: [QTV, QLK] }],
  },
  {
    roles: [QTV, QLK, NVM, NVK],
    children: [
      { to: "/supplier", roles: [QTV, QLK, NVM] },
      { to: "/supplier-barcodes", roles: [QTV, QLK, NVK, NVM] },
      { to: "/purchase-requests", roles: [QTV, QLK, NVK, NVM] },
      { to: "/quotation-requests", roles: [QTV, NVM] },
      { to: "/purchase-orders", roles: [QTV, QLK, NVM, NVK] },
      { to: "/goods-receipts", roles: [QTV, QLK, NVK] },
    ],
  },
  {
    roles: [QTV, QLK, NVK],
    children: [
      { to: "/warehouse", roles: [QTV, QLK] },
      { to: "/warehouse/locations", roles: [QTV, QLK, NVK] },
      { to: "/goods-issues/pending-orders" },
      { to: "/goods-issues/pick-lists" },
      { to: "/goods-issues" },
      { to: "/transfer-tickets", roles: [QTV, QLK, NVK] },
      { to: "/stock-take" },
    ],
  },
  {
    roles: [QTV, NVB, NVK, QLK],
    children: [
      { to: "/customers", roles: [QTV, NVB] },
      { to: "/sales-quotations", roles: [QTV, NVB] },
      { to: "/sales-orders", roles: [QTV, NVB, NVK, QLK] },
      { to: "/pos", roles: [QTV, NVB] },
    ],
  },
  { to: "/channels", roles: [QTV] },
  { roles: [QTV], children: [{ to: "/channels/shopify", roles: [QTV] }] },
  {
    roles: [QTV, QLK, NVK, NVM, NVB],
    children: [
      { to: "/reports/revenue", roles: [QTV, QLK] },
      { to: "/reports/inventory", roles: [QTV, QLK, NVK, NVM, NVB] },
      { to: "/reports/stock-movements", roles: [QTV, QLK] },
      { to: "/reports/customers", roles: [QTV, QLK] },
      { to: "/inventory-transactions", roles: [QTV, QLK, NVK] },
    ],
  },
  {
    // Cấu hình ghim ở đáy sidebar; mục con là các trang của settings.config.js
    to: "/settings",
    roles: [QTV, QLK],
    children: [
      { to: "/settings/stock", roles: [QTV, QLK] },
      { to: "/settings/sync", roles: [QTV, QLK] },
      { to: "/settings/customer", roles: [QTV, QLK] },
      { to: "/settings/store", roles: [QTV, QLK] },
      { to: "/settings/payment", roles: [QTV] },
      { to: "/settings/print-templates", roles: [QTV, QLK] },
    ],
  },
];

const MAU_NVK = [1, 2, 4, 7, 12, 15];
const NHAY_CAM = [3, 6, 8, 9, 11, 13, 14, 17, 18, 19, 20];
const TAT_CA = QUYEN.map((q) => q.id);

test("vai trò: đúng năm vai trò nhân sự, theo thứ tự hiện trên màn hình, lấy từ constants/backend/role.js", () => {
  assert.deepEqual(VAI_TRO.map((v) => v.ma), [NVK, QLK, NVB, NVM, QTV], "Quản trị viên để cuối");
  assert.deepEqual(VAI_TRO.map((v) => v.ma), ROLES.map((r) => r.value), "một nguồn duy nhất");
  assert.deepEqual(VAI_TRO.map((v) => v.ten), ROLES.map((r) => r.label));
  for (const v of VAI_TRO) assert.ok(v.moTa, `${v.ma} có mô tả`);
  assert.equal(moTaVaiTro(QTV), "Chủ cửa hàng, người quản lý hệ thống. Toàn quyền ở mọi kho.");
  assert.equal(moTaVaiTro(VAI_TRO_DA_BO), "");
});

test("vai trò nhân sự: chỉ năm mã đúng, không nhận vai trò đã bỏ hay mã lạ", () => {
  for (const ma of [NVK, QLK, NVB, NVM, QTV]) assert.equal(laVaiTroNoiBo(ma), true, ma);
  for (const ma of [VAI_TRO_DA_BO, "all", "vai_tro_moi", "QUAN_TRI_VIEN", " quan_tri_vien", "", null, undefined]) {
    assert.equal(laVaiTroNoiBo(ma), false, String(ma));
  }
});

test("tên vai trò và vai trò cần kho", () => {
  assert.equal(tenVaiTro(NVK), "Nhân viên kho");
  assert.equal(tenVaiTro("vai_tro_moi"), "vai tro moi");
  assert.equal(tenVaiTro(null), "Không xác định");
  for (const ma of [NVK, QLK, NVB, NVM]) assert.equal(canKho(ma), true, ma);
  assert.equal(canKho(QTV), false, "quản trị viên toàn quyền ở mọi kho");
  // Mã lạ không được coi là làm việc theo kho (trước đây mọi mã khác quản trị viên / khách hàng đều cần kho)
  assert.equal(canKho(VAI_TRO_DA_BO), false);
  assert.equal(canKho("vai_tro_moi"), false);
  assert.equal(canKho(""), false);
  assert.equal(canKho(undefined), false);
});

test("nhóm theo luồng việc: đúng thứ tự nhóm và thứ tự trong nhóm, nhóm lạ vào Khác", () => {
  const nhom = nhomTheoLuong([...QUYEN, { id: 99, maQuyen: "moi", tenQuyen: "Quyền mới", nhomQuyen: "la" }]);
  assert.deepEqual(nhom.map((n) => n.ten), ["Mua & nhập kho", "Tồn kho", "Bán & xuất kho", "Báo cáo", "Danh mục & nhân sự", "Khác"]);
  assert.deepEqual(nhom[1].quyen.map((q) => q.id), [1, 2, 4, 3]);
  assert.deepEqual(nhom[4].quyen.map((q) => q.id), [21, 22, 23, 19, 20]);
  assert.equal(nhom.filter((n) => n.luong).length, 3);
  assert.deepEqual(nhomTheoLuong(null), []);
});

test("màn hình theo vai trò khớp quy tắc lọc của sidebar", () => {
  const nvk = manHinhCuaVaiTro(MENU, NVK);
  assert.equal(nvk.duongDan.length, 17);
  assert.equal(nvk.soNhom, 6);
  assert.equal(manHinhCuaVaiTro(MENU, NVM).duongDan.length, 10);
  assert.equal(manHinhCuaVaiTro(MENU, NVB).duongDan.length, 9);
  assert.deepEqual(manHinhCuaVaiTro(MENU, VAI_TRO_DA_BO), { duongDan: [], soNhom: 0 });
  // Mục không khai báo roles mở cho mọi vai trò nhân sự, nhưng không mở cho mã lạ
  const menuMo = [{ to: "/dashboard" }];
  assert.deepEqual(manHinhCuaVaiTro(menuMo, NVK), { duongDan: ["/dashboard"], soNhom: 1 });
  assert.deepEqual(manHinhCuaVaiTro(menuMo, "vai_tro_moi"), { duongDan: [], soNhom: 0 });
  assert.deepEqual(manHinhCuaVaiTro(menuMo, undefined), { duongDan: [], soNhom: 0 });
  assert.ok(nvk.duongDan.includes("/goods-issues"), "mục con không khai báo roles thì theo mục cha");
});

test("quyền không có tác dụng khi vai trò không mở được màn dùng quyền", () => {
  assert.equal(quyenCoTacDung("cap_quyen_nhan_vien", NVK, MENU), false);
  assert.equal(quyenCoTacDung("cap_quyen_nhan_vien", QLK, MENU), true);
  assert.equal(quyenCoTacDung("quan_ly_khach_hang", NVK, MENU), false);
  assert.equal(quyenCoTacDung("tao_don_ban_hang", NVK, MENU), true);
  assert.equal(quyenCoTacDung("quyen_chua_khai_bao", NVK, MENU), true);
  assert.equal(quyenCoTacDung("cap_quyen_nhan_vien", QTV, MENU), true);
});

const nguoiDung = (vaiTro, khoPhuTrach = []) => ({ id: 52, vaiTro, khoPhuTrach });
const pq = (quyen, them = {}) => ({
  id: 7,
  trangThai: 1,
  kho: { id: 22, maKho: "KHO_TONG", tenKho: "Kho tổng", loaiKho: "kho_tong" },
  ngayBatDau: "2026-10-12T07:03:00Z",
  ngayKetThuc: null,
  chiTietQuyenKhos: quyen.map(([id, trangThai]) => ({ id: 100 + id, trangThai, quyenHan: { id } })),
  ...them,
});

test("phân quyền hiện có: chỉ quyền đang bật, bỏ dòng kho đã tắt", () => {
  const { pq: p, quyenIds } = phanQuyenHienCo(nguoiDung(NVK, [pq([[7, 1], [1, 1], [20, 0]])]));
  assert.equal(p.kho.maKho, "KHO_TONG");
  assert.deepEqual(quyenIds, [1, 7]);
  assert.deepEqual(phanQuyenHienCo(nguoiDung(NVK, [pq([[1, 1]], { trangThai: 0 })])), { pq: null, quyenIds: [] });
  assert.deepEqual(phanQuyenHienCo(null), { pq: null, quyenIds: [] });
});

test("đánh giá quyền so với mẫu: ngoài mẫu, thiếu, cặp tạo–duyệt, vô hiệu, chưa áp dụng", () => {
  const dg = danhGiaQuyen({
    vaiTro: NVK,
    quyenIds: [1, 2, 4, 7, 8, 12, 15, 20],
    dsQuyen: QUYEN,
    mau: MAU_NVK,
    nhayCam: NHAY_CAM,
    daApDung: ["tao_phieu_nhap", "tao_phieu_xuat"],
    menu: MENU,
  });
  assert.equal(dg.soCap, 8);
  assert.equal(dg.tong, 23);
  assert.deepEqual(dg.ngoaiMau.map((d) => d.id), [8, 20]);
  assert.deepEqual(dg.thieuMau, []);
  assert.deepEqual(dg.capTrung.map((c) => c.ten), ["Phiếu nhập kho"]);
  assert.deepEqual(dg.voHieu.map((d) => d.id), [20]);
  assert.equal(dg.chuaApDung.length, 6);
  const dong8 = dg.nhom[0].dong.find((d) => d.id === 8);
  assert.equal(dong8.nhayCam, true);
  assert.equal(dong8.trongMau, false);
  assert.equal(dong8.ngoaiMau, true);
  assert.equal(dg.nhom[1].dong.find((d) => d.id === 1).ngoaiMau, false, "quyền trong mẫu");
  assert.equal(dg.nhom[1].dong.find((d) => d.id === 3).ngoaiMau, false, "chưa cấp thì không ngoài mẫu");

  const khongCauHinh = danhGiaQuyen({ vaiTro: NVK, quyenIds: [1], dsQuyen: QUYEN, mau: null, daApDung: null, menu: MENU });
  assert.equal(khongCauHinh.khongDocDuocMau, true);
  assert.deepEqual(khongCauHinh.ngoaiMau, [], "không đọc được mẫu thì không gắn Ngoài mẫu");
  assert.equal(khongCauHinh.nhom[1].dong.find((d) => d.id === 1).ngoaiMau, false, "từng dòng cũng không tô Ngoài mẫu");
  assert.deepEqual(khongCauHinh.chuaApDung, [], "không đọc được cấu hình thì không gắn Chưa áp dụng");
});

test("Cần xem lại: chỉ khi có nơi làm việc; xếp theo mức nặng; không nhắc tên vai trò", () => {
  const dgRong = danhGiaQuyen({ vaiTro: QTV, quyenIds: [], dsQuyen: QUYEN, menu: MENU });
  assert.deepEqual(vanDeCanXemLai({ vaiTro: QTV, coKho: false, danhGia: dgRong }), [], "quản trị viên: không có khung");
  assert.deepEqual(vanDeCanXemLai({ vaiTro: VAI_TRO_DA_BO, coKho: true, danhGia: dgRong }), [], "vai trò lạ: không có khung");
  const dgChuaKho = danhGiaQuyen({ vaiTro: NVK, quyenIds: [], dsQuyen: QUYEN, mau: MAU_NVK, menu: MENU });
  assert.deepEqual(vanDeCanXemLai({ vaiTro: NVK, coKho: false, danhGia: dgChuaKho }), [], "chưa có nơi làm việc: ô trống của tab đã nói");

  const chuaCap = vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: dgChuaKho });
  assert.deepEqual(chuaCap.map((v) => v.ma), ["chuaCap"], "chưa cấp quyền nào thì không kể thêm 'thiếu 6 quyền so với mẫu'");

  const dgLech = danhGiaQuyen({ vaiTro: NVK, quyenIds: TAT_CA, dsQuyen: QUYEN, mau: MAU_NVK, menu: MENU });
  const lech = vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: dgLech });
  assert.deepEqual(lech.map((v) => v.ma), ["taoDuyet", "ngoaiMau", "voHieu"]);
  assert.equal(lech[0].chinh, "Tự tạo và tự duyệt được 4 loại chứng từ");
  assert.equal(lech[0].phu, "Đơn mua hàng, Phiếu nhập kho, Đơn bán hàng, Phiếu xuất kho");
  assert.deepEqual(lech[0].maQuyen.length, 8);
  assert.equal(lech[1].chinh, "17 quyền ngoài mẫu của vai trò");
  assert.equal(lech[1].phu, "mẫu có 6 quyền");
  assert.equal(lech[2].chinh, "6 quyền không dùng được");
  assert.ok(lech.every((v) => !v.chinh.includes("Nhân viên kho") && !v.phu.includes("Nhân viên kho")), "không lặp tên vai trò");

  const dgKhop = danhGiaQuyen({ vaiTro: NVK, quyenIds: MAU_NVK, dsQuyen: QUYEN, mau: MAU_NVK, menu: MENU });
  assert.deepEqual(vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: dgKhop }), [], "khớp mẫu: không có khung");

  const dgThieu = danhGiaQuyen({ vaiTro: NVK, quyenIds: [1, 2, 4, 7], dsQuyen: QUYEN, mau: MAU_NVK, menu: MENU });
  const thieu = vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: dgThieu });
  assert.deepEqual(thieu.map((v) => v.ma), ["thieuMau"]);
  assert.equal(thieu[0].chinh, "Thiếu 2 quyền so với mẫu");
  assert.equal(thieu[0].phu, "Tạo phiếu xuất kho, Xem báo cáo tồn kho");
  assert.deepEqual(thieu[0].maQuyen, ["tao_phieu_xuat", "xem_bao_cao_ton_kho"]);
});

test("ma trận chứng từ: 4 chứng từ × Tạo / Duyệt / Hủy, 13 quyền còn lại thành việc khác", () => {
  const dg = danhGiaQuyen({ vaiTro: NVK, quyenIds: [5, 6, 7, 9, 1], dsQuyen: QUYEN, mau: MAU_NVK, menu: MENU });
  const { hang, viecKhac } = maTranQuyen(dg);
  assert.deepEqual(hang.map((h) => h.ten), CHUNG_TU.map((c) => c.ten));
  const muaHang = hang[0];
  assert.equal(muaHang.tao.cap, true);
  assert.equal(muaHang.duyet.cap, true);
  assert.equal(muaHang.huy, null, "đơn mua hàng không có quyền hủy");
  assert.equal(hang[1].huy.cap, true);
  assert.equal(hang[1].duyet.cap, false);
  assert.equal(hang.reduce((t, h) => t + [h.tao, h.duyet, h.huy].filter(Boolean).length, 0), 10);
  assert.deepEqual(viecKhac.map((n) => n.ten), ["Tồn kho", "Báo cáo", "Danh mục & nhân sự"]);
  assert.equal(viecKhac.reduce((t, n) => t + n.dong.length, 0), 13);
  assert.equal(viecKhac[0].dong.find((d) => d.ma === "xem_ton_kho").cap, true);

  // Quyền lạ trong nhóm nhập kho (không thuộc ô nào) vẫn hiện ở việc khác; máy chủ thiếu một mã thì ô đó là null
  const coQuyenLa = [...QUYEN.filter((q) => q.maQuyen !== "huy_phieu_xuat"), { id: 30, maQuyen: "tra_hang_ncc", tenQuyen: "Trả hàng nhà cung cấp", nhomQuyen: "nhap_kho" }];
  const m2 = maTranQuyen(danhGiaQuyen({ vaiTro: NVK, quyenIds: [30], dsQuyen: coQuyenLa, menu: MENU }));
  assert.equal(m2.hang[3].huy, null);
  assert.deepEqual(m2.viecKhac[0].dong.map((d) => d.ma), ["tra_hang_ncc"]);
  assert.equal(m2.viecKhac[0].ten, "Mua & nhập kho");
  assert.deepEqual(maTranQuyen(null), { hang: [], viecKhac: [] });
});

test("máy chủ trả danh sách quyền đã áp dụng rỗng (quét lỗi): không gắn Chưa áp dụng, Kiểm tra không ghi 'kiểm 0/23'", () => {
  const dg = danhGiaQuyen({ vaiTro: NVK, quyenIds: MAU_NVK, dsQuyen: QUYEN, mau: MAU_NVK, daApDung: [], menu: MENU });
  assert.deepEqual(dg.chuaApDung, []);
  assert.equal(dg.nhom.flatMap((n) => n.dong).some((d) => d.chuaApDung), false, "từng dòng cũng không gắn");
  const kq = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: MAU_NVK },
    { dsQuyen: QUYEN, mau: MAU_NVK, daApDung: [], menu: MENU });
  assert.equal(kq.muc.some((m) => m.tieuDe.endsWith("chưa áp dụng")), false);
  assert.equal(kq.tomTat, "Khớp mẫu Nhân viên kho");
});

test("không đọc được cấu hình (mẫu = null) khác vai trò chưa có mẫu (mẫu = [])", () => {
  const p = pq([[1, 1], [7, 1]]);
  const khongDoc = danhGiaQuyen({ vaiTro: NVK, quyenIds: [1, 7], dsQuyen: QUYEN, mau: null, menu: MENU });
  assert.equal(khongDoc.khongDocDuocMau, true);
  assert.equal(khongDoc.soMau, 0);
  assert.deepEqual(khongDoc.ngoaiMau, []);
  assert.deepEqual(khongDoc.thieuMau, []);
  assert.ok(p.kho);
  const khongDocCoCap = danhGiaQuyen({ vaiTro: NVK, quyenIds: [1, 7, 8], dsQuyen: QUYEN, mau: null, menu: MENU });
  assert.deepEqual(vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: khongDocCoCap }).map((v) => v.ma), ["taoDuyet"],
    "không đọc được mẫu: vẫn báo cặp tạo–duyệt, không kể ngoài mẫu / thiếu mẫu");

  const chuaMau = danhGiaQuyen({ vaiTro: NVK, quyenIds: [1, 7], dsQuyen: QUYEN, mau: [], menu: MENU });
  assert.equal(chuaMau.khongDocDuocMau, false);
  assert.deepEqual(vanDeCanXemLai({ vaiTro: NVK, coKho: true, danhGia: chuaMau }), [], "vai trò chưa có mẫu: không có gì để so");
  assert.equal(danhGiaQuyen({ vaiTro: NVK, quyenIds: [1], dsQuyen: QUYEN, menu: MENU }).khongDocDuocMau, false,
    "không truyền mẫu = mẫu rỗng");

  // Kiểm tra trong ngăn kéo: không so được với mẫu thì không báo xanh "Không có điểm cần xem lại"
  const kq = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: [1, 7] },
    { dsQuyen: QUYEN, mau: null, menu: MENU });
  assert.equal(kq.loai, "luuY");
  assert.equal(kq.tomTat, "Chưa so được với mẫu");
  assert.deepEqual(kq.muc.map((m) => m.tieuDe), ["Chưa so được với mẫu"]);
  assert.equal(kq.chanLuu, false, "chỉ nhắc, không chặn lưu");

  const chuaMauKt = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: [1, 7] },
    { dsQuyen: QUYEN, mau: [], menu: MENU });
  assert.equal(chuaMauKt.tomTat, "Không có điểm cần xem lại", "vai trò chưa có mẫu thì vẫn như cũ");
});

test("phân quyền hiện có: quản trị viên / vai trò lạ còn dòng kho cũ thì bỏ qua", () => {
  const p = pq([[1, 1], [7, 1]]);
  assert.equal(phanQuyenHienCo(nguoiDung(NVK, [p])).pq, p);
  assert.deepEqual(phanQuyenHienCo(nguoiDung(QTV, [p])), { pq: null, quyenIds: [] });
  assert.deepEqual(phanQuyenHienCo(nguoiDung(VAI_TRO_DA_BO, [p])), { pq: null, quyenIds: [] });
  assert.equal(banNhapTuNguoiDung(nguoiDung(QTV, [p])).khoId, null);
});

test("ngày: chuyển qua lại với ô chọn ngày, hết ngày theo giờ máy", () => {
  const iso = cuoiNgay("2026-12-31");
  const d = new Date(iso);
  assert.equal(d.getHours(), 23);
  assert.equal(d.getMinutes(), 59);
  assert.equal(sangNgayNhap(iso), "2026-12-31");
  assert.equal(cuoiNgay(""), null);
  assert.equal(cuoiNgay("31/12/2026"), null);
});

test("bản nháp và giá trị lưu: vai trò không dùng kho thì bỏ kho, quyền và hạn", () => {
  const nd = nguoiDung(NVK, [pq([[1, 1], [7, 1]], { ngayKetThuc: cuoiNgay("2026-12-31") })]);
  const nhap = banNhapTuNguoiDung(nd);
  assert.deepEqual(nhap, { vaiTro: NVK, khoId: 22, hieuLuc: "den_ngay", ngayKetThuc: "2026-12-31", quyenIds: [1, 7] });
  assert.deepEqual(giaTriHieuLuc({ ...nhap, vaiTro: QTV }), { vaiTro: QTV, khoId: null, ngayKetThuc: "", quyenIds: [] });
  assert.deepEqual(giaTriHieuLuc({ ...nhap, hieuLuc: "vo_han" }).ngayKetThuc, "");
  assert.deepEqual(giaTriHieuLuc({ ...nhap, khoId: null }).quyenIds, []);
});

test("nội dung lưu: giữ đúng giờ hết hạn cũ khi không đổi ngày", () => {
  const cu = "2026-12-31T10:00:00Z";
  const p = pq([[1, 1]], { ngayKetThuc: cu });
  const nd = nguoiDung(NVK, [p]);
  const nhap = banNhapTuNguoiDung(nd);
  assert.deepEqual(noiDungLuu(nhap, p), { vaiTro: NVK, khoId: 22, ngayKetThuc: cu, quyenHanIds: [1] });
  const doiNgay = noiDungLuu({ ...nhap, ngayKetThuc: "2027-01-15" }, p);
  assert.equal(sangNgayNhap(doiNgay.ngayKetThuc), "2027-01-15");
  assert.equal(noiDungLuu({ ...nhap, hieuLuc: "vo_han" }, p).ngayKetThuc, null);
  assert.deepEqual(noiDungLuu({ ...nhap, vaiTro: QTV }, p), { vaiTro: QTV, khoId: null, ngayKetThuc: null, quyenHanIds: [] });
});

test("so sánh: vai trò, kho, hạn, thêm/bỏ quyền theo thứ tự hiển thị; thu hồi khi sang quản trị viên", () => {
  const tenKho = (id) => ({ 22: "Kho tổng", 23: "Kho Hà Nội" })[id];
  const goc = { vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [1, 7] };
  assert.deepEqual(soSanhPhanQuyen(goc, goc, { dsQuyen: QUYEN, tenKho }), []);

  const doi = soSanhPhanQuyen(goc, { ...goc, khoId: 23, hieuLuc: "den_ngay", ngayKetThuc: "2026-12-31", quyenIds: [1, 3, 5] }, { dsQuyen: QUYEN, tenKho });
  assert.deepEqual(doi.map((d) => d.loai), ["doi", "doi", "them", "them", "bo"]);
  assert.equal(doi[0].chu, "Nơi làm việc: Kho tổng → Kho Hà Nội");
  assert.equal(doi[1].chu, "Hiệu lực: đến 31/12/2026");
  assert.deepEqual(doi.slice(2).map((d) => d.chu), ["Tạo đơn mua hàng", "Điều chỉnh tồn kho", "Tạo phiếu nhập kho"]);

  const lenQtv = soSanhPhanQuyen(goc, { ...goc, vaiTro: QTV }, { dsQuyen: QUYEN, tenKho });
  assert.deepEqual(lenQtv.map((d) => d.chu), ["Vai trò: Nhân viên kho → Quản trị viên", "Thu hồi phân quyền Kho tổng (2 quyền)"]);

  const phanLanDau = soSanhPhanQuyen({ vaiTro: NVK, khoId: null, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [] },
    { vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [1] }, { dsQuyen: QUYEN, tenKho });
  assert.deepEqual(phanLanDau.map((d) => d.chu), ["Nơi làm việc: Kho tổng", "Xem tồn kho"]);
});

test("kiểm tra trước khi lưu", () => {
  const ctx = { dsQuyen: QUYEN, mau: MAU_NVK, daApDung: null, menu: MENU };
  const chuaKho = kiemTraBanNhap({ vaiTro: NVK, khoId: null, hieuLuc: "vo_han", quyenIds: [] }, ctx);
  assert.equal(chuaKho.loai, "canhBao");
  assert.equal(chuaKho.muc[0].tieuDe, "Chưa chọn nơi làm việc");
  assert.equal(chuaKho.chanLuu, false);

  const khop = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: MAU_NVK }, ctx);
  assert.equal(khop.loai, "on");
  assert.equal(khop.tomTat, "Khớp mẫu Nhân viên kho");

  const lech = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: TAT_CA }, ctx);
  assert.equal(lech.soCanhBao, 1);
  assert.equal(lech.tomTat, "Vừa tạo vừa duyệt 4 loại chứng từ · thêm 2 điểm", "nói thẳng vấn đề nặng nhất");
  assert.deepEqual(lech.muc.filter((m) => m.loai === "luuY").map((m) => m.tieuDe), ["6 quyền không dùng được", "17 quyền ngoài mẫu Nhân viên kho"]);
  assert.equal(lech.muc[0].tieuDe, "Vừa tạo vừa duyệt 4 loại chứng từ");

  const thieuNgay = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "den_ngay", ngayKetThuc: "", quyenIds: MAU_NVK }, ctx);
  assert.equal(thieuNgay.chanLuu, true);

  // Gõ tay ngày đã qua (bộ chọn ngày chỉ chặn bằng min)
  const ngayCu = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "den_ngay", ngayKetThuc: "2020-01-01", quyenIds: MAU_NVK },
    { ...ctx, homNay: "2026-10-18" });
  assert.equal(ngayCu.chanLuu, true);
  assert.equal(ngayCu.muc[0].tieuDe, "Ngày hết hiệu lực đã qua");
  const homNay = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "den_ngay", ngayKetThuc: "2026-10-18", quyenIds: MAU_NVK },
    { ...ctx, homNay: "2026-10-18" });
  assert.equal(homNay.chanLuu, false, "hết hạn cuối hôm nay vẫn hợp lệ");

  const chuaApDung = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: MAU_NVK },
    { ...ctx, daApDung: ["tao_phieu_nhap", "tao_phieu_xuat", "chuyen_kho"] });
  const muc = chuaApDung.muc.find((m) => m.tieuDe.endsWith("chưa áp dụng"));
  assert.equal(muc.tieuDe, "3 quyền chưa áp dụng");
  assert.match(muc.moTa, /kiểm 3\/23 quyền/);
  assert.equal(muc.phu, true, "việc của hệ thống: chỉ liệt kê, không tính vào tóm tắt");
  assert.equal(chuaApDung.tomTat, "Khớp mẫu Nhân viên kho");

  assert.equal(kiemTraBanNhap({ vaiTro: QTV }, ctx).tomTat, "Không cần quyền theo kho");
});

test("kiểm tra trước khi lưu: vai trò lạ (dữ liệu cũ) phải chọn lại vai trò, chặn lưu", () => {
  const ctx = { dsQuyen: QUYEN, mau: MAU_NVK, nhayCam: NHAY_CAM, menu: MENU };
  for (const vaiTro of [VAI_TRO_DA_BO, "", undefined]) {
    const kq = kiemTraBanNhap({ vaiTro, khoId: 22, hieuLuc: "vo_han", quyenIds: [1] }, ctx);
    assert.equal(kq.chanLuu, true, String(vaiTro));
    assert.equal(kq.loai, "canhBao");
    assert.equal(kq.tomTat, "Chưa chọn vai trò");
    assert.deepEqual(kq.muc.map((m) => m.tieuDe), ["Chưa chọn vai trò"], "không đánh giá kho và quyền");
  }
  const qtv = kiemTraBanNhap({ vaiTro: QTV, khoId: 22, quyenIds: [1] }, ctx);
  assert.equal(qtv.chanLuu, false);
  assert.equal(qtv.loai, "on");
  assert.equal(qtv.muc[0].moTa, "Quản trị viên có toàn quyền ở mọi kho.");
  // Chọn lại một vai trò nhân sự thì kiểm như thường
  assert.equal(kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: MAU_NVK }, ctx).chanLuu, false);
});

test("kiểm tra trước khi lưu: quyền nhạy cảm trong mẫu chỉ liệt kê, vẫn tóm tắt Khớp mẫu", () => {
  const ctx = { dsQuyen: QUYEN, mau: [1, 2, 3, 4, 7], nhayCam: NHAY_CAM, daApDung: null, menu: MENU };
  const kq = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: [1, 2, 3, 4, 7] }, ctx);
  assert.deepEqual(kq.muc.map((m) => m.loai), ["on", "luuY"]);
  assert.equal(kq.muc[0].tieuDe, "Khớp mẫu Nhân viên kho");
  assert.equal(kq.muc[1].tieuDe, "1 quyền nhạy cảm");
  assert.equal(kq.muc[1].moTa, "Điều chỉnh tồn kho.");
  assert.equal(kq.muc[1].phu, true);
  assert.equal(kq.soLuuY, 0);
  assert.equal(kq.loai, "on", "vai trò đúng mẫu (vd. quản lý kho có nhiều quyền nhạy cảm trong mẫu) vẫn xanh");
  assert.equal(kq.tomTat, "Khớp mẫu Nhân viên kho");
  assert.equal(kq.chanLuu, false);

  const khongNhay = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: MAU_NVK }, { ...ctx, mau: MAU_NVK });
  assert.equal(khongNhay.loai, "on");
  assert.equal(khongNhay.muc.length, 1);
});

test("kiểm tra trước khi lưu: quyền nhạy cảm ngoài mẫu tính vào lưu ý", () => {
  const ctx = { dsQuyen: QUYEN, mau: MAU_NVK, nhayCam: NHAY_CAM, daApDung: null, menu: MENU };
  // Mẫu nhân viên kho + Điều chỉnh tồn kho (nhạy cảm, ngoài mẫu)
  const kq = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: [...MAU_NVK, 3] }, ctx);
  const nhay = kq.muc.find((m) => m.tieuDe === "1 quyền nhạy cảm");
  assert.equal(nhay.phu, undefined);
  assert.equal(kq.soLuuY, 2, "vượt mẫu + quyền nhạy cảm");
  assert.equal(kq.tomTat, "1 quyền ngoài mẫu Nhân viên kho · 1 quyền nhạy cảm");

  // Vai trò chưa có mẫu: không gọi là "trong mẫu" được, quyền nhạy cảm tính vào lưu ý
  const khongMau = kiemTraBanNhap({ vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", quyenIds: [1, 3] }, { ...ctx, mau: [] });
  assert.equal(khongMau.muc.find((m) => m.tieuDe === "1 quyền nhạy cảm").phu, undefined);
  assert.equal(khongMau.muc.some((m) => m.loai === "on"), false, "không vừa báo lưu ý vừa ghi 'Không có điểm cần xem lại'");
  assert.equal(khongMau.loai, "luuY");
  assert.equal(khongMau.tomTat, "1 quyền nhạy cảm");
});

test("quyền nhạy cảm cấp thêm ở lần lưu này", () => {
  const goc = { vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [1, 8] };
  const ctx = { dsQuyen: QUYEN, nhayCam: NHAY_CAM };
  // 8 đã có từ trước: không nhắc lại; 20 và 3 mới, theo thứ tự hiển thị (Tồn kho trước Danh mục & nhân sự)
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, quyenIds: [1, 3, 8, 20, 21] }, ctx), ["Điều chỉnh tồn kho", "Cấp quyền nhân viên"]);
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, quyenIds: [1] }, ctx), []);
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, vaiTro: QTV, quyenIds: [3] }, ctx), [], "quản trị viên không cấp quyền kho");
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, quyenIds: [3] }, { dsQuyen: QUYEN }), [], "không có danh sách nhạy cảm");
});

test("quyền nhạy cảm cấp thêm: đổi kho, đổi vai trò làm quyền có tác dụng, quyền lạ", () => {
  const ctx = { dsQuyen: QUYEN, nhayCam: NHAY_CAM, menu: MENU };
  const goc = { vaiTro: NVK, khoId: 22, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [1, 3] };
  // Đổi sang kho khác: quyền ở kho mới là cấp mới
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, khoId: 23 }, ctx), ["Điều chỉnh tồn kho"]);
  // Từ chưa có kho sang có kho
  assert.deepEqual(quyenNhayCamCapThem({ ...goc, khoId: null, quyenIds: [] }, goc, ctx), ["Điều chỉnh tồn kho"]);

  // Cấp quyền nhân viên không có tác dụng với nhân viên bán hàng (không mở được màn Kho); lên quản lý kho thì có
  const banHang = { vaiTro: NVB, khoId: 22, hieuLuc: "vo_han", ngayKetThuc: "", quyenIds: [10, 20] };
  assert.deepEqual(quyenNhayCamCapThem(banHang, { ...banHang, vaiTro: QLK }, ctx), ["Cấp quyền nhân viên"]);
  assert.deepEqual(quyenNhayCamCapThem(banHang, { ...banHang, vaiTro: QLK }, { ...ctx, menu: [] }), [],
    "không có menu thì không xét tác dụng");

  // Quyền vốn đã có, vẫn không có tác dụng với cả vai trò cũ lẫn mới: không nhắc (không có gì mới được cấp)
  assert.deepEqual(quyenNhayCamCapThem(banHang, banHang, ctx), [], "không đổi gì");
  assert.deepEqual(quyenNhayCamCapThem(banHang, { ...banHang, hieuLuc: "den_ngay", ngayKetThuc: "2026-12-31" }, ctx), [],
    "chỉ đổi hạn hiệu lực");
  assert.deepEqual(quyenNhayCamCapThem(banHang, { ...banHang, vaiTro: NVM }, ctx), [], "sang mua hàng vẫn không mở được màn Kho");

  // Quyền nhạy cảm không có trong danh sách quyền: vẫn nhắc, tên dự phòng như hộp so sánh
  assert.deepEqual(quyenNhayCamCapThem(goc, { ...goc, quyenIds: [1, 3, 99] }, { ...ctx, nhayCam: [...NHAY_CAM, 99] }), ["Quyền 99"]);
});

test("diễn giải lịch sử: bản ghi mới và bản ghi cũ", () => {
  const khoTong = { id: 22, maKho: "KHO_TONG", tenKho: "Kho tổng" };
  const khoHn = { id: 23, maKho: "KHO_HN", tenKho: "Kho Hà Nội" };

  const phan = dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: NVK, khoCu: null, khoMoi: khoTong, quyenThem: ["Xem tồn kho", "Chuyển kho"], quyenBo: [] });
  assert.equal(phan.viec, "phân Kho tổng (KHO_TONG), không thời hạn, cấp 2 quyền");

  const them = dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: NVK, khoCu: khoTong, khoMoi: khoTong,
    quyenThem: ["Duyệt đơn mua hàng", "Duyệt phiếu nhập kho", "Cấp quyền nhân viên", "Xuất báo cáo"], quyenBo: ["Chuyển kho"] });
  assert.equal(them.viec, "cấp thêm 4 quyền, thu hồi 1 quyền tại Kho tổng");
  assert.deepEqual(them.the.map((t) => t.chu), ["− Chuyển kho", "+ Duyệt đơn mua hàng", "+ Duyệt phiếu nhập kho", "và 2 thay đổi khác"]);

  assert.equal(dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: NVB, khoCu: null, khoMoi: null }).viec, "đổi vai trò Nhân viên kho → Nhân viên bán hàng");
  assert.equal(dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: NVK, khoCu: khoTong, khoMoi: khoHn, quyenThem: ["Xem tồn kho"] }).viec, "chuyển Kho tổng → Kho Hà Nội, cấp 1 quyền");

  const thuHoi = dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: QTV, khoCu: khoTong, khoMoi: null, quyenBo: ["Xem tồn kho", "Chuyển kho"] });
  assert.equal(thuHoi.viec, "đổi vai trò Nhân viên kho → Quản trị viên, thu hồi phân quyền Kho tổng (2 quyền)");
  assert.deepEqual(thuHoi.the, []);

  const han = dienGiaiLichSu({ vaiTroCu: NVK, vaiTroMoi: NVK, khoCu: khoTong, khoMoi: khoTong, doiHieuLuc: true, ngayKetThucMoi: cuoiNgay("2026-12-31") });
  assert.equal(han.viec, "đặt hiệu lực đến 31/12/2026");

  const cu = dienGiaiLichSu({ khoCu: khoTong, khoMoi: khoTong, quyenThem: ["Xem tồn kho"], quyenBo: [] });
  assert.equal(cu.viec, "cấp thêm 1 quyền tại Kho tổng");
  assert.equal(dienGiaiLichSu({ khoCu: khoTong, khoMoi: khoTong, quyenThem: [], quyenBo: [] }).viec, "cập nhật phân quyền");
});

test("quyền của tôi: nhóm việc, quyền mới, quyền vừa thu hồi", () => {
  const q = quyenCuaToiTheoNhom({
    quyen: [1, 2, 3, 7, 12, 15].map((id) => QUYEN[id - 1]),
    quyenMoi: ["dieu_chinh_ton_kho"],
    quyenDaThuHoi: ["Chuyển kho"],
  });
  assert.equal(q.soViec, 6);
  assert.deepEqual(q.nhom.map((n) => n.ten), ["Mua & nhập kho", "Tồn kho", "Bán & xuất kho", "Báo cáo"]);
  assert.deepEqual(q.nhom.map((n) => n.bieuTuong), ["nhap", "ton", "xuat", "bao_cao"]);
  const dieuChinh = q.nhom[1].viec.find((v) => v.ma === "dieu_chinh_ton_kho");
  assert.equal(dieuChinh.moi, true);
  assert.equal(dieuChinh.moTa, "Sửa số lượng tồn khi kiểm kê thấy lệch");
  assert.deepEqual(q.daThuHoi, ["Chuyển kho"]);
  assert.deepEqual(quyenCuaToiTheoNhom(null), { nhom: [], soViec: 0, soDaCap: 0, khongDungDuoc: [], daThuHoi: [] });
});

test("quyền của tôi: Danh mục & nhân sự tách thành Sản phẩm, Đối tác, Nhân sự kho", () => {
  const nhom = nhomHoSo([23, 19, 21, 22, 20, 1].map((id) => QUYEN[id - 1]));
  assert.deepEqual(nhom.map((n) => n.ten), ["Tồn kho", "Sản phẩm", "Đối tác", "Nhân sự kho"]);
  assert.deepEqual(nhom[2].quyen.map((q) => q.maQuyen), ["quan_ly_nha_cung_cap", "quan_ly_khach_hang"]);
  assert.deepEqual(nhom[3].quyen.map((q) => q.maQuyen), ["quan_ly_nhan_vien_kho", "cap_quyen_nhan_vien"]);
  // Quyền mới trong CSDL: nhóm luồng theo nhom_quyen, nhóm danh mục hay nhóm lạ thì vào "Khác"
  const la = nhomHoSo([
    { id: 30, maQuyen: "kiem_ke", tenQuyen: "Kiểm kê", nhomQuyen: "quan_ly_kho" },
    { id: 31, maQuyen: "quan_ly_thuong_hieu", tenQuyen: "Quản lý thương hiệu", nhomQuyen: "cai_dat" },
    { id: 32, maQuyen: "la", tenQuyen: "Lạ", nhomQuyen: "nhom_la" },
  ]);
  assert.deepEqual(la.map((n) => [n.ten, n.quyen.map((q) => q.id)]), [["Tồn kho", [30]], ["Khác", [31, 32]]]);
  assert.deepEqual(nhomHoSo(null), []);
});

test("quyền của tôi: mẫu quyền mặc định của 4 vai trò nhân viên ra đúng các cột đã chốt", () => {
  const cot = (vaiTro, ids) => quyenCuaToiTheoNhom({ vaiTro, quyen: ids.map((id) => QUYEN[id - 1]) }, { menu: MENU });
  const nvk = cot(NVK, [1, 2, 4, 7, 12, 15]);
  assert.equal(nvk.soViec, 6);
  assert.deepEqual(nvk.nhom.map((n) => n.ten), ["Mua & nhập kho", "Tồn kho", "Bán & xuất kho", "Báo cáo"]);
  const qlk = cot(QLK, [1, 2, 3, 4, 8, 9, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.equal(qlk.soViec, 14);
  assert.deepEqual(qlk.nhom.map((n) => n.ten), ["Mua & nhập kho", "Tồn kho", "Bán & xuất kho", "Báo cáo", "Nhân sự kho"]);
  const nvb = cot(NVB, [1, 10, 15, 23]);
  assert.equal(nvb.soViec, 4);
  assert.deepEqual(nvb.nhom.map((n) => n.ten), ["Tồn kho", "Bán & xuất kho", "Báo cáo", "Đối tác"]);
  const nvm = cot(NVM, [1, 5, 15, 22]);
  assert.equal(nvm.soViec, 4);
  assert.deepEqual(nvm.nhom.map((n) => n.ten), ["Mua & nhập kho", "Tồn kho", "Báo cáo", "Đối tác"]);
});

test("quyền của tôi: quyền hệ thống chưa kiểm vẫn liệt kê (chưa kiểm = không bị chặn)", () => {
  const goc = { vaiTro: NVK, quyen: [1, 7, 8, 12].map((id) => QUYEN[id - 1]) };
  const apDung = quyenCuaToiTheoNhom({ ...goc, quyenDaApDung: ["tao_phieu_nhap", "duyet_phieu_nhap"] }, { menu: MENU });
  assert.equal(apDung.soViec, 4);
  assert.deepEqual(apDung.khongDungDuoc, []);

  // Lỗi review 18/10: nhân viên bán hàng được cấp đủ mẫu (không quyền nào có API kiểm) từng thấy "chưa được cấp việc nào"
  const banHang = quyenCuaToiTheoNhom(
    { vaiTro: NVB, quyen: [1, 10, 15, 23].map((id) => QUYEN[id - 1]), quyenDaApDung: ["cap_quyen_nhan_vien"] },
    { menu: MENU },
  );
  assert.equal(banHang.soViec, 4);
  assert.deepEqual(banHang.nhom.map((n) => n.ten), ["Tồn kho", "Bán & xuất kho", "Báo cáo", "Đối tác"]);
});

test("quyền của tôi: quyền vai trò không mở được màn tách sang khongDungDuoc", () => {
  // Nhân viên bán hàng không có màn Phiếu nhập kho, Kho
  const banHang = quyenCuaToiTheoNhom({ vaiTro: NVB, quyen: [20, 7, 10].map((id) => QUYEN[id - 1]) }, { menu: MENU });
  assert.equal(quyenCoTacDung("tao_phieu_nhap", NVB, MENU), false);
  assert.equal(banHang.nhom.flatMap((n) => n.viec).some((v) => v.ma === "tao_phieu_nhap"), false);
  assert.equal(banHang.soViec, 1);
  assert.equal(banHang.soDaCap, 3);
  assert.deepEqual(banHang.khongDungDuoc, ["Tạo phiếu nhập kho", "Cấp quyền nhân viên"], "theo thứ tự nhóm của Hồ sơ");

  const khongViecNao = quyenCuaToiTheoNhom({ vaiTro: NVB, quyen: [7].map((id) => QUYEN[id - 1]) }, { menu: MENU });
  assert.equal(khongViecNao.soViec, 0);
  assert.equal(khongViecNao.soDaCap, 1);
});

test("hiệu lực của tôi: không thời hạn, còn xa, sắp hết (≤ 7 ngày), đã hết", () => {
  const now = new Date("2026-10-18T10:00:00Z");
  assert.deepEqual(hieuLucCuaToi(null, { now }), { moTa: "không thời hạn", denNgay: "", conNgay: null, sapHet: false });
  const xa = hieuLucCuaToi("2026-12-31T16:59:59Z", { now });
  assert.equal(xa.sapHet, false);
  assert.match(xa.moTa, /^đến \d{2}\/\d{2}\/2026$/);
  const gan = hieuLucCuaToi("2026-10-25T09:00:00Z", { now });
  assert.equal(gan.conNgay, 7, "6 ngày 23 giờ làm tròn lên 7");
  assert.equal(gan.sapHet, true);
  assert.equal(gan.moTa, `hết hiệu lực ${gan.denNgay}`);
  assert.equal(hieuLucCuaToi("2026-10-25T11:00:00Z", { now }).sapHet, false, "còn hơn 7 ngày");
  assert.equal(hieuLucCuaToi("2026-10-18T09:00:00Z", { now }).sapHet, false, "đã hết hạn thì không nhắc gia hạn");
  assert.equal(hieuLucCuaToi("2026-10-21T10:00:00Z", { now, soNgayNhac: 2 }).sapHet, false, "mốc nhắc truyền vào");
});

test("gợi ý đầu Hồ sơ: đúng thứ tự ưu tiên, mỗi lần một cái", () => {
  const now = new Date("2026-10-18T10:00:00Z");
  const hoSo = { soDienThoai: "0912345678", mustChangePassword: false };
  const quyen = { vaiTro: NVK, kho: { tenKho: "Kho tổng" }, ngayKetThuc: "2026-10-22T10:00:00Z", canDangNhapLai: true };
  assert.equal(goiYHoSo({ hoSo: { ...hoSo, mustChangePassword: true, soDienThoai: "" }, quyen, now }), "mat_khau_tam");
  assert.equal(goiYHoSo({ hoSo: { ...hoSo, soDienThoai: "" }, quyen, now }), "quyen_vua_doi");
  assert.equal(goiYHoSo({ hoSo: { ...hoSo, soDienThoai: "" }, quyen: { ...quyen, canDangNhapLai: false }, now }), "sap_het_hieu_luc");
  assert.equal(goiYHoSo({ hoSo: { ...hoSo, soDienThoai: " " }, quyen: { ...quyen, canDangNhapLai: false, ngayKetThuc: null }, now }), "chua_co_sdt");
  assert.equal(goiYHoSo({ hoSo, quyen: { ...quyen, canDangNhapLai: false, ngayKetThuc: null }, now }), null);
  assert.equal(goiYHoSo({ hoSo, quyen: { toanQuyen: true, vaiTro: QTV }, now }), null, "quản trị viên không có hiệu lực theo kho");
  assert.equal(goiYHoSo({ hoSo, quyen: null, now }), null, "chưa tải được quyền thì chỉ xét hồ sơ");
  assert.equal(goiYHoSo({ hoSo: null }), null);
});

test("kho ở dòng phụ dưới tên Hồ sơ", () => {
  assert.equal(khoCuaToiNgan({ vaiTro: QTV }), "Mọi kho");
  assert.equal(khoCuaToiNgan({ vaiTro: NVB, quyen: { kho: { tenKho: "Kho Hà Nội", maKho: "KHO_HN" } } }), "Kho Hà Nội");
  assert.equal(khoCuaToiNgan({ vaiTro: NVK, quyen: { kho: null } }), "Chưa có kho");
  assert.equal(khoCuaToiNgan({ vaiTro: NVK, quyen: undefined, khoTuHoSo: { maKho: "KHO_TONG" } }), "KHO_TONG");
  assert.equal(khoCuaToiNgan({ vaiTro: NVK }), "", "chưa tải xong quyền thì chưa kết luận");
});

test("liên kết liên hệ quản trị viên: có tiêu đề thư, không có email thì rỗng", () => {
  assert.equal(mailtoLienHe(" lienhe@fcentric.net ", "Đề nghị phân kho"), "mailto:lienhe@fcentric.net?subject=%C4%90%E1%BB%81%20ngh%E1%BB%8B%20ph%C3%A2n%20kho");
  assert.equal(mailtoLienHe("lienhe@fcentric.net"), "mailto:lienhe@fcentric.net");
  assert.equal(mailtoLienHe("", "x"), "");
  assert.equal(mailtoLienHe(null), "");
});

test("cột Tài khoản chỉ có dòng Tên đăng nhập khi họ tên khác tên đăng nhập", () => {
  assert.equal(hienTenDangNhapRieng({ tenDangNhap: "nvan", hoTen: "Nguyễn Văn An" }), true);
  assert.equal(hienTenDangNhapRieng({ tenDangNhap: "nvan", hoTen: null }), false, "họ tên trống: tiêu đề đã là tên đăng nhập");
  assert.equal(hienTenDangNhapRieng({ tenDangNhap: "nvan", hoTen: "  " }), false);
  assert.equal(hienTenDangNhapRieng({ tenDangNhap: "nvan", hoTen: "nvan" }), false, "trùng tên đăng nhập");
  assert.equal(hienTenDangNhapRieng({ tenDangNhap: "", hoTen: "An" }), false);
});
