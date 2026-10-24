import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canXuLyGia,
  chuanHoaTrang,
  dinhDangPhanTram,
  dongCuaTrangGiaBan,
  dongInLaiSauDoiGia,
  duoiGiaVon,
  laMotPhanLoai,
  mucDoiGia,
  nhanPhanLoai,
  nhomDangMo,
  timDongQuet,
  tinhLaiGop,
  tomTatNhom,
  trangThaiChon,
  tuMoNhom,
} from "./nhomGiaBan.js";

// Chạy: node --test src/components/gia-ban/nhomGiaBan.test.js

const bt = (id, extra = {}) => ({
  id, maSku: `AK2610234-CL001-${id}-MS-2691`, maVachSku: `20000000${id}`, mauSac: { ten: "Đen", maHex: "#111827" },
  kichCo: "M", trangThai: 1, giaVon: 1500000, giaBan: 2000000, tonKho: "4.000", ngayDoiGiaGanNhat: null, ...extra,
});
const trang = (content) => ({ content, tongSanPham: content.length, tongSku: 9, demTheoTab: { tatCa: 9, hoatDong: 8, ngungHoatDong: 1 }, canXuLy: { chuaCoGia: 1, duoiGiaVon: 2 } });

test("chuẩn hóa trang: tên, màu, tồn là số; tổng phân loại không nhỏ hơn số SKU đang có", () => {
  const { nhom, tongSku, canXuLy } = chuanHoaTrang(trang([
    { sanPhamId: 1, tenSanPham: "Nike Sportswear", maSanPham: "AK2610234", tongPhanLoai: 5, khopTen: false, bienThe: [bt(11), bt(12)] },
    { sanPhamId: 2, tenSanPham: "Áo polo", tongPhanLoai: 0, khopTen: true, bienThe: [bt(21)] },
  ]));
  assert.equal(nhom[0].khoa, "sp-1");
  assert.equal(nhom[0].tongPhanLoai, 5);
  assert.equal(nhom[0].dong[0].tenMau, "Đen");
  assert.equal(nhom[0].dong[0].tonKho, 4);
  assert.equal(nhom[0].dong[0].tenSanPham, "Nike Sportswear");
  assert.equal(nhom[1].tongPhanLoai, 1);
  assert.ok(laMotPhanLoai(nhom[1]), "sản phẩm một phân loại hiện một dòng");
  assert.ok(!laMotPhanLoai(nhom[0]));
  assert.equal(tongSku, 9);
  assert.deepEqual(canXuLy, { chuaCoGia: 1, duoiGiaVon: 2 });
  assert.deepEqual(dongCuaTrangGiaBan(nhom).map((d) => d.id), [11, 12, 21]);
});

test("tự mở nhóm: khớp một phần SKU, tab Ngừng hoạt động, Cần xử lý giá, dòng vừa quét; khớp tên thì không", () => {
  const motPhan = { khopTen: false, tongPhanLoai: 5, dong: [{ id: 1 }, { id: 2 }] };
  const khopTen = { khopTen: true, tongPhanLoai: 5, dong: [{ id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }] };
  assert.ok(tuMoNhom(motPhan, { tab: "tat-ca", canXuLy: false, tuKhoa: "cl001" }));
  assert.ok(!tuMoNhom(khopTen, { tab: "hoat-dong", canXuLy: false, tuKhoa: "nike" }), "khớp tên dù tab còn 4/5");
  assert.ok(!tuMoNhom(motPhan, { tab: "tat-ca", canXuLy: false, tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "ngung-hoat-dong", canXuLy: false, tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "tat-ca", canXuLy: true, tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "tat-ca", canXuLy: false, tuKhoa: "", idNoiBat: 5 }));
});

