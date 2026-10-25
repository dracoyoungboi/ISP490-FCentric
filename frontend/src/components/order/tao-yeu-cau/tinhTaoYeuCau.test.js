// Chạy: node --test src/components/order/tao-yeu-cau/tinhTaoYeuCau.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boDong,
  canChuY,
  canhBao,
  cauCanhBao,
  chenLaiDong,
  chonKhiEnter,
  datSoLuong,
  demTheoDeXuat,
  docDanhSachDan,
  docDeXuatDuongDan,
  docNgay,
  doiOLuoi,
  homNayVN,
  isoNgay,
  doiSoLuongDong,
  dongBang,
  idYeuCauMoi,
  laGoiY,
  luoiNhap,
  lyDoKhoaGui,
  moTaNgayGiao,
  noiThuTuSanPham,
  roiOSoLuong,
  sauNgay,
  SO_LUONG_TOI_DA,
  soNgayToi,
  soSanhKichCo,
  taoBodyYeuCau,
  taoChiMuc,
  themDong,
  themNhieu,
  theoNhomHang,
  theoSoDeXuat,
  timHang,
} from "./tinhTaoYeuCau.js";

const bt = (id, spId, ten, mau, co, them = {}) => ({
  bienTheId: id, sanPhamId: spId, tenSanPham: ten, maSanPham: `SP${spId}`, maSku: `SP${spId}-${mau}-${co}`.toUpperCase(),
  maVach: `20${String(id).padStart(11, "0")}`, tenMau: mau, maMauHex: "#111111", tenSize: co, tenChatLieu: "Cotton",
  nhomHang: "Áo khoác", anh: null, khaDung: 0, dangVe: 0, nguong: 10, daTungNhap: true, soLuongDeXuat: 0, du: false,
  yeuCauMo: null, ...them,
});

const HANG = [
  bt(1, 10, "Áo khoác gió", "Đen", "XL", { soLuongDeXuat: 20 }),
  bt(2, 10, "Áo khoác gió", "Đen", "S", { soLuongDeXuat: 15, khaDung: 5 }),
  bt(3, 10, "Áo khoác gió", "Trắng", "M"),
  bt(4, 10, "Áo khoác gió", "Đen", "M", { du: true, khaDung: 40 }),
  bt(5, 20, "Quần jean slim", "Xanh", "31", { nhomHang: "Quần jean", yeuCauMo: { id: 9, ma: "PR202610240009", soYeuCau: 1 } }),
  bt(6, 20, "Quần jean slim", "Xanh", "29", { nhomHang: "Quần jean" }),
];
const CM = taoChiMuc(HANG);

test("soSanhKichCo: chữ theo bảng cỡ, số theo giá trị", () => {
  assert.deepEqual(["XL", "S", "M", "XXL", "L"].sort(soSanhKichCo), ["S", "M", "L", "XL", "XXL"]);
  assert.deepEqual(["32", "29", "30"].sort(soSanhKichCo), ["29", "30", "32"]);
  assert.deepEqual(["Free", "M", "30"].sort(soSanhKichCo), ["M", "30", "Free"]);
});

test("taoChiMuc: tra theo id, SKU, mã vạch; biến thể xếp theo màu rồi cỡ", () => {
  assert.equal(CM.theoId.get("3").tenMau, "Trắng");
  assert.equal(CM.theoMa.get("sp10-đen-xl").bienTheId, 1);
  assert.equal(CM.theoMa.get(HANG[4].maVach).bienTheId, 5);
  assert.deepEqual(CM.theoSanPham.get("10").map((x) => x.bienTheId), [2, 4, 1, 3]);
  assert.deepEqual(CM.theoSanPham.get("20").map((x) => x.bienTheId), [6, 5]);
});

