// Chạy: node --test src/components/outbound/phieu-xuat/phieuXuat.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LECH_TAO_XUAT_POS_MS,
  cauThieuLo,
  docKhoaTaiLo,
  ghepLoDong,
  khoaTaiLo,
  laPhieuPos,
  lyDoKhoaXuat,
  phieuNhatCuaPhieuXuat,
  quyenPhieuXuat,
  tachGhiChuPhieuXuat,
  tinhBuocPhieuXuat,
} from "./phieuXuat.js";

const phieu = (extra = {}) => ({
  id: 236,
  soPhieuXuat: "PXK-20261021-007",
  loaiXuat: "ban_hang",
  trangThai: 6,
  donBanHang: { id: 1021, soDonHang: "SHP-1021" },
  ngayTao: "2026-10-21T04:42:00Z",
  ngayXuat: null,
  ghiChu: "Phiếu xuất tự động từ đợt nhặt hàng PL-20261021-002",
  ...extra,
});

// ── Phiếu bán tại quầy ─────────────────────────────────────────────────────
test("laPhieuPos: ghi chú POS của backend", () => {
  assert.equal(laPhieuPos(phieu({ trangThai: 3, ghiChu: "Xuất kho POS cho đơn SO202610171", ngayXuat: "2026-10-21T09:00:00Z" })), true);
});

test("laPhieuPos: ngày tạo ≈ ngày xuất (tạo thẳng ở Đã xuất), kể cả CSDL làm tròn giây", () => {
  const p = phieu({ trangThai: 3, ghiChu: null, ngayTao: "2026-10-17T07:05:00Z", ngayXuat: "2026-10-17T07:05:01Z" });
  assert.equal(laPhieuPos(p), true);
  const bien = phieu({ trangThai: 3, ghiChu: "", ngayTao: "2026-10-17T07:05:00.000Z", ngayXuat: new Date(Date.parse("2026-10-17T07:05:00Z") + LECH_TAO_XUAT_POS_MS).toISOString() });
  assert.equal(laPhieuPos(bien), true);
});

test("laPhieuPos: phiếu qua nhặt / đóng gói, phiếu cũ xuất sau vài giây, chưa xuất, chuyển kho → không phải POS", () => {
  assert.equal(laPhieuPos(phieu({ trangThai: 3, ngayXuat: "2026-10-21T07:05:00Z" })), false);
  // dữ liệu cũ trước luồng đóng gói: tạo 13:24:41, xuất 13:24:51
  assert.equal(laPhieuPos(phieu({ trangThai: 3, ghiChu: "", ngayTao: "2026-03-18T13:24:41Z", ngayXuat: "2026-03-18T13:24:51Z" })), false);
  assert.equal(laPhieuPos(phieu({ trangThai: 6, ghiChu: "Xuất kho POS cho đơn SO1" })), false);
  assert.equal(laPhieuPos(phieu({ loaiXuat: "chuyen_kho", trangThai: 3, ngayXuat: "2026-10-21T04:42:00Z" })), false);
  // thiếu mốc thời gian, không có dấu hiệu POS → không đoán
  assert.equal(laPhieuPos(phieu({ trangThai: 3, ghiChu: "", ngayTao: null, ngayXuat: null })), false);
  assert.equal(laPhieuPos(null), false);
});

// ── Tách ghi chú ───────────────────────────────────────────────────────────
test("tachGhiChuPhieuXuat: giao vận đủ trường + ghi chú bàn giao, giữ ghi chú gốc", () => {
  const kq = tachGhiChuPhieuXuat(
    "Phiếu xuất tự động từ đợt nhặt hàng PL-1 | [Vận chuyển: GHTK - Vận đơn: GHTK-HN-8849201 - Cước: 30000] - Đã bàn giao lúc 14:00",
  );
  assert.deepEqual(kq.giaoVan, { donViVanChuyen: "GHTK", maVanDon: "GHTK-HN-8849201", cuoc: 30000 });
  assert.equal(kq.maPhieuChuyen, null);
  assert.equal(kq.ghiChu, "Phiếu xuất tự động từ đợt nhặt hàng PL-1\nĐã bàn giao lúc 14:00");
});

