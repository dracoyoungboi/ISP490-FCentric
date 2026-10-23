package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.enums.FileType;
import com.dev.backend.dto.request.ThongTinCongTyRequest;
import com.dev.backend.dto.response.ThongTinCongTyDto;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.utils.PublicAssetUrl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.Arrays;
import java.util.regex.Pattern;

/**
 * Thông tin cửa hàng dùng chung (bảng một dòng, id = 1): đầu phiếu in, đầu và chân email.
 * Logo tải lên qua MinIO và quản lý ở tep_tin (như ảnh sản phẩm).
 *
 * Quy tắc cập nhật (PUT), áp cho từng trường:
 * - null / không gửi = giữ nguyên (thẻ "Tên và logo" chỉ gửi name; thẻ "Pháp lý và liên hệ" không gửi name);
 * - chuỗi trắng = xóa, trừ name và legalName (trắng thì báo lỗi);
 * - chưa có hồ sơ mà không gửi name thì báo "Lưu tên cửa hàng trước." (cột tên không được trống).
 * Tên đăng ký kinh doanh và địa chỉ đăng ký bắt buộc ở giao diện (thẻ Pháp lý và liên hệ, hộp sửa nhanh) và ở bước
 * gửi yêu cầu báo giá (máy chủ, khu mua hàng); PUT không chặn thêm (đặc tả 6.5, soát chéo 3.4).
 */
@Service
@Slf4j
public class ThongTinCongTyService {

    @Autowired
    private ThongTinCongTyRepository thongTinCongTyRepository;
    @Autowired
    private MinioService minioService;
    @Autowired
    private TepTinService tepTinService;

    private static final int PROFILE_ID = 1;
    private static final int PROFILE_VERSION = 1;

    /** Độ dài tối đa của tên cửa hàng, tên đăng ký kinh doanh (cột ten_cong_ty, ten_dang_ky_kinh_doanh). */
    static final int TEN_TOI_DA = 255;
    /** Độ dài tối đa của email (cột email varchar(100)). */
    static final int EMAIL_TOI_DA = 100;
    /** Logo tối đa 2 MB — khớp LOGO_TOI_DA_BYTE ở frontend (validations/companyProfileSchema.js). */
    static final long LOGO_TOI_DA_BYTE = 2L * 1024 * 1024;

