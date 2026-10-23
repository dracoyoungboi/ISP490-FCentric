// Chữ và logic hiển thị của trang Cấu hình › Thông tin cửa hàng và hộp sửa nhanh trong trình sửa mẫu in.
// Chép đúng demo đã duyệt (demo-cua-hang/Main.dc.html, SuaNhanhMauIn.dc.html). Hàm thuần, chạy được với node --test
// (chỉ import đường dẫn tương đối).
import {
  KHOA_PHAP_LY_LIEN_HE,
  LOGO_TOI_DA_CHU,
  NHAN_THONG_TIN_CUA_HANG as NHAN,
  cauNhanDangMaSoThue,
  dinhDangDienThoai,
  lechLoaiMaSoThue,
  loaiMaSoThue,
} from "../../validations/companyProfileSchema.js";

export const CHU_THICH_THE_TEN_VA_LOGO = "Hiện ở đầu phiếu in, đầu email và là tên người gửi email";
export const CHU_THICH_THE_PHAP_LY = "In trên phiếu in và email";
// Giới hạn dung lượng lấy từ LOGO_TOI_DA_BYTE (không viết cứng số): với 2 MB ra đúng chữ demo
export const GOI_Y_LOGO_TRANG = `PNG hoặc JPG, tối đa ${LOGO_TOI_DA_CHU}. Không nhận ảnh SVG vì email không hiện được.`;
export const GOI_Y_LOGO_HOP = `PNG hoặc JPG, tối đa ${LOGO_TOI_DA_CHU}.`;
export const CHU_THICH_HOP_SUA_NHANH = "Dùng chung cho mọi mẫu in và email.";

/** Chú thích nút Sửa bị khóa (đặt ở lớp bọc vì nút bị khóa không hiện chú thích). */
export const CHU_THICH_KHOA_THE_KHAC = "Lưu hoặc hủy phần đang sửa trước";
export const CHU_THICH_CHUA_CO_TEN = "Lưu tên cửa hàng trước";

export const TOAST_DA_LUU = "Đã lưu thông tin cửa hàng.";
export const TOAST_CHUA_LUU = "Chưa lưu được thông tin cửa hàng.";

/** Ô trên trang (gợi ý đầy đủ). Thứ tự thẻ Pháp lý: tên đăng ký, mã số thuế; địa chỉ (cả hàng); điện thoại, email. */
export const O_TRANG = {
  name: {
    label: NHAN.name,
    required: true,
    type: "text",
    placeholder: "Ví dụ: Thời trang Linh Lan",
    hint: "Tên trên biển hiệu, thương hiệu khách quen gọi. Không thay cho tên đăng ký kinh doanh trên hóa đơn, email.",
  },
  legalName: {
    label: NHAN.legalName,
    required: true,
    type: "text",
    placeholder: "Ví dụ: Công ty TNHH Thời trang Linh Lan",
    hint: 'Ghi đúng như trên giấy chứng nhận đăng ký: "Công ty TNHH …", "Hộ kinh doanh …"; chi nhánh thêm "Chi nhánh …".',
  },
  taxCode: {
    label: NHAN.taxCode,
    type: "text",
    placeholder: "Ví dụ: 0109123456",
    hint: "Doanh nghiệp 10 số, chi nhánh 10 số kèm -3 số, hộ kinh doanh 12 số.",
  },
  address: {
    label: NHAN.address,
    required: true,
    type: "text",
    placeholder: "Số nhà, đường, phường/xã, tỉnh/thành phố",
    hint: "Ghi đúng địa chỉ trên giấy chứng nhận đăng ký. Địa chỉ từng cửa hàng, kho nằm ở mục Kho.",
    wide: true,
  },
  phone: { label: NHAN.phone, type: "tel", placeholder: "028 7300 0000", hint: "" },
  email: {
    label: NHAN.email,
    type: "email",
    placeholder: "lienhe@tencuahang.vn",
    hint: "Nhà cung cấp gửi hóa đơn điện tử về địa chỉ này.",
  },
};

/** Ô trong hộp sửa nhanh (gợi ý ngắn; mỗi ô pháp lý một hàng, Email trước Điện thoại). */
export const O_HOP_SUA_NHANH = {
  name: { ...O_TRANG.name, hint: "" },
  legalName: { ...O_TRANG.legalName, hint: "Ghi đúng như trên giấy chứng nhận đăng ký.", wide: true },
  taxCode: { ...O_TRANG.taxCode, hint: "10 số, chi nhánh thêm -3 số, hộ kinh doanh 12 số.", wide: true },
  address: { ...O_TRANG.address, hint: "Ghi đúng địa chỉ trên giấy chứng nhận đăng ký.", wide: true },
  email: { ...O_TRANG.email, hint: "" },
  phone: { ...O_TRANG.phone, hint: "" },
};
export const THU_TU_PHAP_LY_HOP = ["legalName", "taxCode", "address", "email", "phone"];

