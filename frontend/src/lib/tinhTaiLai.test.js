// Chạy: node --test src/lib/tinhTaiLai.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { GIA_CACH_TU_TAI_LAI_MS, nenTuTaiLai, nhanCapNhat, thoiDiemDayDu, trangCuoiNeuVuot } from "./tinhTaiLai.js";

const DU_DIEU_KIEN = { bat: true, hienThi: true, coHopThoai: false, bayGio: 100_000, lanCuoi: 0 };

test("nenTuTaiLai: đủ điều kiện và đã quá giãn cách thì tải lại", () => {
  assert.equal(nenTuTaiLai(DU_DIEU_KIEN), true);
});

test("nenTuTaiLai: chưa tải lần nào thì tải lại", () => {
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, lanCuoi: null }), true);
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, lanCuoi: undefined }), true);
});

test("nenTuTaiLai: trang tắt, tab đang ẩn hoặc đang mở popup thì không tải lại", () => {
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, bat: false }), false);
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, hienThi: false }), false);
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, coHopThoai: true }), false);
});

test("nenTuTaiLai: chưa đủ giãn cách thì không tải lại, đúng bằng giãn cách thì tải", () => {
  const bayGio = 1_000_000;
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, bayGio, lanCuoi: bayGio - GIA_CACH_TU_TAI_LAI_MS + 1 }), false);
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, bayGio, lanCuoi: bayGio - GIA_CACH_TU_TAI_LAI_MS }), true);
});

test("nenTuTaiLai: nhận giãn cách riêng", () => {
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, bayGio: 5_000, lanCuoi: 0, giaCach: 10_000 }), false);
  assert.equal(nenTuTaiLai({ ...DU_DIEU_KIEN, bayGio: 10_000, lanCuoi: 0, giaCach: 10_000 }), true);
});

test("nhanCapNhat: giờ phút có số 0 đứng trước", () => {
  assert.equal(nhanCapNhat(new Date(2026, 9, 18, 14, 16, 5)), "Cập nhật lúc 14:16");
  assert.equal(nhanCapNhat(new Date(2026, 0, 1, 7, 5, 0)), "Cập nhật lúc 07:05");
  assert.equal(nhanCapNhat(new Date(2026, 0, 1, 0, 0, 0)), "Cập nhật lúc 00:00");
});

test("nhanCapNhat / thoiDiemDayDu: giá trị không hợp lệ trả chuỗi rỗng", () => {
  for (const sai of [null, undefined, "14:16", 1_700_000_000_000, new Date("không phải ngày")]) {
    assert.equal(nhanCapNhat(sai), "");
    assert.equal(thoiDiemDayDu(sai), "");
  }
});

test("thoiDiemDayDu: giờ:phút:giây ngày/tháng/năm", () => {
  assert.equal(thoiDiemDayDu(new Date(2026, 9, 18, 14, 16, 5)), "14:16:05 18/10/2026");
  assert.equal(thoiDiemDayDu(new Date(2026, 0, 2, 3, 4, 9)), "03:04:09 02/01/2026");
});

test("trangCuoiNeuVuot: trang rỗng vượt số trang thật thì lùi về trang cuối còn dữ liệu", () => {
  // Trang 2 (đếm từ 0) với 20 dòng/trang nhưng chỉ còn 20 dòng: lùi về trang 0
  assert.equal(trangCuoiNeuVuot({ trang: 1, kichThuoc: 20, soDong: 0, tong: 20 }), 0);
  assert.equal(trangCuoiNeuVuot({ trang: 5, kichThuoc: 20, soDong: 0, tong: 41 }), 2);
  assert.equal(trangCuoiNeuVuot({ trang: 3, kichThuoc: 10, soDong: 0, tong: 21 }), 2);
});

test("trangCuoiNeuVuot: không vượt thì null", () => {
  assert.equal(trangCuoiNeuVuot({ trang: 1, kichThuoc: 20, soDong: 5, tong: 25 }), null, "trang có dữ liệu");
  assert.equal(trangCuoiNeuVuot({ trang: 0, kichThuoc: 20, soDong: 0, tong: 3 }), null, "trang đầu");
  assert.equal(trangCuoiNeuVuot({ trang: 1, kichThuoc: 20, soDong: 0, tong: 30 }), null, "tổng đếm lệch danh sách: không lùi lặp");
  assert.equal(trangCuoiNeuVuot({ trang: undefined, kichThuoc: 20, soDong: 0, tong: 30 }), null);
  assert.equal(trangCuoiNeuVuot({ trang: -1, kichThuoc: 20, soDong: 0, tong: 0 }), null);
  assert.equal(trangCuoiNeuVuot({ trang: 0, kichThuoc: 20, soDong: 0, tong: 0 }), null, "trang đầu rỗng thật: giữ ô trống");
});

test("trangCuoiNeuVuot: máy chủ trả trang rỗng kèm tổng 0 (Page.empty) thì về trang đầu", () => {
  assert.equal(trangCuoiNeuVuot({ trang: 2, kichThuoc: 20, soDong: 0, tong: 0 }), 0);
  assert.equal(trangCuoiNeuVuot({ trang: 1, kichThuoc: 20, soDong: 0, tong: undefined }), 0);
});
