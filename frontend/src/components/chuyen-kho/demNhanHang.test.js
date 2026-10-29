// Chạy: node --test src/components/chuyen-kho/demNhanHang.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
    chiaLo,
    chonLyDo,
    chuanHoaPhienNhan,
    datTay,
    doiGhiChu,
    doiHongTay,
    doiSoHong,
    doiSoLuong,
    ghepLyDo,
    hoanTacLuot,
    loDangChoLyDo,
    LY_DO_CHUA_CHON,
    luotChoLyDo,
    luotDeHoanTac,
    phienCoSo,
    phienNhanMoi,
    thanhDat,
    thanhHong,
    themLuot,
    timBienTheTheoMa,
    tinhNhan,
    vanTayLo,
} from "./demNhanHang.js";
import { yeuCauNhanLech } from "./hienThiChuyenKho.js";

// Áo trắng M có 2 lô (5 + 3), quần short 1 lô 4
const LO = [
    { bienTheId: 1, sku: "AT-01", maVach: "893001", loHangId: 11, maLo: "L1", soLuong: 5 },
    { bienTheId: 1, sku: "AT-01", maVach: "893001", loHangId: 12, maLo: "L2", soLuong: 3 },
    { bienTheId: 2, sku: "QS-02", maVach: null, loHangId: 21, maLo: "L3", soLuong: 4 },
];
const quet = (phien, bienTheId, soLuong = 1, ma = "AT-01") => themLuot(phien, LO, { bienTheId, ma, soLuong, nguon: "quét SKU", gio: "10:00:00" });
const so = (phien, khoa) => {
    const r = phien.dem[khoa] ?? { dat: 0, hong: {} };
    return { dat: r.dat, hong: r.hong };
};

test("timBienTheTheoMa: SKU hoặc mã vạch FCentric, không phân biệt hoa thường", () => {
    assert.deepEqual(timBienTheTheoMa(LO, "at-01"), { bienTheId: 1, nguon: "quét SKU" });
    assert.deepEqual(timBienTheTheoMa(LO, " 893001 "), { bienTheId: 1, nguon: "mã vạch FCentric" });
    assert.equal(timBienTheTheoMa(LO, "khong-co"), null);
    assert.equal(timBienTheTheoMa(LO, ""), null);
});

test("themLuot: mặc định Đạt, chia sang lô sau khi lô đầu đủ, đủ số gửi thì không cộng", () => {
    let p = phienNhanMoi();
    ({ phien: p } = quet(p, 1, 4));
    assert.equal(so(p, "1-11").dat, 4);
    const kq = quet(p, 1, 3);
    assert.equal(kq.tinh, 3);
    assert.deepEqual(kq.luot.phan, [{ khoa: "1-11", sl: 1 }, { khoa: "1-12", sl: 2 }]);
    p = kq.phien;
    assert.equal(so(p, "1-11").dat, 5);
    assert.equal(so(p, "1-12").dat, 2);
    // Còn 1: gõ 12* chỉ tính 1
    const cat = quet(p, 1, 12);
    assert.equal(cat.tinh, 1);
    p = cat.phien;
    const du = quet(p, 1, 1);
    assert.equal(du.luot, null);
    assert.equal(du.phien, p);
    assert.equal(p.cur, cat.luot.id);
});

test("thanhHong + chonLyDo: lượt chuyển phần sang Hỏng, chờ lý do rồi ghi theo lý do", () => {
    let p = quet(phienNhanMoi(), 2, 3, "QS-02").phien;
    p = thanhHong(p, LO);
    assert.deepEqual(so(p, "2-21"), { dat: 2, hong: { [LY_DO_CHUA_CHON]: 1 } });
    assert.ok(luotChoLyDo(p));
    p = chonLyDo(p, LO, "Rách vải");
    assert.deepEqual(so(p, "2-21"), { dat: 2, hong: { "Rách vải": 1 } });
    assert.equal(luotChoLyDo(p), null);
    p = doiSoHong(p, LO, 1);
    assert.deepEqual(so(p, "2-21"), { dat: 1, hong: { "Rách vải": 2 } });
    p = doiSoHong(p, LO, 5); // tối đa bằng số lượng của lượt
    assert.deepEqual(so(p, "2-21"), { dat: 0, hong: { "Rách vải": 3 } });
    p = thanhDat(p, LO);
    assert.deepEqual(so(p, "2-21"), { dat: 3, hong: {} });
});

