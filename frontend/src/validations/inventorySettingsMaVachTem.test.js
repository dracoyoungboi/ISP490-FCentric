import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INVENTORY_SETTINGS,
  getInventoryChanges,
  maVachMau,
  moTaTacDong,
  phamViCauHinh,
  readCompleteInventorySettings,
  validateInventoryField,
} from "./inventorySettingsSchema.js";
import { KHO_TEM } from "../components/print/paperStyles.js";

// Chạy: node --test src/validations/inventorySettingsMaVachTem.test.js

const TEM = [
  { maCauHinh: "TEM_KHO_MAC_DINH", giaTri: "35x22", kieuDuLieu: "STRING" },
  { maCauHinh: "TEM_IN_TEN_CUA_HANG", giaTri: "false", kieuDuLieu: "BOOLEAN" },
  { maCauHinh: "TEM_IN_SKU", giaTri: "false", kieuDuLieu: "BOOLEAN" },
  { maCauHinh: "TEM_NGUONG_XAC_NHAN", giaTri: "200", kieuDuLieu: "INT" },
];

test("tiền tố mã vạch: đúng 2 chữ số, mã mẫu tiền tố + id đủ 10 chữ số, nhắc mã đã cấp giữ nguyên", () => {
  assert.equal(validateInventoryField("MA_VACH_TIEN_TO", "20", "STRING"), "");
  for (const sai of ["2", "893", "2A", "AB"]) assert.match(validateInventoryField("MA_VACH_TIEN_TO", sai, "STRING"), /đúng 2 chữ số/, sai);
  assert.equal(maVachMau("20"), "2000000150");
  assert.equal(maVachMau("29").length, 10);
  assert.equal(moTaTacDong("MA_VACH_TIEN_TO", "20")[1], "2000000150");
  assert.match(moTaTacDong("MA_VACH_TIEN_TO", "20")[2], /Mã đã cấp giữ nguyên/);
  assert.equal(phamViCauHinh("MA_VACH_TIEN_TO"), "Đúng 2 chữ số");
});

test("tem sản phẩm: khổ chỉ nhận khổ dựng sẵn, ngưỡng 1–9999, cờ in là BOOLEAN", () => {
  const kho = INVENTORY_SETTINGS.find((f) => f.code === "TEM_KHO_MAC_DINH");
  assert.deepEqual(kho.options.map((o) => o.value).sort(), Object.keys(KHO_TEM).sort(), "khớp danh sách khổ ở paperStyles");
  assert.equal(validateInventoryField("TEM_KHO_MAC_DINH", "50x30", "STRING"), "");
  assert.equal(validateInventoryField("TEM_KHO_MAC_DINH", "A4", "STRING"), "Chọn một trong các cách có sẵn.");
  assert.equal(validateInventoryField("TEM_NGUONG_XAC_NHAN", "1", "INT"), "");
  assert.equal(validateInventoryField("TEM_NGUONG_XAC_NHAN", "9999", "INT"), "");
  assert.match(validateInventoryField("TEM_NGUONG_XAC_NHAN", "0", "INT"), /từ 1 đến 9\.999/);
  assert.match(validateInventoryField("TEM_NGUONG_XAC_NHAN", "10000", "INT"), /từ 1 đến 9\.999/);
  assert.equal(validateInventoryField("TEM_IN_SKU", "true", "BOOLEAN"), "");
  assert.match(validateInventoryField("TEM_IN_SKU", "co", "BOOLEAN"), /true, false/);
  assert.equal(moTaTacDong("TEM_NGUONG_XAC_NHAN", "1500")[1], "1.500 tem");
});

test("đọc cấu hình tem: bắt đủ 4 khóa đúng kiểu; chỉ gửi giá trị đã đổi", () => {
  assert.equal(readCompleteInventorySettings(TEM, "label").length, 4);
  assert.throws(() => readCompleteInventorySettings(TEM.slice(1), "label"), "thiếu khổ tem");
  assert.throws(() => readCompleteInventorySettings([{ ...TEM[1], kieuDuLieu: "STRING" }, TEM[0], TEM[2], TEM[3]], "label"), "sai kiểu");
  assert.equal(
    readCompleteInventorySettings([{ maCauHinh: "DEFAULT_MIN_STOCK_ALERT", giaTri: "100", kieuDuLieu: "INT" }], "stock").length,
    1,
    "máy chủ chưa có mã tem thì mục Tồn kho vẫn mở được",
  );
  assert.deepEqual(
    getInventoryChanges(TEM, { TEM_KHO_MAC_DINH: "50x30", TEM_IN_TEN_CUA_HANG: "false", TEM_IN_SKU: "true", TEM_NGUONG_XAC_NHAN: "0200" }),
    [
      { maCauHinh: "TEM_KHO_MAC_DINH", giaTri: "50x30" },
      { maCauHinh: "TEM_IN_SKU", giaTri: "true" },
    ],
  );
});
