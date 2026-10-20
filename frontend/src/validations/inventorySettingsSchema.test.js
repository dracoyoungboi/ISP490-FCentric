import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getInventoryChanges,
  moTaTacDong,
  phamViCauHinh,
  readCompleteInventorySettings,
  validateInventoryField,
} from "./inventorySettingsSchema.js";

test("câu mô tả đổi theo giá trị, bám đúng cách backend dùng", () => {
  assert.deepEqual(moTaTacDong("DEFAULT_MIN_STOCK_ALERT", "1000"), ["Báo thiếu hàng khi tồn khả dụng còn ", "1.000 cái", " trở xuống."]);
  assert.deepEqual(moTaTacDong("OMNI_SYNC_INTERVAL_MINS", "3")[1], "mỗi 3 phút");
  assert.match(moTaTacDong("OMNI_SYNC_INTERVAL_MINS", "3")[2], /480 lần\/ngày/);
  assert.equal(moTaTacDong("REALTIME_SYNC_THRESHOLD", "0")[1], "đang tắt");
  assert.equal(moTaTacDong("REALTIME_SYNC_THRESHOLD", "4")[1], "dưới 4 cái");
  assert.equal(moTaTacDong("MA_KHACH_HANG_TIEN_TO", "KH")[1], "KH000124");
});

test("phạm vi hiện dưới ô nhập", () => {
  assert.equal(phamViCauHinh("DEFAULT_MIN_STOCK_ALERT"), "0–100.000");
  assert.equal(phamViCauHinh("REALTIME_SYNC_THRESHOLD"), "0–100 · 0 là tắt");
  assert.equal(phamViCauHinh("MA_KHACH_HANG_TIEN_TO"), "Tối đa 10 ký tự");
});

test("chỉ gửi giá trị thật sự đổi của phần đang sửa", () => {
  const part = [
    { maCauHinh: "OMNI_SYNC_INTERVAL_MINS", giaTri: "3", kieuDuLieu: "INT" },
    { maCauHinh: "REALTIME_SYNC_THRESHOLD", giaTri: "4", kieuDuLieu: "INT" },
  ];
  assert.deepEqual(getInventoryChanges(part, { OMNI_SYNC_INTERVAL_MINS: "03", REALTIME_SYNC_THRESHOLD: "5" }), [
    { maCauHinh: "REALTIME_SYNC_THRESHOLD", giaTri: "5" },
  ]);
  assert.equal(validateInventoryField("OMNI_SYNC_INTERVAL_MINS", "0", "INT"), "Nhập giá trị từ 1 đến 1.440.");
});

test("cách xác nhận chất lượng khi kiểm đếm: chỉ nhận hai giá trị của máy chủ", () => {
  assert.equal(validateInventoryField("KIEM_DEM_XAC_NHAN", "QUET_TIEP_LA_DAT", "STRING"), "");
  assert.equal(validateInventoryField("KIEM_DEM_XAC_NHAN", "QUET_THE_TUNG_CAI", "STRING"), "");
  assert.equal(validateInventoryField("KIEM_DEM_XAC_NHAN", "DAT", "STRING"), "Chọn một trong các cách có sẵn.");
  assert.equal(phamViCauHinh("KIEM_DEM_XAC_NHAN"), "");
  assert.equal(moTaTacDong("KIEM_DEM_XAC_NHAN", "QUET_THE_TUNG_CAI")[1], "áp dụng ở lần tải dữ liệu kế tiếp");
  assert.equal(validateInventoryField("MA_LO_TIEN_TO", "LOT", "STRING"), "");
  assert.match(validateInventoryField("MA_LO_TIEN_TO", "lô", "STRING"), /chữ in hoa không dấu/);
  // FC-… là dạng thẻ lệnh kiểm đếm
  for (const sai of ["FC", "FC-", "FC-LO", "AFC", "A_FC-"]) assert.match(validateInventoryField("MA_LO_TIEN_TO", sai, "STRING"), /chứa FC-/, sai);
  assert.equal(validateInventoryField("MA_LO_TIEN_TO", "FCL", "STRING"), "");
  assert.equal(moTaTacDong("MA_LO_TIEN_TO", "LOT")[1], "LOT-PN202610201-01");
});

test("đọc cấu hình: chỉ bắt đủ mã của mục đang mở", () => {
  const coBon = [
    { maCauHinh: "DEFAULT_MIN_STOCK_ALERT", giaTri: "100", kieuDuLieu: "INT" },
    { maCauHinh: "OMNI_SYNC_INTERVAL_MINS", giaTri: "10", kieuDuLieu: "INT" },
    { maCauHinh: "REALTIME_SYNC_THRESHOLD", giaTri: "3", kieuDuLieu: "INT" },
    { maCauHinh: "MA_KHACH_HANG_TIEN_TO", giaTri: "KH", kieuDuLieu: "STRING" },
  ];
  assert.equal(readCompleteInventorySettings(coBon, "stock").length, 4, "máy chủ chưa có mã mới thì mục cũ vẫn mở được");
  assert.throws(() => readCompleteInventorySettings(coBon, "inbound"));
  assert.throws(() => readCompleteInventorySettings(coBon));
  const thieuTienTo = [...coBon, { maCauHinh: "KIEM_DEM_XAC_NHAN", giaTri: "QUET_TIEP_LA_DAT", kieuDuLieu: "STRING" }];
  assert.throws(() => readCompleteInventorySettings(thieuTienTo, "inbound"), "thiếu tiền tố mã lô");
  const du = [...thieuTienTo, { maCauHinh: "MA_LO_TIEN_TO", giaTri: "LO", kieuDuLieu: "STRING" }];
  assert.equal(readCompleteInventorySettings(du, "inbound").length, 6);
  assert.throws(() => readCompleteInventorySettings([{ ...du[4], kieuDuLieu: "INT" }, du[5]], "inbound"), "sai kiểu");
});
