// Chạy: node --test src/components/kiem-ke/tinhKiemKe.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BO_LOC_KIEM_KE,
  buocKiemKe,
  chuKetQuaTim,
  csvSoDem,
  demKiemKe,
  docSoDem,
  gioDem,
  gioMuonNhatTheoLo,
  dongHienThi,
  dongKiemKe,
  laDotDaDong,
  lechGioMayChu,
  locMacDinh,
  loXenGiua,
  luaChonLoc,
  lyDoKhoaHoanThanh,
  msCua,
  soDemBiBo,
  thongBaoKiemKe,
  timLo,
  tinhDong,
  tomTatHoanThanh,
} from "./tinhKiemKe.js";
import {
  demBanTamNguoiKhac,
  docBanTam,
  docDemMu,
  donBanTam,
  ghiBanTam,
  ghiDemMu,
  khoaBanTam,
  khoiPhucSoDem,
  xoaBanTam,
} from "./banTamKiemKe.js";

const ct = (id, maLo, sku, ht, extra = {}) => ({
  id,
  loHang: { id: id * 10, maLo },
  bienTheSanPham: { id: sku.length, tenBienThe: `Áo ${sku} - Đen / M`, maSku: sku },
  soLuongHeThong: `${ht}.00`,
  soLuongThucTe: "0.00",
  chenhLechSoLuong: null,
  loaiChenhLech: null,
  ...extra,
});

const CHI_TIET = [
  ct(1, "L001", "AT-1", 10),
  ct(2, "L002", "AT-1", 5),
  ct(3, "L003", "QJ-22", 0),
  ct(4, "L004", "QJ-22", 7),
];
const DONG = dongKiemKe(CHI_TIET);

test("dongKiemKe đọc số của máy chủ, giữ tên nguyên", () => {
  assert.equal(DONG.length, 4);
  assert.equal(DONG[0].heThong, 10);
  assert.equal(DONG[0].tenSanPham, "Áo AT-1 - Đen / M");
  assert.equal(DONG[0].loHangId, 10);
  assert.equal(DONG[0].loaiMayChu, null);
  const daXong = dongKiemKe([ct(9, "L9", "X", 4, { soLuongThucTe: "6.00", chenhLechSoLuong: "2.00", loaiChenhLech: "thua" })]);
  assert.equal(daXong[0].thucTeMayChu, 6);
  assert.equal(daXong[0].chenhLechMayChu, 2);
});

test("tinhDong + demKiemKe khi đang đếm", () => {
  const rows = tinhDong(DONG, { soDem: { 1: { so: 10, luc: 1 }, 2: { so: 3, luc: 1 }, 3: { so: 2, luc: 1 } } });
  assert.deepEqual(rows.map((d) => d.loai), ["khop", "thieu", "thua", "chua"]);
  const dem = demKiemKe(rows);
  assert.equal(dem.daDem, 3);
  assert.equal(dem.chua, 1);
  assert.equal(dem.spThieu, 2);
  assert.equal(dem.spThua, 2);
  assert.equal(dem.lech, 2);
  assert.equal(dem.soBienThe, 2);
  assert.equal(dem.phanTram, 75);
});

test("đợt đã xong: dòng loaiChenhLech null là Không đếm; đóng đợt khi mọi dòng null", () => {
  const rows = tinhDong(DONG, { daXong: true });
  assert.ok(rows.every((d) => d.loai === "khongDem"));
  const dem = demKiemKe(rows);
  assert.equal(laDotDaDong(true, dem), true);
  assert.equal(locMacDinh({ daXong: true, dem }), "tatCa");
  const mot = dongKiemKe([ct(1, "L1", "A", 4, { soLuongThucTe: "3.00", chenhLechSoLuong: "-1.00", loaiChenhLech: "thieu" }), ct(2, "L2", "A", 2)]);
  const dem2 = demKiemKe(tinhDong(mot, { daXong: true }));
  assert.equal(laDotDaDong(true, dem2), false);
  assert.equal(dem2.khongDem, 1);
  assert.equal(locMacDinh({ daXong: true, dem: dem2 }), "lech");
  assert.equal(locMacDinh({ daXong: false, dem: dem2 }), "chua");
});

