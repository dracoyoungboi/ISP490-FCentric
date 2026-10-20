import { test } from "node:test";
import assert from "node:assert/strict";
import {
  khopLanKhoa,
  maLoChuaTheLenh,
  CHE_DO_XAC_NHAN,
  cauChuaKiemKhoaChuaRo,
  chonLyDo,
  chuanHoaPhien,
  coKeHoatDong,
  conTrongKe,
  datCua,
  dieuKienKhoaLo,
  docTheLenh,
  doiChieuKhoaChuaRo,
  doiSoLoi,
  doiSoLuong,
  goiYMaLo,
  hoanTacLuot,
  KE_KHONG_DUOC,
  keDungDuoc,
  ketQuaLanTaiMoiNhat,
  loiCua,
  luotDangCho,
  luotDeHoanTac,
  maCuaBienThe,
  nhanLuot,
  nhanTrangThai,
  nhomLoiTheoLyDo,
  phienMoi,
  tenDayDu,
  thanhDat,
  thanhKhongDat,
  themLuot,
  tinh,
} from "./kiemDem.js";

const MAC_DINH = CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT;
const TUNG_CAI = CHE_DO_XAC_NHAN.QUET_THE_TUNG_CAI;
const them = (p, ma, soLuong = 1, conLai = 40, cheDo = MAC_DINH) =>
  themLuot(p, { ma, nguon: "quét SKU", soLuong, conLai, cheDo, gio: "10:00:00" });

test("thẻ lệnh: chỉ khớp đúng mã", () => {
  assert.deepEqual(docTheLenh("FC-KHONG-DAT", 6), { loai: "KHONG_DAT" });
  assert.deepEqual(docTheLenh("FC-HOAN-TAC", 6), { loai: "HOAN_TAC" });
  assert.deepEqual(docTheLenh("FC-KHOA-LO", 6), { loai: "KHOA_LO" });
  assert.deepEqual(docTheLenh("FC-DAT", 6), { loai: "DAT" });
  assert.deepEqual(docTheLenh("FC-LD-6", 6), { loai: "LY_DO", soLyDo: 6 });
  assert.deepEqual(docTheLenh("FC-LD-7", 6), { loai: "KHONG_RO" });
  assert.deepEqual(docTheLenh("FC-DATX", 6), { loai: "KHONG_RO" });
  assert.equal(docTheLenh("QJ2610141-XN-30", 6), null);
});

test("quét tiếp là Đạt: mỗi lượt tự tính đạt, lượt mới thành lượt hiện tại", () => {
  let p = phienMoi("2026-09-28");
  ({ phien: p } = them(p, "SKU"));
  ({ phien: p } = them(p, "SKU"));
  const t = tinh(p, { canNhap: 40, datKhoa: 12, loiKhoa: 0 });
  assert.equal(t.datLo, 2);
  assert.equal(t.daKiem, 14);
  assert.equal(t.conLai, 26);
  assert.equal(p.cur, 2);
  assert.equal(luotDangCho(p), null);
});

test("số lượng bị chặn ở số còn lại theo đơn mua", () => {
  const { phien, soTinh, luot } = them(phienMoi(), "SKU", 12, 5);
  assert.equal(soTinh, 5);
  assert.equal(luot.nguon, "quét SKU · chỉ tính 5 vì đủ số đặt");
  assert.equal(tinh(phien, { canNhap: 5, datKhoa: 0, loiKhoa: 0 }).conLai, 0);
  assert.equal(them(phien, "SKU", 1, 0).soTinh, 0);
});

test("không đạt: phải chọn lý do trước lượt kế tiếp; đổi lại đạt thì bỏ lý do", () => {
  let { phien: p } = them(phienMoi(), "SKU", 3);
  p = thanhKhongDat(p);
  assert.deepEqual(luotDangCho(p).loai, "lyDo");
  p = doiSoLoi(p, +5);
  assert.equal(p.log[0].loi, 3, "không quá số lượng của lượt");
  p = doiSoLoi(p, -1);
  assert.equal(p.log[0].loi, 2);
  p = chonLyDo(p, "Bung chỉ");
  assert.equal(luotDangCho(p), null);
  const t = tinh(p, { canNhap: 40, datKhoa: 0, loiKhoa: 0 });
  assert.deepEqual([t.datLo, t.loiLo, t.trongLo], [1, 2, 3]);
  assert.equal(nhanLuot(p.log[0]), "Không đạt 2 · Bung chỉ · Đạt 1");
  p = thanhDat(p);
  assert.deepEqual([p.log[0].kq, p.log[0].loi, p.log[0].lyDo], ["dat", 0, null]);
});