test("doiSoLuong: chia lại lô, không vượt chỗ còn trống, tối thiểu 1", () => {
    let p = quet(phienNhanMoi(), 1, 4).phien;
    p = doiSoLuong(p, LO, 3);
    assert.equal(so(p, "1-11").dat, 5);
    assert.equal(so(p, "1-12").dat, 2);
    p = doiSoLuong(p, LO, 10);
    assert.equal(so(p, "1-11").dat + so(p, "1-12").dat, 8);
    p = doiSoLuong(p, LO, -20);
    assert.equal(so(p, "1-11").dat, 1);
    assert.equal(so(p, "1-12").dat, 0);
});

test("hoanTacLuot / luotDeHoanTac: trừ đúng phần của lượt, lùi dần khi quét HOÀN TÁC nhiều lần", () => {
    let p = phienNhanMoi();
    const a = quet(p, 1, 2);
    p = a.phien;
    const b = quet(p, 2, 1, "QS-02");
    p = thanhHong(b.phien, LO);
    p = chonLyDo(p, LO, "Ố bẩn");
    let kq = hoanTacLuot(p, luotDeHoanTac(p).id);
    p = kq.phien;
    assert.equal(kq.luot.id, b.luot.id);
    assert.deepEqual(so(p, "2-21"), { dat: 0, hong: {} });
    assert.equal(p.cur, null);
    kq = hoanTacLuot(p, luotDeHoanTac(p).id);
    p = kq.phien;
    assert.equal(kq.luot.id, a.luot.id);
    assert.equal(so(p, "1-11").dat, 0);
    assert.equal(luotDeHoanTac(p), null);
    assert.equal(hoanTacLuot(p, a.luot.id).luot, null);
    assert.equal(p.log.length, 2);
});

test("datTay / doiHongTay: hộp Hỏng không vượt Gửi − Đạt − Hỏng", () => {
    const lo = LO[2];
    let p = datTay(phienNhanMoi(), "2-21", "3");
    p = doiHongTay(p, lo, "Bung chỉ", 1);
    assert.deepEqual(so(p, "2-21").hong, { "Bung chỉ": 1 });
    assert.equal(doiHongTay(p, lo, "Bung chỉ", 1), p);
    p = doiHongTay(p, lo, "Bung chỉ", -1);
    assert.deepEqual(so(p, "2-21").hong, {});
    assert.equal(datTay(p, "2-21", -4).dem["2-21"].dat, 0);
});

test("gõ tay vào lô của lượt hiện tại: lượt xong, sửa lượt sau đó không cộng lại phần cũ (không vượt số gửi)", () => {
    let p = quet(phienNhanMoi(), 2, 3, "QS-02").phien;
    p = datTay(p, "2-21", 2);
    assert.equal(p.cur, null);
    p = doiHongTay(p, LO[2], "Rách vải", 2);
    p = thanhDat(p, LO); // không còn lượt hiện tại: không đổi gì
    assert.deepEqual(so(p, "2-21"), { dat: 2, hong: { "Rách vải": 2 } });
    // Gõ tay lô khác: lượt hiện tại vẫn sửa được
    let q = quet(phienNhanMoi(), 2, 1, "QS-02").phien;
    q = datTay(q, "1-11", 5);
    assert.notEqual(q.cur, null);
});