test("tachGhiChuPhieuXuat: N/A → null, không có cước, không có ghi chú khác", () => {
  const kq = tachGhiChuPhieuXuat("[Vận chuyển: N/A - Vận đơn: SPX123]");
  assert.deepEqual(kq.giaoVan, { donViVanChuyen: null, maVanDon: "SPX123", cuoc: null });
  assert.equal(kq.ghiChu, null);
  const chiDv = tachGhiChuPhieuXuat("[Vận chuyển: Tự giao - Vận đơn: N/A - Cước: 0]");
  assert.deepEqual(chiDv.giaoVan, { donViVanChuyen: "Tự giao", maVanDon: null, cuoc: 0 });
});

test("tachGhiChuPhieuXuat: tên đơn vị có dấu gạch, cước thập phân", () => {
  const kq = tachGhiChuPhieuXuat("[Vận chuyển: J&T - Express - Vận đơn: JT-01 - Cước: 25000.00]");
  assert.deepEqual(kq.giaoVan, { donViVanChuyen: "J&T - Express", maVanDon: "JT-01", cuoc: 25000 });
});

test("tachGhiChuPhieuXuat: mọi trường N/A → không có giao vận nhưng vẫn bỏ khối khỏi ghi chú", () => {
  const kq = tachGhiChuPhieuXuat("Ghi chú A | [Vận chuyển: N/A - Vận đơn: N/A]");
  assert.equal(kq.giaoVan, null);
  assert.equal(kq.ghiChu, "Ghi chú A");
});

test("tachGhiChuPhieuXuat: mã phiếu chuyển kho", () => {
  const kq = tachGhiChuPhieuXuat("Xuất thủ công cho phiếu chuyển: PX-TRF-202610201");
  assert.equal(kq.maPhieuChuyen, "PX-TRF-202610201");
  assert.equal(kq.ghiChu, null);
  const coLyDo = tachGhiChuPhieuXuat("Xuất thủ công cho phiếu chuyển: PX-TRF-1 | Hủy vì đổi kho");
  assert.equal(coLyDo.maPhieuChuyen, "PX-TRF-1");
  assert.equal(coLyDo.ghiChu, "Hủy vì đổi kho");
  // Ghi chú máy chủ đặt cho PX-CK khi duyệt phiếu chuyển
  const pxCk = tachGhiChuPhieuXuat("Phiếu xuất của phiếu chuyển PX-TRF-202610281, lệnh điều động LDD-20261028-001");
  assert.equal(pxCk.maPhieuChuyen, "PX-TRF-202610281");
  assert.equal(pxCk.ghiChu, null);
  assert.equal(tachGhiChuPhieuXuat("Phiếu xuất của phiếu chuyển PX-TRF-9").maPhieuChuyen, "PX-TRF-9");
});

test("tachGhiChuPhieuXuat: không tách được → giữ nguyên ghi chú; trống → null", () => {
  assert.deepEqual(tachGhiChuPhieuXuat("Xuất kho POS cho đơn SO202610171"), {
    giaoVan: null,
    maPhieuChuyen: null,
    ghiChu: "Xuất kho POS cho đơn SO202610171",
  });
  assert.equal(tachGhiChuPhieuXuat("Vận chuyển: GHTK (gõ tay) | x").ghiChu, "Vận chuyển: GHTK (gõ tay) | x");
  assert.deepEqual(tachGhiChuPhieuXuat(null), { giaoVan: null, maPhieuChuyen: null, ghiChu: null });
  assert.deepEqual(tachGhiChuPhieuXuat("   "), { giaoVan: null, maPhieuChuyen: null, ghiChu: null });
});

// ── Tiến trình ─────────────────────────────────────────────────────────────
const trangThaiBuoc = (ds) => ds.map((b) => `${b.nhan}:${b.trangThai}`);

