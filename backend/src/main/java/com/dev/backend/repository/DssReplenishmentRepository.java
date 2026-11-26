package com.dev.backend.repository;

import com.dev.backend.services.impl.dss.DssPolicyEngine.SkuRawInput;
import com.dev.backend.utils.PublicAssetUrl;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Truy vấn dữ liệu gốc phục vụ bộ máy DSS bổ sung hàng (FE-04.4) và đồng bộ cảnh báo {@code canh_bao}.
 * Dùng NamedParameterJdbcTemplate chạy 6 câu SQL thuần đọc tổng hợp ~23 bảng (7 bảng lõi: ton_kho_theo_lo,
 * lo_hang, kho, don_ban_hang, chi_tiet_don_ban_hang, don_mua_hang, phieu_nhap_kho) và batchUpdate bảng canh_bao.
 */
@Repository
public class DssReplenishmentRepository {

    public static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final NamedParameterJdbcTemplate jdbc;
    private final TongQuanAdminRepository adminRepo;
    private final TongQuanVaiTroRepository vaiTroRepo;

    public DssReplenishmentRepository(
            NamedParameterJdbcTemplate jdbc,
            TongQuanAdminRepository adminRepo,
            TongQuanVaiTroRepository vaiTroRepo) {
        this.jdbc = jdbc;
        this.adminRepo = adminRepo;
        this.vaiTroRepo = vaiTroRepo;
    }

    public record KhoInfo(Integer id, String maKho, String tenKho, boolean laKhoTong) {}

    private record VariantStockRow(
            Integer sanPhamId,
            Integer bienTheId,
            String maSanPham,
            String maSku,
            String tenSanPham,
            String tenMau,
            String maMauHex,
            String tenSize,
            String tenChatLieu,
            String tenDanhMuc,
            String anh,
            long onHand,
            long outgoing,
            long ftu,
            boolean daTungNhap,
            BigDecimal donGiaNhapGanNhat
    ) {}

    public KhoInfo resolveWarehouse(Integer requestedKhoId) {
        List<KhoInfo> list = jdbc.query("""
                        SELECT k.id, k.ma_kho, k.ten_kho,
                               CASE WHEN k.loai_kho = 'kho_tong' THEN 1 ELSE 0 END AS la_kho_tong
                        FROM kho k
                        WHERE k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                          AND (:khoId IS NULL OR k.id = :khoId)
                        ORDER BY la_kho_tong DESC, k.id
                        LIMIT 1
                        """,
                new MapSqlParameterSource().addValue("khoId", requestedKhoId, Types.INTEGER),
                (rs, i) -> new KhoInfo(
                        rs.getInt("id"),
                        rs.getString("ma_kho"),
                        rs.getString("ten_kho"),
                        rs.getInt("la_kho_tong") == 1));
        if (!list.isEmpty()) {
            return list.get(0);
        }
        return null;
    }

    public List<KhoInfo> listActiveWarehouses() {
        return jdbc.query("""
                SELECT k.id, k.ma_kho, k.ten_kho,
                       CASE WHEN k.loai_kho = 'kho_tong' THEN 1 ELSE 0 END AS la_kho_tong
                FROM kho k
                WHERE k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                ORDER BY la_kho_tong DESC, k.id
                """, (rs, i) -> new KhoInfo(
                rs.getInt("id"),
                rs.getString("ma_kho"),
                rs.getString("ten_kho"),
                rs.getInt("la_kho_tong") == 1));
    }

