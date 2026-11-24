// Chạy: node --test src/components/supplier-portal/loiCong.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAU_BIEN_BAN_KHONG_CON_NHAN,
  CAU_CHO_GUI_LAI,
  CAU_DON_KHONG_CON_NHAN,
  CAU_LOI_TAI,
  CAU_MA_CU_CON_HIEU_LUC,
  CAU_MA_HET_HAN,
  CAU_MA_SAI,
  CAU_PHIEN_HET_HAN,
  LOI_GUI_MAC_DINH,
  LOI_MAT_KET_NOI,
  LOI_XAC_NHAN_BIEN_BAN,
  boThongBaoVaoTrang,
  cauDaGuiMa,
  dinhDangDemNguoc,
  docThoiHanMa,
  laPhienHetHan,
  soGiay,
  xuLyLoiGuiBaoGia,
  xuLyLoiNhanMa,
  xuLyLoiTai,
  xuLyLoiXacNhan,
  xuLyLoiXacNhanBienBan,
} from "./loiCong.js";

/** Lỗi axios giả: HTTP `status`, body ResponseData `{ status, error, message, data }`. */
const loi = (status, { ma, message, data } = {}) => ({
  response: { status, data: { status, error: ma ?? "Bad Request", message, data: ma ? { code: ma, ...data } : data } },
});
const matMang = { request: {}, message: "Network Error" };

test("soGiay / docThoiHanMa: chỉ nhận số ≥ 0, thiếu thì null (không đoán 300)", () => {
  assert.equal(soGiay(60), 60);
  assert.equal(soGiay("45"), 45);
  assert.equal(soGiay(0), 0);
  assert.equal(soGiay(12.2), 13);
  assert.equal(soGiay(-1), null);
  assert.equal(soGiay(undefined), null);
  assert.equal(soGiay("abc"), null);
  assert.deepEqual(docThoiHanMa({ hetHanGiay: 300, guiLaiSauGiay: 60 }), { hetHanGiay: 300, guiLaiSauGiay: 60 });
  assert.deepEqual(docThoiHanMa(null), { hetHanGiay: null, guiLaiSauGiay: null });
});

test("cauDaGuiMa: thời hạn theo máy chủ, thiếu thì bỏ câu thời hạn", () => {
  assert.equal(
    cauDaGuiMa(300),
    "Mã có hiệu lực trong 5 phút. Nếu không thấy email, hãy kiểm tra thư mục Thư rác.",
  );
  assert.equal(cauDaGuiMa(600, { guiLai: true }), "Đã gửi lại mã xác nhận. Mã có hiệu lực trong 10 phút. Vui lòng kiểm tra email.");
  assert.equal(cauDaGuiMa(null), "Nếu không thấy email, hãy kiểm tra thư mục Thư rác.");
  assert.equal(cauDaGuiMa(20), "Mã có hiệu lực trong 1 phút. Nếu không thấy email, hãy kiểm tra thư mục Thư rác.");
  assert.equal(cauDaGuiMa(null, { guiLai: true }), "Đã gửi lại mã xác nhận. Vui lòng kiểm tra email.");
  // L4: dòng dưới tiêu đề bước 2 đã nói "Mã 6 chữ số đã được gửi tới …": thông báo lần đầu không nói lại
  assert.doesNotMatch(cauDaGuiMa(300), /đã gửi|Đã gửi/);
  assert.doesNotMatch(cauDaGuiMa(300), /OTP/);
});

test("dinhDangDemNguoc", () => {
  assert.equal(dinhDangDemNguoc(60), "1:00");
  assert.equal(dinhDangDemNguoc(59), "0:59");
  assert.equal(dinhDangDemNguoc(3605), "60:05");
  assert.equal(dinhDangDemNguoc(-3), "0:00");
});