test("timHang / chonKhiEnter: không dấu, mã chính xác trước, một kết quả mới lấy", () => {
  assert.equal(timHang(HANG, "ao khoac den").tong, 3);
  assert.equal(timHang(HANG, "quan jean").tong, 2);
  assert.equal(timHang(HANG, "").ds.length, 6);
  assert.equal(chonKhiEnter(HANG, CM, "sp20-xanh-31").bienThe.bienTheId, 5);
  assert.equal(chonKhiEnter(HANG, CM, HANG[5].maVach).bienThe.bienTheId, 6);
  assert.equal(chonKhiEnter(HANG, CM, "trắng").bienThe.bienTheId, 3);
  assert.deepEqual(chonKhiEnter(HANG, CM, "đen"), { loi: "nhieu" });
  assert.deepEqual(chonKhiEnter(HANG, CM, "không có"), { loi: "khong" });
  assert.equal(chonKhiEnter(HANG, CM, "  "), null);
});

test("laGoiY / canChuY", () => {
  assert.equal(laGoiY(HANG[0]), true);
  assert.equal(laGoiY(HANG[2]), false);
  assert.equal(canChuY(HANG[3]), true, "còn dư");
  assert.equal(canChuY(HANG[4]), true, "đang trong yêu cầu khác");
  assert.equal(canChuY(HANG[2]), false);
});

test("themDong: quét lại cộng 1, kẹp tối đa", () => {
  let d = themDong([], 1);
  d = themDong(d, 1);
  d = themDong(d, 2, 5);
  assert.deepEqual(d, [{ bienTheId: 1, soLuong: 2 }, { bienTheId: 2, soLuong: 5 }]);
  assert.equal(themDong([{ bienTheId: 1, soLuong: SO_LUONG_TOI_DA }], 1)[0].soLuong, SO_LUONG_TOI_DA);
  assert.equal(themDong([{ bienTheId: 1, soLuong: "" }], 1)[0].soLuong, 1, "ô đang trống thì cộng từ 0");
});

test("themNhieu: cộng thêm / thay / giữ mã đã có", () => {
  const goc = [{ bienTheId: 1, soLuong: 10 }];
  const them = [{ bienTheId: 1, soLuong: 5 }, { bienTheId: 2, soLuong: 3 }];
  assert.deepEqual(themNhieu(goc, them, "cong"), { dong: [{ bienTheId: 1, soLuong: 15 }, { bienTheId: 2, soLuong: 3 }], moi: 1, capNhat: 1 });
  assert.deepEqual(themNhieu(goc, them, "thay").dong[0], { bienTheId: 1, soLuong: 5 });
  assert.deepEqual(themNhieu(goc, them, "giu"), { dong: [{ bienTheId: 1, soLuong: 10 }, { bienTheId: 2, soLuong: 3 }], moi: 1, capNhat: 0 });
  assert.deepEqual(goc, [{ bienTheId: 1, soLuong: 10 }], "không sửa mảng gốc");
});

test("datSoLuong / theoSoDeXuat / boDong", () => {
  const goc = [{ bienTheId: 1, soLuong: 3 }, { bienTheId: 3, soLuong: 4 }, { bienTheId: 6, soLuong: 1 }];
  assert.deepEqual(datSoLuong(goc, [1, "3"], 40).map((d) => d.soLuong), [40, 40, 1]);
  const kq = theoSoDeXuat(goc, [1, 3], CM.theoId);
  assert.deepEqual(kq.dong.map((d) => d.soLuong), [20, 4, 1]);
  assert.equal(kq.dat, 1);
  assert.equal(kq.khong, 1);
  assert.deepEqual(boDong(goc, [3, 6]), [{ bienTheId: 1, soLuong: 3 }]);
});

test("ô số lượng: chữ sai giữ số cũ, trống giữ trống, rời ô về 1", () => {
  const goc = [{ bienTheId: 1, soLuong: 3 }];
  assert.equal(doiSoLuongDong(goc, 1, "2.5"), goc);
  assert.deepEqual(doiSoLuongDong(goc, 1, ""), [{ bienTheId: 1, soLuong: "" }]);
  assert.deepEqual(doiSoLuongDong(goc, 1, "0"), [{ bienTheId: 1, soLuong: 1 }]);
  assert.deepEqual(doiSoLuongDong(goc, 1, "120"), [{ bienTheId: 1, soLuong: 120 }]);
  assert.deepEqual(roiOSoLuong([{ bienTheId: 1, soLuong: "" }], 1), [{ bienTheId: 1, soLuong: 1 }]);
});