test("quét KHÔNG ĐẠT lần nữa giữ lý do đã chọn; lý do chỉ gán cho lượt không đạt", () => {
  let { phien: p } = them(phienMoi(), "SKU");
  assert.equal(chonLyDo(p, "Khác").log[0].lyDo, null);
  p = chonLyDo(thanhKhongDat(p), "Ố bẩn");
  assert.equal(thanhKhongDat(p).log[0].lyDo, "Ố bẩn");
});

test("quét thẻ cho từng cái: lượt chờ chọn, chưa tính đạt", () => {
  const { phien: p } = them(phienMoi(), "SKU", 1, 40, TUNG_CAI);
  assert.equal(p.log[0].kq, "cho");
  assert.equal(luotDangCho(p).loai, "cho");
  const t = tinh(p, { canNhap: 40, datKhoa: 0, loiKhoa: 0 });
  assert.deepEqual([t.datLo, t.choLo, t.trongLo], [0, 1, 1]);
  assert.equal(datCua(thanhDat(p).log[0]), 1);
});

test("± số lượng: tối thiểu 1, tối đa thêm số còn lại", () => {
  let { phien: p } = them(phienMoi(), "SKU", 2);
  p = doiSoLuong(p, +10, 3);
  assert.equal(p.log[0].sl, 5);
  p = doiSoLuong(p, -10, 0);
  assert.equal(p.log[0].sl, 1);
  p = thanhKhongDat(doiSoLuong(p, +2, 5));
  p = doiSoLoi(p, +2);
  p = doiSoLuong(p, -2, 0);
  assert.deepEqual([p.log[0].sl, p.log[0].loi], [1, 1], "bớt số lượng thì số lỗi không vượt");
});

test("hoàn tác lùi dần từng lượt, lượt bị hủy không tính", () => {
  let p = phienMoi();
  ({ phien: p } = them(p, "A"));
  ({ phien: p } = them(p, "B"));
  ({ phien: p } = them(p, "C"));
  let luot;
  ({ phien: p, luot } = hoanTacLuot(p, luotDeHoanTac(p).id));
  assert.equal(luot.ma, "C");
  assert.equal(p.cur, null);
  ({ phien: p, luot } = hoanTacLuot(p, luotDeHoanTac(p).id));
  assert.equal(luot.ma, "B");
  assert.equal(tinh(p, { canNhap: 40, datKhoa: 0, loiKhoa: 0 }).trongLo, 1);
  assert.equal(hoanTacLuot(p, 3).luot, null, "đã hủy thì không hủy lại");
  assert.equal(loiCua({ ...p.log[0], kq: "loi", loi: 1 }), 0, "lượt hủy không tính lỗi");
});

test("trạng thái biến thể: Đã kiểm xong chỉ khi số đã khóa đủ", () => {
  let { phien: p } = them(phienMoi(), "SKU", 4, 4);
  const t1 = tinh(p, { canNhap: 40, datKhoa: 36, loiKhoa: 0 });
  assert.equal(nhanTrangThai(t1), "Chờ khóa lô");
  assert.equal(t1.xong, false);
  assert.equal(nhanTrangThai(tinh(phienMoi(), { canNhap: 40, datKhoa: 37, loiKhoa: 3 })), "Đã kiểm xong");
  assert.equal(nhanTrangThai(tinh(phienMoi(), { canNhap: 40, datKhoa: 0, loiKhoa: 0 })), "Chờ kiểm đếm");
  assert.equal(nhanTrangThai(tinh(p, { canNhap: 40, datKhoa: 0, loiKhoa: 0 })), "Đang kiểm đếm");
});

test("nhóm hàng không đạt theo lý do để gửi máy chủ", () => {
  let p = phienMoi();
  for (const [lyDo, so] of [["Bung chỉ", 1], ["Ố bẩn", 2], ["Bung chỉ", 1]]) {
    ({ phien: p } = them(p, "SKU", so));
    p = chonLyDo(doiSoLoi(thanhKhongDat(p), so), lyDo);
  }
  ({ phien: p } = them(p, "SKU"));
  assert.deepEqual(nhomLoiTheoLyDo(p.log), [
    { lyDo: "Bung chỉ", soLuong: 2 },
    { lyDo: "Ố bẩn", soLuong: 2 },
  ]);
});