test("lô đang chờ chọn lý do hỏng: chưa cho gõ tay, chưa cho quét lượt mới", () => {
    let p = quet(phienNhanMoi(), 2, 2, "QS-02").phien;
    p = thanhHong(p, LO);
    assert.equal(loDangChoLyDo(p, "2-21"), true);
    assert.equal(loDangChoLyDo(p, "1-11"), false);
    assert.equal(datTay(p, "2-21", 0), p);
    assert.equal(doiHongTay(p, LO[2], "Bung chỉ", 1), p);
    const moi = quet(p, 1, 1);
    assert.equal(moi.luot, null);
    assert.equal(moi.choLyDo.id, p.cur);
    assert.equal(moi.phien, p);
});

test("ghepLyDo: hỏng theo lý do + ghi chú phần thiếu, tối đa 255 ký tự", () => {
    assert.equal(ghepLyDo({ hong: 1, thieu: 1, lyDos: [["Bung chỉ", 1]], ghiChu: " Không thấy trong kiện " }), "Hỏng 1: Bung chỉ. Thiếu 1: Không thấy trong kiện");
    assert.equal(ghepLyDo({ hong: 3, thieu: 0, lyDos: [["Rách vải", 2], ["Khác", 1]], ghiChu: "dính sơn" }), "Hỏng 3: Rách vải 2, Khác 1 (dính sơn)");
    assert.equal(ghepLyDo({ hong: 1, thieu: 1, lyDos: [["Khác", 1]], ghiChu: "dính sơn, thiếu 1 cái" }), "Hỏng 1: Khác. Thiếu 1. Ghi chú: dính sơn, thiếu 1 cái");
    assert.equal(ghepLyDo({ hong: 0, thieu: 2, lyDos: [], ghiChu: "rơi trên xe" }), "Thiếu 2: rơi trên xe");
    assert.equal(ghepLyDo({ hong: 0, thieu: 0, lyDos: [], ghiChu: "" }), "");
    // Quá 255: cắt bớt ghi chú (đánh dấu …), phần số lượng không bị cắt
    const lyDos = [["Bung chỉ", 100], ["Rách vải", 100], ["Ố bẩn", 100], ["Sai màu / kích cỡ", 100], ["Lỗi phụ liệu", 100], ["Khác", 100]];
    const dai = ghepLyDo({ hong: 600, thieu: 120, lyDos, ghiChu: "x".repeat(150) });
    assert.ok(dai.length <= 255);
    assert.ok(dai.startsWith("Hỏng 600: Bung chỉ 100, Rách vải 100, Ố bẩn 100, Sai màu / kích cỡ 100, Lỗi phụ liệu 100, Khác 100. Thiếu 120. Ghi chú: x"));
    assert.ok(dai.endsWith("…"));
});

test("tinhNhan: khớp, lệch, bắt ghi chú phần thiếu và lý do Khác, chặn cái hỏng chưa chọn lý do", () => {
    let p = phienNhanMoi();
    p = datTay(p, "1-11", 5);
    p = datTay(p, "1-12", 3);
    p = datTay(p, "2-21", 4);
    assert.equal(tinhNhan(LO, p.dem).khop, true);

    p = datTay(p, "2-21", 2);
    p = doiHongTay(p, LO[2], "Khác", 1);
    let kq = tinhNhan(LO, p.dem);
    const d = kq.dong.find((x) => x.khoa === "2-21");
    assert.equal(kq.khop, false);
    assert.equal(d.thieu, 1);
    assert.equal(d.canGhiChu, true);
    assert.equal(d.thieuLyDo, true);
    p = doiGhiChu(p, "2-21", "rơi trên xe");
    kq = tinhNhan(LO, p.dem);
    assert.equal(kq.dong.find((x) => x.khoa === "2-21").thieuLyDo, false);
    const body = yeuCauNhanLech(kq, { nguoiVanChuyen: "Hùng", thoiDiem: "2026-10-30T10:00", ketLuan: "" });
    assert.deepEqual(body.dong.find((x) => x.loHangId === 21), { bienTheSanPhamId: 2, loHangId: 21, soLuongDat: 2, soLuongHong: 1, lyDo: "Hỏng 1: Khác. Thiếu 1. Ghi chú: rơi trên xe" });
    assert.equal(body.dong.find((x) => x.loHangId === 11).lyDo, null);

    // Hết thiếu, không còn Khác: ô ghi chú ẩn, ghi chú cũ không lên biên bản
    p = doiHongTay(p, LO[2], "Khác", -1);
    p = doiHongTay(p, LO[2], "Rách vải", 1);
    p = datTay(p, "2-21", 3);
    const dAn = tinhNhan(LO, p.dem).dong.find((x) => x.khoa === "2-21");
    assert.equal(dAn.canGhiChu, false);
    assert.equal(dAn.lyDo, "Hỏng 1: Rách vải");

    // Hỏng chưa chọn lý do: dòng vẫn thiếu lý do dù không có thiếu
    let q = quet(phienNhanMoi(), 2, 4, "QS-02").phien;
    q = thanhHong(q, LO);
    const dq = tinhNhan(LO, q.dem).dong.find((x) => x.khoa === "2-21");
    assert.equal(dq.chuaLyDo, 1);
    assert.equal(dq.canGhiChu, false);
    assert.equal(dq.thieuLyDo, true);
});

