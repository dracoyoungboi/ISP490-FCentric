package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.PosCatalogBienTheDto;
import com.dev.backend.dto.PosCatalogNhomDto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Gộp các SKU của danh mục POS thành nhóm "mẫu + màu + chất liệu" và phân trang THEO NHÓM.
 * Thuần Java (không phụ thuộc Spring/JPA) để kiểm thử độc lập.
 *
 * Quy tắc:
 * - Nhóm hiện ra khi CÓ ÍT NHẤT MỘT biến thể khớp từ khóa (danh sách "khop", đúng thứ tự SQL);
 *   một nhóm luôn hiện ĐỦ các kích cỡ của nó (lấy từ danh sách "dayDu"), kể cả khi người bán
 *   tìm theo mã SKU của một kích cỡ.
 * - Bộ lọc tồn theo nhóm: con_hang = còn ít nhất một kích cỡ có tồn khả dụng &gt; 0 (kích cỡ đã hết
 *   vẫn hiện để báo khách); het_hang = mọi kích cỡ đều &lt;= 0; tat_ca = không lọc.
 * - Thứ tự nhóm = thứ tự xuất hiện đầu tiên trong "khop" (SQL đã sắp theo tên mẫu, màu, chất liệu).
 *   Biến thể trong nhóm xếp theo thứ tự kích cỡ (null xuống cuối), rồi theo id.
 */
public final class PosCatalogNhomBuilder {

    public static final String TON_CON_HANG = "con_hang";
    public static final String TON_HET_HANG = "het_hang";

    private static final Comparator<PosCatalogBienTheDto> THU_TU_KICH_CO = Comparator
            .comparing(PosCatalogBienTheDto::getThuTuSize, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(PosCatalogBienTheDto::getBienTheSanPhamId, Comparator.nullsLast(Comparator.naturalOrder()));

    private PosCatalogNhomBuilder() {
    }

    /** Một trang nhóm + tổng số nhóm thỏa điều kiện (để tính số trang). */
    public record KetQua(List<PosCatalogNhomDto> trang, int tongSoNhom) {
    }

    public static String khoaNhom(PosCatalogBienTheDto bienThe) {
        return bienThe.getSanPhamId() + "-" + bienThe.getMauSacId() + "-" + bienThe.getChatLieuId();
    }

    /**
     * @param khop     các SKU khớp từ khóa (thứ tự SQL) — quyết định nhóm nào hiện và thứ tự nhóm
     * @param dayDu    mọi SKU của các sản phẩm có trong "khop" (có thể chính là "khop" khi không tìm kiếm)
     * @param boLocTon con_hang | het_hang | tat_ca (đã chuẩn hóa)
     * @param page     trang (từ 0) tính theo NHÓM
     * @param size     số nhóm mỗi trang (&gt;= 1)
     */
    public static KetQua xayDung(List<PosCatalogBienTheDto> khop, List<PosCatalogBienTheDto> dayDu,
                                 String boLocTon, int page, int size) {
        Map<String, List<PosCatalogBienTheDto>> theoKhoa = gomTheoKhoa(dayDu);
        Map<String, List<PosCatalogBienTheDto>> khopTheoKhoa = gomTheoKhoa(khop);

        Set<String> khoaKhop = new LinkedHashSet<>(khopTheoKhoa.keySet());
        List<PosCatalogNhomDto> nhoms = new ArrayList<>();
        for (String khoa : khoaKhop) {
            // Danh sách đầy đủ thiếu nhóm này (dữ liệu vừa đổi giữa hai truy vấn): dùng phần đã khớp.
            List<PosCatalogBienTheDto> bienThes = theoKhoa.getOrDefault(khoa, khopTheoKhoa.get(khoa));
            if (bienThes == null || bienThes.isEmpty() || !thoaBoLoc(bienThes, boLocTon)) {
                continue;
            }
            nhoms.add(taoNhom(khoa, bienThes));
        }

        int safeSize = Math.max(size, 1);
        int safePage = Math.max(page, 0);
        int from = (int) Math.min((long) safePage * safeSize, nhoms.size());
        int to = Math.min(from + safeSize, nhoms.size());
        return new KetQua(new ArrayList<>(nhoms.subList(from, to)), nhoms.size());
    }

    /** Gom theo khóa nhóm, giữ thứ tự xuất hiện và bỏ SKU trùng id. */
    private static Map<String, List<PosCatalogBienTheDto>> gomTheoKhoa(List<PosCatalogBienTheDto> ds) {
        Map<String, List<PosCatalogBienTheDto>> theoKhoa = new LinkedHashMap<>();
        Set<Integer> daCo = new LinkedHashSet<>();
        if (ds == null) {
            return theoKhoa;
        }
        for (PosCatalogBienTheDto bienThe : ds) {
            if (bienThe == null || !daCo.add(bienThe.getBienTheSanPhamId())) {
                continue;
            }
            theoKhoa.computeIfAbsent(khoaNhom(bienThe), k -> new ArrayList<>()).add(bienThe);
        }
        return theoKhoa;
    }

    static boolean thoaBoLoc(List<PosCatalogBienTheDto> bienThes, String boLocTon) {
        if (TON_CON_HANG.equals(boLocTon)) {
            return bienThes.stream().anyMatch(b -> ton(b).signum() > 0);
        }
        if (TON_HET_HANG.equals(boLocTon)) {
            return bienThes.stream().allMatch(b -> ton(b).signum() <= 0);
        }
        return true;
    }

    private static BigDecimal ton(PosCatalogBienTheDto bienThe) {
        return bienThe.getSoLuongKhaDung() == null ? BigDecimal.ZERO : bienThe.getSoLuongKhaDung();
    }

    private static PosCatalogNhomDto taoNhom(String khoa, List<PosCatalogBienTheDto> bienThes) {
        List<PosCatalogBienTheDto> sapXep = new ArrayList<>(bienThes);
        sapXep.sort(THU_TU_KICH_CO);
        PosCatalogBienTheDto dau = sapXep.get(0);

        PosCatalogNhomDto nhom = new PosCatalogNhomDto();
        nhom.setKhoaNhom(khoa);
        nhom.setSanPhamId(dau.getSanPhamId());
        nhom.setTenSanPham(dau.getTenSanPham());
        nhom.setMauSacId(dau.getMauSacId());
        nhom.setTenMau(dau.getTenMau());
        nhom.setMaMauHex(dau.getMaMauHex());
        nhom.setChatLieuId(dau.getChatLieuId());
        nhom.setTenChatLieu(dau.getTenChatLieu());
        nhom.setDanhMucId(dau.getDanhMucId());
        nhom.setTenDanhMuc(dau.getTenDanhMuc());

        List<BigDecimal> gias = sapXep.stream().map(PosCatalogBienTheDto::getGiaBan).filter(Objects::nonNull).toList();
        nhom.setGiaThapNhat(gias.stream().min(Comparator.naturalOrder()).orElse(BigDecimal.ZERO));
        nhom.setGiaCaoNhat(gias.stream().max(Comparator.naturalOrder()).orElse(BigDecimal.ZERO));
        nhom.setTongTonKhaDung(sapXep.stream()
                .map(PosCatalogNhomBuilder::ton)
                .filter(t -> t.signum() > 0)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        nhom.setBienThes(sapXep);
        return nhom;
    }
}