    /**
     * Nạp dữ liệu gốc (tồn kho, hàng đang về, sức bán, Lead Time, yêu cầu nhập đang mở)
     * tổng hợp trên toàn bộ các kho đang hoạt động ({@code trang_thai = 1} và loại trừ {@code KHO_TRANSIT}).
     */
    public List<SkuRawInput> loadRawInputsAllWarehouses(int observationDaysN, int leadTimeSampleM, LocalDate todayVn) {
        // Cụm SQL 1: Lấy toàn bộ biến thể đang bán kèm tồn tổng hợp (onHand, outgoing, ftu) trên mọi kho active
        List<VariantStockRow> variants = loadVariantsWithStockAllWarehouses();
        if (variants.isEmpty()) {
            return List.of();
        }

        List<Integer> bienTheIds = variants.stream().map(VariantStockRow::bienTheId).toList();
        // Cụm SQL 2: Tổng hợp hàng đang về từ đơn mua hàng (don_mua_hang trang_thai 3, 5)
        Map<Integer, Long> incomingMap = loadIncomingAllWarehouses();
        // Cụm SQL 3: Lấy số yêu cầu mua hàng đang mở (yeu_cau_mua_hang) để tránh tạo PR trùng
        Map<Integer, TongQuanVaiTroRepository.YeuCauMo> openPrMap = vaiTroRepo.yeuCauMoTheoBienThe(bienTheIds);
        // Cụm SQL 4: Đo Lead Time giao hàng thực tế (ngay_nhap - ngay_dat_hang) qua M phiếu nhập gần nhất
        Map<Integer, List<Double>> leadTimeMap = loadLeadTimeSamples(leadTimeSampleM);

        int n = Math.max(1, observationDaysN);
        LocalDate startN = todayVn.minusDays(n - 1L);
        LocalDate start30 = todayVn.minusDays(29L);
        LocalDate earliestDate = startN.isBefore(start30) ? startN : start30;
        Instant sinceUtc = earliestDate.atStartOfDay(VN_ZONE).toInstant();

        Map<Integer, double[]> dailySeriesMap = new HashMap<>();
        Map<Integer, Long> revenueNMap = new HashMap<>();
        Map<Integer, Long> sold30Map = new HashMap<>();
        Map<Integer, Map<String, Long>> channelMap = new HashMap<>();

        // Kiểm tra tồn tại bảng pos_checkout_request chỉ để gắn nhãn kênh bán là POS hay kênh Online
        boolean hasPosTable = adminRepo.coBang("pos_checkout_request");
        String posJoin = hasPosTable
                ? "LEFT JOIN pos_checkout_request pos ON pos.don_ban_hang_id = d.id"
                : "";
        String posSelect = hasPosTable
                ? "CASE WHEN pos.id IS NOT NULL THEN 1 ELSE 0 END AS la_pos"
                : "0 AS la_pos";

        // Cụm SQL 5: Quét lịch sử bán trong max(N, 30) ngày, bỏ đơn Nháp (0) & Hủy (4), tính chuỗi bán từng ngày + doanh thu
        String sqlSales = """
                SELECT ct.bien_the_san_pham_id AS bien_the_id,
                       d.ngay_dat_hang,
                       kb.ma_kenh,
                       %s,
                       ct.so_luong_dat,
                       COALESCE(ct.thanh_tien, ct.so_luong_dat * ct.don_gia) - COALESCE(ct.tien_giam_gia, 0) AS doanh_thu
                FROM chi_tiet_don_ban_hang ct
                JOIN don_ban_hang d ON d.id = ct.don_ban_hang_id
                JOIN kho kx ON kx.id = d.kho_xuat_id AND kx.trang_thai = 1 AND kx.ma_kho <> 'KHO_TRANSIT'
                LEFT JOIN kenh_ban_hang kb ON kb.id = d.kenh_ban_id
                %s
                WHERE d.loai_chung_tu = 'don_ban_hang'
                  AND d.trang_thai NOT IN (0, 4)
                  AND d.ngay_dat_hang >= :sinceUtc
                """.formatted(posSelect, posJoin);

        MapSqlParameterSource salesParams = new MapSqlParameterSource("sinceUtc", Timestamp.from(sinceUtc));

        jdbc.query(sqlSales,
                salesParams,
                rs -> {
                    int bienTheId = rs.getInt("bien_the_id");
                    Timestamp ts = rs.getTimestamp("ngay_dat_hang");
                    if (ts == null) return;
                    LocalDate orderDate = ts.toInstant().atZone(VN_ZONE).toLocalDate();
                    if (orderDate.isAfter(todayVn)) {
                        orderDate = todayVn;
                    }
                    double qty = rs.getBigDecimal("so_luong_dat") != null
                            ? Math.max(0.0d, rs.getBigDecimal("so_luong_dat").doubleValue())
                            : 0.0d;
                    long rev = rs.getBigDecimal("doanh_thu") != null
                            ? Math.max(0L, rs.getBigDecimal("doanh_thu").setScale(0, RoundingMode.HALF_UP).longValue())
                            : 0L;

                    if (!orderDate.isBefore(start30)) {
                        sold30Map.merge(bienTheId, Math.round(qty), Long::sum);
                    }
                    if (!orderDate.isBefore(startN)) {
                        int idx = (int) ChronoUnit.DAYS.between(startN, orderDate);
                        if (idx >= 0 && idx < n) {
                            dailySeriesMap.computeIfAbsent(bienTheId, k -> new double[n])[idx] += qty;
                        }
                        revenueNMap.merge(bienTheId, rev, Long::sum);

                        String channelKey = normalizeChannel(
                                rs.getInt("la_pos") == 1,
                                rs.getString("ma_kenh"));
                        channelMap.computeIfAbsent(bienTheId, k -> new LinkedHashMap<>())
                                .merge(channelKey, Math.round(qty), Long::sum);
                    }
                });

        List<SkuRawInput> results = new ArrayList<>(variants.size());
        for (VariantStockRow v : variants) {
            TongQuanVaiTroRepository.YeuCauMo pr = openPrMap.get(v.bienTheId());
            results.add(new SkuRawInput(
                    v.sanPhamId(),
                    v.bienTheId(),
                    v.maSanPham(),
                    v.maSku(),
                    v.tenSanPham(),
                    v.tenMau(),
                    v.maMauHex(),
                    v.tenSize(),
                    v.tenChatLieu(),
                    v.tenDanhMuc(),
                    v.anh(),
                    v.onHand(),
                    v.outgoing(),
                    incomingMap.getOrDefault(v.bienTheId(), 0L),
                    v.ftu(),
                    v.daTungNhap(),
                    dailySeriesMap.getOrDefault(v.bienTheId(), new double[n]),
                    revenueNMap.getOrDefault(v.bienTheId(), 0L),
                    sold30Map.getOrDefault(v.bienTheId(), 0L),
                    channelMap.getOrDefault(v.bienTheId(), Map.of()),
                    leadTimeMap.getOrDefault(v.bienTheId(), List.of()),
                    pr != null ? pr.ma() : null,
                    pr != null ? (int) pr.soYeuCau() : null,
                    v.donGiaNhapGanNhat()
            ));
        }
        return results;
    }

