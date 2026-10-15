package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.DoanhThuChartDTO;
import com.dev.backend.repository.DoanhThuReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DoanhThuReportService {

    private final DoanhThuReportRepository repo;

    public List<DoanhThuChartDTO> layBaoCaoTheoNgay(LocalDate tuNgay, LocalDate denNgay, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoNgay(tuNgay, denNgay, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoTuan(Integer nam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoTuan(nam, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoThang(Integer nam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoThang(nam, khoId));
    }

    public List<DoanhThuChartDTO> layBaoCaoTheoNam(Integer tuNam, Integer denNam, Integer khoId) {
        return tinhTyLe(repo.baoCaoTheoNam(tuNam, denNam, khoId));
    }

    public List<DoanhThuChartDTO> laySoSanhCungKy(Integer nam, Integer thang, Integer khoId) {
        // Tính tháng trước
        LocalDate thangHienTai = LocalDate.of(nam, thang, 1);
        LocalDate thangTruoc   = thangHienTai.minusMonths(1);
        return tinhTyLe(repo.soSanhCungKy(
                nam, thang,
                thangTruoc.getYear(), thangTruoc.getMonthValue(),
                khoId
        ));
    }

    /** Tính % lợi nhuận sau khi nhận data từ DB */
    private List<DoanhThuChartDTO> tinhTyLe(List<DoanhThuChartDTO> list) {
        list.forEach(row -> {
            if (row.getDoanhThu() != null && row.getDoanhThu().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal tyLe = row.getLoiNhuan()
                        .divide(row.getDoanhThu(), 4, RoundingMode.HALF_UP)
                        .multiply(BigDecimal.valueOf(100))
                        .setScale(2, RoundingMode.HALF_UP);
                row.setTyLeLaiGop(tyLe);
            } else {
                row.setTyLeLaiGop(BigDecimal.ZERO);
            }
        });
        return list;
    }
}