test("kệ: còn trống trừ cả hàng chờ nhập; bảo trì / đầy / không đủ chỗ thì không chọn được", () => {
  const ke = { id: 1, maViTri: "A-01-02", sucChua: 60, dangChua: 32, choNhap: 12, trangThai: "HOAT_DONG" };
  assert.equal(conTrongKe(ke), 16);
  assert.deepEqual(keDungDuoc(ke, 16), { duoc: true, ma: "", lyDo: "" });
  assert.deepEqual(keDungDuoc(ke, 17), { duoc: false, ma: KE_KHONG_DUOC.CHI_CON, lyDo: "Chỉ còn trống 16" });
  assert.deepEqual(keDungDuoc({ ...ke, dangChua: 48 }, 0), { duoc: false, ma: KE_KHONG_DUOC.DAY, lyDo: "Đầy" });
  assert.deepEqual(keDungDuoc({ ...ke, trangThai: "BAO_TRI" }, 1), { duoc: false, ma: KE_KHONG_DUOC.BAO_TRI, lyDo: "Bảo trì" });
  assert.equal(conTrongKe({ sucChua: 0 }), null, "kệ không giới hạn");
});

test("mã lô gợi ý theo số phiếu, không trùng lô đã khóa", () => {
  assert.equal(goiYMaLo("PN202610191", []), "LO-PN202610191-01");
  assert.equal(goiYMaLo("PN202610191", ["LO-PN202610191-02"]), "LO-PN202610191-03");
  assert.equal(goiYMaLo("PN202610191", ["X", "lo-pn202610191-03"]), "LO-PN202610191-04");
});