test("luaChonLoc theo tình huống", () => {
  const dem = { tong: 4, chua: 1, daDem: 3, lech: 2, khop: 1, thua: 1, thieu: 1, khongDem: 0, xen: 1 };
  assert.deepEqual(luaChonLoc({ daXong: false, mu: false, dem }).map((x) => x.value), ["chua", "lech", "khop", "xen", "tatCa"]);
  assert.deepEqual(luaChonLoc({ daXong: false, mu: true, dem }).map((x) => x.value), ["chua", "da", "xen", "tatCa"]);
  assert.deepEqual(luaChonLoc({ daXong: true, mu: false, dem: { ...dem, xen: 0 } }).map((x) => x.value), ["lech", "thua", "thieu", "khop", "tatCa"]);
  assert.ok(luaChonLoc({ daXong: true, dem: { ...dem, khongDem: 2 } }).some((x) => x.value === "khongDem"));
  // Đang xem "Cần đếm lại" mà vừa đếm lại hết: vẫn giữ lựa chọn
  assert.ok(luaChonLoc({ daXong: false, mu: false, dem: { ...dem, xen: 0 }, giuXen: true }).some((x) => x.value === "xen"));
  assert.ok(!luaChonLoc({ daXong: false, mu: false, dem: { ...dem, xen: 0 } }).some((x) => x.value === "xen"));
});

test("timLo ưu tiên đúng mã lô, báo SKU nhiều lô, tìm bỏ qua bộ lọc", () => {
  const rows = tinhDong(DONG, { soDem: { 1: { so: 10 } } });
  const lo = timLo(rows, " l002 ");
  assert.equal(lo.kieu, "lo");
  assert.equal(lo.ds.length, 1);
  assert.equal(chuKetQuaTim(lo), "Đúng mã lô · nhập số đếm ở dòng tô xanh");
  const sku = timLo(rows, "AT-1");
  assert.equal(sku.kieu, "sku");
  assert.match(chuKetQuaTim(sku), /SKU này có 2 lô/);
  assert.equal(timLo(rows, "qj").kieu, "tim");
  assert.equal(timLo(rows, ""), null);
  // Có từ khóa thì tìm cả lô đã đếm dù đang lọc "Chưa đếm"
  assert.equal(dongHienThi(rows, { tuKhoa: "L001", loc: "chua" }).length, 1);
  assert.equal(dongHienThi(rows, { loc: "chua" }).length, 3);
  // Dòng vừa đếm giữ lại trong bộ lọc
  assert.equal(dongHienThi(rows, { loc: "chua", giuLai: new Set([1]) }).length, 4);
  assert.equal(BO_LOC_KIEM_KE.tatCa, null);
});

test("docSoDem chỉ nhận số nguyên, cắt theo tối đa", () => {
  assert.equal(docSoDem("", 999999), null);
  assert.equal(docSoDem("12a3", 999999), 123);
  assert.equal(docSoDem("1234567", 999999), 123456);
  assert.equal(docSoDem("-5", 999999), 5);
  assert.equal(docSoDem("0", 999999), 0);
});

