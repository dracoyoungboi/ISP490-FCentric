// Chạy: node --test src/lib/tinhTaiLai.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { GIA_CACH_TU_TAI_LAI_MS, nenTuTaiLai, nhanCapNhat, thoiDiemDayDu } from "./tinhTaiLai.js";

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
