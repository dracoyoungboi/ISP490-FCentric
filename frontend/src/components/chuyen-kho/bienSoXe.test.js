// Chạy: node --test src/components/chuyen-kho/bienSoXe.test.js
// Bộ ca giống BienSoXeTest.java (máy chủ) để hai phía không lệch nhau.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MA_DIA_PHUONG_BIEN_SO, kiemTraBienSo } from "./bienSoXe.js";

const NHAN = [
    // [gõ vào, lưu thành, loại]
    ["30A-123.45", "30A-123.45", "O_TO"],
    ["30a12345", "30A-123.45", "O_TO"],
    ["30A 123 45", "30A-123.45", "O_TO"],
    ["30A-12345", "30A-123.45", "O_TO"],
    ["30A-123,45", "30A-123.45", "O_TO"],
    [" 51k – 678.90 ", "51K-678.90", "O_TO"],
    ["29C-012.34", "29C-012.34", "O_TO"],
    ["80B-001.23", "80B-001.23", "O_TO"],
    ["39A-123.45", "39A-123.45", "O_TO"],
    ["29A-1234", "29A-1234", "O_TO"],
    ["29a1234", "29A-1234", "O_TO"],
    ["20KT-226.22", "20KT-226.22", "O_TO"],
    ["15RM-012.34", "15RM-012.34", "O_TO"],
    ["29HC12345", "29HC-123.45", "O_TO"],
    ["51LD-123.45", "51LD-123.45", "O_TO"],
    ["51R-141.39", "51R-141.39", "O_TO"],
    ["50TĐ-821.08", "50TĐ-821.08", "O_TO"],
    ["50tđ82108", "50TĐ-821.08", "O_TO"],
    ["29-B1 123.45", "29-B1 123.45", "XE_MAY"],
    ["29B1-123.45", "29-B1 123.45", "XE_MAY"],
    ["29B112345", "29-B1 123.45", "XE_MAY"],
    ["30-AB 266.59", "30-AB 266.59", "XE_MAY"],
    ["30ab26659", "30-AB 266.59", "XE_MAY"],
    ["29-AR 123.45", "29-AR 123.45", "XE_MAY"],
    ["29-MĐ1 013.53", "29-MĐ1 013.53", "XE_MAY"],
    ["29-md1 013.53", "29-MĐ1 013.53", "XE_MAY"],
    ["29-B1 1234", "29-B1 1234", "XE_MAY"],
    ["29-KT 123.45", "29-KT 123.45", "XE_MAY"],
    ["29-MD 123.45", "29-MD 123.45", "XE_MAY"],
    ["29MD12345", "29-MD 123.45", "XE_MAY"],
    ["29-MK1 2345", "29-MK1 2345", "XE_MAY"],
    ["29B1 1234", "29-B1 1234", "XE_MAY"],
    ["29 - B1  123 . 45", "29-B1 123.45", "XE_MAY"],
    ["30 A 123.45", "30A-123.45", "O_TO"],
    ["20 KT 226.22", "20KT-226.22", "O_TO"],
    ["29B11234", "29B-112.34", "O_TO"],
    ["29KT12345", "29KT-123.45", "O_TO"],
    ["T80-235.88", "T80-235.88", "TAM_THOI"],
    ["t29 12345", "T29-123.45", "TAM_THOI"],
];

const CHAN = [
    "", "   ", null, "A", "xe 9 tấn", "30AS-012345", "30I-123.45", "30O-123.45", "3OA-123.45", "30Q-1234", "30W-123.45",
    "30A-123.456", "30A-123", "30A-12.345", "30A--123.45", "30A-000.00", "30A-0000", "29-W1 123.45", "29-B0 123.45",
    "13A-123.45", "42A-123.45", "10A-123.45", "05A-123.45", "80-441-NG-02", "TM-12-34", "T13-123.45", "T80-000.00",
    "30A-123.45 / 29R-012.34", "29-B 123.45", "29-B 1234", "T-80-235.88", "29-AB1 23.45", "29-B11 234", "30A-1234 5",
];

