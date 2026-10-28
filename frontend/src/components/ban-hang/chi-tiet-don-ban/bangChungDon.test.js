import test from "node:test";
import assert from "node:assert/strict";
import { coKhoiBangChung, noiDungBangChung } from "./bangChungDon.js";

const anh = (loai, id) => ({ id, loaiBangChung: loai, ngayHetHan: "2026-11-27T02:00:00Z" });
const video = { id: 9, loaiBangChung: "VIDEO_DONG_GOI", thoiLuongGiay: 64 };

test("coKhoiBangChung: từ Chờ đóng gói trở đi, đơn hủy có thể còn tệp; trước đó ẩn", () => {
  for (const trangThai of [7, 8, 2, 3, 5, 6, 4]) assert.equal(coKhoiBangChung({ trangThai, laKho: true }), true, `trạng thái ${trangThai}`);
  for (const trangThai of [0, 1, undefined, null]) assert.equal(coKhoiBangChung({ trangThai, laKho: true }), false, `trạng thái ${trangThai}`);
  assert.equal(coKhoiBangChung({ trangThai: "3", laBan: true }), true, "trạng thái dạng chuỗi");
});

test("coKhoiBangChung: đơn tại quầy, báo giá, vai trò không xem được thì ẩn", () => {
  assert.equal(coKhoiBangChung({ trangThai: 5, laPos: true, laBan: true }), false);
  assert.equal(coKhoiBangChung({ trangThai: 3, laBaoGia: true, laBan: true }), false);
  assert.equal(coKhoiBangChung({ trangThai: 3 }), false);
  assert.equal(coKhoiBangChung(), false);
});

test("noiDungBangChung: còn tệp → ô có tệp theo thứ tự yêu cầu, nhãn Đủ / Chưa đủ", () => {
  const du = noiDungBangChung({ yeuCauVideo: false, daDuBangChung: true, danhSachBangChung: [anh("ANH_NIEM_PHONG_TEM_VC", 2), anh("ANH_HANG_TRONG_HOP", 1)] }, 3);
  assert.equal(du.kieu, "co");
  assert.deepEqual([du.nhan, du.nhom], ["Đủ", "xong"]);
  assert.deepEqual(du.o.map((x) => x.bangChung.id), [1, 2]);

  const thieu = noiDungBangChung({ yeuCauVideo: false, daDuBangChung: false, danhSachBangChung: [anh("ANH_HANG_TRONG_HOP", 1)] }, 7);
  assert.deepEqual([thieu.kieu, thieu.nhan, thieu.nhom, thieu.o.length], ["co", "Chưa đủ", "canChuY", 1]);

  // Đã qua đóng gói mà máy chủ tính chưa đủ (video cũ không ghi thời lượng…): không báo thiếu
  for (const tt of [8, 3, 5]) {
    const cu = noiDungBangChung({ yeuCauVideo: true, daDuBangChung: false, danhSachBangChung: [{ ...video, thoiLuongGiay: null }] }, tt);
    assert.deepEqual([cu.kieu, cu.nhan, cu.nhom], ["co", "Đã lưu", "thuong"], `trạng thái ${tt}`);
  }

  const vid = noiDungBangChung({ yeuCauVideo: true, daDuBangChung: true, danhSachBangChung: [video] }, 5);
  assert.equal(vid.o.length, 1);
  assert.equal(vid.o[0].laVideo, true);
});

test("noiDungBangChung: tệp khác loại yêu cầu (đơn đổi qua ngưỡng video) vẫn hiện, xếp sau", () => {
  const nd = noiDungBangChung({ yeuCauVideo: true, daDuBangChung: true, danhSachBangChung: [anh("ANH_HANG_TRONG_HOP", 1), video] }, 3);
  assert.deepEqual(nd.o.map((x) => x.bangChung.id), [9, 1]);
  assert.deepEqual(nd.o.map((x) => x.laVideo), [true, false]);
});

test("noiDungBangChung: không còn tệp → chưa có / đã tự xóa / không có / ẩn (đơn hủy)", () => {
  assert.equal(noiDungBangChung({ danhSachBangChung: [] }, 7).kieu, "chuaCo");
  const xoa = noiDungBangChung({ danhSachBangChung: [], ngayTuXoa: "2026-10-01T02:00:00Z" }, 3);
  assert.deepEqual([xoa.kieu, xoa.nhan, xoa.ngay], ["daXoa", "Đã tự xóa", "2026-10-01T02:00:00Z"]);
  const cu = noiDungBangChung({ danhSachBangChung: [] }, 5);
  assert.deepEqual([cu.kieu, cu.cau], ["khongCo", "Đơn xuất kho trước khi có bước đóng gói nên không có bằng chứng."]);
  const choXuat = noiDungBangChung({}, 8);
  assert.deepEqual([choXuat.kieu, choXuat.cau], ["khongCo", "Không tìm thấy tệp bằng chứng của đơn."]);
  assert.equal(noiDungBangChung({ danhSachBangChung: [], ngayTuXoa: "2026-10-01T02:00:00Z" }, 4).kieu, "an");
  assert.equal(noiDungBangChung({ danhSachBangChung: [anh("ANH_HANG_TRONG_HOP", 1)] }, 4).kieu, "co", "đơn hủy còn tệp vẫn hiện");
  assert.equal(noiDungBangChung(undefined, 3).kieu, "khongCo");
});
