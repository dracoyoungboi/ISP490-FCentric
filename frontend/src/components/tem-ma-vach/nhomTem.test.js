import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chuanHoaTrang,
  coGia,
  dongCuaTrang,
  laMotPhanLoai,
  nhanPhanLoai,
  nhomDangMo,
  timDongQuet,
  tomTatNhom,
  trangThaiChon,
  tuMoNhom,
  soThieuMaVach,
} from "./nhomTem.js";

// Chạy: node --test src/components/tem-ma-vach/nhomTem.test.js

const bt = (id, extra = {}) => ({
  id, maSku: `AK2610234-CL001-${id}-MS-2691`, maVachSku: `20000000${id}`, mauSac: { ten: "Đen", maHex: "#111827" },
  kichCo: "M", trangThai: 1, giaBan: 2000000, ...extra,
});
const trang = (content) => ({ content, tongSanPham: content.length, tongSku: 9, demTheoTab: { tatCa: 9, doiGia: 2, chuaGia: 1, thieuMa: 0 } });

test("chuẩn hóa trang: tên, màu, tồn là số; tổng phân loại không nhỏ hơn số SKU đang có", () => {
  const { nhom, tongSku } = chuanHoaTrang(trang([
    { sanPhamId: 1, tenSanPham: "Nike Sportswear", maSanPham: "AK2610234", tongPhanLoai: 5, khopTen: false, bienThe: [bt(11), bt(12)] },
    { sanPhamId: 2, tenSanPham: "Áo polo", tongPhanLoai: 0, khopTen: true, bienThe: [bt(21)] },
  ]));
  assert.equal(nhom[0].khoa, "sp-1");
  assert.equal(nhom[0].tongPhanLoai, 5);
  assert.equal(nhom[0].dong[0].tenMau, "Đen");
  assert.equal("tonKho" in nhom[0].dong[0], false, "màn Tem mã vạch không còn tồn");
  assert.equal(nhom[0].dong[0].tenSanPham, "Nike Sportswear");
  assert.equal(nhom[1].tongPhanLoai, 1);
  assert.ok(laMotPhanLoai(nhom[1]), "sản phẩm một phân loại hiện một dòng");
  assert.ok(!laMotPhanLoai(nhom[0]));
  assert.equal(tongSku, 9);
  assert.equal(nhom[0].dong[0].giaBan, 2000000);
  assert.equal("giaVon" in nhom[0].dong[0], false, "màn tem không dùng giá vốn");
  assert.deepEqual(dongCuaTrang(nhom).map((d) => d.id), [11, 12, 21]);
});

test("tự mở nhóm: khớp một phần SKU, tab khác Tất cả, dòng vừa quét; khớp tên thì không", () => {
  const motPhan = { khopTen: false, tongPhanLoai: 5, dong: [{ id: 1 }, { id: 2 }] };
  const khopTen = { khopTen: true, tongPhanLoai: 5, dong: [{ id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }] };
  assert.ok(tuMoNhom(motPhan, { tab: "tat-ca", tuKhoa: "cl001" }));
  assert.ok(!tuMoNhom(khopTen, { tab: "tat-ca", tuKhoa: "nike" }), "khớp tên thì không tự mở");
  assert.ok(!tuMoNhom(motPhan, { tab: "tat-ca", tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "doi-gia", tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "chua-gia", tuKhoa: "" }));
  assert.ok(tuMoNhom(khopTen, { tab: "tat-ca", tuKhoa: "", idNoiBat: 5 }));
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

test("tóm tắt hàng sản phẩm: giá bán một số / khoảng / chưa có", () => {
  const g = (dong) => ({ dong });
  const deu = tomTatNhom(g([bt(1), bt(2)]));
  assert.deepEqual(deu.giaBan, { loai: "mot", gia: 2000000 });

  const khac = tomTatNhom(g([{ ...bt(1), giaBan: 390000 }, { ...bt(2), giaBan: 420000 }]));
  assert.deepEqual(khac.giaBan, { loai: "khoang", thapNhat: 390000, caoNhat: 420000, thieuGia: false });

  const motChuaGia = tomTatNhom(g([{ ...bt(1), giaBan: 450000 }, { ...bt(2), giaBan: 0 }]));
  assert.deepEqual(motChuaGia.giaBan, { loai: "khoang", thapNhat: 450000, caoNhat: 450000, thieuGia: true }, "có SKU chưa giá thì không coi là một giá");
  const khoangThieu = tomTatNhom(g([{ ...bt(1), giaBan: 100000 }, { ...bt(2), giaBan: 200000 }, { ...bt(3), giaBan: null }]));
  assert.deepEqual(khoangThieu.giaBan, { loai: "khoang", thapNhat: 100000, caoNhat: 200000, thieuGia: true }, "khoảng giá vẫn báo còn phân loại chưa giá");

  assert.deepEqual(tomTatNhom(g([{ ...bt(1), giaBan: null }])).giaBan, { loai: "chua" });
  const ngung = tomTatNhom(g([{ ...bt(1), giaBan: 990000, trangThai: 1 }, { ...bt(2), giaBan: 0, trangThai: 0 }]));
  assert.deepEqual(ngung.giaBan, { loai: "mot", gia: 990000 }, "SKU ngừng không tính vào giá hàng sản phẩm");
});

test("có giá: trống, 0, số âm là chưa có giá (tem không in được)", () => {
  assert.ok(coGia(1));
  assert.ok(coGia("450000"));
  for (const x of [null, undefined, "", 0, "0", -5]) assert.ok(!coGia(x), String(x));
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

test("đếm SKU thiếu mã vạch, chuẩn hóa giữ giá cũ", () => {
  assert.equal(soThieuMaVach({ dong: [{ maVachSku: "" }, { maVachSku: " " }, { maVachSku: "200" }] }), 2);
  const { nhom } = chuanHoaTrang(trang([{ sanPhamId: 1, tenSanPham: "A", bienThe: [bt(1, { giaBanCu: 105000, ngayDoiGia: "2026-11-23T03:00:00Z" })] }]));
  assert.equal(nhom[0].dong[0].giaBanCu, 105000);
  assert.equal(nhom[0].dong[0].ngayDoiGia, "2026-11-23T03:00:00Z");
});
