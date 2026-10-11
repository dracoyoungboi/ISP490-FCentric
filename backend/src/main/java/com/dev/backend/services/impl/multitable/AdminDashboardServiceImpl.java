package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.AdminDashboardResponse;
import com.dev.backend.repository.*;
import com.dev.backend.services.multitable.AdminDashboardService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminDashboardServiceImpl implements AdminDashboardService {

    private static final Logger log = LoggerFactory.getLogger(AdminDashboardServiceImpl.class);

    private final NguoiDungRepository nguoiDungRepository;
    private final DonBanHangRepository donBanHangRepository;
    private final DonMuaHangRepository donMuaHangRepository;
    private final TonKhoTheoLoRepository tonKhoTheoLoRepository;
    private final SanPhamQuanAoRepository sanPhamQuanAoRepository;
    private final NhaCungCapRepository nhaCungCapRepository;
    private final PhieuNhapKhoRepository phieuNhapKhoRepository;
    private final PhieuXuatKhoRepository phieuXuatKhoRepository;
    private final TongQuanAdminRepository tongQuanAdminRepository;

    public AdminDashboardServiceImpl(
            NguoiDungRepository nguoiDungRepository,
            DonBanHangRepository donBanHangRepository,
            DonMuaHangRepository donMuaHangRepository,
            TonKhoTheoLoRepository tonKhoTheoLoRepository,
            SanPhamQuanAoRepository sanPhamRepository, SanPhamQuanAoRepository sanPhamQuanAoRepository,
            NhaCungCapRepository nhaCungCapRepository,
            PhieuNhapKhoRepository phieuNhapKhoRepository,
            PhieuXuatKhoRepository phieuXuatKhoRepository,
            TongQuanAdminRepository tongQuanAdminRepository
    ) {
        this.nguoiDungRepository = nguoiDungRepository;
        this.donBanHangRepository = donBanHangRepository;
        this.donMuaHangRepository = donMuaHangRepository;
        this.tonKhoTheoLoRepository = tonKhoTheoLoRepository;
        this.sanPhamQuanAoRepository = sanPhamQuanAoRepository;
        this.nhaCungCapRepository = nhaCungCapRepository;
        this.phieuNhapKhoRepository = phieuNhapKhoRepository;
        this.phieuXuatKhoRepository = phieuXuatKhoRepository;
        this.tongQuanAdminRepository = tongQuanAdminRepository;
    }

    @Override
    public AdminDashboardResponse getDashboard() {

        /* ================= REVENUE CHART ================= */

        Instant fromDate = LocalDate.now()
                .minusDays(6)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant();

        Map<String, Long> revenueMap =
                donBanHangRepository.revenueFromDate(fromDate)
                        .stream()
                        .collect(Collectors.toMap(
                                row -> row[0].toString(),
                                row -> ((Number) row[1]).longValue()
                        ));

        List<AdminDashboardResponse.RevenueChartItem> chart = new ArrayList<>();

        for (int i = 6; i >= 0; i--) {

            LocalDate date = LocalDate.now().minusDays(i);
            String key = date.toString();

            chart.add(
                    AdminDashboardResponse.RevenueChartItem.builder()
                            .date(key)
                            .value(revenueMap.getOrDefault(key, 0L))
                            .build()
            );
        }

        /* ================= BUILD RESPONSE ================= */

        return AdminDashboardResponse.builder()

                /* USER */

                .totalUsers(nguoiDungRepository.count())
                .newUsersToday(nguoiDungRepository.countNewUsersToday())
                .bannedUsers(nguoiDungRepository.countBannedUsers())

                /* SALES */

                .totalOrdersToday(demDonBanHomNay())
                .revenueToday(donBanHangRepository.sumRevenueToday())

                /* PURCHASE */

                .pendingPurchaseOrders(demYeuCauNhapChoDuyet())

                .purchaseToday(
                        donMuaHangRepository.countPurchaseToday().intValue()
                )

                /* WAREHOUSE */

                .lowStockCount(demMaHetHoacThieuHang())

                .pendingImports(
                        phieuNhapKhoRepository.countPendingImports().intValue()
                )

                .pendingExports(
                        phieuXuatKhoRepository.countPendingExports().intValue()
                )

                .importToday(
                        phieuNhapKhoRepository.countImportToday().intValue()
                )

                .exportToday(
                        phieuXuatKhoRepository.countExportToday().intValue()
                )

                /* SALES ORDER */

                .pendingSaleOrders(
                        donBanHangRepository.countPendingSaleOrders().intValue()
                )

                /* PRODUCT */

                .totalProducts(
                        sanPhamQuanAoRepository.count()
                )

                /* SUPPLIER */

                .totalSuppliers(
                        nhaCungCapRepository.count()
                )

                /* CHART */

                .revenueLast7Days(chart)

                .build();
    }

    /* ================= CÁCH ĐẾM ĐÃ SỬA (giữ tên trường cũ) =================
     * Nếu truy vấn mới lỗi (CSDL thiếu bảng/cột) thì quay về cách đếm cũ để màn của các vai trò khác không hỏng.
     */

    /** Đơn bán đặt hôm nay, trừ đơn nháp và đơn đã hủy (cách cũ đếm cả đơn hủy). */
    private Long demDonBanHomNay() {
        try {
            return tongQuanAdminRepository.demDonMoiTrongNgay(
                    tongQuanAdminRepository.thoiDiemHienTai().toLocalDate());
        } catch (RuntimeException e) {
            log.warn("Không đếm được đơn bán hôm nay theo cách mới, dùng cách cũ", e);
            return donBanHangRepository.countOrdersToday();
        }
    }

    /** Yêu cầu nhập hàng đang chờ duyệt (cách cũ đếm đơn mua trạng thái 0 = đã xoá). */
    private Integer demYeuCauNhapChoDuyet() {
        try {
            return (int) tongQuanAdminRepository.demYeuCauNhapChoDuyet();
        } catch (RuntimeException e) {
            log.warn("Không đếm được yêu cầu nhập chờ duyệt theo cách mới, dùng cách cũ", e);
            return donMuaHangRepository.countPendingPurchaseOrders().intValue();
        }
    }

    /**
     * Số cặp (kho, mã hàng) đang Hết hàng hoặc Thiếu hàng theo tồn khả dụng
     * (cách cũ đếm từng dòng lô, kể cả lô đã xuất hết).
     */
    private Integer demMaHetHoacThieuHang() {
        try {
            Integer nguong = tongQuanAdminRepository.cauHinhSo("DEFAULT_MIN_STOCK_ALERT");
            int nguongDung = nguong != null && nguong > 0 ? nguong : TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH;
            TongQuanAdminRepository.TonKhoTongHopDong t = tongQuanAdminRepository.tonKhoTongHop(
                    null, nguongDung, TongQuanAdminServiceImpl.HE_SO_DU_MAC_DINH);
            return (int) (t.hetHang() + t.thieuHang());
        } catch (RuntimeException e) {
            log.warn("Không đếm được mã hết/thiếu hàng theo cách mới, dùng cách cũ", e);
            return tonKhoTheoLoRepository.countLowStockWarnings().intValue();
        }
    }
}