test("xuLyLoiNhanMa: 429 mã cũ còn hiệu lực → bước nhập mã, đếm ngược theo máy chủ", () => {
  const kq = xuLyLoiNhanMa(loi(429, { ma: "MA_CU_CON_HIEU_LUC", message: "x", data: { guiLaiSauGiay: 42, hetHanGiay: 250 } }));
  assert.deepEqual(kq, { loai: "cho-gui-lai", guiLaiSauGiay: 42, cau: CAU_MA_CU_CON_HIEU_LUC });
  // Thiếu hetHanGiay: vẫn coi mã cũ còn hiệu lực
  assert.equal(xuLyLoiNhanMa(loi(429, { ma: "MA_CU_CON_HIEU_LUC", data: { guiLaiSauGiay: 5 } })).cau, CAU_MA_CU_CON_HIEU_LUC);
  // Thiếu guiLaiSauGiay: không đếm ngược (máy chủ chặn nếu bấm sớm)
  assert.equal(xuLyLoiNhanMa(loi(429, { ma: "MA_CU_CON_HIEU_LUC" })).guiLaiSauGiay, 0);
});

test("xuLyLoiNhanMa: 429 quá số mã trong giờ (hetHanGiay = 0) → ở lại bước 1 (R10), câu máy chủ", () => {
  const kq = xuLyLoiNhanMa(
    loi(429, { ma: "MA_CU_CON_HIEU_LUC", message: "Đã gửi quá 5 mã trong một giờ.", data: { guiLaiSauGiay: 1800, hetHanGiay: 0 } }),
  );
  assert.deepEqual(kq, { loai: "phai-cho", guiLaiSauGiay: 1800, cau: "Đã gửi quá 5 mã trong một giờ." });
  assert.equal(xuLyLoiNhanMa(loi(429, { ma: "MA_CU_CON_HIEU_LUC", data: { hetHanGiay: 0 } })).cau, CAU_CHO_GUI_LAI);
});

test("xuLyLoiNhanMa: email chưa đăng ký, 503, 400, mất mạng", () => {
  // Đăng nhập theo email: không còn "đơn không còn nhận báo giá" ở bước nhận mã
  assert.deepEqual(xuLyLoiNhanMa(loi(400, { ma: "EMAIL_KHONG_CO", message: "Email hoặc mã không đúng." })), {
    loai: "loi",
    cau: "Email hoặc mã không đúng.",
  });
  assert.equal(xuLyLoiNhanMa(loi(409, { ma: "DON_KHONG_CON_NHAN", message: "khác" })).loai, "loi");
  assert.deepEqual(xuLyLoiNhanMa(loi(503, { ma: "CHUA_GUI_DUOC_MA", message: "Chưa gửi được mã. Thử lại sau ít phút." })), {
    loai: "chua-gui-duoc",
    cau: "Chưa gửi được mã. Thử lại sau ít phút.",
  });
  assert.deepEqual(xuLyLoiNhanMa(loi(400, { ma: "DON_HOAC_EMAIL_SAI", message: "Không tìm thấy đơn hoặc email không đúng." })), {
    loai: "loi",
    cau: "Không tìm thấy đơn hoặc email không đúng.",
  });
  assert.deepEqual(xuLyLoiNhanMa(matMang), { loai: "loi", cau: LOI_MAT_KET_NOI });
  // Không dò câu chữ: câu có chữ "otp" mà không có mã thì không bị coi là "mã cũ còn hiệu lực"
  assert.equal(xuLyLoiNhanMa(loi(400, { message: "Otp chưa hết hạn" })).loai, "loi");
});

