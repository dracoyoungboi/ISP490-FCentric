// Chạy: node --test src/pages/product/components/product/logicBienThe.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { bienTheReducer, demDongApGiaChung, khoaBienThe, tinhNhomBienThe, trangThaiBanDau } from "./logicBienThe.js";
import { khoiTaoSuaBienThe, suaBienTheReducer, tinhNhomSua } from "./logicSuaBienThe.js";

const KICH_CO = [{ id: 10 }, { id: 11 }, { id: 12 }];

const taoForm = (...hanhDong) => hanhDong.reduce(bienTheReducer, trangThaiBanDau());

test("form Thêm: câu báo áp giá chung chỉ đếm dòng đang tích", () => {
    const state = taoForm(
        { type: "themMau", mauSacIds: [1, 2] },
        { type: "chonKichCo", sizeIds: [10, 11, 12] },
        { type: "batTatToHop", khoa: khoaBienThe(1, 10) },
        { type: "batTatToHop", khoa: khoaBienThe(2, 12) },
    );
    const nhom = tinhNhomBienThe(state, KICH_CO);
    assert.deepEqual(demDongApGiaChung(nhom), { soApDung: 4, soKhoaGia: 0 });
});

test("form Thêm: dòng bỏ tích vẫn nhận giá chung, tích lại thấy đúng giá", () => {
    let state = taoForm(
        { type: "themMau", mauSacIds: [1] },
        { type: "chonKichCo", sizeIds: [10, 11] },
        { type: "batTatToHop", khoa: khoaBienThe(1, 10) },
        { type: "apDungGiaChung", giaVon: 100000, giaBan: 150000 },
    );
    assert.equal(demDongApGiaChung(tinhNhomBienThe(state, KICH_CO)).soApDung, 1);
    state = bienTheReducer(state, { type: "batTatToHop", khoa: khoaBienThe(1, 10) });
    const [{ dong }] = tinhNhomBienThe(state, KICH_CO);
    assert.deepEqual(
        dong.map((d) => [d.tao, d.giaVon, d.giaBan]),
        [
            [true, 100000, 150000],
            [true, 100000, 150000],
        ],
    );
});

test("form Thêm: bỏ tích hết thì báo 0 dòng", () => {
    const state = taoForm(
        { type: "themMau", mauSacIds: [1] },
        { type: "chonKichCo", sizeIds: [10] },
        { type: "batTatToHop", khoa: khoaBienThe(1, 10) },
    );
    assert.deepEqual(demDongApGiaChung(tinhNhomBienThe(state, KICH_CO)), { soApDung: 0, soKhoaGia: 0 });
});

test("form Chỉnh sửa: đếm biến thể đã lưu (trừ dòng khóa giá) và tổ hợp mới đang tích", () => {
    const bienThe = (id, sizeId, conTonKho) => ({
        id,
        mauSac: { id: 1 },
        size: { id: sizeId },
        maSku: `SKU-${id}`,
        giaVon: 100000,
        giaBan: 120000,
        trangThai: 1,
        conTonKho,
    });
    let state = khoiTaoSuaBienThe([bienThe(1, 10, true), bienThe(2, 11, false)]);
    // Thêm kích cỡ 12 cho màu 1 (tổ hợp mới đang tích), thêm màu 2 rồi bỏ tích một tổ hợp của nó.
    state = suaBienTheReducer(state, { type: "chonKichCo", sizeIds: [12] });
    state = suaBienTheReducer(state, { type: "batTatMau", mauSacId: 2 });
    state = suaBienTheReducer(state, { type: "batTatToHop", khoa: khoaBienThe(2, 10) });
    const nhom = tinhNhomSua(state, KICH_CO);
    const moi = nhom.flatMap((n) => n.dong).filter((d) => d.loai !== "cu");
    assert.equal(moi.filter((d) => d.tao).length, 3, "tổ hợp mới đang tích: 1-12, 2-11, 2-12");
    assert.equal(moi.filter((d) => !d.tao).length, 1);
    // 2 biến thể đã lưu (1 khóa giá) + 3 tổ hợp mới đang tích
    assert.deepEqual(demDongApGiaChung(nhom), { soApDung: 4, soKhoaGia: 1 });
});
