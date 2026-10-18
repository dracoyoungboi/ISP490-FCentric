import { test } from "node:test";
import assert from "node:assert/strict";
import {
  capNhatDongTrongTrang,
  chuanHoaNhom,
  dongCuaTrang,
  khoaNhom,
  laMotPhanLoai,
  nhanSoPhanLoai,
  phanTrangTheoSanPham,
} from "./nhomLienKet.js";

// Chạy: node --test src/components/channel/nhomLienKet.test.js

const sku = (id, sanPhamId, tenSanPham, extra = {}) => ({ id, sanPhamId, tenSanPham, maSku: `SKU-${id}`, ...extra });

/** 49 SKU như ảnh lỗi: Áo khoác 16, Áo polo 20, Quần 13; xếp xen kẽ như danh sách theo id. */
function duLieu49() {
  const ds = [];
  let id = 1;
  for (let i = 0; i < 16; i += 1) ds.push(sku(id++, 12, "Áo Khoác Blouson Cản Gió Cổ Đứng"));
  for (let i = 0; i < 20; i += 1) ds.push(sku(id++, 6, "Áo Polo tennis"));
  for (let i = 0; i < 13; i += 1) ds.push(sku(id++, 9, "Quần jean"));
  return ds;
}

test("khoaNhom: theo id sản phẩm, thiếu id thì theo tên", () => {
  assert.equal(khoaNhom(12, "Áo"), "sp-12");
  assert.equal(khoaNhom(null, "Áo"), "ten-Áo");
  assert.equal(khoaNhom(null, undefined), "ten-");
});

test("chuanHoaNhom: chuẩn hóa từng SKU, lấy ảnh và tổng phân loại", () => {
  const nhom = chuanHoaNhom(
    { sanPhamId: 12, tenSanPham: "Áo khoác", anhDaiDien: "a.jpg", tongPhanLoai: 16, bienThe: [{ id: 1 }, { id: 2 }] },
    (d) => ({ ...d, daChuanHoa: true }),
  );
  assert.equal(nhom.khoa, "sp-12");
  assert.equal(nhom.ten, "Áo khoác");
  assert.equal(nhom.anh, "a.jpg");
  assert.equal(nhom.tongPhanLoai, 16);
  assert.deepEqual(nhom.dong.map((d) => d.daChuanHoa), [true, true]);
});

test("chuanHoaNhom: tổng phân loại thiếu hoặc nhỏ hơn số SKU thì lấy số SKU", () => {
  assert.equal(chuanHoaNhom({ sanPhamId: 1, bienThe: [{ id: 1 }, { id: 2 }] }).tongPhanLoai, 2);
  assert.equal(chuanHoaNhom({ sanPhamId: 1, tongPhanLoai: 1, bienThe: [{ id: 1 }, { id: 2 }] }).tongPhanLoai, 2);
  assert.equal(chuanHoaNhom({ sanPhamId: 1, tongPhanLoai: "abc", bienThe: [{ id: 1 }] }).tongPhanLoai, 1);
});

test("chuanHoaNhom: thiếu tên/ảnh ở nhóm thì lấy từ SKU đầu", () => {
  const nhom = chuanHoaNhom({ sanPhamId: null, bienThe: [{ id: 1, tenSanPhamSan: "Tên sàn", anhDaiDien: null }, { id: 2, anhDaiDien: "b.jpg" }] });
  assert.equal(nhom.ten, "Tên sàn");
  assert.equal(nhom.anh, "b.jpg");
  assert.equal(nhom.khoa, "ten-Tên sàn");
});

test("dongCuaTrang: nối SKU của các nhóm theo thứ tự hiển thị", () => {
  const nhoms = [{ dong: [{ id: 3 }, { id: 1 }] }, { dong: [{ id: 2 }] }];
  assert.deepEqual(dongCuaTrang(nhoms).map((d) => d.id), [3, 1, 2]);
  assert.deepEqual(dongCuaTrang(undefined), []);
});