test("nhận biển ô tô, xe máy, biển tạm và lưu cách viết chuẩn", () => {
    for (const [vao, giaTri, loai] of NHAN) {
        assert.deepEqual(kiemTraBienSo(vao), { hopLe: true, giaTri, loai }, JSON.stringify(vao));
    }
});

test("chặn biển sai mẫu, kèm câu lỗi", () => {
    for (const vao of CHAN) {
        const kq = kiemTraBienSo(vao);
        assert.equal(kq.hopLe, false, JSON.stringify(vao));
        assert.ok(kq.loi, JSON.stringify(vao));
    }
});

test("câu lỗi chỉ ra chỗ sai", () => {
    assert.equal(kiemTraBienSo("").loi, "Nhập biển số xe");
    assert.match(kiemTraBienSo("3OA-123.45").loi, /có thể là số 0 hoặc 1/);
    assert.match(kiemTraBienSo("30O-123.45").loi, /không dùng chữ I, J, O, Q, W/);
    assert.match(kiemTraBienSo("42A-123.45").loi, /"42" không phải ký hiệu địa phương/);
    assert.match(kiemTraBienSo("30AS-012345").loi, /Ví dụ ô tô 30A-123.45/);
    assert.equal(kiemTraBienSo("30A-000.00").loi, "Số thứ tự trên biển không được toàn số 0");
    assert.equal(kiemTraBienSo("T80-000.00").loi, "Số thứ tự trên biển không được toàn số 0");
});

test("bảng ký hiệu địa phương: 81 mã của Phụ lục 02 Thông tư 51/2025", () => {
    assert.equal(MA_DIA_PHUONG_BIEN_SO.size, 81);
    for (const ma of ["11", "29", "39", "41", "80", "99"]) assert.ok(MA_DIA_PHUONG_BIEN_SO.has(ma), ma);
    for (const ma of ["10", "13", "42", "44", "45", "46", "87", "91", "96"]) assert.ok(!MA_DIA_PHUONG_BIEN_SO.has(ma), ma);
});

test("dán từ nơi khác: khoảng trắng không ngắt, ký tự rộng 0, gạch dài, chữ Ð, dấu chấm giữa", () => {
    const k = (...ma) => String.fromCharCode(...ma);
    assert.equal(kiemTraBienSo(`30A${k(0xa0)}123.45`).giaTri, "30A-123.45");
    assert.equal(kiemTraBienSo(`30A-123${k(0x200b)}.45`).giaTri, "30A-123.45");
    assert.equal(kiemTraBienSo(`30A${k(0x2014)}123${k(0xb7)}45`).giaTri, "30A-123.45");
    assert.equal(kiemTraBienSo(`29-M${k(0xd0)}1 013.53`).giaTri, "29-MĐ1 013.53");
    assert.equal(kiemTraBienSo(`30A${k(0x2212)}123.45`).giaTri, "30A-123.45");
    // Gạch mới của Unicode 14 (Java 17 chưa biết): hai phía cùng chặn
    assert.equal(kiemTraBienSo(`30A${k(0x2e5d)}123.45`).hopLe, false);
});

test("chuỗi quá 64 ký tự thì chặn ngay", () => {
    assert.equal(kiemTraBienSo(`30A-123.45${" ".repeat(55)}`).loi, "Biển số chưa đúng mẫu. Ví dụ ô tô 30A-123.45, xe máy 29-AB 123.45");
    assert.equal(kiemTraBienSo(`30A-123.45${" ".repeat(54)}`).giaTri, "30A-123.45");
});

test("chuẩn hóa lại cách viết chuẩn thì giữ nguyên", () => {
    for (const [, giaTri] of NHAN) assert.equal(kiemTraBienSo(giaTri).giaTri, giaTri);
});
