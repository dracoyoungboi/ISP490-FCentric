import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMPANY_PROFILE_FIELDS,
  KHOA_PHAP_LY_LIEN_HE,
  KHOA_TEN_VA_LOGO,
  LOGO_ACCEPT,
  LOGO_TOI_DA_BYTE,
  LOGO_TOI_DA_CHU,
  cauNhanDangMaSoThue,
  chuanHoaMaSoThue,
  companyProfileForm,
  companyProfilePayload,
  dinhDangDienThoai,
  isCompanyProfileChanged,
  kiemTepLogo,
  lechLoaiMaSoThue,
  loaiMaSoThue,
  oThieuDeGuiNhaCungCap,
  payloadPhapLyLienHe,
  payloadTenVaLogo,
  validateCompanyProfile,
  validatePhapLyLienHe,
  validateTenVaLogo,
} from "./companyProfileSchema.js";

const HO_SO_MAU = {
  name: "Thời trang Linh Lan",
  legalName: "Công ty TNHH Thời trang Linh Lan",
  taxCode: "0109123456",
  address: "Tầng 3, 25 Láng Hạ, phường Láng, Hà Nội",
  phone: "02439998888",
  email: "lienhe@linhlan.vn",
};

test("form lấy từ hồ sơ đã lưu, giá trị null thành chuỗi rỗng, đủ 6 ô", () => {
  assert.deepEqual(companyProfileForm({ name: "FCentric", email: null, logoAsset: "/a.png" }), {
    name: "FCentric",
    legalName: "",
    taxCode: "",
    address: "",
    phone: "",
    email: "",
  });
  assert.deepEqual(Object.keys(companyProfileForm(null)), COMPANY_PROFILE_FIELDS);
});

test("hai thẻ chia đủ 6 ô, không ô nào thuộc cả hai", () => {
  assert.deepEqual([...KHOA_TEN_VA_LOGO, ...KHOA_PHAP_LY_LIEN_HE].sort(), [...COMPANY_PROFILE_FIELDS].sort());
});

test("thẻ Tên và logo: tên bắt buộc, tối đa 255 ký tự", () => {
  assert.deepEqual(validateTenVaLogo({ name: "  " }), { name: "Nhập tên cửa hàng." });
  assert.deepEqual(validateTenVaLogo({}), { name: "Nhập tên cửa hàng." });
  assert.deepEqual(validateTenVaLogo({ name: "a".repeat(256) }), { name: "Tên cửa hàng tối đa 255 ký tự." });
  assert.deepEqual(validateTenVaLogo({ name: ` ${"a".repeat(255)} ` }), {});
  // Không kiểm phần pháp lý
  assert.deepEqual(validateTenVaLogo({ name: "A", legalName: "", address: "", email: "sai" }), {});
});

test("thẻ Pháp lý và liên hệ: tên đăng ký và địa chỉ đăng ký bắt buộc", () => {
  assert.deepEqual(validatePhapLyLienHe({ legalName: " ", address: "" }), {
    legalName: "Nhập tên đăng ký kinh doanh.",
    address: "Nhập địa chỉ đăng ký.",
  });
  assert.deepEqual(validatePhapLyLienHe({ legalName: "b".repeat(256), address: "Hà Nội" }), {
    legalName: "Tên đăng ký kinh doanh tối đa 255 ký tự.",
  });
  assert.deepEqual(validatePhapLyLienHe(HO_SO_MAU), {});
  // Không kiểm tên cửa hàng
  assert.deepEqual(validatePhapLyLienHe({ ...HO_SO_MAU, name: "" }), {});
});

test("thẻ Pháp lý và liên hệ: email, điện thoại đúng dạng khi có nhập; email tối đa 100 ký tự", () => {
  const base = { legalName: "Công ty A", address: "Hà Nội" };
  assert.deepEqual(validatePhapLyLienHe({ ...base, email: "sai", phone: "12" }), {
    email: "Email không hợp lệ.",
    phone: "Số điện thoại không hợp lệ.",
  });
  assert.deepEqual(validatePhapLyLienHe({ ...base, email: "", phone: "" }), {});
  assert.deepEqual(validatePhapLyLienHe({ ...base, email: "lienhe@tencuahang.vn", phone: "028 7300 0000" }), {});
  const email100 = `${"a".repeat(95)}@x.vn`;
  assert.deepEqual(validatePhapLyLienHe({ ...base, email: email100 }), {});
  assert.deepEqual(validatePhapLyLienHe({ ...base, email: `a${email100}` }), { email: "Email tối đa 100 ký tự." });
});