test("mở / thu gọn theo chế độ, tự mở và ngoại lệ (cùng quy tắc màn Sản phẩm theo sàn)", () => {
  assert.equal(nhomDangMo({}), false, "mặc định thu gọn");
  assert.equal(nhomDangMo({ moTatCa: true }), true);
  assert.equal(nhomDangMo({ tuMo: true }), true);
  assert.equal(nhomDangMo({ tuMo: true, boTuMo: true }), false, "Thu gọn tất cả gập cả nhóm đang tự mở");
  assert.equal(nhomDangMo({ moTatCa: true, laNgoaiLe: true }), false, "người dùng tự gập một nhóm");
  assert.equal(nhomDangMo({ tuMo: true, boTuMo: true, laNgoaiLe: true }), true);
});

test("dòng phụ hàng sản phẩm: N phân loại, x/y phân loại, x/y phân loại khớp", () => {
  assert.equal(nhanPhanLoai({ tongPhanLoai: 5, dong: new Array(5) }, false), "5 phân loại");
  assert.equal(nhanPhanLoai({ tongPhanLoai: 5, dong: new Array(4) }, false), "4/5 phân loại");
  assert.equal(nhanPhanLoai({ tongPhanLoai: 5, dong: new Array(2) }, true), "2/5 phân loại khớp");
  assert.equal(nhanPhanLoai({ tongPhanLoai: 1200, dong: new Array(2) }, true, (n) => n.toLocaleString("vi-VN")), "2/1.200 phân loại khớp");
});

test("checkbox nhóm: chưa chọn / chọn hết / lưng chừng", () => {
  assert.equal(trangThaiChon([1, 2, 3], new Set()), false);
  assert.equal(trangThaiChon([1, 2, 3], new Set([1, 2, 3, 9])), true);
  assert.equal(trangThaiChon([1, 2, 3], new Set([2])), "indeterminate");
});

test("tóm tắt hàng sản phẩm: tổng tồn, giá vốn chỉ khi bằng nhau, giá bán một số / khoảng / chưa có", () => {
  const g = (dong) => ({ dong });
  const deu = tomTatNhom(g([{ ...bt(1), tonKho: 12 }, { ...bt(2), tonKho: 3 }]));
  assert.equal(deu.tongTon, 15);
  assert.equal(deu.giaVonChung, 1500000);
  assert.deepEqual(deu.giaBan, { loai: "mot", gia: 2000000 });

  const khac = tomTatNhom(g([{ ...bt(1), giaVon: 220000, giaBan: 390000 }, { ...bt(2), giaVon: 230000, giaBan: 420000 }]));
  assert.equal(khac.giaVonChung, null);
  assert.deepEqual(khac.giaBan, { loai: "khoang", thapNhat: 390000, caoNhat: 420000, thieuGia: false });

  const motChuaGia = tomTatNhom(g([{ ...bt(1), giaBan: 450000 }, { ...bt(2), giaBan: 0 }]));
  assert.deepEqual(motChuaGia.giaBan, { loai: "khoang", thapNhat: 450000, caoNhat: 450000, thieuGia: true }, "có SKU chưa giá thì không coi là một giá");
  const khoangThieu = tomTatNhom(g([{ ...bt(1), giaBan: 100000 }, { ...bt(2), giaBan: 200000 }, { ...bt(3), giaBan: null }]));
  assert.deepEqual(khoangThieu.giaBan, { loai: "khoang", thapNhat: 100000, caoNhat: 200000, thieuGia: true }, "khoảng giá vẫn báo còn phân loại chưa giá");

  assert.deepEqual(tomTatNhom(g([{ ...bt(1), giaBan: null }])).giaBan, { loai: "chua" });
  const ngung = tomTatNhom(g([{ ...bt(1), giaBan: 990000, trangThai: 1 }, { ...bt(2), giaBan: 0, trangThai: 0 }]));
  assert.deepEqual(ngung.giaBan, { loai: "mot", gia: 990000 }, "SKU ngừng không tính vào giá hàng sản phẩm");
});

