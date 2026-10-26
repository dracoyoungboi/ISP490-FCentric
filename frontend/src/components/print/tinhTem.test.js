import { test } from "node:test";
import assert from "node:assert/strict";
import { KHO_TEM, getLabelPageCss, layKhoTem, leCuonTem } from "./paperStyles.js";
import {
    LY_DO_BO_QUA,
    cheDoMacDinh,
    dungLanIn,
    giaTrenTem,
    gioiHanSoTem,
    lyDoBoQua,
    maVachTem,
    nhanBienThe,
    soTemCuaDong,
    timDongTheoMa,
    pxMoiMmXemTruoc,
} from "./tinhTem.js";

// Chạy: node --test src/components/print/tinhTem.test.js

const K35 = KHO_TEM["35x22"];
const K50 = KHO_TEM["50x30"];
const sku = (id, extra = {}) => ({
    id, tenSanPham: "Nike Sportswear", tenMau: "Đen", kichCo: "M", maSku: `AK2610234-CL001-M-MS-${id}`,
    maVachSku: `20000000${String(id).padStart(2, "0")}`, giaBan: 2000000, trangThai: 1, tonKho: 3, ...extra,
});

test("khổ tem dựng sẵn: 35×22 hai cột trên cuộn 74 mm, 50×30 một cột trên cuộn 52 mm, lề cuộn 1 mm", () => {
    assert.equal(K35.soCot, 2);
    assert.equal(leCuonTem(K35), 1);
    assert.equal(K50.soCot, 1);
    assert.equal(leCuonTem(K50), 1);
    assert.equal(layKhoTem("A4"), K35, "mã lạ về khổ mặc định");
    assert.match(getLabelPageCss(K35), /@page \{ size: 74mm 22mm !important; margin: 0 !important; \}/);
    assert.match(getLabelPageCss(K50), /size: 52mm 30mm/);
});

test("mã vạch 10 chữ số: 90 mô-đun, rộng 22,5 mm + vùng trắng 10 mô-đun mỗi bên = 27,5 mm, vừa tem 35 mm", () => {
    const vach = maVachTem("2000000150");
    assert.equal(vach.soMoDun, 90);
    assert.equal(vach.rongVachMm, 22.5);
    assert.equal(vach.rongMm, 27.5);
    assert.ok(vach.vach.length > 0 && vach.vach.every((b) => b.width >= 1));
    assert.equal(lyDoBoQua(sku(1, { maVachSku: "2000000150" }), K35), null);
});

test("SKU dài làm mã vạch thì quá dài cho tem 35 mm (≈ 77 mm)", () => {
    const vach = maVachTem("AK2610234-CL001-S-MS-2691");
    assert.ok(vach.rongMm > 33, `rộng ${vach.rongMm} mm`);
    assert.equal(lyDoBoQua(sku(1, { maVachSku: "AK2610234-CL001-S-MS-2691" }), K35), LY_DO_BO_QUA.dai);
    assert.equal(lyDoBoQua(sku(1, { maVachSku: "AK2610234-CL001-S-MS-2691" }), K50), LY_DO_BO_QUA.dai);
});

test("lý do bỏ qua theo thứ tự: ngừng → chưa có giá → thiếu mã → ký tự lạ", () => {
    assert.equal(lyDoBoQua(sku(1, { trangThai: 0, giaBan: 0 }), K35), LY_DO_BO_QUA.ngung);
    assert.equal(lyDoBoQua(sku(1, { giaBan: 0, maVachSku: "" }), K35), LY_DO_BO_QUA.chuaGia);
    assert.equal(lyDoBoQua(sku(1, { giaBan: null }), K35), LY_DO_BO_QUA.chuaGia);
    assert.equal(lyDoBoQua(sku(1, { maVachSku: "  " }), K35), LY_DO_BO_QUA.thieuMa);
    assert.equal(lyDoBoQua(sku(1, { maVachSku: null }), K35), LY_DO_BO_QUA.thieuMa);
    assert.equal(lyDoBoQua(sku(1, { maVachSku: "MÃ-01" }), K35), LY_DO_BO_QUA.kyTu);
    assert.equal(maVachTem(" 2000000150"), null, "khoảng trắng đầu/cuối: không in mã khác mã đã lưu");
});