/**
 * Dòng gợi ý dưới ô khi đang sửa: { text, tone: "muted" | "ok" | "warn" }.
 * - Mã số thuế nhận dạng được: xanh "Nhận dạng: …" (trang thêm "Sẽ lưu thành …");
 * - Tên đăng ký lệch loại mã số thuế: câu cảnh báo cam thay gợi ý.
 */
export function goiYKhiSua(key, form, { noi = "trang" } = {}) {
  const o = (noi === "hop" ? O_HOP_SUA_NHANH : O_TRANG)[key];
  if (key === "taxCode") {
    const nhanDang = cauNhanDangMaSoThue(form?.taxCode, { kemMaSeLuu: noi === "trang" });
    if (nhanDang) return { text: nhanDang, tone: "ok" };
  }
  if (key === "legalName") {
    const lech = lechLoaiMaSoThue(form?.legalName, form?.taxCode);
    if (lech) return { text: lech, tone: "warn" };
  }
  return { text: o?.hint ?? "", tone: "muted" };
}

/** Thẻ Tên và logo khi xem: tên trống thì "Chưa nhập" màu cam kèm lý do. */
export function xemTenCuaHang(profile) {
  const ten = (profile?.name ?? "").trim();
  if (ten) return { text: ten, canhBao: false, phu: "" };
  return { text: "Chưa nhập", canhBao: true, phu: "Cần để in phiếu và gửi email." };
}

/**
 * Thẻ Pháp lý và liên hệ khi xem — mỗi dòng { key, label, text, trong, canhBao, tag, phu, wide, so }.
 * Tên đăng ký, địa chỉ đăng ký trống: "Chưa nhập" cam kèm lý do; ô khác trống: "Chưa nhập" xám.
 * Mã số thuế kèm loại mã; điện thoại cách nhóm khi hiện; tên đăng ký lệch loại mã số thuế thì dòng phụ cam.
 */
export function xemPhapLyLienHe(profile) {
  return KHOA_PHAP_LY_LIEN_HE.map((key) => {
    const raw = (profile?.[key] ?? "").trim();
    const dong = {
      key,
      label: NHAN[key],
      text: raw || "Chưa nhập",
      trong: !raw,
      canhBao: false,
      tag: "",
      phu: "",
      wide: Boolean(O_TRANG[key].wide),
      so: false,
    };
    if (key === "legalName") {
      if (!raw) {
        dong.canhBao = true;
        dong.phu = "Hóa đơn và email phải ghi đúng tên trên giấy chứng nhận đăng ký.";
      } else {
        dong.phu = lechLoaiMaSoThue(raw, profile?.taxCode);
      }
    }
    if (key === "address" && !raw) {
      dong.canhBao = true;
      dong.phu = "Hóa đơn và email gửi nhà cung cấp phải có địa chỉ này.";
    }
    if (key === "taxCode" && raw) {
      dong.tag = loaiMaSoThue(raw);
      dong.so = true;
    }
    if (key === "phone" && raw) {
      dong.text = dinhDangDienThoai(raw);
      dong.so = true;
    }
    return dong;
  });
}

/**
 * Nút Sửa của một thẻ: { hien, khoa, chuThich }.
 * - Vai trò chỉ xem hoặc thẻ đang sửa: không hiện;
 * - thẻ kia đang sửa: khóa, "Lưu hoặc hủy phần đang sửa trước";
 * - thẻ Pháp lý khi cửa hàng chưa có tên: khóa, "Lưu tên cửa hàng trước" (máy chủ cần tên trước).
 */
export function nutSuaThe(the, { dangSua = null, coTen = false, canEdit = false } = {}) {
  if (!canEdit || dangSua === the) return { hien: false, khoa: false, chuThich: "" };
  if (dangSua) return { hien: true, khoa: true, chuThich: CHU_THICH_KHOA_THE_KHAC };
  if (the === "B" && !coTen) return { hien: true, khoa: true, chuThich: CHU_THICH_CHUA_CO_TEN };
  return { hien: true, khoa: false, chuThich: "" };
}

/**
 * Lưu thông tin xong mà tải logo lỗi: báo riêng, nói rõ phần nào đã lưu (logo luôn tải SAU khi lưu thông tin).
 * Trang chỉ lưu tên cùng logo; hộp sửa nhanh lưu cả hồ sơ.
 */
export function thongBaoLogoLoi({ daLuuThongTin, noi = "trang" }) {
  if (!daLuuThongTin) return "Chưa tải được logo";
  return noi === "hop" ? "Đã lưu thông tin, chưa tải được logo" : "Đã lưu tên, chưa tải được logo";
}

/** Câu chi tiết từ lỗi máy chủ (câu tiếng Việt của máy chủ, hoặc mất kết nối). */
export function chiTietLoi(error) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (!error?.response && error?.request) return "Không nhận được phản hồi từ máy chủ. Vui lòng thử lại.";
  return "Vui lòng thử lại.";
}