    // Câu lỗi hiện nguyên văn ở giao diện: chép đúng chữ demo (demo-cua-hang/Main.dc.html, hàm validate)
    static final String LOI_THIEU_TEN = "Nhập tên cửa hàng.";
    static final String LOI_TEN_QUA_DAI = "Tên cửa hàng tối đa " + TEN_TOI_DA + " ký tự.";
    static final String LOI_THIEU_TEN_DANG_KY = "Nhập tên đăng ký kinh doanh.";
    static final String LOI_TEN_DANG_KY_QUA_DAI = "Tên đăng ký kinh doanh tối đa " + TEN_TOI_DA + " ký tự.";
    static final String LOI_MA_SO_THUE = "Mã số thuế gồm 10 số (đơn vị phụ thuộc thêm -3 số) hoặc 12 số.";
    static final String LOI_EMAIL = "Email không hợp lệ.";
    static final String LOI_DIEN_THOAI = "Số điện thoại không hợp lệ.";
    static final String LOI_CHUA_CO_TEN = "Lưu tên cửa hàng trước.";
    static final String LOI_LOGO_CHUA_CO_HO_SO = "Lưu tên cửa hàng trước khi tải logo.";
    static final String LOI_LOGO_TRONG = "Chưa chọn ảnh logo.";
    static final String LOI_LOGO_SAI_LOAI = "Chỉ nhận ảnh PNG hoặc JPG.";
    static final String LOI_LOGO_QUA_LON = "Ảnh lớn hơn 2 MB.";
    static final String LOI_LOGO_TAI_LEN = "Chưa tải được logo lên. Vui lòng thử lại.";

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+\\-\\s()]{6,20}$");
    /** Doanh nghiệp 10 số, đơn vị phụ thuộc 10 số + "-3 số"; hộ/cá nhân kinh doanh dùng số định danh 12 số. */
    private static final Pattern TAX_CODE = Pattern.compile("^(\\d{10}(-\\d{3})?|\\d{12})$");
    /** Người dùng hay gõ "0109.123.456" hoặc có khoảng trắng: bỏ trước khi kiểm và lưu (khớp frontend). */
    private static final Pattern KY_TU_BO_TRONG_MA_SO_THUE = Pattern.compile("[\\s.]");

    private static final String LOAI_PNG = "image/png";
    private static final String LOAI_JPEG = "image/jpeg";
    private static final byte[] DAU_PNG = {(byte) 0x89, 0x50, 0x4E, 0x47};
    private static final byte[] DAU_JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    /**
     * Đọc hồ sơ. Chưa có dòng nào thì vẫn trả đối tượng: id 1, version 1, các trường còn lại null
     * (không tự đặt tên "FCentric" hay logo của phần mềm).
     */
    public ThongTinCongTyDto getProfile() {
        return thongTinCongTyRepository.findById(PROFILE_ID)
                .map(this::toDto)
                .orElseGet(() -> ThongTinCongTyDto.builder().id(PROFILE_ID).version(PROFILE_VERSION).build());
    }

    /** Cập nhật thông tin (không đổi logo). Kiểm hết rồi mới ghi. */
    @Transactional
    public ThongTinCongTyDto updateProfile(ThongTinCongTyRequest req) {
        if (req == null) {
            throw new CommonException("Dữ liệu gửi lên không hợp lệ.");
        }
        ThongTinCongTy entity = thongTinCongTyRepository.findById(PROFILE_ID)
                .orElseGet(() -> ThongTinCongTy.builder().id(PROFILE_ID).build());

        String ten = req.getName() == null ? null : req.getName().trim();
        if (ten != null) {
            if (ten.isEmpty()) throw new CommonException(LOI_THIEU_TEN);
            if (ten.length() > TEN_TOI_DA) throw new CommonException(LOI_TEN_QUA_DAI);
        } else if (isBlank(entity.getTenCongTy())) {
            // Thẻ Pháp lý và liên hệ khóa khi chưa có tên; chặn cả ở máy chủ vì cột tên không được trống
            throw new CommonException(LOI_CHUA_CO_TEN);
        }

        String tenDangKy = req.getLegalName() == null ? null : req.getLegalName().trim();
        if (tenDangKy != null) {
            if (tenDangKy.isEmpty()) throw new CommonException(LOI_THIEU_TEN_DANG_KY);
            if (tenDangKy.length() > TEN_TOI_DA) throw new CommonException(LOI_TEN_DANG_KY_QUA_DAI);
        }

        String maSoThue = req.getTaxCode() == null ? null : chuanHoaMaSoThue(req.getTaxCode());
        if (maSoThue != null && !maSoThue.isEmpty() && !TAX_CODE.matcher(maSoThue).matches()) {
            throw new CommonException(LOI_MA_SO_THUE);
        }

        String email = req.getEmail() == null ? null : req.getEmail().trim();
        if (email != null && !email.isEmpty()
                && (email.length() > EMAIL_TOI_DA || !EMAIL.matcher(email).matches())) {
            throw new CommonException(LOI_EMAIL);
        }

        String dienThoai = req.getPhone() == null ? null : req.getPhone().trim();
        if (dienThoai != null && !dienThoai.isEmpty() && !PHONE.matcher(dienThoai).matches()) {
            throw new CommonException(LOI_DIEN_THOAI);
        }

        String diaChi = req.getAddress() == null ? null : req.getAddress().trim();

        if (ten != null) entity.setTenCongTy(ten);
        if (tenDangKy != null) entity.setTenDangKyKinhDoanh(tenDangKy);
        if (maSoThue != null) entity.setMaSoThue(emptyToNull(maSoThue));
        if (email != null) entity.setEmail(emptyToNull(email));
        if (dienThoai != null) entity.setSoDienThoai(emptyToNull(dienThoai));
        if (diaChi != null) entity.setDiaChi(emptyToNull(diaChi));
        entity.setVersion(PROFILE_VERSION);
        entity.setNgayCapNhat(Instant.now());
        return toDto(thongTinCongTyRepository.save(entity));
    }

    /**
     * Upload logo qua MinIO rồi lưu metadata vào tep_tin (chuẩn như ảnh sản phẩm).
     * Chỉ nhận PNG/JPEG (kiểm cả loại khai báo lẫn byte đầu tệp), tối đa 2 MB: email không hiện được SVG.
     * Chưa có hồ sơ (chưa lưu tên) thì không nhận — không tự đặt tên thay người dùng.
     * Thay logo: upload tệp mới TRƯỚC, xóa tệp cũ (dòng tep_tin + object MinIO) SAU.
     */
    @Transactional
    public ThongTinCongTyDto updateLogo(MultipartFile file) {
        kiemTepLogo(file);
        ThongTinCongTy entity = thongTinCongTyRepository.findById(PROFILE_ID)
                .filter(hoSo -> !isBlank(hoSo.getTenCongTy()))
                .orElseThrow(() -> new CommonException(LOI_LOGO_CHUA_CO_HO_SO));
        try {
            TepTin tepTinCu = entity.getTepTin();

            // Upload object mới lên MinIO và tạo dòng tep_tin tương ứng
            String objectName = minioService.upload(file);
            String duoiTep = minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension");
            TepTin tepTinMoi = tepTinService.create(TepTin.builder()
                    .tenTepGoc(objectName)
                    .tenTaiLen(objectName)
                    .tenLuuTru(objectName)
                    .duongDan(minioService.getPublicUrl(objectName))
                    .loaiTepTin(FileType.IMAGE.toString())
                    .duoiTep(duoiTep)
                    .trangThai(1)
                    .ngayTao(Instant.now())
                    .build());

            entity.setTepTin(tepTinMoi);
            entity.setVersion(PROFILE_VERSION);
            entity.setNgayCapNhat(Instant.now());
            ThongTinCongTy saved = thongTinCongTyRepository.save(entity);

            // Xóa tệp cũ (dòng tep_tin + object MinIO) sau khi đã gắn tệp mới thành công
            if (tepTinCu != null) {
                tepTinService.hardDeleteNoMessage(tepTinCu.getId());
            }

            return toDto(saved);
        } catch (CommonException e) {
            throw e;
        } catch (Exception e) {
            log.error("Lỗi upload logo lên MinIO", e);
            throw new CommonException(LOI_LOGO_TAI_LEN);
        }
    }

    /** Bỏ khoảng trắng và dấu chấm: "0109.123.456" -> "0109123456" (khớp chuanHoaMaSoThue ở frontend). */
    static String chuanHoaMaSoThue(String value) {
        return value == null ? null : KY_TU_BO_TRONG_MA_SO_THUE.matcher(value).replaceAll("");
    }

    private void kiemTepLogo(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CommonException(LOI_LOGO_TRONG);
        }
        if (file.getSize() > LOGO_TOI_DA_BYTE) {
            throw new CommonException(LOI_LOGO_QUA_LON);
        }
        String loai = file.getContentType() == null ? "" : file.getContentType().trim().toLowerCase();
        byte[] dau;
        try (InputStream in = file.getInputStream()) {
            dau = in.readNBytes(DAU_PNG.length);
        } catch (IOException e) {
            log.warn("Không đọc được tệp logo", e);
            throw new CommonException(LOI_LOGO_SAI_LOAI);
        }
        // Loại khai báo phải khớp nội dung: object MinIO lưu theo loại khai báo, email đọc theo loại này
        boolean laPng = LOAI_PNG.equals(loai) && batDauBang(dau, DAU_PNG);
        boolean laJpeg = LOAI_JPEG.equals(loai) && batDauBang(dau, DAU_JPEG);
        if (!laPng && !laJpeg) {
            throw new CommonException(LOI_LOGO_SAI_LOAI);
        }
    }

    private static boolean batDauBang(byte[] du, byte[] dau) {
        return du != null && du.length >= dau.length && Arrays.equals(Arrays.copyOf(du, dau.length), dau);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private ThongTinCongTyDto toDto(ThongTinCongTy entity) {
        // Logo ưu tiên từ tep_tin (chuẩn quản lý tệp); không có thì cột cũ logo_duong_dan; không có nữa thì null
        // (không còn logo mặc định của phần mềm: phiếu in, email tự hiện tên cửa hàng khi chưa có logo)
        String logoSelected = entity.getTepTin() != null && entity.getTepTin().getDuongDan() != null
                ? entity.getTepTin().getDuongDan()
                : entity.getLogoDuongDan();
        // Chuẩn hoá origin legacy MinIO -> HTTPS để trình duyệt không chặn Mixed Content
        String logoAsset = PublicAssetUrl.toHttps(logoSelected);
        return ThongTinCongTyDto.builder()
                .id(entity.getId())
                .name(entity.getTenCongTy())
                .legalName(entity.getTenDangKyKinhDoanh())
                .taxCode(entity.getMaSoThue())
                .logoAsset(logoAsset)
                .email(entity.getEmail())
                .phone(entity.getSoDienThoai())
                .address(entity.getDiaChi())
                .version(entity.getVersion())
                .ngayCapNhat(entity.getNgayCapNhat())
                .build();
    }
}
