import { test } from "node:test";
import assert from "node:assert/strict";
import { getInventoryChanges, moTaTacDong, phamViCauHinh, validateInventoryField } from "./inventorySettingsSchema.js";

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