test("cần xử lý giá / dưới giá vốn: chỉ SKU đang hoạt động", () => {
  assert.ok(canXuLyGia(bt(1, { giaBan: 0 })));
  assert.ok(canXuLyGia(bt(1, { giaBan: null })));
  assert.ok(canXuLyGia(bt(1, { giaVon: 480000, giaBan: 450000 })));
  assert.ok(!canXuLyGia(bt(1, { giaBan: 0, trangThai: 0 })));
  assert.ok(!canXuLyGia(bt(1)));
  assert.ok(duoiGiaVon(bt(1, { giaVon: 480000, giaBan: 450000 })));
  assert.ok(!duoiGiaVon(bt(1, { giaVon: null, giaBan: 450000 })), "không biết giá vốn thì không cảnh báo");
});

test("lãi gộp tính ngay khi gõ: lãi, phần trăm, bán lỗ", () => {
  const lai = tinhLaiGop(2000000, 1500000);
  assert.equal(lai.lai, 500000);
  assert.equal(dinhDangPhanTram(lai.phanTram), "25,0%");
  assert.equal(lai.lo, false);
  const lo = tinhLaiGop("450000", 480000);
  assert.equal(lo.lai, -30000);
  assert.equal(lo.lo, true);
  assert.equal(dinhDangPhanTram(lo.phanTram), "−6,7%");
  assert.equal(tinhLaiGop("", 100), null);
  assert.equal(tinhLaiGop(0, 100), null);
  assert.equal(tinhLaiGop(100, null), null);
});

test("mục đổi giá: bỏ SKU ngừng, khoảng giá vốn, giá không đổi, lần đổi gần nhất", () => {
  const ds = [
    bt(1, { giaVon: 220000, giaBan: 390000, ngayDoiGiaGanNhat: "2026-10-22T03:00:00Z" }),
    bt(2, { giaVon: 230000, giaBan: 390000, ngayDoiGiaGanNhat: "2026-10-20T03:00:00Z" }),
    bt(3, { trangThai: 0, giaVon: 999999 }),
  ];
  const m = mucDoiGia(ds);
  assert.deepEqual(m.muc.map((d) => d.id), [1, 2]);
  assert.equal(m.boQua, 1);
  assert.equal(m.vonThap, 220000);
  assert.equal(m.vonCao, 230000);
  assert.ok(m.khongDoi(390000));
  assert.ok(!m.khongDoi(400000));
  assert.equal(m.lanGanNhat.toISOString(), "2026-10-22T03:00:00.000Z");
  assert.equal(mucDoiGia([bt(4, { trangThai: 0 })]).khongDoi(1), false, "không còn SKU đang hoạt động");
});

test("quét mã: khớp đúng mã vạch hoặc SKU, không phân biệt hoa thường", () => {
  const { nhom } = chuanHoaTrang(trang([
    { sanPhamId: 1, tenSanPham: "A", tongPhanLoai: 2, bienThe: [bt(11), bt(12)] },
    { sanPhamId: 2, tenSanPham: "B", tongPhanLoai: 1, bienThe: [bt(21, { maVachSku: "8936000000123" })] },
  ]));
  assert.equal(timDongQuet(nhom, " 2000000012 ").dong.id, 12);
  assert.equal(timDongQuet(nhom, "ak2610234-cl001-11-ms-2691").dong.id, 11);
  assert.equal(timDongQuet(nhom, "8936000000123").nhom.sanPhamId, 2);
  assert.equal(timDongQuet(nhom, "2000000"), null, "khớp một phần không tính là quét trúng");
});

test("in lại tem sau đổi giá: chỉ SKU còn hàng, giá mới, số tem = tồn", () => {
  const ds = [{ id: 1, tenSanPham: "A", giaBan: 100, tonKho: 5 }, { id: 2, tenSanPham: "B", giaBan: 100, tonKho: 0 }];
  const ra = dongInLaiSauDoiGia([{ id: 1, giaBanMoi: 120, tonKho: "5.000" }, { id: 2, giaBanMoi: 120, tonKho: 0 }], ds);
  assert.equal(ra.length, 1);
  assert.equal(ra[0].giaBan, 120);
  assert.equal(ra[0].tonKho, 5);
});