test("số tem mặc định theo nơi mở: phiếu → SL nhập, đổi giá → tồn, còn lại → 1; sửa tay thì giữ số đã sửa", () => {
    assert.equal(cheDoMacDinh("phieu"), "nhap");
    assert.equal(cheDoMacDinh("doi-gia"), "ton");
    assert.equal(cheDoMacDinh("chon"), "mot");
    const d = sku(1, { soLuong: 12, tonKho: 7 });
    assert.equal(soTemCuaDong(d, "nhap"), 12);
    assert.equal(soTemCuaDong(d, "ton"), 7);
    assert.equal(soTemCuaDong(d, "mot"), 1);
    assert.equal(soTemCuaDong(d, "ton", { 1: 0 }), 0);
    assert.equal(soTemCuaDong(sku(2, { tonKho: "4.000" }), "ton"), 4);
    assert.equal(gioiHanSoTem(12000), 9999);
    assert.equal(gioiHanSoTem(-3), 0);
    assert.equal(gioiHanSoTem("abc"), 0);
});

test("dựng lần in: bỏ dòng lỗi, chia hàng theo số cột, đếm SKU có tem", () => {
    const ds = [
        sku(1, { soLuong: 3 }),
        sku(2, { soLuong: 2, giaBan: 0 }),
        sku(3, { soLuong: 0 }),
        sku(4, { soLuong: 2, trangThai: 0 }),
        sku(5, { soLuong: 2 }),
    ];
    const lan = dungLanIn({ dong: ds, cheDo: "nhap", kho: K35 });
    assert.equal(lan.tong, 5);
    assert.equal(lan.hang.length, 3, "5 tem, 2 tem mỗi hàng");
    assert.deepEqual(lan.hang.map((h) => h.map((d) => d.id)), [[1, 1], [1, 5], [5]]);
    assert.equal(lan.soSku, 2, "SKU 3 có 0 tem không tính");
    assert.deepEqual(lan.boQua.map((b) => [b.dong.id, b.lyDo]), [[2, "Chưa có giá bán"], [4, "Ngừng hoạt động"]]);

    const lan50 = dungLanIn({ dong: ds, cheDo: "nhap", kho: K50 });
    assert.equal(lan50.hang.length, 5, "khổ 50×30 một tem mỗi hàng");
});

test("không có tem hợp lệ: tổng 0, không có hàng", () => {
    const lan = dungLanIn({ dong: [sku(1, { trangThai: 0 })], cheDo: "mot", kho: K35 });
    assert.equal(lan.tong, 0);
    assert.deepEqual(lan.hang, []);
});

test("chữ trên tem: Màu - Kích cỡ, giá có dấu chấm và ₫, tìm theo mã quét", () => {
    assert.equal(nhanBienThe({ tenMau: "Xanh nhạt", kichCo: "30" }), "Xanh nhạt - 30");
    assert.equal(nhanBienThe({ tenMau: "Đen", kichCo: null }), "Đen");
    assert.equal(giaTrenTem(2000000), "2.000.000 ₫");
    assert.equal(giaTrenTem("199000.00"), "199.000 ₫");
    const ds = [sku(1), sku(2)];
    assert.equal(timDongTheoMa(ds, " 2000000002 ").id, 2);
    assert.equal(timDongTheoMa(ds, "ak2610234-cl001-m-ms-1").id, 1);
    assert.equal(timDongTheoMa(ds, "khong-co"), null);
    assert.equal(timDongTheoMa(ds, ""), null);
});

test("xem trước: phóng một tem vừa khung, tối đa 8 px/mm", () => {
    assert.equal(pxMoiMmXemTruoc(K35), 8);
    assert.equal(pxMoiMmXemTruoc(K50), 5.6);
    assert.ok(K50.rongTem * pxMoiMmXemTruoc(K50) <= 280);
    assert.equal(pxMoiMmXemTruoc(K35, 200), 5.7);
});