test("mã số thuế: để trống được; có nhập thì 10 số, 10 số -3 số, hoặc 12 số (sau khi bỏ khoảng trắng, dấu chấm)", () => {
  const loi = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số.";
  const base = { legalName: "Công ty A", address: "Hà Nội" };
  for (const taxCode of ["", "0312345678", "0312345678-001", "001203004567", " 0312345678 ", "0109.123.456", "0312 345 678-001"]) {
    assert.deepEqual(validatePhapLyLienHe({ ...base, taxCode }), {}, taxCode);
  }
  for (const taxCode of ["031234567", "0312345678-1", "03123456789", "MST0312345678", "0109123456-01", "123"]) {
    assert.deepEqual(validatePhapLyLienHe({ ...base, taxCode }), { taxCode: loi }, taxCode);
  }
});

test("hộp sửa nhanh kiểm cả hai phần", () => {
  assert.deepEqual(validateCompanyProfile({ name: "", legalName: "", address: "" }), {
    name: "Nhập tên cửa hàng.",
    legalName: "Nhập tên đăng ký kinh doanh.",
    address: "Nhập địa chỉ đăng ký.",
  });
  assert.deepEqual(validateCompanyProfile(HO_SO_MAU), {});
});

test("chuẩn hóa mã số thuế như máy chủ: bỏ khoảng trắng và dấu chấm", () => {
  assert.equal(chuanHoaMaSoThue("0109.123.456"), "0109123456");
  assert.equal(chuanHoaMaSoThue(" 0109 123 456-001 "), "0109123456-001");
  assert.equal(chuanHoaMaSoThue(null), "");
  assert.equal(chuanHoaMaSoThue(undefined), "");
});

test("loại mã số thuế: 10 số, 10-3 số, 12 số; sai dạng thì rỗng", () => {
  assert.equal(loaiMaSoThue("0109123456"), "Doanh nghiệp");
  assert.equal(loaiMaSoThue("0109123456-001"), "Chi nhánh, đơn vị phụ thuộc");
  assert.equal(loaiMaSoThue("040204000494"), "Hộ, cá nhân kinh doanh");
  assert.equal(loaiMaSoThue("0109.123.456"), "Doanh nghiệp");
  for (const sai of ["", null, "123", "01091234567", "0109123456-01", "MST0109123456"]) {
    assert.equal(loaiMaSoThue(sai), "", String(sai));
  }
});

test("lệch loại mã số thuế: công ty dùng mã 12 số", () => {
  const cau = "Mã 12 số là của hộ, cá nhân kinh doanh; công ty, doanh nghiệp tư nhân dùng mã 10 số.";
  for (const ten of ["Công ty TNHH Thời trang Linh Lan", "CÔNG TY CỔ PHẦN AN PHÚ", "Cty TNHH A", "Doanh nghiệp tư nhân B", "DNTN Hòa Bình"]) {
    assert.equal(lechLoaiMaSoThue(ten, "040204000494"), cau, ten);
  }
});

test("lệch loại mã số thuế: hộ kinh doanh dùng mã 10 số; chi nhánh thiếu cụm từ", () => {
  assert.equal(
    lechLoaiMaSoThue("Hộ kinh doanh Nguyễn Văn A", "0109123456"),
    "Mã 10 số là của doanh nghiệp; hộ kinh doanh dùng mã 12 số.",
  );
  assert.equal(
    lechLoaiMaSoThue("Công ty TNHH Thời trang Linh Lan", "0109123456-001"),
    'Mã có -3 số là của đơn vị phụ thuộc: tên phải gồm tên công ty và cụm từ "Chi nhánh" hoặc "Địa điểm kinh doanh".',
  );
});

test("không cảnh báo khi khớp loại, khi cá nhân ghi họ tên, hoặc khi thiếu tên / mã sai", () => {
  assert.equal(lechLoaiMaSoThue("Công ty TNHH Thời trang Linh Lan", "0109123456"), "");
  assert.equal(lechLoaiMaSoThue("Hộ kinh doanh Nguyễn Văn A", "040204000494"), "");
  assert.equal(lechLoaiMaSoThue("Nguyễn Văn A", "040204000494"), "");
  assert.equal(lechLoaiMaSoThue("Công ty TNHH Linh Lan - Chi nhánh Hà Nội", "0109123456-001"), "");
  assert.equal(lechLoaiMaSoThue("Công ty TNHH Linh Lan - Địa điểm kinh doanh số 2", "0109123456-002"), "");
  assert.equal(lechLoaiMaSoThue("Văn phòng đại diện Công ty A", "0109123456-003"), "");
  assert.equal(lechLoaiMaSoThue("", "040204000494"), "");
  assert.equal(lechLoaiMaSoThue("Công ty A", ""), "");
  assert.equal(lechLoaiMaSoThue("Công ty A", "123"), "");
  // Mã gõ có dấu chấm vẫn nhận dạng được
  assert.notEqual(lechLoaiMaSoThue("Công ty A", "040.204.000.494"), "");
});

