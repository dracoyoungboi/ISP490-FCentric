// Chạy: node --test src/components/print/adapters/soTienBangChu.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { docSoNguyen, docSoTienBangChu } from "./soTienBangChu.js";

test("docSoNguyen: hàng đơn vị, chục và các cách đọc đặc biệt", () => {
    assert.equal(docSoNguyen(0), "không");
    assert.equal(docSoNguyen(5), "năm");
    assert.equal(docSoNguyen(10), "mười");
    assert.equal(docSoNguyen(11), "mười một");
    assert.equal(docSoNguyen(15), "mười lăm");
    assert.equal(docSoNguyen(21), "hai mươi mốt");
    assert.equal(docSoNguyen(25), "hai mươi lăm");
    assert.equal(docSoNguyen(105), "một trăm linh năm");
    assert.equal(docSoNguyen(110), "một trăm mười");
    assert.equal(docSoNguyen(999), "chín trăm chín mươi chín");
});

test("docSoNguyen: nhóm nghìn / triệu / tỷ và nhóm giữa có hàng trăm bằng 0", () => {
    assert.equal(docSoNguyen(1000), "một nghìn");
    assert.equal(docSoNguyen(10500), "mười nghìn năm trăm");
    assert.equal(docSoNguyen(1005000), "một triệu không trăm linh năm nghìn");
    assert.equal(docSoNguyen(4300000), "bốn triệu ba trăm nghìn");
    assert.equal(docSoNguyen(13900000), "mười ba triệu chín trăm nghìn");
    assert.equal(docSoNguyen(2000000005), "hai tỷ không trăm linh năm");
    assert.equal(docSoNguyen(2500000000), "hai tỷ năm trăm triệu");
    assert.equal(docSoNguyen(1000000000000), "một nghìn tỷ");
});

test("docSoTienBangChu: viết hoa chữ đầu, thêm 'đồng', làm tròn và giá trị không hợp lệ", () => {
    assert.equal(docSoTienBangChu(4300000), "Bốn triệu ba trăm nghìn đồng");
    assert.equal(docSoTienBangChu("13900000"), "Mười ba triệu chín trăm nghìn đồng");
    assert.equal(docSoTienBangChu(0), "Không đồng");
    assert.equal(docSoTienBangChu(1999.6), "Hai nghìn đồng");
    assert.equal(docSoTienBangChu(-50000), "Âm năm mươi nghìn đồng");
    assert.equal(docSoTienBangChu(null), null);
    assert.equal(docSoTienBangChu(""), null);
    assert.equal(docSoTienBangChu("abc"), null);
});
