import { test } from "node:test";
import assert from "node:assert/strict";
import { KHO_TEM, getLabelPageCss, layKhoTem, leCuonTem } from "./paperStyles.js";
import {
    CAO_VACH_TOI_THIEU_MM,
    LY_DO_BO_QUA,
    boCucChuTem,
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
    maVachSku: `20000000${String(id).padStart(2, "0")}`, giaBan: 2000000, trangThai: 1, ...extra,
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

test("số tem mặc định theo nơi mở: phiếu → SL nhập, còn lại → 1; sửa tay thì giữ số đã sửa", () => {
    assert.equal(cheDoMacDinh("phieu"), "nhap");
    assert.equal(cheDoMacDinh("chon"), "mot");
    const d = sku(1, { soLuong: 12 });
    assert.equal(soTemCuaDong(d, "nhap"), 12);
    assert.equal(soTemCuaDong(d, "mot"), 1);
    assert.equal(soTemCuaDong(d, "nhap", { 1: 0 }), 0);
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

// Đo giả: mỗi ký tự rộng 0,66 cỡ chữ (đậm) / 0,58 (thường) — tem 35 mm chứa 21 ký tự tên đậm cỡ 2,2 mm
const doGia = (chu, co, dam) => chu.length * (dam ? 0.66 : 0.58) * co;
const tenTem = (tenSanPham, them = {}) => sku(1, { tenSanPham, ...them });

test("tên tem vừa một dòng: giữ cỡ gốc, vạch 8 mm, không báo cắt", () => {
    const b = boCucChuTem(tenTem("Áo thun basic"), K35, {}, doGia);
    assert.deepEqual(b.ten, ["Áo thun basic"]);
    assert.equal(b.coTen, K35.coChu.ten);
    assert.equal(b.caoVach, K35.caoVach);
    assert.equal(b.catTen, false);
});

test("tên hơi dài: co chữ (không dưới 85%) để vừa một dòng", () => {
    const b = boCucChuTem(tenTem("ÁO KHOÁC CLIMAWARM HYBRID"), K35, { coTenCuaHang: true }, doGia);
    assert.equal(b.ten.length, 1);
    assert.ok(b.coTen < K35.coChu.ten && b.coTen >= K35.coChu.ten * 0.85);
    assert.ok(doGia(b.ten[0], b.coTen, true) <= 31 + 1e-9);
    assert.equal(b.catTen, false);
});

test("tên rất dài: xuống 2 dòng theo từ khi vạch còn đủ cao", () => {
    const ten = "QUẦN JOGGER NỈ BÔNG DÂY RÚT PHẢN QUANG";
    const khong = boCucChuTem(tenTem(ten), K35, {}, doGia);
    assert.deepEqual(khong.ten, ["QUẦN JOGGER NỈ BÔNG", "DÂY RÚT PHẢN QUANG"]);
    assert.equal(khong.coTen, K35.coChu.ten);
    assert.equal(khong.caoVach, 8, "không in tên cửa hàng, SKU: vừa sẵn, vạch giữ 8 mm");
    assert.equal(khong.catTen, false);
    const cuaHang = boCucChuTem(tenTem(ten), K35, { coTenCuaHang: true }, doGia);
    assert.equal(cuaHang.ten.length, 2);
    assert.equal(cuaHang.caoVach, 7.6, "có dòng tên cửa hàng: vạch thấp lại 0,4 mm");
    assert.ok(cuaHang.caoVach >= CAO_VACH_TOI_THIEU_MM);
});

test("in cả tên cửa hàng và SKU: không đủ chỗ 2 dòng, co 85% rồi cắt … và báo", () => {
    const b = boCucChuTem(tenTem("QUẦN JOGGER NỈ BÔNG DÂY RÚT PHẢN QUANG"), K35, { coTenCuaHang: true, coSku: true }, doGia);
    assert.equal(b.ten.length, 1);
    assert.ok(b.ten[0].endsWith("…"));
    assert.equal(b.coTen, K35.coChu.ten * 0.85);
    assert.equal(b.caoVach, K35.caoVach, "vạch giữ nguyên cao");
    assert.equal(b.catTen, true);
    assert.ok(doGia(b.ten[0], b.coTen, true) <= 31);
});

test("tên dài hơn 2 dòng: dòng 2 cắt … và báo; tem 50 × 30 vẫn đủ chỗ 2 dòng khi bật cả hai", () => {
    const ten = "QUẦN JOGGER NỈ BÔNG DÂY RÚT PHẢN QUANG PHONG CÁCH THỂ THAO HÀN QUỐC";
    const b = boCucChuTem(tenTem(ten), K35, {}, doGia);
    assert.equal(b.ten.length, 2);
    assert.ok(b.ten[1].endsWith("…"));
    assert.equal(b.catTen, true);
    const k50 = boCucChuTem(tenTem(ten), K50, { coTenCuaHang: true, coSku: true }, doGia);
    assert.equal(k50.ten.length, 2);
    assert.ok(k50.caoVach >= CAO_VACH_TOI_THIEU_MM && k50.caoVach < K50.caoVach);
});

test("Màu - Kích cỡ dài: co tới 85% rồi cắt …, không xuống dòng", () => {
    const vua = boCucChuTem(tenTem("Áo", { tenMau: "Xanh rêu đậm", kichCo: "XXL" }), K35, {}, doGia);
    assert.equal(vua.bienThe, "Xanh rêu đậm - XXL");
    assert.equal(vua.catBienThe, false);
    const dai = boCucChuTem(tenTem("Áo", { tenMau: "Xanh rêu đậm pha xám tro nhạt", kichCo: "XXL" }), K35, {}, doGia);
    assert.ok(dai.bienThe.endsWith("…"));
    assert.equal(dai.coBienThe, K35.coChu.bienThe * 0.85);
    assert.equal(dai.catBienThe, true);
});