test("ô lưới: trống / 0 bỏ mã, số thì đặt hoặc thêm, chữ sai giữ nguyên", () => {
  const goc = [{ bienTheId: 1, soLuong: 3 }];
  assert.deepEqual(doiOLuoi(goc, 1, ""), []);
  assert.deepEqual(doiOLuoi(goc, 1, "0"), []);
  assert.deepEqual(doiOLuoi(goc, 1, "8"), [{ bienTheId: 1, soLuong: 8 }]);
  assert.deepEqual(doiOLuoi(goc, 2, "5"), [{ bienTheId: 1, soLuong: 3 }, { bienTheId: 2, soLuong: 5 }]);
  assert.equal(doiOLuoi(goc, 1, "x"), goc);
});

test("dongBang: gom theo sản phẩm theo thứ tự thêm, trong sản phẩm theo màu rồi cỡ, kèm số Kho tổng", () => {
  const d = dongBang([{ bienTheId: 5, soLuong: 2 }, { bienTheId: 1, soLuong: 20 }, { bienTheId: 2, soLuong: "" }, { bienTheId: 999, soLuong: 1 }], CM);
  assert.deepEqual(d.map((x) => x.id), [5, 2, 1, 999]);
  assert.equal(d[1].deXuat, 15);
  assert.equal(d[1].khaDung, 5);
  assert.equal(d[1].oNhap, "");
  assert.equal(d[1].soLuong, 0);
  assert.equal(d[0].yeuCauMo.ma, "PR202610240009");
  assert.equal(d[3].khongConBan, true);
});

test("noiThuTuSanPham / dongBang theo thứ tự thêm: bỏ dòng đầu của sản phẩm không làm sản phẩm nhảy chỗ", () => {
  let thuTu = noiThuTuSanPham([], [1], CM);
  thuTu = noiThuTuSanPham(thuTu, [5, 2], CM);
  assert.deepEqual(thuTu, ["10", "20"]);
  assert.equal(noiThuTuSanPham(thuTu, [3, 6], CM), thuTu, "không có sản phẩm mới thì giữ nguyên mảng");
  // Dòng đầu của sản phẩm 10 (mã 1) đã bị bỏ, mã 3 thêm sau mã 5: sản phẩm 10 vẫn đứng trước
  const d = dongBang([{ bienTheId: 5, soLuong: 1 }, { bienTheId: 3, soLuong: 2 }], CM, thuTu);
  assert.deepEqual(d.map((x) => x.id), [3, 5]);
});

test("luoiNhap: mọi biến thể của sản phẩm, cỡ theo thứ tự, ô trống là chưa nhập", () => {
  const luoi = luoiNhap(CM.theoSanPham.get("10"), [{ bienTheId: 1, soLuong: 20 }, { bienTheId: 3, soLuong: 4 }]);
  assert.deepEqual(luoi.cotKichCo, ["S", "M", "XL"]);
  assert.deepEqual(luoi.hang.map((h) => h.tenMau), ["Đen", "Trắng"]);
  assert.deepEqual(luoi.hang[0].o.map((o) => o.soLuong), ["", "", 20]);
  assert.equal(luoi.hang[1].o[0].bienThe, null, "Trắng không có cỡ S");
  assert.deepEqual(luoi.congCot, [0, 4, 20]);
  assert.equal(luoi.cong, 24);
});