test("tinhBuocPhieuXuat: bán hàng theo trạng thái", () => {
  assert.deepEqual(trangThaiBuoc(tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 0 }) })), [
    "Nhặt hàng:xong", "Đóng gói:dangLam", "Xuất kho:chua",
  ]);
  assert.deepEqual(trangThaiBuoc(tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 6 }) })), [
    "Nhặt hàng:xong", "Đóng gói:xong", "Xuất kho:dangLam",
  ]);
  const daXuat = tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 3, ngayXuat: "2026-10-21T07:05:00Z" }) });
  assert.deepEqual(trangThaiBuoc(daXuat), ["Nhặt hàng:xong", "Đóng gói:xong", "Xuất kho:xong"]);
  assert.equal(daXuat[0].ngay, "2026-10-21T04:42:00Z");
  assert.equal(daXuat[2].ngay, "2026-10-21T07:05:00Z");
  assert.equal(daXuat[2].coGio, true);
  const huy = tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 4 }) });
  assert.deepEqual(trangThaiBuoc(huy), ["Nhặt hàng:xong", "Đóng gói:chua", "Đã hủy:dung"]);
  assert.equal(huy[2].phu, "Trước khi xuất kho");
});

test("tinhBuocPhieuXuat: chuyển kho đếm dòng đủ lô", () => {
  const ck = (trangThai) => phieu({ loaiXuat: "chuyen_kho", trangThai, donBanHang: null });
  const thieu = tinhBuocPhieuXuat({ phieu: ck(0), soDong: 3, soDongDuLo: 2 });
  assert.deepEqual(trangThaiBuoc(thieu), ["Tạo phiếu:xong", "Chọn lô:dangLam", "Xác nhận xuất:chua"]);
  assert.equal(thieu[1].phu, "2/3 dòng đủ lô");
  const du = tinhBuocPhieuXuat({ phieu: ck(0), soDong: 3, soDongDuLo: 3 });
  assert.deepEqual(trangThaiBuoc(du), ["Tạo phiếu:xong", "Chọn lô:xong", "Xác nhận xuất:dangLam"]);
  assert.equal(du[2].phu, "Ở phiếu chuyển kho");
  assert.deepEqual(trangThaiBuoc(tinhBuocPhieuXuat({ phieu: ck(3), soDong: 3, soDongDuLo: 3 })), [
    "Tạo phiếu:xong", "Chọn lô:xong", "Xác nhận xuất:xong",
  ]);
  assert.deepEqual(trangThaiBuoc(tinhBuocPhieuXuat({ phieu: ck(4), soDong: 3 })), [
    "Tạo phiếu:xong", "Đã hủy:dung", "Xác nhận xuất:chua",
  ]);
  // phiếu rỗng: chưa đủ lô
  assert.equal(tinhBuocPhieuXuat({ phieu: ck(0), soDong: 0, soDongDuLo: 0 })[1].trangThai, "dangLam");
});

test("tinhBuocPhieuXuat: POS và mã lạ không có tiến trình", () => {
  assert.deepEqual(tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 3 }), laPos: true }), []);
  assert.deepEqual(tinhBuocPhieuXuat({ phieu: phieu({ trangThai: 1 }) }), []);
  assert.deepEqual(tinhBuocPhieuXuat({ phieu: phieu({ loaiXuat: "khac", trangThai: 5 }) }), []);
  assert.deepEqual(tinhBuocPhieuXuat({ phieu: null }), []);
});

// ── Quyền ──────────────────────────────────────────────────────────────────
test("quyenPhieuXuat: hủy chỉ quản lý, phiếu chưa xuất", () => {
  assert.equal(quyenPhieuXuat({ phieu: phieu({ trangThai: 6 }), laQuanLy: true }).coHuy, true);
  assert.equal(quyenPhieuXuat({ phieu: phieu({ trangThai: 0 }), laQuanLy: false }).coHuy, false);
  assert.equal(quyenPhieuXuat({ phieu: phieu({ trangThai: 3 }), laQuanLy: true }).coHuy, false);
  assert.equal(quyenPhieuXuat({ phieu: phieu({ trangThai: 4 }), laQuanLy: true }).coHuy, false);
  // Phiếu xuất chuyển kho hủy theo phiếu chuyển, không hủy riêng
  assert.equal(quyenPhieuXuat({ phieu: phieu({ loaiXuat: "chuyen_kho", trangThai: 0 }), laQuanLy: true }).coHuy, false);
});

