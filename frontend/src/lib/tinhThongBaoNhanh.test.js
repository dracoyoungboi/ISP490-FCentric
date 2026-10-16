// Chạy: node --test src/lib/tinhThongBaoNhanh.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chuDaSaoChep,
  demKyTu,
  taoKhoaGop,
  tinhKhoangTranhDay,
  tinhSoLan,
  tinhThoiGian,
  viTriTheoTrang,
} from "./tinhThongBaoNhanh.js";
import { CAU_HINH_THONG_BAO_NHANH as CH } from "../config/thongBaoNhanh.js";

test("thời gian theo loại với câu ngắn", () => {
  assert.equal(tinhThoiGian("success", "Đã lưu đơn mua"), CH.thoiGian.thanhCong);
  assert.equal(tinhThoiGian("info", "Đã gửi lệnh in"), CH.thoiGian.thongTin);
  assert.equal(tinhThoiGian("message", "Đã gửi lệnh in"), CH.thoiGian.thongTin);
  assert.equal(tinhThoiGian("warning", "Còn thiếu hàng"), CH.thoiGian.canhBao);
  assert.equal(tinhThoiGian("error", "Lỗi máy chủ"), CH.thoiGian.loi);
});

test("loại lạ dùng thời gian thông tin", () => {
  assert.equal(tinhThoiGian("khac", "Xin chào"), CH.thoiGian.thongTin);
});

test("có nút thao tác dùng thời gian riêng", () => {
  const nut = { label: "Hoàn tác", onClick() {} };
  assert.equal(tinhThoiGian("success", "Đã xóa dòng", { action: nut }), CH.thoiGian.coNutThaoTac);
  assert.equal(tinhThoiGian("success", "Đã xóa dòng", { cancel: nut }), CH.thoiGian.coNutThaoTac);
});

test("trang tự đặt duration thì giữ nguyên", () => {
  assert.equal(tinhThoiGian("success", "Đã lưu", { duration: 1234 }), 1234);
  assert.equal(tinhThoiGian("error", "Lỗi", { duration: Infinity }), Infinity);
});

test("đang xử lý thì không tự tắt", () => {
  assert.equal(tinhThoiGian("loading", "Đang lưu…"), Infinity);
});

test("chữ dài thì giữ lâu hơn, có trần", () => {
  const vua = "a".repeat(60); // 1000 + 60 × 55 = 4300
  assert.equal(tinhThoiGian("success", vua), 4300);
  const moTa = "b".repeat(40); // tiêu đề 10 + mô tả 40 = 50 ký tự → 3750
  assert.equal(tinhThoiGian("success", "c".repeat(10), { description: moTa }), 3750);
  assert.equal(tinhThoiGian("success", "d".repeat(500)), CH.docChu.toiDa);
  assert.equal(tinhThoiGian("error", "e".repeat(500)), CH.docChu.toiDa);
});

test("trần không cắt ngắn hơn mức theo loại", () => {
  const cauHinh = { ...CH, thoiGian: { ...CH.thoiGian, loi: 12000 } };
  assert.equal(tinhThoiGian("error", "f".repeat(500), {}, cauHinh), 12000);
});

test("loại cấu hình chờ đóng (Infinity) thì không tự tắt", () => {
  const cauHinh = { ...CH, thoiGian: { ...CH.thoiGian, loi: Infinity } };
  assert.equal(tinhThoiGian("error", "Lỗi", {}, cauHinh), Infinity);
});

test("đếm ký tự bỏ qua phần không phải chữ", () => {
  assert.equal(demKyTu("  ab  ", { type: "span" }, null, undefined, 12), 4);
});

test("góc hiện theo trang", () => {
  assert.equal(viTriTheoTrang("/pos"), "bottom-left");
  assert.equal(viTriTheoTrang("/pos/hoa-don"), "bottom-left");
  assert.equal(viTriTheoTrang("/position"), CH.viTri);
  assert.equal(viTriTheoTrang("/purchase-orders/12"), CH.viTri);
  assert.equal(viTriTheoTrang(), CH.viTri);
});