test("docDanhSachDan: tiêu đề, Tab / phẩy / khoảng trắng, mã vạch, số có dấu nghìn, lỗi và cộng dồn", () => {
  const chu = [
    "Mã SKU\tSố lượng",
    "SP10-ĐEN-XL\t30",
    "sp10-đen-s, 12",
    `${HANG[5].maVach} 1.200`,
    "SP20-XANH-31,7",
    "SP99-KHONG-CO\t10",
    "SP10-TRẮNG-M\tmười",
    "SP10-TRẮNG-M",
    "SP10-ĐEN-XL\t5",
    "",
  ].join("\r\n");
  const kq = docDanhSachDan(chu, CM);
  assert.deepEqual(kq.hop, [
    { bienTheId: 1, soLuong: 35 },
    { bienTheId: 2, soLuong: 12 },
    { bienTheId: 6, soLuong: 1200 },
    { bienTheId: 5, soLuong: 7 },
  ]);
  assert.deepEqual(kq.loi.map((e) => [e.dongSo, e.lyDo]), [[6, "không tìm thấy mã"], [7, "số lượng không hợp lệ"], [8, "thiếu số lượng"]]);
  assert.equal(kq.soDong, 5);
  assert.equal(kq.soDongLap, 1);
  assert.equal(docDanhSachDan("SP10-ĐEN-XL\t200000", CM).hop[0].soLuong, SO_LUONG_TOI_DA);
  assert.deepEqual(docDanhSachDan("XYZ\t10", CM).loi.length, 1, "dòng đầu kết thúc bằng số thì không phải tiêu đề");
  assert.deepEqual(docDanhSachDan("SP10-ĐEN-XL\t0", CM).loi[0].lyDo, "số lượng không hợp lệ");
});

test("docDanhSachDan: CSV ngoặc kép, ngăn nghìn bằng dấu cách / NBSP, cột STT trước mã, BOM", () => {
  const kq = docDanhSachDan([
    "﻿\"Mã\",\"Số lượng\"",
    "\"SP10-ĐEN-XL\",\"30\"",
    "SP10-ĐEN-S\t1 200",
    "SP10-ĐEN-M\t1 200",
    "3\tSP20-XANH-31\tQuần jean slim\t7",
  ].join("\n"), CM);
  assert.deepEqual(kq.hop, [
    { bienTheId: 1, soLuong: 30 },
    { bienTheId: 2, soLuong: 1200 },
    { bienTheId: 4, soLuong: 1200 },
    { bienTheId: 5, soLuong: 7 },
  ]);
  assert.deepEqual(kq.loi, []);
});

test("docDanhSachDan: không đoán sai số lượng — dòng hơn 2 phần báo lỗi, chỉ dòng đầu được coi là tiêu đề", () => {
  const kq = docDanhSachDan(["SP10-ĐEN-XL,1,200", "SP10-ĐEN-S 30 SP10-ĐEN-M 20"].join("\n"), CM);
  assert.deepEqual(kq.hop, []);
  assert.deepEqual(kq.loi.map((e) => e.lyDo), [
    "dòng có hơn 2 phần, mỗi dòng chỉ ghi mã và số lượng",
    "dòng có hơn 2 phần, mỗi dòng chỉ ghi mã và số lượng",
  ]);
  const goTay = docDanhSachDan(["TYPO1", "TYPO2", "SP10-ĐEN-XL 5"].join("\n"), CM);
  assert.deepEqual(goTay.loi.map((e) => e.dongSo), [2], "dòng 1 là tiêu đề, dòng 2 phải báo lỗi");
  assert.deepEqual(goTay.hop, [{ bienTheId: 1, soLuong: 5 }]);
});

test("luoiNhap: hai biến thể trùng màu và cỡ khác chất liệu tách hàng, không gộp mất mã", () => {
  const ds = [
    bt(31, 30, "Áo linen", "Đen", "M", { tenChatLieu: "Cotton" }),
    bt(32, 30, "Áo linen", "Đen", "M", { tenChatLieu: "Linen", maSku: "SP30-DEN-M-LINEN" }),
    bt(33, 30, "Áo linen", "Đen", "L", { tenChatLieu: "Cotton", maSku: "SP30-DEN-L" }),
  ];
  const luoi = luoiNhap(ds, [{ bienTheId: 31, soLuong: 5 }, { bienTheId: 32, soLuong: 7 }]);
  assert.deepEqual(luoi.hang.map((h) => h.tenMau), ["Đen · Cotton", "Đen · Linen"]);
  assert.equal(luoi.cong, 12);
  assert.equal(luoi.hang[1].o.find((o) => o.kichCo === "M").bienThe.bienTheId, 32);
});