test("xuLyLoiXacNhan: MA_SAI (kèm số lần còn lại), MA_HET_HAN, email không có (cùng câu với sai mã)", () => {
  assert.deepEqual(xuLyLoiXacNhan(loi(400, { ma: "MA_SAI", data: { conLaiLanThu: 3 } })), {
    loai: "ma-sai",
    cau: "Mã xác nhận không đúng. Còn 3 lần nhập.",
  });
  assert.deepEqual(xuLyLoiXacNhan(loi(400, { ma: "MA_SAI" })), { loai: "ma-sai", cau: CAU_MA_SAI });
  assert.deepEqual(xuLyLoiXacNhan(loi(400, { ma: "MA_HET_HAN" })), { loai: "ma-het-han", cau: CAU_MA_HET_HAN });
  // Không cho dò email đã đăng ký: email không thuộc nhà cung cấp nào báo như sai mã
  assert.deepEqual(xuLyLoiXacNhan(loi(400, { ma: "EMAIL_KHONG_CO", message: "Email không có" })), { loai: "ma-sai", cau: CAU_MA_SAI });
  assert.deepEqual(xuLyLoiXacNhan(loi(400, { ma: "DON_HOAC_EMAIL_SAI" })), { loai: "ma-sai", cau: CAU_MA_SAI });
  assert.deepEqual(xuLyLoiXacNhan(loi(500, { message: "Lỗi máy chủ" })), { loai: "loi", cau: "Lỗi máy chủ" });
  assert.deepEqual(xuLyLoiXacNhan(matMang), { loai: "loi", cau: LOI_MAT_KET_NOI });
});

test("xuLyLoiGuiBaoGia: phiên hết hạn, không còn nhận, dữ liệu sai kèm dòng, mất mạng", () => {
  assert.deepEqual(xuLyLoiGuiBaoGia(loi(401, { ma: "PHIEN_HET_HAN", message: CAU_PHIEN_HET_HAN })), {
    loai: "phien-het-han",
    cau: CAU_PHIEN_HET_HAN,
  });
  assert.deepEqual(xuLyLoiGuiBaoGia(loi(409, { ma: "DON_KHONG_CON_NHAN" })), { loai: "khong-con-nhan", cau: CAU_DON_KHONG_CON_NHAN });
  assert.deepEqual(xuLyLoiGuiBaoGia(loi(400, { ma: "BAO_GIA_KHONG_HOP_LE", message: "Đơn giá phải lớn hơn 0.", data: { dong: 77 } })), {
    loai: "du-lieu-sai",
    cau: "Không gửi được báo giá. Đơn giá phải lớn hơn 0.",
    dong: 77,
  });
  assert.equal(xuLyLoiGuiBaoGia(loi(400, { ma: "BAO_GIA_KHONG_HOP_LE", message: "x" })).dong, null);
  assert.deepEqual(xuLyLoiGuiBaoGia(matMang), { loai: "loi", cau: LOI_GUI_MAC_DINH });
  assert.deepEqual(xuLyLoiGuiBaoGia(loi(500, {})), { loai: "loi", cau: LOI_GUI_MAC_DINH });
  // 403 không có mã (vd. lỗi khác) không bị coi là hết phiên
  assert.equal(xuLyLoiGuiBaoGia(loi(403, { message: "Cấm" })).loai, "loi");
});

test("boThongBaoVaoTrang: đã nhận mã mới thì bỏ câu 'phiên hết hạn' khỏi lịch sử (Quay lại không hiện lại)", () => {
  const vao = { pathname: "/supplier/login", search: "?tiep=%2Fsupplier%2Fportal%2Fhistory&email=ncc4%40x.vn", state: { thongBao: CAU_PHIEN_HET_HAN } };
  assert.deepEqual(boThongBaoVaoTrang(vao), ["/supplier/login?tiep=%2Fsupplier%2Fportal%2Fhistory&email=ncc4%40x.vn", { replace: true, state: null }]);
  assert.equal(boThongBaoVaoTrang({ ...vao, state: null }), null, "không có câu nào: không điều hướng");
  assert.equal(boThongBaoVaoTrang({ pathname: "/supplier/login", search: "", state: {} }), null);
  assert.equal(boThongBaoVaoTrang(undefined), null);
});

