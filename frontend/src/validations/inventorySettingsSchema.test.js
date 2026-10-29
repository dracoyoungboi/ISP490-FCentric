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

test("giấy đi đường XKNB: ký hiệu để trống được hoặc đúng mẫu, chế độ chỉ hai giá trị", () => {
  assert.equal(validateInventoryField("XKNB_KY_HIEU_MAC_DINH", "", "STRING"), "");
  assert.equal(validateInventoryField("XKNB_KY_HIEU_MAC_DINH", "6K26NAB", "STRING"), "");
  assert.equal(validateInventoryField("XKNB_KY_HIEU_MAC_DINH", "6C25N01", "STRING"), "");
  for (const sai of ["6K26AB", "7K26NAB", "6X26NAB", "6K26XAB", "6k26nab", " "]) {
    assert.notEqual(validateInventoryField("XKNB_KY_HIEU_MAC_DINH", sai, "STRING"), "", sai);
  }
  // Mã khác vẫn không được để trống
  assert.match(validateInventoryField("MA_LO_TIEN_TO", "", "STRING"), /không được để trống/);
  assert.equal(validateInventoryField("XKNB_CHE_DO", "CHAN", "STRING"), "");
  assert.equal(validateInventoryField("XKNB_CHE_DO", "CHI_CANH_BAO", "STRING"), "");
  assert.equal(validateInventoryField("XKNB_CHE_DO", "", "STRING"), "Giá trị cấu hình không được để trống.");
  assert.equal(validateInventoryField("XKNB_CHE_DO", "CANH_BAO", "STRING"), "Chọn một trong các cách có sẵn.");
  // Phần in đậm là lúc cách mới được áp dụng, ghép lại thành câu liền
  const tacDong = moTaTacDong("XKNB_CHE_DO", "CHAN");
  assert.equal(tacDong[1], "lần xác nhận xuất kế tiếp");
  assert.match(tacDong.join(""), /Đổi cách này thì áp dụng từ lần xác nhận xuất kế tiếp\.$/);
  assert.equal(phamViCauHinh("XKNB_KY_HIEU_MAC_DINH"), "7 ký tự · để trống nếu chưa có");
  const du = [
    { maCauHinh: "XKNB_KY_HIEU_MAC_DINH", giaTri: "", kieuDuLieu: "STRING" },
    { maCauHinh: "XKNB_CHE_DO", giaTri: "CHI_CANH_BAO", kieuDuLieu: "STRING" },
  ];
  assert.equal(readCompleteInventorySettings(du, "documents").length, 2);
  assert.throws(() => readCompleteInventorySettings(du.slice(1), "documents"), "thiếu ký hiệu");
});

test("ai được xử lý chênh lệch chuyển kho: ba lựa chọn khớp máy chủ, mục Chuyển kho cần đủ mã", () => {
  for (const dung of ["QL_KHO_TONG", "QL_KHO_TONG_VA_KHO_XUAT", "CHI_QUAN_TRI"]) {
    assert.equal(validateInventoryField("CHUYEN_KHO_QUYEN_XU_LY_LECH", dung, "STRING"), "", dung);
  }
  assert.equal(validateInventoryField("CHUYEN_KHO_QUYEN_XU_LY_LECH", "QL_KHO_NHAN", "STRING"), "Chọn một trong các cách có sẵn.");
  assert.equal(validateInventoryField("CHUYEN_KHO_QUYEN_XU_LY_LECH", "", "STRING"), "Giá trị cấu hình không được để trống.");
  assert.equal(phamViCauHinh("CHUYEN_KHO_QUYEN_XU_LY_LECH"), "");
  assert.equal(moTaTacDong("CHUYEN_KHO_QUYEN_XU_LY_LECH", "CHI_QUAN_TRI")[1], "áp dụng ngay");
  const ma = { maCauHinh: "CHUYEN_KHO_QUYEN_XU_LY_LECH", giaTri: "QL_KHO_TONG", kieuDuLieu: "STRING" };
  assert.equal(readCompleteInventorySettings([ma], "transfer").length, 1);
  assert.throws(() => readCompleteInventorySettings([], "transfer"), "máy chủ chưa có mã");
  const chungTu = [
    { maCauHinh: "XKNB_KY_HIEU_MAC_DINH", giaTri: "", kieuDuLieu: "STRING" },
    { maCauHinh: "XKNB_CHE_DO", giaTri: "CHAN", kieuDuLieu: "STRING" },
  ];
  assert.equal(readCompleteInventorySettings(chungTu, "documents").length, 2, "thiếu mã Chuyển kho không làm hỏng mục khác");
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