test("loXenGiua: giao dịch của lô ở kho của đợt sau lúc đếm", () => {
  const luc = Date.parse("2026-10-21T03:00:00Z");
  const rows = tinhDong(DONG, { soDem: { 1: { so: 10, luc }, 2: { so: 5, luc }, 3: { so: 0, luc: null } } });
  const lichSu = [
    { khoId: 1, maLo: "L001", ngayGiaoDich: "2026-10-21T03:30:00Z" }, // sau → xen
    { khoId: 1, maLo: "L002", ngayGiaoDich: "2026-10-21T02:00:00Z" }, // trước → không
    { khoId: 2, maLo: "L002", ngayGiaoDich: "2026-10-21T04:00:00Z" }, // kho khác → không
    { khoId: 1, maLo: "L003", ngayGiaoDich: "2026-10-21T04:00:00Z" }, // dòng không có giờ đếm → không xét
    { khoId: 1, maLo: "L004", ngayGiaoDich: "2026-10-21T04:00:00Z" }, // chưa đếm → không
    { khoId: 1, maLo: "L001", ngayGiaoDich: "bad" },
  ];
  const xen = loXenGiua(lichSu, { khoId: 1, rows, dungSai: 0 });
  assert.deepEqual([...xen], [1]);
  // Dung sai: giao dịch 1 phút trước lúc đếm vẫn tính là có thể sau
  const gan = [{ khoId: 1, maLo: "L002", ngayGiaoDich: "2026-10-21T02:59:00Z" }];
  assert.deepEqual([...loXenGiua(gan, { khoId: 1, rows, dungSai: 120000 })], [2]);
  // Bỏ giao dịch điều chỉnh của chính đợt
  const tuDot = [{ khoId: 1, maLo: "L001", ngayGiaoDich: "2026-10-21T05:00:00Z", loaiThamChieu: "kiem_ke", idThamChieu: 7 }];
  assert.equal(loXenGiua(tuDot, { khoId: 1, dotId: 7, rows, dungSai: 0 }).size, 0);
  // Đếm lại sau khi thấy cờ: giờ đếm không sớm hơn giao dịch đã biết + dung sai → hết cờ
  const muonNhat = gioMuonNhatTheoLo(lichSu, { khoId: 1 });
  assert.equal(muonNhat.get("l001|*"), Date.parse("2026-10-21T03:30:00Z"));
  const lucMoi = gioDem({ bayGio: Date.parse("2026-10-21T03:31:00Z"), maLo: "L001", muonNhat, dungSai: 120000 });
  assert.equal(lucMoi, Date.parse("2026-10-21T03:32:00Z") + 1);
  const rowsMoi = tinhDong(DONG, { soDem: { 1: { so: 9, luc: lucMoi } } });
  assert.equal(loXenGiua(lichSu, { khoId: 1, rows: rowsMoi, dungSai: 120000 }).size, 0);
  assert.equal(gioDem({ bayGio: 1000, lech: 500, maLo: "Lx", muonNhat }), 1500);
  // Cùng mã lô ở hai biến thể: chỉ biến thể có giao dịch (theo SKU) bị gắn cờ
  const haiBt = tinhDong(dongKiemKe([ct(21, "LO1", "SKU-A", 5), ct(22, "LO1", "SKU-B", 5)]), {
    soDem: { 21: { so: 5, luc }, 22: { so: 5, luc } },
  });
  const lsB = [{ khoId: 1, maLo: "LO1", maSku: "SKU-B", ngayGiaoDich: "2026-10-21T03:30:00Z" }];
  assert.deepEqual([...loXenGiua(lsB, { khoId: 1, rows: haiBt, dungSai: 0 })], [22]);
  assert.equal(chuKetQuaTim(timLo(haiBt, "lo1")), "Mã lô này có ở 2 sản phẩm · nhập số ở đúng dòng sản phẩm");
  assert.equal(msCua(1761015600), 1761015600000);
  assert.equal(lechGioMayChu("Tue, 21 Oct 2026 03:00:10 GMT", luc), 10000);
  assert.equal(lechGioMayChu(undefined, luc), 0);
});

test("tomTatHoanThanh chỉ gửi lô đã đếm, bỏ lô xen giữa", () => {
  const soDem = { 1: { so: 12, luc: 1 }, 2: { so: 1, luc: 1 }, 3: { so: 0, luc: 1 } };
  const rows = tinhDong(DONG, { soDem, xen: new Set([2]) });
  const tt = tomTatHoanThanh(rows);
  assert.equal(tt.soGui, 2);
  assert.equal(tt.daDem, 3);
  assert.equal(tt.chua, 1);
  assert.equal(tt.xen, 1);
  assert.deepEqual(tt.duLieu, [{ chiTietId: 1, soLuongThucTe: 12 }, { chiTietId: 3, soLuongThucTe: 0 }]);
  assert.equal(tt.thua, 1);
  assert.equal(tt.spThua, 2);
  assert.equal(tt.thieu, 0);
  assert.equal(tt.top.length, 1);
  assert.equal(lyDoKhoaHoanThanh(tt), "");
  assert.match(lyDoKhoaHoanThanh(tomTatHoanThanh(tinhDong(DONG, {})), { dongDuoc: true }), /Đóng đợt, không đổi tồn/);
  assert.equal(lyDoKhoaHoanThanh(tomTatHoanThanh(tinhDong(DONG, {}))), "Chưa đếm lô nào");
  const chiXen = tomTatHoanThanh(tinhDong(DONG, { soDem: { 2: { so: 1 } }, xen: new Set([2]) }));
  assert.match(lyDoKhoaHoanThanh(chiXen), /cần đếm lại/);
});

