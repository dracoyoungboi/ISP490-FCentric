import { test } from "node:test";
import assert from "node:assert/strict";
import {
  companyProfileForm,
  companyProfilePayload,
  isCompanyProfileChanged,
  validateCompanyProfile,
} from "./companyProfileSchema.js";

test("form lấy từ hồ sơ đã lưu, giá trị null thành chuỗi rỗng", () => {
  assert.deepEqual(companyProfileForm({ name: "FCentric", email: null, logoAsset: "/a.svg" }), {
    name: "FCentric",
    taxCode: "",
    phone: "",
    email: "",
    address: "",
  });
});

test("kiểm tra từng ô: tên bắt buộc, email và điện thoại đúng dạng khi có nhập", () => {
  assert.deepEqual(validateCompanyProfile({ name: "  ", email: "", phone: "" }), { name: "Nhập tên cửa hàng." });
  assert.deepEqual(validateCompanyProfile({ name: "A", email: "sai", phone: "12" }), {
    email: "Email không hợp lệ.",
    phone: "Số điện thoại không hợp lệ.",
  });
  assert.deepEqual(validateCompanyProfile({ name: "A", email: "lienhe@fcentric.vn", phone: "028 7300 0000" }), {});
});

test("mã số thuế: để trống được; có nhập thì 10 số, 10 số -3 số, hoặc 12 số", () => {
  const loi = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số.";
  for (const taxCode of ["", "0312345678", "0312345678-001", "001203004567", " 0312345678 "]) {
    assert.deepEqual(validateCompanyProfile({ name: "A", taxCode }), {}, taxCode);
  }
  for (const taxCode of ["031234567", "0312345678-1", "03123456789", "MST0312345678"]) {
    assert.deepEqual(validateCompanyProfile({ name: "A", taxCode }), { taxCode: loi }, taxCode);
  }
});

test("so thay đổi và dữ liệu gửi đi bỏ khoảng trắng đầu/cuối", () => {
  const saved = { name: "FCentric", phone: "", email: "", address: "Q1" };
  assert.equal(isCompanyProfileChanged(saved, { ...saved, name: " FCentric " }), false);
  assert.equal(isCompanyProfileChanged(saved, { ...saved, address: "Q3" }), true);
  assert.equal(isCompanyProfileChanged(saved, { ...saved, taxCode: "0312345678" }), true);
  assert.deepEqual(companyProfilePayload({ name: " FCentric ", taxCode: " 0312345678", phone: null, email: " a@b.vn", address: "" }), {
    name: "FCentric",
    taxCode: "0312345678",
    phone: "",
    email: "a@b.vn",
    address: "",
  });
});

test("xóa mã số thuế: luôn gửi chuỗi rỗng (máy chủ coi null là giữ nguyên, chuỗi rỗng là xóa)", () => {
  const saved = { name: "FCentric", taxCode: "0312345678", phone: "", email: "", address: "" };
  const form = { ...companyProfileForm(saved), taxCode: "  " };
  assert.equal(isCompanyProfileChanged(saved, form), true);
  assert.equal(companyProfilePayload(form).taxCode, "");
  // Hồ sơ chưa từng có mã số thuế (null) vẫn gửi chuỗi, không gửi null
  assert.equal(companyProfilePayload(companyProfileForm({ name: "FCentric", taxCode: null })).taxCode, "");
});