test("điều kiện khóa lô", () => {
  const viTris = [{ id: 7, maViTri: "A-01-02", sucChua: 40, dangChua: 30, choNhap: 0, trangThai: "HOAT_DONG" }];
  const homNay = "2026-10-19";
  let p = phienMoi("");
  const dk0 = dieuKienKhoaLo(p, { t: tinh(p, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", homNay });
  assert.deepEqual(dk0.thieu, ["sản phẩm", "ngày sản xuất"]);

  ({ phien: p } = them(p, "SKU", 12));
  p = { ...p, nsx: "2026-10-20", keId: 7 };
  let dk = dieuKienKhoaLo(p, { t: tinh(p, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", maLoDaCo: ["lo-1"], homNay });
  assert.equal(dk.ok, false);
  assert.deepEqual(dk.loi, [
    "Kệ A-01-02 chỉ còn trống 10, lô đang có 12 đạt. Chọn kệ khác.",
    "Mã lô LO-1 đã có trong phiếu, hãy đổi mã khác.",
    "Ngày sản xuất không được sau hôm nay.",
  ]);

  p = { ...doiSoLuong(p, -2, 0), nsx: "2026-10-19", maLo: " LO-2 " };
  dk = dieuKienKhoaLo(p, { t: tinh(p, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", maLoDaCo: ["LO-1"], homNay });
  assert.equal(dk.ok, true);
  assert.equal(dk.maLo, "LO-2");

  // Lô chỉ có hàng lỗi: không cần kệ
  let q = { ...phienMoi("2026-10-01") };
  ({ phien: q } = them(q, "SKU", 2));
  q = chonLyDo(doiSoLoi(thanhKhongDat(q), 1), "Rách vải");
  dk = dieuKienKhoaLo(q, { t: tinh(q, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", homNay });
  assert.equal(dk.ok, true);

  // Lượt chưa chọn lý do chặn khóa lô
  ({ phien: q } = them(q, "SKU"));
  q = thanhKhongDat(q);
  dk = dieuKienKhoaLo(q, { t: tinh(q, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", homNay });
  assert.equal(dk.loi[0], "Lượt quét SKU chưa chọn lý do không đạt. Chọn trên thẻ kết quả.");
  // Lượt chờ không phải lượt hiện tại (phiên cũ đọc lại): chỉ cách hoàn tác ở danh sách lượt
  const cu = { ...q, cur: -1 };
  dk = dieuKienKhoaLo(cu, { t: tinh(cu, { canNhap: 40 }), viTris, coKe: true, maLoGoiY: "LO-1", homNay });
  assert.match(dk.loi[0], /chưa chọn lý do không đạt\. Hoàn tác lượt đó ở danh sách "Lượt quét lô này"/);

  // Kho chưa có kệ: hàng đạt khóa được không cần kệ
  let r = { ...phienMoi("2026-10-01") };
  ({ phien: r } = them(r, "SKU", 3));
  assert.equal(dieuKienKhoaLo(r, { t: tinh(r, { canNhap: 40 }), viTris: [], coKe: false, maLoGoiY: "LO-1", homNay }).ok, true);
});

test("đọc lại phiên từ trình duyệt: bỏ dữ liệu hỏng", () => {
  const p = chuanHoaPhien(
    {
      log: [
        { id: 3, ma: "A", sl: 2, kq: "loi", loi: 9, lyDo: "Ố bẩn", huy: false },
        { id: 2, ma: "B", sl: 0, kq: "dat" },
        null,
        { id: 1, ma: "C", sl: 1, kq: "la" },
      ],
      cur: 2,
      dem: 1,
      keId: "7",
      nsx: "2026-10-01",
    },
    "",
  );
  assert.equal(p.log.length, 2);
  assert.equal(p.log[0].loi, 2);
  assert.equal(p.log[1].kq, "dat");
  assert.equal(p.cur, null, "lượt hiện tại không còn thì bỏ");
  assert.equal(p.dem, 4);
  assert.equal(p.keId, null);
  assert.deepEqual(chuanHoaPhien("rác", "2026-09-01"), phienMoi("2026-09-01"));
});

test("tên đầy đủ và mã của biến thể", () => {
  const item = { tenBienThe: "Quần Jeans", mauSac: "Đen", kichCo: "30", sku: "qj-de-30", maVachSku: null, maVachNcc: ["8935001200307"] };
  assert.equal(tenDayDu(item), "Quần Jeans · Đen · 30");
  assert.deepEqual(maCuaBienThe(item), ["QJ-DE-30", "8935001200307"]);
});

test("vượt số đặt: phiên cũ trong trình duyệt + máy khác đã khóa đủ → không 'Đã kiểm xong', chặn khóa", () => {
  let ph = phienMoi("2026-10-01");
  ph = themLuot(ph, { ma: "A", nguon: "x", soLuong: 5, conLai: 5, cheDo: CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT, gio: "" }).phien;
  const t = tinh(ph, { canNhap: 40, datKhoa: 40, loiKhoa: 0 });
  assert.equal(t.vuot, 5);
  assert.equal(t.xong, false);
  assert.equal(nhanTrangThai(t), "Vượt số đặt");
  const dk = dieuKienKhoaLo(ph, { t, viTris: [], coKe: false, maLoGoiY: "LO-1-02", homNay: "2026-10-19" });
  assert.equal(dk.ok, false);
  assert.match(dk.loi.join(" "), /chỉ còn thiếu 0.*Hoàn tác bớt 5/);
});

test("khóa lô: chưa tải xong danh sách kệ thì chưa cho khóa lô có hàng đạt", () => {
  let ph = phienMoi("2026-10-01");
  ph = themLuot(ph, { ma: "A", nguon: "x", soLuong: 2, conLai: 10, cheDo: CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT, gio: "" }).phien;
  const t = tinh(ph, { canNhap: 10, datKhoa: 0, loiKhoa: 0 });
  const dang = dieuKienKhoaLo(ph, { t, viTris: [], coKe: false, keDangTai: true, maLoGoiY: "LO-1-01", homNay: "2026-10-19" });
  assert.equal(dang.ok, false);
  assert.match(dang.loi[0], /Đang tải danh sách kệ/);
  const xong = dieuKienKhoaLo(ph, { t, viTris: [], coKe: false, keDangTai: false, maLoGoiY: "LO-1-01", homNay: "2026-10-19" });
  assert.equal(xong.ok, true, "kho không có kệ thì khóa được");
});

test("khóa lô: lượt chờ không phải lượt hiện tại (phiên hỏng) vẫn chặn khóa", () => {
  const ph = chuanHoaPhien({
    log: [
      { id: 2, ma: "B", sl: 1, kq: "dat" },
      { id: 1, ma: "A", sl: 3, kq: "loi", loi: 1, lyDo: null },
    ],
    cur: 2, dem: 3, nsx: "2026-10-01",
  });
  const t = tinh(ph, { canNhap: 10, datKhoa: 0, loiKhoa: 0 });
  const dk = dieuKienKhoaLo(ph, { t, viTris: [], coKe: false, maLoGoiY: "LO-1-01", homNay: "2026-10-19" });
  assert.equal(dk.ok, false);
  assert.match(dk.loi.join(" "), /Lượt quét A chưa chọn lý do/);
});

test("ngày sản xuất: chặn năm nhập nhầm (máy quét gõ mã kệ vào ô ngày)", () => {
  let ph = phienMoi("0102-10-15");
  ph = themLuot(ph, { ma: "A", nguon: "x", soLuong: 1, conLai: 10, cheDo: CHE_DO_XAC_NHAN.QUET_TIEP_LA_DAT, gio: "" }).phien;
  const t = tinh(ph, { canNhap: 10, datKhoa: 0, loiKhoa: 0 });
  const dk = dieuKienKhoaLo(ph, { t, viTris: [], coKe: false, maLoGoiY: "LO-1-01", homNay: "2026-10-19" });
  assert.equal(dk.ok, false);
  assert.match(dk.loi.join(" "), /kiểm tra lại năm/);
});

test("mã lô gợi ý theo tiền tố cấu hình; kệ không dùng được có mã lý do", () => {
  assert.equal(goiYMaLo("PN1", [], "LOT"), "LOT-PN1-01");
  assert.equal(goiYMaLo("PN1", []), "LO-PN1-01");
  assert.equal(keDungDuoc({ maViTri: "B", trangThai: "BAO_TRI", sucChua: 10 }).ma, KE_KHONG_DUOC.BAO_TRI);
  assert.equal(keDungDuoc({ maViTri: "A", trangThai: "HOAT_DONG", sucChua: 10, dangChua: 10 }).ma, KE_KHONG_DUOC.DAY);
});

test("đối chiếu lô trên máy chủ với lần khóa không rõ kết quả: phải trùng đủ mã, số, kệ, ngày", () => {
  const lan = { maLo: "LO-PN1-01", dat: 2, loi: 1, keId: 601, nsx: "2026-09-30" };
  const lo = { maLo: "lo-pn1-01 ", soLuongNhap: 2, soLuongLoi: 1, viTriKhoId: 601, ngaySanXuat: "2026-09-30T00:00:00Z" };
  assert.equal(khopLanKhoa(lo, lan), true);
  assert.equal(khopLanKhoa({ ...lo, viTriKhoId: 602 }, lan), false, "khác kệ (máy khác)");
  assert.equal(khopLanKhoa({ ...lo, soLuongNhap: 3 }, lan), false);
  assert.equal(khopLanKhoa({ ...lo, ngaySanXuat: "2026-09-29T00:00:00Z" }, lan), false);
  assert.equal(khopLanKhoa({ ...lo, viTriKhoId: null }, { ...lan, keId: null }), true, "lô chỉ có lỗi, không kệ");
  assert.equal(khopLanKhoa(null, lan), false);
});

test("mã lô có chứa thẻ lệnh FC- (máy quét gõ nhầm vào ô) bị chặn khóa", () => {
  assert.equal(maLoChuaTheLenh("LO-PN1-04FC-KHOA-LO"), true);
  assert.equal(maLoChuaTheLenh("fc-dat"), true);
  assert.equal(maLoChuaTheLenh("LO-PN1-04"), false);
  assert.equal(maLoChuaTheLenh(null), false);
});

test("khóa lô mất phản hồi, máy chủ đã lưu lô: quét thêm / hoàn tác thì chặn (không gửi lại thành lô gấp đôi)", () => {
  let ph = phienMoi("2026-09-30");
  for (const ma of ["A", "B", "C"]) ({ phien: ph } = them(ph, ma));
  const lan = { maLo: "LO-PN1-01", dat: 3, loi: 0, keId: 601, nsx: "2026-09-30", dem: ph.dem };
  ph = { ...ph, khoaChuaRo: lan };
  const lo = { chiTietPhieuNhapKhoId: 9, maLo: "LO-PN1-01", soLuongNhap: 3, soLuongLoi: 0, viTriKhoId: 601, ngaySanXuat: "2026-09-30T00:00:00Z" };
  const so = (p) => tinh(p, { canNhap: 40, datKhoa: 0, loiKhoa: 0 });
  const doiChieu = (p, ds) => doiChieuKhoaChuaRo(p, ds, { dat: so(p).datLo, loi: so(p).loiLo });

  assert.equal(doiChieu(ph, [lo]), "da-luu", "đúng các lượt của lần đó: chốt, không gửi lại");
  assert.equal(doiChieu(ph, []), null, "máy chủ chưa có lô: khóa bình thường");
  assert.equal(doiChieu(ph, [{ ...lo, soLuongNhap: 5 }]), null, "lô trùng mã của máy khác: lần trước không được lưu");
  assert.equal(doiChieu({ ...ph, khoaChuaRo: null }, [lo]), null);

  const quetThem = them(ph, "D").phien;
  assert.equal(doiChieu(quetThem, [lo]), "chan", "quét thêm sau lần mất phản hồi");
  const hoanTacCu = hoanTacLuot(ph, 2).phien;
  assert.equal(doiChieu(hoanTacCu, [lo]), "chan", "hoàn tác một lượt đã nằm trong lô");

  // Hoàn tác hết các lượt của lần trước, còn lượt mới: khóa phần còn lại bình thường (không chặn mãi)
  let conLai = quetThem;
  for (const id of [1, 2, 3]) conLai = hoanTacLuot(conLai, id).phien;
  assert.equal(doiChieu(conLai, [lo]), null);
  // Trùng số một cách tình cờ (hoàn tác 1 lượt cũ, quét 1 lượt mới) vẫn không phải lần trước
  assert.equal(doiChieu(them(hoanTacCu, "E").phien, [lo]), "chan");
});

test("lần khóa trước mất phản hồi, tải lại danh sách lô lỗi: chưa gửi lần khóa mới (không ghi đè lần trước khi chưa rõ)", () => {
  // Lần A: lượt 1-3 (3 đạt) mất phản hồi, tải lại cũng lỗi → nhớ lần A. Sau đó quét thêm lượt 4.
  let ph = phienMoi("2026-09-30");
  for (const ma of ["A", "B", "C"]) ({ phien: ph } = them(ph, ma));
  const lanA = { maLo: "LO-PN1-01", dat: 3, loi: 0, keId: 601, nsx: "2026-09-30", dem: ph.dem };
  ({ phien: ph } = them({ ...ph, khoaChuaRo: lanA }, "D"));
  const t = tinh(ph, { canNhap: 40, datKhoa: 0, loiKhoa: 0 });
  const doiChieu = (p, ds) => doiChieuKhoaChuaRo(p, ds, { dat: t.datLo, loi: t.loiLo });

  assert.equal(doiChieu(ph, null), "chua-kiem", "tải lại lỗi: chưa biết lần A đã lưu hay chưa, không gửi");
  assert.equal(doiChieu(ph, undefined), "chua-kiem");
  // Danh sách vừa tải có lô của lần A (mã lô gợi ý nay đã nhảy sang -02, hoặc người kiểm gõ mã khác): vẫn chặn
  const loA = { chiTietPhieuNhapKhoId: 9, maLo: "LO-PN1-01", soLuongNhap: 3, soLuongLoi: 0, viTriKhoId: 601, ngaySanXuat: "2026-09-30T00:00:00Z" };
  assert.equal(doiChieu(ph, [loA]), "chan", "lượt 1-3 đã nằm trong lô của lần A");
  assert.equal(doiChieu(ph, []), null, "máy chủ chưa lưu lần A: khóa bình thường cả 4 lượt");
  // Máy khác vừa khóa đúng mã -01 với số khác: không phải lô của lần A (không bảo hoàn tác oan)
  const loMayKhac = { ...loA, chiTietPhieuNhapKhoId: 10, soLuongNhap: 5 };
  assert.equal(khopLanKhoa(loMayKhac, lanA), false);
  assert.equal(doiChieu(ph, [loMayKhac]), null);
  // Không có lần khóa không rõ kết quả: không cần danh sách vừa tải
  assert.equal(doiChieu({ ...ph, khoaChuaRo: null }, null), null);
});

test("khóa lô mất phản hồi: lượt mới đang chờ chọn Đạt / Không đạt không bị bỏ lặng lẽ", () => {
  let ph = phienMoi("2026-09-30");
  ({ phien: ph } = them(ph, "A", 2, 40, TUNG_CAI));
  ph = thanhDat(ph);
  const lan = { maLo: "LO-PN1-01", dat: 2, loi: 0, keId: null, nsx: "2026-09-30", dem: ph.dem };
  ({ phien: ph } = them({ ...ph, khoaChuaRo: lan }, "A", 1, 40, TUNG_CAI));
  const t = tinh(ph, { canNhap: 40, datKhoa: 0, loiKhoa: 0 });
  assert.deepEqual([t.datLo, t.choLo], [2, 1], "số đạt / lỗi vẫn trùng lần trước");
  const lo = { maLo: "LO-PN1-01", soLuongNhap: 2, soLuongLoi: 0, viTriKhoId: null, ngaySanXuat: "2026-09-30T00:00:00Z" };
  assert.equal(doiChieuKhoaChuaRo(ph, [lo], { dat: t.datLo, loi: t.loiLo }), "chan");
});

test("đọc lại lần khóa không rõ kết quả: phải có mốc lượt (dem)", () => {
  const lan = { maLo: "LO-1", dat: 1, loi: 0, keId: null, nsx: "2026-09-30" };
  const raw = { log: [{ id: 1, ma: "A", sl: 1, kq: "dat" }], dem: 2, nsx: "2026-09-30" };
  assert.deepEqual(chuanHoaPhien({ ...raw, khoaChuaRo: { ...lan, dem: 2 } }).khoaChuaRo, { ...lan, dem: 2 });
  assert.equal(chuanHoaPhien({ ...raw, khoaChuaRo: lan }).khoaChuaRo, null);
});

test("kho có kệ nhưng kệ nào cũng bảo trì: không bắt chọn kệ (khớp máy chủ)", () => {
  const baoTri = [
    { id: 7, maViTri: "A-01", sucChua: 0, trangThai: "BAO_TRI" },
    { id: 8, maViTri: "A-02", sucChua: 0, trangThai: "BAO_TRI" },
  ];
  assert.equal(coKeHoatDong(baoTri), false);
  assert.equal(coKeHoatDong([...baoTri, { id: 9, maViTri: "B-01", trangThai: "HOAT_DONG" }]), true);
  assert.equal(coKeHoatDong([]), false);
  assert.equal(coKeHoatDong(undefined), false);

  let ph = phienMoi("2026-10-01");
  ({ phien: ph } = them(ph, "SKU", 3));
  const t = tinh(ph, { canNhap: 40 });
  const dk = dieuKienKhoaLo(ph, { t, viTris: baoTri, coKe: coKeHoatDong(baoTri), maLoGoiY: "LO-1", homNay: "2026-10-19" });
  assert.equal(dk.ok, true);
  // Kệ chọn từ trước rồi chuyển bảo trì: không chọn kệ khác được nên bỏ qua, khóa không gắn kệ
  const cu = dieuKienKhoaLo({ ...ph, keId: 7 }, { t, viTris: baoTri, coKe: false, maLoGoiY: "LO-1", homNay: "2026-10-19" });
  assert.deepEqual([cu.ok, cu.ke], [true, null]);
  // Kho còn kệ hoạt động: kệ đã chọn mà bảo trì vẫn chặn, chọn kệ khác
  const conKe = [...baoTri, { id: 9, maViTri: "B-01", trangThai: "HOAT_DONG" }];
  const chan = dieuKienKhoaLo({ ...ph, keId: 7 }, { t, viTris: conKe, coKe: true, maLoGoiY: "LO-1", homNay: "2026-10-19" });
  assert.equal(chan.ok, false);
  assert.match(chan.loi.join(" "), /A-01 đang bảo trì/);
});

// Mô phỏng taiLai của màn: mỗi lần tải tăng số thứ tự; lần bị lần bắt đầu sau thay chỗ trả null (hoặc chờ lần mới nhất
// khi theoLanMoi), lần mới nhất trả danh sách lô (null nếu tải lỗi). Mạng trả về khi gọi `xong(ds)`.
function moPhongTaiLai() {
  const s = { lan: 0, moiNhat: null };
  return ({ theoLanMoi = false } = {}) => {
    const lan = ++s.lan;
    let xong;
    const mang = new Promise((r) => (xong = r));
    const p = mang.then((ds) => (lan !== s.lan ? (theoLanMoi ? ketQuaLanTaiMoiNhat(() => s.lan, () => s.moiNhat) : null) : ds));
    s.moiNhat = p;
    return { p, xong };
  };
}
const choXuLy = () => new Promise((r) => setTimeout(r, 0));

test("tải lại để đối chiếu lần khóa mất phản hồi bị lần tải khác thay chỗ: lấy kết quả lần mới nhất, không coi là lỗi", async () => {
  const tai = moPhongTaiLai();
  // Đang chờ thì tải ngầm khi quay lại thẻ chen vào; lần đối chiếu về trước
  const doiChieu = tai({ theoLanMoi: true });
  const quayLai = tai();
  doiChieu.xong([{ maLo: "LO-CU" }]);
  await choXuLy();
  quayLai.xong([{ maLo: "LO-MOI" }]);
  assert.deepEqual(await doiChieu.p, [{ maLo: "LO-MOI" }]);
  assert.deepEqual(await quayLai.p, [{ maLo: "LO-MOI" }]);

  // Lần chen vào (sau xóa lô) về trước; lần đối chiếu lỗi nhưng đã bị thay chỗ, lần mới hơn đã tải được
  const doiChieu2 = tai({ theoLanMoi: true });
  const sauXoaLo = tai();
  sauXoaLo.xong([{ maLo: "B" }]);
  await choXuLy();
  doiChieu2.xong(null);
  assert.deepEqual(await doiChieu2.p, [{ maLo: "B" }]);

  // Các nơi gọi khác (không theoLanMoi) giữ như cũ: bị thay chỗ trả null
  const cu = tai();
  const moi = tai();
  cu.xong([{ maLo: "C" }]);
  moi.xong([{ maLo: "D" }]);
  assert.equal(await cu.p, null);
  assert.deepEqual(await moi.p, [{ maLo: "D" }]);
});

test("lần tải mới hơn lại bị thay chỗ: chờ tiếp tới lần mới nhất; lần mới nhất lỗi thì null (chưa kiểm)", async () => {
  const tai = moPhongTaiLai();
  const doiChieu = tai({ theoLanMoi: true });
  const lan2 = tai();
  doiChieu.xong([]);
  await choXuLy(); // đang chờ lần 2
  const lan3 = tai();
  lan2.xong([{ maLo: "CU" }]); // lần 2 bị lần 3 thay chỗ: trả null cho nơi gọi lần 2
  await choXuLy();
  lan3.xong([{ maLo: "LO-PN1-01" }]);
  assert.deepEqual(await doiChieu.p, [{ maLo: "LO-PN1-01" }]);
  assert.equal(await lan2.p, null);

  // Lần mới nhất tải lỗi: không có danh sách vừa tải → null → doiChieuKhoaChuaRo trả "chua-kiem"
  const doiChieu2 = tai({ theoLanMoi: true });
  const lan5 = tai();
  doiChieu2.xong([]);
  lan5.xong(null);
  const ds = await doiChieu2.p;
  assert.equal(ds, null);
  const lan = { maLo: "LO-PN1-01", dat: 1, loi: 0, keId: null, nsx: "2026-09-30", dem: 2 };
  const ph = { ...them(phienMoi("2026-09-30"), "A").phien, khoaChuaRo: lan };
  assert.equal(doiChieuKhoaChuaRo(ph, ds, { dat: 1, loi: 0 }), "chua-kiem");
});

test("chưa tải được danh sách lô để đối chiếu: câu đúng cho cả mất mạng lẫn máy chủ từ chối", () => {
  const matMang = cauChuaKiemKhoaChuaRo("LO-PN1-01");
  assert.match(matMang, /^Chưa tải được danh sách lô để kiểm lần khóa lô LO-PN1-01 lúc mất phản hồi đã được lưu hay chưa\. /);
  assert.match(matMang, /khóa lại sau khi tải được\.$/);
  assert.doesNotMatch(matMang, /có mạng/);
  assert.equal(cauChuaKiemKhoaChuaRo("LO-1", "   "), cauChuaKiemKhoaChuaRo("LO-1"));
  // Câu của máy chủ (vd. 404 phiếu bị hủy) kèm trong ngoặc, không lặp dấu chấm
  assert.match(
    cauChuaKiemKhoaChuaRo("LO-1", "Không tìm thấy phiếu nhập kho. "),
    /hay chưa \(Không tìm thấy phiếu nhập kho\)\. Lô đang kiểm/,
  );
});