    /**
     * Giữ overload cũ để tương thích ngược; toàn bộ phép tính luôn tổng hợp trên tất cả kho đang hoạt động.
     *
     * @deprecated Dùng {@link #loadRawInputsAllWarehouses(int, int, LocalDate)}.
     */
    @Deprecated
    public List<SkuRawInput> loadRawInputs(Integer khoId, int observationDaysN, int leadTimeSampleM, LocalDate todayVn) {
        return loadRawInputsAllWarehouses(observationDaysN, leadTimeSampleM, todayVn);
    }

    /**
     * Đồng bộ ngưỡng đặt hàng lại (ROP) và trạng thái cảnh báo vào {@code canh_bao}
     * ({@code loai_canh_bao = 'ton_kho_thap'}). {@code khoId} truyền vào là Kho tổng neo cảnh báo toàn hệ thống.
     * @return số bản ghi đang ở trạng thái cảnh báo ({@code trang_thai = 0}) sau khi cập nhật
     */
    public int syncLowStockAlerts(Integer khoId, List<com.dev.backend.dto.dss.DssRecommendationItemDto> items) {
        if (khoId == null || items == null || items.isEmpty() || !adminRepo.coBang("canh_bao")) {
            return 0;
        }

        // Nạp id mới nhất của mỗi biến thể tại kho trong canh_bao
        Map<Integer, Integer> existingByVariant = new HashMap<>();
        List<Integer> duplicateIdsToResolve = new ArrayList<>();
        jdbc.query("""
                        SELECT id, bien_the_san_pham_id
                        FROM canh_bao
                        WHERE loai_canh_bao = 'ton_kho_thap'
                          AND kho_id = :khoId
                          AND lo_hang_id IS NULL
                        ORDER BY id DESC
                        """,
                new MapSqlParameterSource("khoId", khoId),
                rs -> {
                    int id = rs.getInt("id");
                    int btId = rs.getInt("bien_the_san_pham_id");
                    if (existingByVariant.containsKey(btId)) {
                        duplicateIdsToResolve.add(id);
                    } else {
                        existingByVariant.put(btId, id);
                    }
                });

        Timestamp nowTs = Timestamp.from(Instant.now());
        List<MapSqlParameterSource> updates = new ArrayList<>();
        List<MapSqlParameterSource> inserts = new ArrayList<>();
        int activeAlertCount = 0;

        // Phân loại từng SKU thành UPDATE (đã có dòng canh_bao) hoặc INSERT (chưa từng có), gán trang_thai=0 nếu FTU <= ROP
        for (var item : items) {
            boolean shouldAlert = !item.isPrCreationLocked()
                    && item.getReorderPoint() > 0
                    && item.getFtu() <= item.getReorderPoint();
            if (shouldAlert) {
                activeAlertCount++;
            }

            Integer existingId = existingByVariant.get(item.getBienTheSanPhamId());
            if (existingId != null) {
                updates.add(new MapSqlParameterSource()
                        .addValue("id", existingId)
                        .addValue("soLuong", BigDecimal.valueOf(item.getFtu()))
                        .addValue("nguong", BigDecimal.valueOf(item.getReorderPoint()))
                        .addValue("ngayCanhBao", nowTs)
                        .addValue("trangThai", shouldAlert ? 0 : 1)
                        .addValue("ngayXuLy", shouldAlert ? null : nowTs, Types.TIMESTAMP));
            } else if (shouldAlert || item.isDaTungNhap() || item.getFtu() > 0) {
                inserts.add(new MapSqlParameterSource()
                        .addValue("bienTheId", item.getBienTheSanPhamId())
                        .addValue("khoId", khoId)
                        .addValue("soLuong", BigDecimal.valueOf(item.getFtu()))
                        .addValue("nguong", BigDecimal.valueOf(item.getReorderPoint()))
                        .addValue("ngayCanhBao", nowTs)
                        .addValue("trangThai", shouldAlert ? 0 : 1)
                        .addValue("ngayXuLy", shouldAlert ? null : nowTs, Types.TIMESTAMP));
            }
        }

        // Dọn các bản ghi trùng thừa (giữ lại đúng id mới nhất ở trên) rồi batchUpdate/batchInsert theo lô
        if (!duplicateIdsToResolve.isEmpty()) {
            jdbc.update("""
                            UPDATE canh_bao
                            SET trang_thai = 1, ngay_xu_ly = :nowTs
                            WHERE id IN (:ids)
                            """,
                    new MapSqlParameterSource("ids", duplicateIdsToResolve).addValue("nowTs", nowTs));
        }

        if (!updates.isEmpty()) {
            jdbc.batchUpdate("""
                            UPDATE canh_bao
                            SET so_luong_hien_tai = :soLuong,
                                nguong_canh_bao = :nguong,
                                ngay_canh_bao = :ngayCanhBao,
                                trang_thai = :trangThai,
                                ngay_xu_ly = :ngayXuLy
                            WHERE id = :id
                            """,
                    updates.toArray(new MapSqlParameterSource[0]));
        }

        if (!inserts.isEmpty()) {
            jdbc.batchUpdate("""
                            INSERT INTO canh_bao (
                                loai_canh_bao, bien_the_san_pham_id, kho_id, lo_hang_id,
                                so_luong_hien_tai, nguong_canh_bao, ngay_canh_bao, trang_thai, ngay_xu_ly
                            ) VALUES (
                                'ton_kho_thap', :bienTheId, :khoId, NULL,
                                :soLuong, :nguong, :ngayCanhBao, :trangThai, :ngayXuLy
                            )
                            """,
                    inserts.toArray(new MapSqlParameterSource[0]));
        }

        return activeAlertCount;
    }

