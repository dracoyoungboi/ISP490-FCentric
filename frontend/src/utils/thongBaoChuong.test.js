import { test } from "node:test";
import assert from "node:assert/strict";
import { chuyenDanhSachThongBao, chuyenDongThongBao, daDocMot, daDocTatCa } from "./thongBaoChuong.js";

// Một trang đúng hình dạng máy chủ trả (ThongBaoDto.DanhSach)
const trang = {
  content: [
    {
      id: 7, loai: "phieu_chuyen_kho", tone: "success", nhom: "Chuyển kho",
      tieuDe: "Phiếu chuyển PX-TRF-202610281 đã được duyệt", moTa: "Lệnh điều động LDD-20261028-003.",
      duongDan: "/transfer-tickets/50", thoiGian: "2026-10-28T03:00:00Z", daDoc: false,
      loaiThamChieu: "phieu_chuyen_kho", idThamChieu: 50,
    },
    {
      id: 9, loai: "phieu_chuyen_kho", tone: "danger", nhom: "Chuyển kho", tieuDe: "Phiếu chuyển PX-TRF-202610282 bị từ chối",
      moTa: null, duongDan: "/transfer-tickets/51", thoiGian: "2026-10-28T05:00:00Z", daDoc: true,
    },
    { id: 8, loai: "phieu_chuyen_kho", tone: "la", tieuDe: "Cùng giờ, id nhỏ", duongDan: null, thoiGian: "2026-10-28T03:00:00Z", daDoc: false },
  ],
  totalElements: 3,
  totalPages: 1,
  soChuaDoc: 12,
};

test("API → chuông: đúng các trường NotificationBell dùng, mới nhất trước, cùng giờ thì id lớn trước", () => {
  const { items, soChuaDoc } = chuyenDanhSachThongBao(trang);
  assert.deepEqual(items.map((n) => n.id), [9, 8, 7]);
  assert.deepEqual(items[2], {
    id: 7, loai: "phieu_chuyen_kho", tone: "success", nhom: "Chuyển kho",
    tieuDe: "Phiếu chuyển PX-TRF-202610281 đã được duyệt", moTa: "Lệnh điều động LDD-20261028-003.",
    duongDan: "/transfer-tickets/50", thoiGian: "2026-10-28T03:00:00Z", daDoc: false,
  });
  assert.equal(items[1].tone, "info", "tone lạ → info");
  assert.equal(items[1].duongDan, null);
  assert.equal(soChuaDoc, 12, "số chưa đọc của mọi trang, do máy chủ đếm");
});

test("số chưa đọc: máy chủ không trả thì đếm trên trang; không nhỏ hơn số chưa đọc đang thấy", () => {
  const { soChuaDoc, ...khongSo } = trang;
  assert.equal(soChuaDoc, 12);
  assert.equal(chuyenDanhSachThongBao(khongSo).soChuaDoc, 2);
  assert.equal(chuyenDanhSachThongBao({ ...trang, soChuaDoc: 1 }).soChuaDoc, 2);
  assert.equal(chuyenDanhSachThongBao({ ...trang, soChuaDoc: "x" }).soChuaDoc, 2);
});

test("dữ liệu hỏng: bỏ dòng thiếu id / tiêu đề, bỏ id trùng, null hay mảng trần vẫn chạy", () => {
  const { items } = chuyenDanhSachThongBao({
    content: [null, { id: 1 }, { tieuDe: "Không id" }, { id: 2, tieuDe: "  " }, { id: 3, tieuDe: "A" }, { id: 3, tieuDe: "A lặp" }],
  });
  assert.deepEqual(items.map((n) => n.tieuDe), ["A"]);
  assert.deepEqual(chuyenDanhSachThongBao(null), { items: [], soChuaDoc: 0 });
  assert.deepEqual(chuyenDanhSachThongBao(undefined), { items: [], soChuaDoc: 0 });
  assert.equal(chuyenDanhSachThongBao([{ id: 1, tieuDe: "Mảng trần", daDoc: false }]).soChuaDoc, 1);
  assert.equal(chuyenDongThongBao({ id: 4, tieuDe: "Không giờ" }).thoiGian, null);
});

test("đường dẫn: chỉ nhận đường dẫn trong ứng dụng", () => {
  const dd = (duongDan) => chuyenDongThongBao({ id: 1, tieuDe: "T", duongDan }).duongDan;
  assert.equal(dd("/transfer-tickets/12"), "/transfer-tickets/12");
  assert.equal(dd("https://ngoai.example/x"), null);
  assert.equal(dd("//ngoai.example/x"), null);
  assert.equal(dd("javascript:alert(1)"), null);
  assert.equal(dd(""), null);
});

test("đánh dấu đã đọc một dòng: trừ số chỉ khi dòng đang chưa đọc; dòng lạ hoặc đã đọc thì giữ nguyên", () => {
  const tt = chuyenDanhSachThongBao(trang);
  const sau = daDocMot(tt, 7);
  assert.equal(sau.items.find((n) => n.id === 7).daDoc, true);
  assert.equal(sau.soChuaDoc, 11);
  assert.equal(tt.items.find((n) => n.id === 7).daDoc, false, "không sửa trạng thái cũ");
  assert.equal(daDocMot(sau, 7), sau);
  assert.equal(daDocMot(sau, 9), sau);
  assert.equal(daDocMot(sau, 999), sau);
  assert.equal(daDocMot({ items: [{ id: 1, daDoc: false }], soChuaDoc: 0 }, 1).soChuaDoc, 0, "không âm");
});

test("đọc hết: mọi dòng đã đọc, số về 0", () => {
  const sau = daDocTatCa(chuyenDanhSachThongBao(trang));
  assert.ok(sau.items.every((n) => n.daDoc));
  assert.equal(sau.soChuaDoc, 0);
});
