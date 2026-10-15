package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.KenhCauHinhDongBoRequest;
import com.dev.backend.dto.response.customize.KenhCauHinhDongBoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.CauHinhHeThong;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.utils.KenhCauHinhDongBo;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Đọc/lưu cấu hình đồng bộ của từng kênh bán (màn Thiết lập và Cấu hình kênh).
 * Chỉ thêm dòng mới vào cau_hinh_he_thong; không đụng bảng kenh_ban_hang hay token đã mã hóa.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class KenhCauHinhDongBoService {

    static final String OMNI_SYNC_INTERVAL_MINS = "OMNI_SYNC_INTERVAL_MINS";
    static final String REALTIME_SYNC_THRESHOLD = "REALTIME_SYNC_THRESHOLD";

    CauHinhHeThongRepository cauHinhHeThongRepository;
    KenhBanHangRepository kenhBanHangRepository;
    DieuHanhHeThongService dieuHanhHeThongService;
    LichSuThayDoiService lichSuThayDoiService;
    NguoiDungRepository nguoiDungRepository;

    @Transactional(readOnly = true)
    public KenhCauHinhDongBoDto layCauHinh(String maKenh) {
        String ma = kiemTraMaKenh(maKenh);
        boolean daLuuTonKho = daCo(ma, KenhCauHinhDongBo.TU_DONG_DAY_TON) || daCo(ma, KenhCauHinhDongBo.TY_LE_DAY_TON)
                || daCo(ma, KenhCauHinhDongBo.TON_DEM) || daCo(ma, KenhCauHinhDongBo.NGUONG_VE_0);
        boolean daLuuDonHang = daCo(ma, KenhCauHinhDongBo.TU_DONG_LAY_DON);
        boolean daLuu = daLuuTonKho || daLuuDonHang;
        int chuKy = Math.max(1, Math.min(dieuHanhHeThongService.getCauHinhInt(OMNI_SYNC_INTERVAL_MINS, 10), 1440));
        int nguongNgay = Math.max(0, Math.min(dieuHanhHeThongService.getCauHinhInt(REALTIME_SYNC_THRESHOLD, 3), 100));
        return KenhCauHinhDongBoDto.builder()
                .maKenh(ma)
                .tuDongDayTon(KenhCauHinhDongBo.tuDongDayTon(dieuHanhHeThongService, ma))
                .tuDongLayDon(KenhCauHinhDongBo.tuDongLayDon(dieuHanhHeThongService, ma))
                .tyLeDayTon(KenhCauHinhDongBo.tyLeDayTon(dieuHanhHeThongService, ma))
                .tonDem(KenhCauHinhDongBo.tonDem(dieuHanhHeThongService, ma))
                .nguongVe0(KenhCauHinhDongBo.nguongVe0(dieuHanhHeThongService, ma))
                .chuKyPhut(chuKy)
                .nguongDayNgay(nguongNgay)
                .daLuu(daLuu)
                .daLuuTonKho(daLuuTonKho)
                .daLuuDonHang(daLuuDonHang)
                .build();
    }

    private boolean daCo(String maKenh, String ten) {
        return cauHinhHeThongRepository.existsById(KenhCauHinhDongBo.khoa(maKenh, ten));
    }

    @Transactional(rollbackFor = Exception.class)
    public KenhCauHinhDongBoDto luuCauHinh(String maKenh, KenhCauHinhDongBoRequest request) {
        String ma = kiemTraMaKenh(maKenh);
        if (request == null) {
            throw new CommonException("Thiếu nội dung cấu hình", HttpStatus.BAD_REQUEST, null);
        }
        if (timKenh(ma).isEmpty()) {
            throw new CommonException("Không tìm thấy kênh bán " + ma, HttpStatus.NOT_FOUND, null);
        }
        kiemTraKhoang(request.getTyLeDayTon(), 1, 100, "Tỷ lệ đẩy tồn phải từ 1 đến 100%");
        kiemTraKhoang(request.getTonDem(), 0, KenhCauHinhDongBo.GIOI_HAN_SO_LUONG, "Tồn đệm phải từ 0 đến 100.000");
        kiemTraKhoang(request.getNguongVe0(), 0, KenhCauHinhDongBo.GIOI_HAN_SO_LUONG, "Ngưỡng về 0 phải từ 0 đến 100.000");

        NguoiDung nguoiCapNhat = layNguoiDungHienTai();
        List<String> thayDoi = new ArrayList<>();
        if (request.getTuDongDayTon() != null) {
            ghi(ma, KenhCauHinhDongBo.TU_DONG_DAY_TON, String.valueOf(request.getTuDongDayTon()), KieuDuLieuCauHinh.BOOLEAN,
                    "Tự động đẩy tồn kho lên sàn", nguoiCapNhat, thayDoi);
        }
        if (request.getTuDongLayDon() != null) {
            ghi(ma, KenhCauHinhDongBo.TU_DONG_LAY_DON, String.valueOf(request.getTuDongLayDon()), KieuDuLieuCauHinh.BOOLEAN,
                    "Tự động lấy đơn từ sàn", nguoiCapNhat, thayDoi);
        }
        if (request.getTyLeDayTon() != null) {
            ghi(ma, KenhCauHinhDongBo.TY_LE_DAY_TON, String.valueOf(request.getTyLeDayTon()), KieuDuLieuCauHinh.INT,
                    "Tỷ lệ % tồn khả dụng đẩy lên sàn", nguoiCapNhat, thayDoi);
        }
        if (request.getTonDem() != null) {
            ghi(ma, KenhCauHinhDongBo.TON_DEM, String.valueOf(request.getTonDem()), KieuDuLieuCauHinh.INT,
                    "Tồn đệm trừ bớt trước khi đẩy lên sàn", nguoiCapNhat, thayDoi);
        }
        if (request.getNguongVe0() != null) {
            ghi(ma, KenhCauHinhDongBo.NGUONG_VE_0, String.valueOf(request.getNguongVe0()), KieuDuLieuCauHinh.INT,
                    "Tồn sau khi trừ không vượt ngưỡng này thì đẩy 0", nguoiCapNhat, thayDoi);
        }

        if (!thayDoi.isEmpty()) {
            ghiNhatKy(ma, nguoiCapNhat, "Lưu cấu hình đồng bộ: " + String.join(", ", thayDoi));
        }
        return layCauHinh(ma);
    }

    private void ghi(String maKenh, String ten, String giaTri, KieuDuLieuCauHinh kieu, String moTa,
                     NguoiDung nguoiCapNhat, List<String> thayDoi) {
        String khoa = KenhCauHinhDongBo.khoa(maKenh, ten);
        Optional<CauHinhHeThong> hienTai = cauHinhHeThongRepository.findById(khoa);
        if (hienTai.isPresent() && giaTri.equals(hienTai.get().getGiaTri())) {
            return;
        }
        CauHinhHeThong entity = hienTai.orElseGet(() -> CauHinhHeThong.builder()
                .maCauHinh(khoa)
                .kieuDuLieu(kieu)
                .moTa("Kênh " + maKenh + ": " + moTa)
                .build());
        entity.setGiaTri(giaTri);
        entity.setNgayCapNhat(LocalDateTime.now());
        if (nguoiCapNhat != null) {
            entity.setNguoiCapNhat(nguoiCapNhat);
        }
        cauHinhHeThongRepository.save(entity);
        thayDoi.add(ten + "=" + giaTri);
    }

    private static void kiemTraKhoang(Integer giaTri, int min, int max, String thongBao) {
        if (giaTri != null && (giaTri < min || giaTri > max)) {
            throw new CommonException(thongBao, HttpStatus.BAD_REQUEST, null);
        }
    }

    private static String kiemTraMaKenh(String maKenh) {
        if (maKenh == null || maKenh.isBlank() || maKenh.trim().length() > 50 || !maKenh.trim().matches("[A-Za-z0-9_-]+")) {
            throw new CommonException("Mã kênh không hợp lệ", HttpStatus.BAD_REQUEST, null);
        }
        return KenhCauHinhDongBo.chuanHoaMaKenh(maKenh);
    }

    private NguoiDung layNguoiDungHienTai() {
        try {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            if (auth != null && auth.getId() != null) {
                return nguoiDungRepository.findById(auth.getId()).orElse(null);
            }
        } catch (Exception e) {
            log.debug("Không xác định được người cập nhật cấu hình kênh: {}", e.getMessage());
        }
        return null;
    }

    private Optional<KenhBanHang> timKenh(String maKenh) {
        return kenhBanHangRepository.findByMaKenh(maKenh)
                .or(() -> kenhBanHangRepository.findByMaKenh(maKenh.toLowerCase()));
    }

    private void ghiNhatKy(String maKenh, NguoiDung nguoiThucHien, String chiTiet) {
        if (nguoiThucHien == null) {
            return;
        }
        try {
            Optional<KenhBanHang> kenh = timKenh(maKenh);
            if (kenh.isEmpty()) {
                return;
            }
            lichSuThayDoiService.create(LichSuThayDoi.builder()
                    .loaiThamChieu(ITable.kenh_ban_hang)
                    .idThamChieu(kenh.get().getId())
                    .hanhDong(IHanhDong.cap_nhat_kenh_ban)
                    .giaTriMoi(chiTiet)
                    .nguoiThucHien(nguoiThucHien)
                    .ngayThucHien(Instant.now())
                    .ghiChu("Cấu hình đồng bộ kênh bán")
                    .build());
        } catch (Exception e) {
            log.warn("Không thể ghi nhật ký cấu hình kênh {}: {}", maKenh, e.getMessage());
        }
    }
}