test("buocKiemKe và thông báo", () => {
  const dot = { kho: { id: 1, tenKho: "Kho tổng" }, ngayBatDau: "2026-10-21T01:30:00Z", ngayHoanThanh: "2026-10-21T05:00:00Z" };
  const dem = { daDem: 3, tong: 4 };
  const dang = buocKiemKe({ dot, dem, daXong: false, daDong: false });
  assert.deepEqual(dang.map((b) => b.trangThai), ["xong", "dangLam", "chua"]);
  assert.equal(dang[1].phu, "3/4 lô");
  assert.equal(buocKiemKe({ dot, dem, daXong: true, daDong: true })[2].nhan, "Đã đóng đợt");
  assert.equal(buocKiemKe({ dot, dem, daXong: false, daDong: false, chiXem: true })[1].phu, "4 lô");
  assert.deepEqual(thongBaoKiemKe({ dot, daXong: false, daGuiXong: true, dem: {} }).map((x) => x.ma), ["daGuiXong"]);
  const tb = thongBaoKiemKe({ dot, daXong: false, dem: { xen: 2 }, khoiPhuc: { soDong: 3, luc: null }, mu: true });
  assert.deepEqual(tb.map((x) => x.ma), ["tamDung", "chup", "xen", "khoiPhuc", "mu"]);
  assert.match(tb[0].chu, /Tạm dừng nhập, xuất, chuyển kho và bán tại quầy ở Kho tổng/);
  const chiXem = thongBaoKiemKe({ dot, daXong: false, chiXem: true, dem: {} });
  assert.deepEqual(chiXem.map((x) => x.ma), ["chiXem"]);
  assert.deepEqual(thongBaoKiemKe({ dot, daXong: true, daDong: true, soMat: 2 }).map((x) => x.ma), ["mat", "daDong"]);
});

test("csvSoDem và soDemBiBo", () => {
  const xong = tinhDong(
    dongKiemKe([
      ct(1, "L1", "A,1", 4, { soLuongThucTe: "4.00", chenhLechSoLuong: "0.00", loaiChenhLech: "khop" }),
      ct(2, "L2", "A", 2),
    ]),
    { daXong: true },
  );
  const bo = soDemBiBo(xong, { 1: { so: 4 }, 2: { so: 3, luc: null } });
  assert.equal(bo.length, 1);
  assert.equal(bo[0].so, 3);
  const csv = csvSoDem(xong.map((d) => ({ ...d, so: 1 })), { maDot: "KK1" });
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.slice(1).startsWith("Mã đợt,Mã lô"));
  assert.match(csv, /"A,1"/);
  // CSV in giờ đếm thật trên máy (lucHien), không phải giờ so sánh đã đẩy lên sau giao dịch đã biết (luc)
  const gioThat = new Date(2026, 9, 22, 8, 12).getTime();
  const csv2 = csvSoDem([{ ...xong[1], so: 9, luc: gioThat + 7 * 3600000, lucHien: gioThat }], { maDot: "KK1" });
  assert.match(csv2, /,9,08:12 · 22\/10/);
});

/** Storage giả trong bộ nhớ (getItem / setItem / removeItem / key / length) */
function khoGia({ chan = false } = {}) {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => {
      if (chan) throw new Error("SecurityError");
      return m.has(k) ? m.get(k) : null;
    },
    setItem: (k, v) => {
      if (chan) throw new Error("QuotaExceeded");
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
    m,
  };
}

test("bản tạm: ghi, đọc, khôi phục đúng đợt và dòng còn khớp", () => {
  const kho = khoGia();
  const dot = { id: 41, maDotKiemKe: "KK1", ngayTao: "2026-10-21T01:30:00Z" };
  assert.equal(ghiBanTam(kho, { dot, nguoiDungId: 5, soDem: { 1: { so: 3, luc: 9 }, 99: { so: 1 } }, dong: DONG, bayGio: 100 }), true);
  const { banTam } = docBanTam(kho, 41, 5);
  assert.equal(banTam.dong.length, 1);
  const kp = khoiPhucSoDem(banTam, dot, DONG);
  assert.deepEqual(kp.soDem, { 1: { so: 3, luc: 9, lucHien: null } });
  assert.equal(kp.capNhat, 100);
  // Đợt khác trùng id → không nạp
  assert.equal(khoiPhucSoDem(banTam, { ...dot, ngayTao: "khac" }, DONG).soDong, 0);
  // Lô đổi → bỏ dòng
  assert.equal(khoiPhucSoDem(banTam, dot, [{ ...DONG[0], loHangId: 777 }]).soDong, 0);
  // Không còn số → xóa bản
  ghiBanTam(kho, { dot, nguoiDungId: 5, soDem: {}, dong: DONG });
  assert.equal(kho.m.has(khoaBanTam(41, 5)), false);
  assert.equal(xoaBanTam(kho, 41, 5), true);
});