test("chenLaiDong: hoàn tác chỉ chèn lại dòng đã bỏ, giữ số đã sửa và mã thêm sau", () => {
  const daBo = [{ bienTheId: 1, soLuong: 10 }, { bienTheId: 2, soLuong: 4 }];
  const sau = [{ bienTheId: 3, soLuong: 50 }, { bienTheId: 2, soLuong: 9 }];
  assert.deepEqual(chenLaiDong(sau, daBo), [{ bienTheId: 3, soLuong: 50 }, { bienTheId: 2, soLuong: 9 }, { bienTheId: 1, soLuong: 10 }]);
});

test("homNayVN: theo ngày Việt Nam dù máy đặt múi giờ khác", () => {
  assert.equal(isoNgay(homNayVN(new Date("2026-10-24T17:30:00Z"))), "2026-10-25");
  assert.equal(isoNgay(homNayVN(new Date("2026-10-24T16:59:00Z"))), "2026-10-24");
  assert.equal(sauNgay(7, new Date(2026, 11, 28)), "2027-01-04", "qua năm");
});

test("ngày giao: đọc ngày, sau n ngày, số ngày còn lại, dòng mô tả", () => {
  const homNay = new Date(2026, 9, 25, 15, 30);
  assert.equal(docNgay("2026-02-30"), null);
  assert.equal(docNgay("abc"), null);
  assert.equal(sauNgay(7, homNay), "2026-11-01");
  assert.equal(sauNgay(30, homNay), "2026-11-24");
  assert.equal(soNgayToi("2026-10-25", homNay), 0);
  assert.equal(soNgayToi("2026-10-24", homNay), -1);
  assert.deepEqual(moTaNgayGiao("2026-11-03", homNay), { trai: "Thứ Ba, 03/11/2026", phai: "còn 9 ngày", loi: false });
  assert.equal(moTaNgayGiao("2026-10-25", homNay).phai, "hôm nay");
  assert.equal(moTaNgayGiao("2026-10-20", homNay).loi, true);
  assert.equal(moTaNgayGiao("", homNay).trai, "Bắt buộc");
});

test("canhBao / cauCanhBao: mã trùng yêu cầu khác, mã còn dư", () => {
  const cb = canhBao([{ bienTheId: 5, soLuong: 1 }, { bienTheId: 4, soLuong: 1 }, { bienTheId: 1, soLuong: 1 }], CM);
  assert.deepEqual(cb, { trung: [5], du: [4], maYeuCau: ["PR202610240009"], soChuY: 2 });
  assert.equal(cauCanhBao(cb), "1 mã đang nằm trong yêu cầu nhập khác chưa xong (PR202610240009); 1 mã Kho tổng còn dư hàng. Gửi thêm có thể mua trùng hoặc mua thừa.");
  assert.equal(cauCanhBao(canhBao([{ bienTheId: 1 }], CM)), "");
});

test("theoNhomHang / demTheoDeXuat", () => {
  assert.deepEqual(theoNhomHang([{ bienTheId: 1, soLuong: 20 }, { bienTheId: 5, soLuong: 30 }, { bienTheId: 2, soLuong: "" }], CM),
    [{ ten: "Quần jean", soLuong: 30 }, { ten: "Áo khoác", soLuong: 20 }]);
  const nhieu = Array.from({ length: 7 }, (_, i) => bt(100 + i, 100 + i, `SP ${i}`, "Đen", "M", { nhomHang: `Nhóm ${i}` }));
  const cm = taoChiMuc(nhieu);
  const kq = theoNhomHang(nhieu.map((x, i) => ({ bienTheId: x.bienTheId, soLuong: 10 - i })), cm);
  assert.equal(kq.length, 6);
  assert.deepEqual(kq[5], { ten: "Nhóm khác (2)", soLuong: 9 });
  assert.equal(demTheoDeXuat([{ bienTheId: 1, soLuong: 20 }, { bienTheId: 2, soLuong: 3 }, { bienTheId: 3, soLuong: 0 }], CM), 1);
});

