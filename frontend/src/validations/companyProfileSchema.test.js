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

test("so thay đổi và dữ liệu gửi đi bỏ khoảng trắng đầu/cuối", () => {
  const saved = { name: "FCentric", phone: "", email: "", address: "Q1" };
  assert.equal(isCompanyProfileChanged(saved, { ...saved, name: " FCentric " }), false);
  assert.equal(isCompanyProfileChanged(saved, { ...saved, address: "Q3" }), true);
  assert.deepEqual(companyProfilePayload({ name: " FCentric ", phone: null, email: " a@b.vn", address: "" }), {
    name: "FCentric",
    phone: "",
    email: "a@b.vn",
    address: "",
  });
});