test("laPhienHetHan / xuLyLoiTai: hết phiên theo mã (không theo HTTP), 404 không tìm thấy, mất mạng", () => {
  assert.equal(laPhienHetHan(loi(401, { ma: "PHIEN_HET_HAN" })), true);
  assert.equal(laPhienHetHan(loi(403, { ma: "PHIEN_HET_HAN" })), true, "máy chủ thật trả 403");
  assert.equal(laPhienHetHan(loi(403, { message: "Forbidden" })), false);
  assert.equal(laPhienHetHan(loi(401, { message: "Unauthorized" })), false, "401 không mã không coi là hết phiên cổng");
  assert.deepEqual(xuLyLoiTai(loi(401, { ma: "PHIEN_HET_HAN" })), { loai: "phien-het-han", cau: CAU_PHIEN_HET_HAN });
  assert.deepEqual(xuLyLoiTai(loi(404, { ma: "KHONG_TIM_THAY", message: "Không tìm thấy." })), { loai: "khong-tim-thay", cau: "Không tìm thấy." });
  assert.equal(xuLyLoiTai(loi(404, {})).loai, "khong-tim-thay");
  assert.deepEqual(xuLyLoiTai(loi(500, { message: "Lỗi máy chủ" })), { loai: "loi", cau: "Lỗi máy chủ" });
  assert.deepEqual(xuLyLoiTai(loi(500, {})), { loai: "loi", cau: CAU_LOI_TAI });
  assert.deepEqual(xuLyLoiTai(matMang), { loai: "loi", cau: CAU_LOI_TAI });
});

test("xuLyLoiXacNhanBienBan: không còn nhận → tải lại, hết phiên, dữ liệu sai, mất mạng", () => {
  assert.deepEqual(xuLyLoiXacNhanBienBan(loi(409, { ma: "BIEN_BAN_KHONG_CON_NHAN", message: "x" })), {
    loai: "khong-con-nhan",
    cau: CAU_BIEN_BAN_KHONG_CON_NHAN,
  });
  assert.equal(xuLyLoiXacNhanBienBan(loi(401, { ma: "PHIEN_HET_HAN" })).loai, "phien-het-han");
  assert.equal(xuLyLoiXacNhanBienBan(loi(404, { ma: "KHONG_TIM_THAY" })).loai, "khong-tim-thay");
  assert.deepEqual(xuLyLoiXacNhanBienBan(loi(400, { message: "Người xác nhận không hợp lệ." })), {
    loai: "loi",
    cau: "Người xác nhận không hợp lệ.",
  });
  assert.deepEqual(xuLyLoiXacNhanBienBan(matMang), { loai: "loi", cau: LOI_XAC_NHAN_BIEN_BAN });
  // Máy chủ chỉ ra ô sai: hiện câu ngay dưới ô đó
  assert.deepEqual(
    xuLyLoiXacNhanBienBan(loi(400, { ma: "TRA_LOI_KHONG_HOP_LE", message: "Họ tên chỉ gồm chữ cái và dấu cách", data: { o: "nguoiXacNhan" } })),
    { loai: "du-lieu-sai", o: "nguoiXacNhan", dong: null, cau: "Họ tên chỉ gồm chữ cái và dấu cách" },
  );
  assert.equal(xuLyLoiXacNhanBienBan(loi(400, { ma: "TRA_LOI_KHONG_HOP_LE" })).o, null);
  // Trả lời theo từng dòng: máy chủ chỉ ra dòng sản phẩm thiếu lựa chọn
  assert.deepEqual(
    xuLyLoiXacNhanBienBan(loi(400, { ma: "TRA_LOI_KHONG_HOP_LE", message: "Chọn giao bù hoặc trừ tiền.", data: { o: "phuongAn", dong: 302 } })),
    { loai: "du-lieu-sai", o: "phuongAn", dong: 302, cau: "Chọn giao bù hoặc trừ tiền." },
  );
});