test("chuanHoaPhienNhan: đọc lại đúng phiếu, bỏ dữ liệu hỏng, bỏ khi danh sách lô đổi", () => {
    let p = quet(phienNhanMoi(), 1, 2).phien;
    p = doiGhiChu(p, "2-21", "ghi chú");
    const luu = JSON.parse(JSON.stringify({ ...p, vanTay: vanTayLo(LO) }));
    assert.deepEqual(chuanHoaPhienNhan(luu, LO), p);
    assert.deepEqual(chuanHoaPhienNhan({ ...luu, vanTay: "khac" }, LO), phienNhanMoi());
    assert.deepEqual(chuanHoaPhienNhan(null, LO), phienNhanMoi());
    // Dữ liệu hỏng ở bất kỳ chỗ nào: bắt đầu phiên mới, không giữ nửa vời
    assert.deepEqual(chuanHoaPhienNhan({ ...luu, dem: { ...luu.dem, "9-99": { dat: 1 } } }, LO), phienNhanMoi());
    assert.deepEqual(chuanHoaPhienNhan({ ...luu, dem: { ...luu.dem, "1-12": { dat: -1, hong: {} } } }, LO), phienNhanMoi());
    assert.deepEqual(chuanHoaPhienNhan({ ...luu, log: [...luu.log, { id: "x" }] }, LO), phienNhanMoi());
    assert.deepEqual(chuanHoaPhienNhan({ ...luu, log: luu.log.map((e) => ({ ...e, kq: "hong", hong: null })) }, LO), phienNhanMoi());
    // Cái hỏng chưa chọn lý do mà không có lượt nào đang chờ lý do: không gỡ được → phiên mới
    const ket = { ...luu, cur: null, dem: { ...luu.dem, "1-11": { dat: 1, hong: { "?": 1 }, ghiChu: "" } } };
    assert.deepEqual(chuanHoaPhienNhan(ket, LO), phienNhanMoi());
    // Lượt đang chờ lý do đọc lại đúng
    const cho = thanhHong(quet(phienNhanMoi(), 2, 2, "QS-02").phien, LO);
    const luuCho = JSON.parse(JSON.stringify({ ...cho, vanTay: vanTayLo(LO) }));
    assert.deepEqual(chuanHoaPhienNhan(luuCho, LO), cho);
});

test("phienCoSo: chỉ giữ khi đã có số đếm, lượt quét hoặc ghi chú", () => {
    assert.equal(phienCoSo(phienNhanMoi()), false);
    assert.equal(phienCoSo(datTay(phienNhanMoi(), "1-11", 1)), true);
    const p = quet(phienNhanMoi(), 1, 1).phien;
    assert.equal(phienCoSo(hoanTacLuot(p, p.cur).phien), false);
    assert.deepEqual(chiaLo([], {}, 3), { phan: [], tinh: 0 });
});
