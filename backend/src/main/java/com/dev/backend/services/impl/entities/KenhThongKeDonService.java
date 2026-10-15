package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.dto.response.customize.KenhThongKeDonDto;
import com.dev.backend.entities.KenhBanHang;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DonBanHangRepository;
import com.dev.backend.repository.KenhBanHangRepository;
import com.dev.backend.utils.KenhCauHinhDongBo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Số liệu đơn hàng theo kênh bán cho màn Tổng quan kênh: chỉ đọc, không ghi gì.
 */
@Service
public class KenhThongKeDonService {

    static final ZoneId MUI_GIO = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Khoảng xem dài nhất (ngày) để giới hạn số dòng phải đọc */
    static final int SO_NGAY_TOI_DA = 92;
    static final int SO_NGAY_MAC_DINH = 30;

    private final DonBanHangRepository donBanHangRepository;
    private final KenhBanHangRepository kenhBanHangRepository;
    private final Clock clock;

    @Autowired
    public KenhThongKeDonService(DonBanHangRepository donBanHangRepository, KenhBanHangRepository kenhBanHangRepository) {
        this(donBanHangRepository, kenhBanHangRepository, Clock.systemUTC());
    }

    KenhThongKeDonService(DonBanHangRepository donBanHangRepository, KenhBanHangRepository kenhBanHangRepository, Clock clock) {
        this.donBanHangRepository = donBanHangRepository;
        this.kenhBanHangRepository = kenhBanHangRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public KenhThongKeDonDto thongKe(String maKenh, String tuNgay, String denNgay) {
        if (maKenh == null || maKenh.isBlank() || maKenh.trim().length() > 50 || !maKenh.trim().matches("[A-Za-z0-9_-]+")) {
            throw new CommonException("Mã kênh không hợp lệ", HttpStatus.BAD_REQUEST, null);
        }
        String ma = KenhCauHinhDongBo.chuanHoaMaKenh(maKenh);
        KenhBanHang kenh = kenhBanHangRepository.findByMaKenh(ma)
                .or(() -> kenhBanHangRepository.findByMaKenh(ma.toLowerCase()))
                .orElseThrow(() -> new CommonException("Không tìm thấy kênh bán " + ma, HttpStatus.NOT_FOUND, null));

        LocalDate den = docNgay(denNgay, LocalDate.now(clock.withZone(MUI_GIO)));
        LocalDate tu = docNgay(tuNgay, den.minusDays(SO_NGAY_MAC_DINH - 1L));
        if (tu.isAfter(den)) {
            throw new CommonException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc", HttpStatus.BAD_REQUEST, null);
        }
        if (ChronoUnit.DAYS.between(tu, den) + 1 > SO_NGAY_TOI_DA) {
            throw new CommonException("Chỉ xem được tối đa " + SO_NGAY_TOI_DA + " ngày một lần", HttpStatus.BAD_REQUEST, null);
        }

        Instant batDau = tu.atStartOfDay(MUI_GIO).toInstant();
        Instant ketThuc = den.plusDays(1).atStartOfDay(MUI_GIO).toInstant();

        Map<LocalDate, long[]> dem = new TreeMap<>();
        Map<LocalDate, BigDecimal> tien = new TreeMap<>();
        for (LocalDate d = tu; !d.isAfter(den); d = d.plusDays(1)) {
            dem.put(d, new long[]{0, 0});
            tien.put(d, BigDecimal.ZERO);
        }

        long tongDon = 0;
        long donHuy = 0;
        BigDecimal doanhSo = BigDecimal.ZERO;
        for (Object[] dong : donBanHangRepository.layDonKenhTrongKhoang(kenh.getId(), batDau, ketThuc)) {
            Instant luc = (Instant) dong[0];
            if (luc == null) continue;
            LocalDate ngay = luc.atZone(MUI_GIO).toLocalDate();
            long[] c = dem.get(ngay);
            if (c == null) continue;
            boolean huy = dong[1] != null && ((Number) dong[1]).intValue() == ITrangThaiDonBanHang.DA_HUY;
            BigDecimal gt = dong[2] instanceof BigDecimal bd ? bd
                    : dong[2] instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : BigDecimal.ZERO;
            c[0]++;
            tongDon++;
            if (huy) {
                c[1]++;
                donHuy++;
            } else {
                tien.merge(ngay, gt, BigDecimal::add);
                doanhSo = doanhSo.add(gt);
            }
        }

        List<KenhThongKeDonDto.Ngay> theoNgay = new ArrayList<>();
        dem.forEach((ngay, c) -> theoNgay.add(KenhThongKeDonDto.Ngay.builder()
                .ngay(ngay.toString())
                .soDon(c[0])
                .soHuy(c[1])
                .doanhSo(tien.get(ngay))
                .build()));

        Map<Integer, Long> theoTrangThai = new LinkedHashMap<>();
        for (Object[] dong : donBanHangRepository.demDonKenhTheoTrangThai(kenh.getId())) {
            if (dong[0] == null) continue;
            theoTrangThai.merge(((Number) dong[0]).intValue(), ((Number) dong[1]).longValue(), Long::sum);
        }

        double tyLeHuy = tongDon == 0 ? 0
                : BigDecimal.valueOf(donHuy * 100L).divide(BigDecimal.valueOf(tongDon), 1, RoundingMode.HALF_UP).doubleValue();

        return KenhThongKeDonDto.builder()
                .maKenh(ma)
                .tu(tu.toString())
                .den(den.toString())
                .tongDon(tongDon)
                .doanhSo(doanhSo)
                .donHuy(donHuy)
                .tyLeHuy(tyLeHuy)
                .theoNgay(theoNgay)
                .theoTrangThai(theoTrangThai)
                .build();
    }

    private static LocalDate docNgay(String giaTri, LocalDate macDinh) {
        if (giaTri == null || giaTri.isBlank()) return macDinh;
        try {
            return LocalDate.parse(giaTri.trim());
        } catch (DateTimeParseException e) {
            throw new CommonException("Ngày không hợp lệ: " + giaTri + " (định dạng yyyy-MM-dd)", HttpStatus.BAD_REQUEST, null);
        }
    }
}