test("khóa gộp chỉ cho nội dung là chữ", () => {
  assert.equal(taoKhoaGop("success", " Đã lưu "), "tb:success:Đã lưu");
  assert.notEqual(taoKhoaGop("success", "Đã lưu"), taoKhoaGop("error", "Đã lưu"));
  assert.equal(taoKhoaGop("success", { type: "span" }), null);
  assert.equal(taoKhoaGop("success", "   "), null);
});

test("đếm số lần thông báo trùng", () => {
  assert.deepEqual(tinhSoLan({ truoc: undefined, dangHien: false, bayGio: 1000 }), { soLan: 1, luc: 1000 });
  // ô cũ đã tắt: đếm lại
  assert.deepEqual(tinhSoLan({ truoc: { soLan: 3, luc: 0 }, dangHien: false, bayGio: 5000 }), { soLan: 1, luc: 5000 });
  // gọi sát nhau (bấm đúp, StrictMode): không tăng
  assert.deepEqual(
    tinhSoLan({ truoc: { soLan: 1, luc: 1000 }, dangHien: true, bayGio: 1100, msCungMotLan: 300 }),
    { soLan: 1, luc: 1100 },
  );
  // lần bấm mới: tăng
  assert.deepEqual(
    tinhSoLan({ truoc: { soLan: 2, luc: 1000 }, dangHien: true, bayGio: 1600, msCungMotLan: 300 }),
    { soLan: 3, luc: 1600 },
  );
});

test("khoảng nâng thông báo trên thanh dính đáy", () => {
  const man = 800;
  const thanh = (top, bottom) => ({ top, bottom, height: bottom - top });
  assert.equal(tinhKhoangTranhDay([], man), 0);
  assert.equal(tinhKhoangTranhDay([thanh(736, 800)], man), 64); // dính đáy
  assert.equal(tinhKhoangTranhDay([thanh(720, 790)], man), 80); // cách đáy 10px vẫn tính
  assert.equal(tinhKhoangTranhDay([thanh(400, 460)], man), 0); // nằm giữa trang
  assert.equal(tinhKhoangTranhDay([{ top: 0, bottom: 0, height: 0 }], man), 0); // đang ẩn
  assert.equal(tinhKhoangTranhDay([thanh(100, 800)], man), 0); // to quá nửa màn: không phải thanh
  assert.equal(tinhKhoangTranhDay([thanh(900, 960)], man), 0); // ở ngoài màn hình
  assert.equal(tinhKhoangTranhDay([thanh(736, 800), thanh(700, 800)], man), 100); // lấy thanh cao nhất
});

test("chữ thông báo sau khi sao chép", () => {
  assert.equal(chuDaSaoChep("Sao chép số điện thoại"), "Đã sao chép số điện thoại");
  assert.equal(chuDaSaoChep("Sao chép mã đơn"), "Đã sao chép mã đơn");
  assert.equal(chuDaSaoChep("sao chép email"), "Đã sao chép email");
  assert.equal(chuDaSaoChep("Mã đơn"), "Đã sao chép");
  assert.equal(chuDaSaoChep(undefined), "Đã sao chép");
});

test("cấu hình đang chọn: nút sao chép bật thông báo", () => {
  assert.equal(CH.kieu, "Đề xuất cho FCentric");
  assert.equal(CH.nutSaoChep, "thong-bao");
  assert.equal(CH.gopThongBaoTrung, true);
  assert.deepEqual({ ...CH.thoiGian }, { thanhCong: 3000, thongTin: 4000, canhBao: 6000, loi: 8000, coNutThaoTac: 8000 });
  assert.deepEqual({ ...CH.hieuUng }, { vao: 200, ra: 150 });
});