test("quyenPhieuXuat: sửa lô, nút chính, in", () => {
  const ban0 = quyenPhieuXuat({ phieu: phieu({ trangThai: 0 }), laQuanLy: true });
  assert.deepEqual([ban0.suaLo, ban0.nhanNutLo, ban0.nutChinh, ban0.coIn], [true, "Sửa lô", "dongGoi", true]);
  const ban6Nv = quyenPhieuXuat({ phieu: phieu({ trangThai: 6 }), laQuanLy: false });
  assert.deepEqual([ban6Nv.suaLo, ban6Nv.nutChinh], [false, "xuatKho"]);
  const ban0KhongDon = quyenPhieuXuat({ phieu: phieu({ trangThai: 0, donBanHang: null }), laQuanLy: true });
  assert.equal(ban0KhongDon.nutChinh, null);
  const ck0Nv = quyenPhieuXuat({ phieu: phieu({ loaiXuat: "chuyen_kho", trangThai: 0 }), laQuanLy: false });
  assert.deepEqual([ck0Nv.suaLo, ck0Nv.nhanNutLo, ck0Nv.nutChinh], [true, "Chọn lô", "phieuChuyen"]);
  const ck3 = quyenPhieuXuat({ phieu: phieu({ loaiXuat: "chuyen_kho", trangThai: 3 }), laQuanLy: true });
  assert.deepEqual([ck3.suaLo, ck3.nutChinh, ck3.coIn], [false, null, true]);
  assert.equal(quyenPhieuXuat({ phieu: phieu({ trangThai: 4 }), laQuanLy: true }).coIn, false);
  const pos = quyenPhieuXuat({ phieu: phieu({ trangThai: 3 }), laQuanLy: true, laPos: true });
  assert.deepEqual([pos.coHuy, pos.suaLo, pos.nutChinh], [false, false, null]);
});

test("PX-CK có phiếu nhặt: ẩn Chọn lô, câu thiếu lô nhắc nhặt theo phiếu nhặt; phiếu cũ giữ như cũ", () => {
  const ck = (extra) => phieu({ loaiXuat: "chuyen_kho", trangThai: 0, donBanHang: null, ...extra });
  const coPn = ck({ phieuNhatId: 80, maPhieuNhat: "PL-20261028-001", trangThaiPhieuNhat: "dang_nhat" });
  const q = quyenPhieuXuat({ phieu: coPn });
  assert.equal(q.suaLo, false);
  assert.deepEqual(q.phieuNhat, { id: 80, ma: "PL-20261028-001", trangThai: "dang_nhat" });
  assert.equal(q.nutChinh, "phieuChuyen");
  assert.equal(
    cauThieuLo({ laCk: true, soThieu: 2, phieuNhat: q.phieuNhat }),
    "Còn 2 dòng chưa đủ lô. Nhặt hàng theo phiếu nhặt PL-20261028-001; hoàn tất nhặt thì lô tự ghi vào phiếu này.",
  );
  assert.doesNotMatch(cauThieuLo({ laCk: true, soThieu: 2, phieuNhat: q.phieuNhat }), /Chọn lô/);
  // thiếu mã phiếu nhặt: không để chỗ trống
  assert.equal(
    cauThieuLo({ laCk: true, soThieu: 1, phieuNhat: phieuNhatCuaPhieuXuat(ck({ phieuNhatId: 80 })) }),
    "Còn 1 dòng chưa đủ lô. Nhặt hàng theo phiếu nhặt; hoàn tất nhặt thì lô tự ghi vào phiếu này.",
  );

  // phiếu nhặt đã hủy, phiếu cũ không có phiếu nhặt: chọn lô tay như cũ
  const pnHuy = quyenPhieuXuat({ phieu: ck({ phieuNhatId: 80, trangThaiPhieuNhat: "da_huy" }) });
  assert.deepEqual([pnHuy.suaLo, pnHuy.phieuNhat], [true, null]);
  const cu = quyenPhieuXuat({ phieu: ck({}) });
  assert.deepEqual([cu.suaLo, cu.nhanNutLo, cu.phieuNhat], [true, "Chọn lô", null]);
  assert.match(cauThieuLo({ laCk: true, soThieu: 3, phieuNhat: cu.phieuNhat }), /Chọn lô xong/);
  // phiếu bán không bao giờ có phiếu nhặt kiểu này
  assert.equal(phieuNhatCuaPhieuXuat(phieu({ phieuNhatId: 9 })), null);
  assert.equal(phieuNhatCuaPhieuXuat(null), null);
});