test("câu nhận dạng mã số thuế: trang kèm 'Sẽ lưu thành' khi có khoảng trắng/dấu chấm; hộp sửa nhanh thì không", () => {
  assert.equal(cauNhanDangMaSoThue("0109123456"), "Nhận dạng: Doanh nghiệp.");
  assert.equal(cauNhanDangMaSoThue("0109123456", { kemMaSeLuu: true }), "Nhận dạng: Doanh nghiệp.");
  assert.equal(cauNhanDangMaSoThue(" 0109123456 ", { kemMaSeLuu: true }), "Nhận dạng: Doanh nghiệp.");
  assert.equal(
    cauNhanDangMaSoThue("0109.123.456", { kemMaSeLuu: true }),
    "Nhận dạng: Doanh nghiệp. Sẽ lưu thành 0109123456.",
  );
  assert.equal(cauNhanDangMaSoThue("0109.123.456"), "Nhận dạng: Doanh nghiệp.");
  assert.equal(
    cauNhanDangMaSoThue("0109 123 456-001", { kemMaSeLuu: true }),
    "Nhận dạng: Chi nhánh, đơn vị phụ thuộc. Sẽ lưu thành 0109123456-001.",
  );
  assert.equal(cauNhanDangMaSoThue("12345", { kemMaSeLuu: true }), "");
  assert.equal(cauNhanDangMaSoThue(""), "");
});

test("định dạng điện thoại khi hiện (giống demo)", () => {
  assert.equal(dinhDangDienThoai("02873009999"), "028 7300 9999");
  assert.equal(dinhDangDienThoai("02439998888"), "024 3999 8888");
  assert.equal(dinhDangDienThoai("0912345678"), "0912 345 678");
  assert.equal(dinhDangDienThoai("0912.345.678"), "0912 345 678");
  assert.equal(dinhDangDienThoai("(028) 7300-9999"), "028 7300 9999");
  assert.equal(dinhDangDienThoai("19001234"), "1900 1234");
  assert.equal(dinhDangDienThoai("18001234"), "1800 1234");
  assert.equal(dinhDangDienThoai("1900123456"), "1900 123 456");
  assert.equal(dinhDangDienThoai("+84 912 345 678"), "+84 912 345 678");
  assert.equal(dinhDangDienThoai(" 12345 "), "12345");
  assert.equal(dinhDangDienThoai(""), "");
  assert.equal(dinhDangDienThoai(null), "");
});

// Bộ ca chung với email (soát chéo 3.4): đọc đúng các ca @CsvSource của DinhDangEmailTest.dienThoai ở máy chủ
const CA_DIEN_THOAI_MAY_CHU = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../backend/src/test/java/com/dev/backend/services/email/DinhDangEmailTest.java",
);

test("định dạng điện thoại trùng email (DinhDangEmail.dienThoai) trên cùng bộ ca", {
  skip: !fs.existsSync(CA_DIEN_THOAI_MAY_CHU) && "không có mã backend",
}, () => {
  const java = fs.readFileSync(CA_DIEN_THOAI_MAY_CHU, "utf8");
  const khoi = java.match(/@CsvSource\(delimiter = '\|', value = \{([^}]*)\}\)\s*void dienThoai\(/);
  assert.ok(khoi, "không đọc được bộ ca dienThoai trong DinhDangEmailTest.java");
  // Như JUnit CsvSource: cắt khoảng trắng, giá trị trong '…' giữ nguyên
  const giaTri = (o) => {
    const t = o.trim();
    return t.length >= 2 && t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1) : t;
  };
  const ca = [...khoi[1].matchAll(/^\s*"(.*)",?\s*$/gm)].map((m) => m[1].split("|").map(giaTri));
  assert.ok(ca.length >= 20, `chỉ đọc được ${ca.length} ca`);
  for (const [vao, ra] of ca) assert.equal(dinhDangDienThoai(vao), ra, `ca [${vao}]`);
});