test("lyDoKhoaGui: theo thứ tự cần làm", () => {
  const homNay = new Date(2026, 9, 25);
  const dong = [{ bienTheId: 1, soLuong: 5 }];
  assert.equal(lyDoKhoaGui({ dangTai: true }), "Đang tải dữ liệu");
  assert.equal(lyDoKhoaGui({ coKho: false, dong }), "Chưa có Kho tổng nhận hàng");
  assert.equal(lyDoKhoaGui({ dong: [], homNay }), "Thêm ít nhất một sản phẩm");
  assert.equal(lyDoKhoaGui({ dong: [...dong, { bienTheId: 999, soLuong: 1 }], chiMuc: CM, homNay }), "Có mã đã ngừng kinh doanh, bỏ trước khi gửi");
  assert.equal(lyDoKhoaGui({ dong: [...dong, { bienTheId: 2, soLuong: "" }], chiMuc: CM, ngayGiao: "2026-10-26", homNay }), "",
    "ô số lượng đang xóa trống không khóa nút (gửi tính là 1)");
  assert.equal(lyDoKhoaGui({ dong, chiMuc: CM, ngayGiao: "", homNay }), "Chọn ngày giao dự kiến");
  assert.equal(lyDoKhoaGui({ dong, chiMuc: CM, ngayGiao: "2026-10-24", homNay }), "Ngày giao không được trước hôm nay");
  assert.equal(lyDoKhoaGui({ dong, chiMuc: CM, ngayGiao: "2026-10-25", homNay }), "");
  const quaNhieu = Array.from({ length: 1001 }, (_, i) => ({ bienTheId: i, soLuong: 1 }));
  assert.equal(lyDoKhoaGui({ dong: quaNhieu, homNay }), "Tối đa 1.000 dòng mỗi yêu cầu");
});

test("taoBodyYeuCau: ngày giao 00:00 giờ Việt Nam, ghi chú gọn, ô trống tính 1", () => {
  assert.deepEqual(taoBodyYeuCau({ khoNhapId: "22", ngayGiao: "2026-11-03", ghiChu: "  " }, [
    { bienTheId: "7", soLuong: 20 }, { bienTheId: 8, soLuong: "" },
  ]), {
    khoNhapId: 22,
    ngayGiaoDuKien: "2026-11-03T00:00:00+07:00",
    ghiChu: null,
    chiTietYeuCauMuaHangs: [{ bienTheSanPhamId: 7, soLuongDat: 20 }, { bienTheSanPhamId: 8, soLuongDat: 1 }],
  });
  assert.equal(taoBodyYeuCau({ khoNhapId: 1, ngayGiao: "2026-11-03", ghiChu: " Bổ sung size M " }, []).ghiChu, "Bổ sung size M");
});

test("idYeuCauMoi / docDeXuatDuongDan", () => {
  assert.equal(idYeuCauMoi({ data: { id: 31 } }), 31);
  assert.equal(idYeuCauMoi({}), null);
  const dsKhoTong = [{ id: 22 }];
  assert.equal(docDeXuatDuongDan(new URLSearchParams(""), CM, dsKhoTong), null);
  assert.deepEqual(docDeXuatDuongDan(new URLSearchParams("khoId=22&bienTheId=2&soLuong=15"), CM, dsKhoTong),
    { dong: { bienTheId: 2, soLuong: 15 }, khoTong: "22", khoDeXuat: null, khongThay: false, coSoLuong: true, ten: null });
  assert.deepEqual(docDeXuatDuongDan(new URLSearchParams("khoId=3&bienTheId=2&soLuong=abc"), CM, dsKhoTong),
    { dong: { bienTheId: 2, soLuong: 1 }, khoTong: null, khoDeXuat: "3", khongThay: false, coSoLuong: false, ten: null });
  assert.deepEqual(docDeXuatDuongDan(new URLSearchParams("bienTheId=999&ten=%C3%81o%20gi%C3%B3"), CM, dsKhoTong),
    { dong: null, khoTong: null, khoDeXuat: null, khongThay: true, coSoLuong: false, ten: "Áo gió" });
});