test("lyDoKhoaXuat và cauThieuLo", () => {
  assert.equal(lyDoKhoaXuat({ soDong: 0 }), "Phiếu xuất kho chưa có sản phẩm nào");
  assert.equal(lyDoKhoaXuat({ soDong: 5, soThieu: 2 }), "Còn 2 dòng chưa đủ lô");
  assert.equal(lyDoKhoaXuat({ laCk: true, soDong: 5, soThieu: 1 }), "Còn 1 dòng chưa chọn đủ lô");
  assert.equal(lyDoKhoaXuat({ soDong: 5, soThieu: 0 }), null);
  assert.match(cauThieuLo({ laCk: true, soThieu: 3 }), /^Còn 3 dòng chưa chọn đủ lô\. Chọn lô xong/);
  assert.match(cauThieuLo({ laQuanLy: true, soThieu: 1200 }), /^Còn 1\.200 dòng .*Bấm Sửa lô/);
  assert.match(cauThieuLo({ laQuanLy: false, soThieu: 1 }), /Báo quản lý kho sửa lô/);
});

// ── Lô của dòng ────────────────────────────────────────────────────────────
test("ghepLoDong: ghép tên lô, thiếu tên thì #id, bỏ số 0", () => {
  const kq = ghepLoDong(
    [{ loHangId: 7, soLuongDaPick: 6 }, { loHangId: 9, soLuongDaPick: "4.00" }, { loHangId: 11, soLuongDaPick: 0 }],
    [{ loHangId: 7, maLo: "L2610170019" }, { loHangId: 8, maLo: "L2610190022" }],
  );
  assert.deepEqual(kq, [
    { loHangId: 7, maLo: "L2610170019", soLuong: 6 },
    { loHangId: 9, maLo: "#9", soLuong: 4 },
  ]);
  assert.deepEqual(ghepLoDong(null, null), []);
});

test("khoaTaiLo: chỉ đổi khi phiếu, trạng thái hay số đã lấy đổi; docKhoaTaiLo đọc lại dòng", () => {
  const ct = [
    { id: 3101, bienTheSanPhamId: 501, soLuongDaPick: 10, tenBienThe: "A" },
    { id: 3102, bienTheSanPhamId: null, soLuongDaPick: "8.00" },
  ];
  const k = khoaTaiLo(231, 0, ct);
  assert.equal(k, "231|0|3101:501:10,3102::8");
  // tải lại ngầm: mảng mới, cùng nội dung → cùng khóa
  assert.equal(khoaTaiLo(231, 0, ct.map((x) => ({ ...x, tenBienThe: "khác" }))), k);
  assert.notEqual(khoaTaiLo(231, 3, ct), k);
  assert.notEqual(khoaTaiLo(231, 0, [{ ...ct[0], soLuongDaPick: 9 }, ct[1]]), k);
  assert.equal(khoaTaiLo(231, 0, []), "");
  assert.equal(khoaTaiLo(null, 0, ct), "");
  assert.deepEqual(docKhoaTaiLo(k), {
    phieuId: 231,
    dong: [{ id: 3101, bienTheSanPhamId: 501 }, { id: 3102, bienTheSanPhamId: null }],
  });
  assert.deepEqual(docKhoaTaiLo(""), { phieuId: null, dong: [] });
});