test("so thay đổi sau chuẩn hóa; giới hạn theo ô của thẻ", () => {
  assert.equal(isCompanyProfileChanged(HO_SO_MAU, { ...HO_SO_MAU, name: " Thời trang Linh Lan " }), false);
  assert.equal(isCompanyProfileChanged(HO_SO_MAU, { ...HO_SO_MAU, taxCode: "0109.123.456" }), false);
  assert.equal(isCompanyProfileChanged(HO_SO_MAU, { ...HO_SO_MAU, address: "Hà Nội" }), true);
  assert.equal(isCompanyProfileChanged({ ...HO_SO_MAU, legalName: null }, { ...HO_SO_MAU, legalName: "" }), false);
  // Thẻ Tên và logo không tính thay đổi ở phần pháp lý
  assert.equal(isCompanyProfileChanged(HO_SO_MAU, { ...HO_SO_MAU, email: "khac@x.vn" }, KHOA_TEN_VA_LOGO), false);
  assert.equal(isCompanyProfileChanged(HO_SO_MAU, { ...HO_SO_MAU, email: "khac@x.vn" }, KHOA_PHAP_LY_LIEN_HE), true);
});

test("payload thẻ Tên và logo chỉ có tên (không gửi phần pháp lý để máy chủ giữ nguyên)", () => {
  assert.deepEqual(payloadTenVaLogo({ ...HO_SO_MAU, name: "  Linh Lan  " }), { name: "Linh Lan" });
});

test("payload thẻ Pháp lý và liên hệ không có tên cửa hàng; mã số thuế đã chuẩn hóa; ô trống gửi chuỗi rỗng để xóa", () => {
  assert.deepEqual(
    payloadPhapLyLienHe({
      name: "Không gửi",
      legalName: " Công ty TNHH A ",
      taxCode: " 0109.123.456 ",
      address: " Hà Nội ",
      phone: null,
      email: "  ",
    }),
    { legalName: "Công ty TNHH A", taxCode: "0109123456", address: "Hà Nội", phone: "", email: "" },
  );
});

test("payload hộp sửa nhanh đủ 6 ô", () => {
  assert.deepEqual(Object.keys(companyProfilePayload(HO_SO_MAU)), COMPANY_PROFILE_FIELDS);
  assert.deepEqual(companyProfilePayload({ ...HO_SO_MAU, taxCode: "0312 345 678-001" }).taxCode, "0312345678-001");
  // Hồ sơ chưa từng có mã số thuế (null) vẫn gửi chuỗi để xóa rõ ràng, không gửi null
  assert.equal(companyProfilePayload(companyProfileForm({ name: "A", taxCode: null })).taxCode, "");
});

test("ô còn thiếu để gửi nhà cung cấp: đủ 4 tổ hợp, theo thứ tự tên đăng ký rồi địa chỉ", () => {
  assert.deepEqual(oThieuDeGuiNhaCungCap(HO_SO_MAU), []);
  assert.deepEqual(oThieuDeGuiNhaCungCap({ ...HO_SO_MAU, address: " " }), ["Địa chỉ đăng ký"]);
  assert.deepEqual(oThieuDeGuiNhaCungCap({ ...HO_SO_MAU, legalName: "" }), ["Tên đăng ký kinh doanh"]);
  assert.deepEqual(oThieuDeGuiNhaCungCap({ name: "FCentric", legalName: null, address: null }), [
    "Tên đăng ký kinh doanh",
    "Địa chỉ đăng ký",
  ]);
  // Chưa đọc được hồ sơ: không chặn ở giao diện
  assert.deepEqual(oThieuDeGuiNhaCungCap(null), []);
});

test("tệp logo: chỉ PNG/JPEG, tối đa 2 MB", () => {
  assert.equal(LOGO_ACCEPT, "image/png,image/jpeg");
  assert.equal(kiemTepLogo({ type: "image/png", size: 1000 }), "");
  assert.equal(kiemTepLogo({ type: "image/jpeg", size: LOGO_TOI_DA_BYTE }), "");
  assert.equal(kiemTepLogo({ type: "image/svg+xml", size: 100 }), "Chỉ nhận ảnh PNG hoặc JPG.");
  assert.equal(kiemTepLogo({ type: "image/webp", size: 100 }), "Chỉ nhận ảnh PNG hoặc JPG.");
  assert.equal(kiemTepLogo({ type: "", size: 100 }), "Chỉ nhận ảnh PNG hoặc JPG.");
  assert.equal(kiemTepLogo({ type: "image/png", size: LOGO_TOI_DA_BYTE + 1 }), "Ảnh lớn hơn 2 MB.");
  assert.equal(kiemTepLogo(null), "");
  // số MB trong câu dựng từ hằng, không viết cứng
  assert.equal(LOGO_TOI_DA_CHU, "2 MB");
  const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "companyProfileSchema.js"), "utf8");
  assert.doesNotMatch(src.replace(/^\s*(\/\/|\/\*\*|\*).*$/gm, ""), /\d\s*MB/, "không viết cứng số MB ngoài chú thích");
});