    private List<VariantStockRow> loadVariantsWithStockAllWarehouses() {
        return jdbc.query("""
                        SELECT sp.id AS san_pham_id, bt.id AS bien_the_id, sp.ma_san_pham, bt.ma_sku,
                               sp.ten_san_pham, ms.ten_mau, ms.ma_mau_hex, sz.ten_size, cl.ten_chat_lieu,
                               dm.ten_danh_muc,
                               COALESCE(
                                   (SELECT tt.duong_dan FROM anh_bien_the a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                                     WHERE a.bien_the_id = bt.id AND a.trang_thai = 1 ORDER BY a.id LIMIT 1),
                                   (SELECT tt.duong_dan FROM anh_quan_ao a JOIN tep_tin tt ON tt.id = a.tep_tin_id
                                     WHERE a.quan_ao_id = sp.id AND COALESCE(a.trang_thai, 1) = 1
                                     ORDER BY COALESCE(a.anh_chinh, 0) = 1 DESC, a.id LIMIT 1)
                               ) AS anh,
                               COALESCE(t.on_hand, 0) AS on_hand,
                               COALESCE(t.outgoing, 0) AS outgoing,
                               COALESCE(t.ftu, 0) AS ftu,
                               CASE WHEN t.bien_the_id IS NULL THEN 0 ELSE 1 END AS da_tung_nhap,
                               COALESCE(
                                   (SELECT lh.gia_von FROM lo_hang lh
                                     WHERE lh.bien_the_san_pham_id = bt.id
                                     ORDER BY lh.ngay_tao DESC, lh.id DESC LIMIT 1),
                                   bt.gia_von,
                                   sp.gia_von_mac_dinh
                               ) AS don_gia_nhap
                        FROM bien_the_san_pham bt
                        JOIN san_pham_quan_ao sp      ON sp.id = bt.san_pham_id
                        LEFT JOIN danh_muc_quan_ao dm ON dm.id = sp.danh_muc_id
                        LEFT JOIN mau_sac ms          ON ms.id = bt.mau_sac_id
                        LEFT JOIN size sz             ON sz.id = bt.size_id
                        LEFT JOIN chat_lieu cl        ON cl.id = bt.chat_lieu_id
                        LEFT JOIN (
                            SELECT lh.bien_the_san_pham_id AS bien_the_id,
                                   SUM(tk.so_luong_ton) AS on_hand,
                                   SUM(COALESCE(tk.so_luong_da_dat, 0)) AS outgoing,
                                   SUM(tk.so_luong_kha_dung) AS ftu
                            FROM ton_kho_theo_lo tk
                            JOIN lo_hang lh ON lh.id = tk.lo_hang_id
                            JOIN kho k      ON k.id = tk.kho_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                            GROUP BY lh.bien_the_san_pham_id
                        ) t ON t.bien_the_id = bt.id
                        WHERE bt.trang_thai = 1 AND sp.trang_thai IN (0, 1)
                        ORDER BY sp.ten_san_pham, bt.id
                        """,
                (rs, i) -> new VariantStockRow(
                        rs.getInt("san_pham_id"),
                        rs.getInt("bien_the_id"),
                        rs.getString("ma_san_pham"),
                        rs.getString("ma_sku"),
                        rs.getString("ten_san_pham"),
                        rs.getString("ten_mau"),
                        rs.getString("ma_mau_hex"),
                        rs.getString("ten_size"),
                        rs.getString("ten_chat_lieu"),
                        rs.getString("ten_danh_muc"),
                        PublicAssetUrl.toHttps(rs.getString("anh")),
                        roundLong(rs.getBigDecimal("on_hand")),
                        roundLong(rs.getBigDecimal("outgoing")),
                        roundLong(rs.getBigDecimal("ftu")),
                        rs.getInt("da_tung_nhap") == 1,
                        rs.getBigDecimal("don_gia_nhap")));
    }