test("capNhatDongTrongTrang: chỉ thay đúng SKU, nhóm khác giữ nguyên tham chiếu", () => {
  const nhomA = { khoa: "sp-1", dong: [{ id: 1, trangThaiLienKet: "da_lien_ket" }, { id: 2, trangThaiLienKet: "da_lien_ket" }] };
  const nhomB = { khoa: "sp-2", dong: [{ id: 3 }] };
  const trang = { totalElements: 2, content: [nhomA, nhomB] };
  const moi = capNhatDongTrongTrang(trang, 2, (d) => ({ ...d, trangThaiLienKet: "chua_lien_ket" }));
  assert.equal(moi.totalElements, 2);
  assert.deepEqual(moi.content[0].dong.map((d) => d.trangThaiLienKet), ["da_lien_ket", "chua_lien_ket"]);
  assert.equal(moi.content[1], nhomB);
  assert.equal(trang.content[0].dong[1].trangThaiLienKet, "da_lien_ket", "không sửa dữ liệu cũ");
  assert.equal(capNhatDongTrongTrang(undefined, 1, (d) => d), undefined);
});

test("laMotPhanLoai: chỉ khi sản phẩm thật sự có một phân loại", () => {
  assert.equal(laMotPhanLoai({ dong: [{ id: 1 }], tongPhanLoai: 1 }), true);
  assert.equal(laMotPhanLoai({ dong: [{ id: 1 }], tongPhanLoai: 16 }), false, "đang lọc còn 1/16 vẫn là nhóm");
  assert.equal(laMotPhanLoai({ dong: [{ id: 1 }, { id: 2 }], tongPhanLoai: 2 }), false);
});

test("nhanSoPhanLoai: đủ thì 'N phân loại', đang lọc thì 'x/y phân loại'", () => {
  assert.equal(nhanSoPhanLoai({ dong: new Array(16).fill({}), tongPhanLoai: 16 }), "16 phân loại");
  assert.equal(nhanSoPhanLoai({ dong: [{}, {}], tongPhanLoai: 16 }), "2/16 phân loại");
  assert.equal(nhanSoPhanLoai({ dong: new Array(1200).fill({}), tongPhanLoai: 1200 }, (n) => n.toLocaleString("vi-VN")), "1.200 phân loại");
});

test("phanTrangTheoSanPham: mọi cỡ trang, mỗi sản phẩm xuất hiện đúng một lần và đủ SKU", () => {
  const ds = duLieu49();
  for (const size of [1, 2, 10, 20, 50, 100]) {
    const dau = phanTrangTheoSanPham(ds, ds, { page: 0, size });
    assert.equal(dau.totalElements, 3, "totalElements là số sản phẩm");
    const gap = new Map();
    for (let p = 0; p < dau.totalPages; p += 1) {
      for (const nhom of phanTrangTheoSanPham(ds, ds, { page: p, size }).content) {
        assert.equal(gap.has(nhom.sanPhamId), false, `sản phẩm ${nhom.sanPhamId} lặp ở trang khác (size ${size})`);
        gap.set(nhom.sanPhamId, nhom.bienThe.length);
        assert.equal(nhom.tongPhanLoai, nhom.bienThe.length);
      }
    }
    assert.deepEqual(Object.fromEntries(gap), { 12: 16, 6: 20, 9: 13 });
  }
});

test("phanTrangTheoSanPham: đang lọc thì nhóm chỉ còn SKU khớp, tổng phân loại vẫn của cả sản phẩm", () => {
  const ds = duLieu49();
  const khop = ds.filter((d) => d.id === 3 || d.id === 40);
  const trang = phanTrangTheoSanPham(khop, ds, { page: 0, size: 20 });
  assert.equal(trang.totalElements, 2);
  assert.deepEqual(trang.content.map((n) => [n.sanPhamId, n.bienThe.length, n.tongPhanLoai]), [[12, 1, 16], [9, 1, 13]]);
});

test("phanTrangTheoSanPham: trang vượt quá thì rỗng, tham số lỗi về mặc định", () => {
  const ds = duLieu49();
  assert.deepEqual(phanTrangTheoSanPham(ds, ds, { page: 9, size: 20 }).content, []);
  const macDinh = phanTrangTheoSanPham(ds, ds, { page: -1, size: 0 });
  assert.equal(macDinh.number, 0);
  assert.equal(macDinh.size, 20);
  assert.deepEqual(phanTrangTheoSanPham([], [], {}).content, []);
});