test("bản tạm: dọn theo tài khoản, không xóa bản của người khác (đợt kho khác không có trong danh sách)", () => {
  const kho = khoGia();
  ghiBanTam(kho, { dot: { id: 50, maDotKiemKe: "KK50", ngayTao: "t" }, nguoiDungId: 6, soDem: { 1: { so: 3 } }, dong: DONG });
  ghiBanTam(kho, { dot: { id: 51, maDotKiemKe: "KK51", ngayTao: "t" }, nguoiDungId: 5, soDem: { 1: { so: 3 } }, dong: DONG });
  // tài khoản 5 chỉ thấy đợt 41 (kho được phân): bản đợt 51 của chính mình bị dọn, bản đợt 50 của tài khoản 6 giữ
  assert.equal(donBanTam(kho, [{ id: 41, maDotKiemKe: "KK1", ngayTao: "t" }], 5), 1);
  assert.equal(kho.m.has("kiemKe:50:6"), true);
  assert.equal(kho.m.has("kiemKe:51:5"), false);
});

test("bản tạm: tài khoản khác, dọn, trình duyệt chặn", () => {
  const kho = khoGia();
  const dot = { id: 41, maDotKiemKe: "KK1", ngayTao: "t" };
  ghiBanTam(kho, { dot, nguoiDungId: 6, soDem: { 1: { so: 3 } }, dong: DONG });
  ghiBanTam(kho, { dot: { id: 50, maDotKiemKe: "KK50", ngayTao: "t" }, nguoiDungId: 5, soDem: { 1: { so: 3 } }, dong: DONG });
  kho.setItem("kiemKe:60:5", "{hỏng");
  kho.setItem("kiemKe:demMu:5", "1");
  assert.equal(demBanTamNguoiKhac(kho, 41, 5), 1);
  assert.equal(demBanTamNguoiKhac(kho, 41, 6), 0);
  // Danh sách: đợt 41 còn (giữ), đợt 50 không còn (xóa), bản hỏng (xóa), khóa đếm mù không đụng tới
  assert.equal(donBanTam(kho, [{ id: 41, maDotKiemKe: "KK1", ngayTao: "t", trangThai: 1 }]), 2);
  assert.equal(kho.m.has("kiemKe:41:6"), true);
  assert.equal(kho.m.has("kiemKe:demMu:5"), true);
  assert.equal(docDemMu(kho, 5), true);
  ghiDemMu(kho, 5, false);
  assert.equal(docDemMu(kho, 5), false);
  const chan = khoGia({ chan: true });
  assert.equal(ghiBanTam(chan, { dot, nguoiDungId: 5, soDem: { 1: { so: 1 } }, dong: DONG }), false);
  assert.equal(docBanTam(chan, 41, 5).loi, true);
  assert.equal(docBanTam(null, 41, 5).loi, true);
  assert.equal(docDemMu(chan, 5), false);
});

test("dongKiemKe: tên hiện, màu, mã màu, cỡ, ảnh của máy chủ mới; tenSanPham vẫn là tên ghép (tìm, CSV)", () => {
  const [d] = dongKiemKe([ct(31, "L31", "AT-9", 3, { tenSanPham: "Áo AT-9", tenMau: "Đen", maMauHex: "#111111", kichCo: "M", anh: "k.jpg" })]);
  assert.equal(d.tenSanPham, "Áo AT-9 - Đen / M");
  assert.equal(d.tenHien, "Áo AT-9");
  assert.equal(d.maMauHex, "#111111");
  assert.equal(d.kichCo, "M");
  assert.equal(d.anh, "k.jpg");
  const [cu] = dongKiemKe([ct(32, "L32", "AT-9", 3)]);
  assert.equal(cu.tenHien, "");
  assert.equal(cu.anh, null);
});