    private Map<Integer, Long> loadIncomingAllWarehouses() {
        Map<Integer, Long> map = new HashMap<>();
        jdbc.query("""
                        SELECT ct.bien_the_san_pham_id,
                               COALESCE(SUM(ct.so_luong_dat - COALESCE(ct.so_luong_da_nhan, 0)), 0) AS dang_ve
                        FROM chi_tiet_don_mua_hang ct
                        JOIN don_mua_hang dm ON dm.id = ct.don_mua_hang_id
                        JOIN kho k           ON k.id = dm.kho_nhap_id AND k.trang_thai = 1 AND k.ma_kho <> 'KHO_TRANSIT'
                        WHERE dm.trang_thai IN (3, 5)
                          AND ct.so_luong_dat > COALESCE(ct.so_luong_da_nhan, 0)
                        GROUP BY ct.bien_the_san_pham_id
                        """,
                rs -> {
                    map.put(rs.getInt("bien_the_san_pham_id"), roundLong(rs.getBigDecimal("dang_ve")));
                });
        return map;
    }

    private Map<Integer, List<Double>> loadLeadTimeSamples(int sampleM) {
        int m = Math.max(1, sampleM);
        Map<Integer, List<Double>> samplesByVariant = new HashMap<>();
        jdbc.query("""
                        SELECT ct.bien_the_san_pham_id AS bien_the_id,
                               dm.ngay_dat_hang,
                               p.ngay_nhap
                        FROM phieu_nhap_kho p
                        JOIN don_mua_hang dm ON dm.id = p.don_mua_hang_id
                        JOIN chi_tiet_phieu_nhap_kho ct ON ct.phieu_nhap_kho_id = p.id
                        WHERE p.trang_thai = 3
                          AND p.don_mua_hang_id IS NOT NULL
                          AND p.ngay_nhap IS NOT NULL
                          AND dm.ngay_dat_hang IS NOT NULL
                        ORDER BY p.ngay_nhap DESC, p.id DESC
                        """,
                rs -> {
                    int btId = rs.getInt("bien_the_id");
                    List<Double> list = samplesByVariant.computeIfAbsent(btId, k -> new ArrayList<>());
                    if (list.size() >= m) {
                        return;
                    }
                    Timestamp ordered = rs.getTimestamp("ngay_dat_hang");
                    Timestamp received = rs.getTimestamp("ngay_nhap");
                    if (ordered != null && received != null) {
                        double hours = Duration.between(ordered.toInstant(), received.toInstant()).toHours();
                        double days = Math.max(1.0d, hours / 24.0d);
                        list.add(Math.round(days * 100.0d) / 100.0d);
                    }
                });
        return samplesByVariant;
    }

    private static String normalizeChannel(boolean isPos, String maKenh) {
        if (isPos) {
            return "POS";
        }
        if (maKenh == null || maKenh.isBlank()) {
            return "TRUC_TIEP";
        }
        String norm = maKenh.trim().toUpperCase(Locale.ROOT);
        if (norm.contains("SHOPEE")) return "SHOPEE";
        if (norm.contains("TIKTOK")) return "TIKTOK";
        if (norm.contains("SHOPIFY")) return "SHOPIFY";
        if (norm.contains("LAZADA")) return "LAZADA";
        return norm;
    }

    private static long roundLong(BigDecimal val) {
        if (val == null) return 0L;
        return val.setScale(0, RoundingMode.HALF_UP).longValue();
    }
}
