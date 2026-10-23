package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.PosCatalogBienTheDto;
import com.dev.backend.dto.PosCatalogNhomDto;
import com.dev.backend.dto.response.customize.PosCatalogItemDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.AnhBienThe;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.PhanQuyenNguoiDungKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.PhanQuyenNguoiDungKhoRepository;
import com.dev.backend.utils.PublicAssetUrl;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Catalog POS (chỉ đọc). Mỗi phần tử là một SKU đang bán được của KHO ĐƯỢC ỦY QUYỀN:
 * - Kho được kiểm tra server-side bằng đúng pattern PhieuXuatKhoService.kiemTraQuyenKho
 *   (admin bỏ qua; người khác phải có phân quyền kho active + chưa hết hạn).
 * - Tồn khả dụng = SUM(ton - dat) theo lô của ĐÚNG kho truy vấn (trong JPQL), không phải
 *   tồn toàn hệ thống; không có lô nào -> 0 (dữ liệu đã biết, không bịa).
 * - Ảnh: anh_bien_the -> fallback anh_quan_ao (anhChinh=1 ưu tiên) -> null; URL qua
 *   PublicAssetUrl.toHttps (convention chống Mixed Content của dự án).
 * - Không N+1: 1 query trang (LEFT JOIN + GROUP BY) + 2 query batch ảnh.
 * - Bộ lọc tồn kho (tùy chọn): trangThaiTon = con_hang | het_hang | tat_ca.
 *   Không truyền = tat_ca -> giữ nguyên hành vi cũ.
 */
@Service
public class PosCatalogService {

    /** Giá trị hợp lệ của tham số trangThaiTon. */
    public static final String TON_CON_HANG = "con_hang";
    public static final String TON_HET_HANG = "het_hang";
    public static final String TON_TAT_CA = "tat_ca";
    private static final Set<String> BO_LOC_TON_HOP_LE = Set.of(TON_CON_HANG, TON_HET_HANG, TON_TAT_CA);

    /** Số SKU tối đa mỗi lần tra tồn cho giỏ hàng (giỏ POS thực tế nhỏ hơn nhiều). */
    private static final int MAX_STOCK_IDS = 200;

    /** Số nhóm (mẫu + màu) tối đa mỗi trang của danh mục gộp kích cỡ. */
    private static final int MAX_NHOM_MOI_TRANG = 120;

    /** Số id tối đa trong một mệnh đề IN (giữ câu lệnh gọn, tránh giới hạn số tham số của CSDL/driver). */
    private static final int KICH_THUOC_LO_IN = 1000;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private BienTheSanPhamRepository bienTheSanPhamRepository;

    @Autowired
    private AnhBienTheRepository anhBienTheRepository;

    @Autowired
    private AnhQuanAoRepository anhQuanAoRepository;

    @Autowired
    private PhanQuyenNguoiDungKhoRepository phanQuyenNguoiDungKhoRepository;

    /** Catalog không lọc (giữ chữ ký cũ cho các nơi gọi/test hiện có). */
    @Transactional(readOnly = true)
    public Page<PosCatalogItemDto> getCatalog(Integer khoId, String q, int page, int size) {
        return getCatalog(khoId, q, null, page, size);
    }

    /**
     * Catalog có bộ lọc tồn kho. tat_ca -> dùng đúng truy vấn gốc (findPosCatalog);
     * con_hang/het_hang -> findPosCatalogFiltered (lọc cả trong countQuery nên tổng số
     * và phân trang luôn khớp với bộ lọc).
     */
    @Transactional(readOnly = true)
    public Page<PosCatalogItemDto> getCatalog(Integer khoId, String q, String trangThaiTon, int page, int size) {
        Integer authorizedKhoId = authorizeWarehouse(khoId);
        int safeSize = Math.min(Math.max(size, 1), 120);
        String query = (q == null || q.isBlank()) ? null : q.trim();
        String boLocTon = chuanHoaBoLocTon(trangThaiTon);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);

        Page<PosCatalogItemDto> result = TON_TAT_CA.equals(boLocTon)
                ? bienTheSanPhamRepository.findPosCatalog(authorizedKhoId, query, pageable)
                : bienTheSanPhamRepository.findPosCatalogFiltered(authorizedKhoId, query, boLocTon, pageable);
        attachImages(result.getContent());
        return result;
    }

    /**
     * Danh mục POS GỘP KÍCH CỠ: mỗi phần tử là một mẫu + màu + chất liệu kèm đủ các kích cỡ
     * (PosCatalogNhomBuilder). Phân trang và bộ lọc tồn tính THEO NHÓM:
     * con_hang = còn ít nhất một kích cỡ có hàng (kích cỡ đã hết vẫn trả về để màn POS làm mờ),
     * het_hang = mọi kích cỡ đều hết, tat_ca = không lọc.
     * Không tìm kiếm: 1 truy vấn. Có từ khóa: thêm 1 truy vấn lấy đủ kích cỡ của các mẫu khớp
     * (từ khóa có thể chỉ khớp mã SKU của một kích cỡ). Ảnh chỉ tải cho các nhóm của trang.
     */
    @Transactional(readOnly = true)
    public Page<PosCatalogNhomDto> getCatalogNhom(Integer khoId, String q, String trangThaiTon, int page, int size) {
        Integer authorizedKhoId = authorizeWarehouse(khoId);
        int safeSize = Math.min(Math.max(size, 1), MAX_NHOM_MOI_TRANG);
        int safePage = Math.max(page, 0);
        String query = (q == null || q.isBlank()) ? null : q.trim();
        String boLocTon = chuanHoaBoLocTon(trangThaiTon);

        List<PosCatalogBienTheDto> khop = bienTheSanPhamRepository.findPosCatalogBienThe(authorizedKhoId, query);
        List<PosCatalogBienTheDto> dayDu = khop;
        if (query != null && !khop.isEmpty()) {
            List<Integer> sanPhamIds = khop.stream().map(PosCatalogBienTheDto::getSanPhamId).toList();
            // chiaLo bỏ trùng/null và chia lô để mệnh đề IN không vượt giới hạn tham số của CSDL khi từ khóa khớp rất nhiều mẫu.
            List<PosCatalogBienTheDto> tatCa = new ArrayList<>();
            for (List<Integer> lo : chiaLo(sanPhamIds)) {
                tatCa.addAll(bienTheSanPhamRepository.findPosCatalogBienTheTheoSanPham(authorizedKhoId, lo));
            }
            dayDu = tatCa;
        }

        PosCatalogNhomBuilder.KetQua ketQua = PosCatalogNhomBuilder.xayDung(khop, dayDu, boLocTon, safePage, safeSize);
        attachNhomImages(ketQua.trang());
        return new PageImpl<>(ketQua.trang(), PageRequest.of(safePage, safeSize), ketQua.tongSoNhom());
    }

    /**
     * Tồn khả dụng hiện tại tại kho được ủy quyền cho một nhóm SKU (thường là các dòng trong giỏ).
     * Trả về map bienTheSanPhamId -> tồn khả dụng; id không tồn tại thì không có trong map.
     */
    @Transactional(readOnly = true)
    public Map<Integer, BigDecimal> getAvailableStock(Integer khoId, List<Integer> ids) {
        Integer authorizedKhoId = authorizeWarehouse(khoId);
        if (ids == null || ids.isEmpty()) {
            return Map.of();
        }
        List<Integer> distinctIds = ids.stream().filter(Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return Map.of();
        }
        if (distinctIds.size() > MAX_STOCK_IDS) {
            throw new CommonException("Chỉ tra cứu tồn kho tối đa " + MAX_STOCK_IDS + " mặt hàng mỗi lần");
        }
        Map<Integer, BigDecimal> result = new LinkedHashMap<>();
        for (Object[] row : bienTheSanPhamRepository.findPosAvailableStock(authorizedKhoId, distinctIds)) {
            Object value = row[1];
            BigDecimal ton = value instanceof BigDecimal decimal ? decimal
                    : value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
            result.put(((Number) row[0]).intValue(), ton);
        }
        return result;
    }

    /** null/rỗng -> tat_ca (tương thích client cũ); giá trị lạ -> lỗi 400 rõ ràng. */
    private String chuanHoaBoLocTon(String trangThaiTon) {
        if (trangThaiTon == null || trangThaiTon.isBlank()) {
            return TON_TAT_CA;
        }
        String value = trangThaiTon.trim().toLowerCase(Locale.ROOT);
        if (!BO_LOC_TON_HOP_LE.contains(value)) {
            // Giá trị hợp lệ: con_hang | het_hang | tat_ca (client POS luôn gửi đúng các giá trị này).
            throw new CommonException("Bộ lọc tồn kho không hợp lệ");
        }
        return value;
    }

    @Transactional(readOnly = true)
    public List<PosCatalogItemDto> lookup(Integer khoId, String skuPrefix, String barcode) {
        Integer authorizedKhoId = authorizeWarehouse(khoId);
        if (skuPrefix != null && !skuPrefix.isBlank()) {
            Page<PosCatalogItemDto> page = bienTheSanPhamRepository.findPosCatalogBySkuPrefix(
                    authorizedKhoId, skuPrefix.trim(), PageRequest.of(0, 1));
            attachImages(page.getContent());
            return page.getContent();
        }
        if (barcode != null && !barcode.isBlank()) {
            Page<PosCatalogItemDto> page = bienTheSanPhamRepository.findPosCatalogByBarcode(
                    authorizedKhoId, barcode.trim(), PageRequest.of(0, 10));
            attachImages(page.getContent());
            return page.getContent();
        }
        throw new CommonException("Cần cung cấp skuPrefix hoặc barcode để tra cứu");
    }

    /**
     * Kiểm tra quyền kho server-side (pattern PhieuXuatKhoService.kiemTraQuyenKho).
     * Admin được mọi kho; người khác phải có phân quyền active và chưa hết hạn.
     * Public để luồng checkout POS tái sử dụng đúng một cơ chế ủy quyền kho.
     */
    public Integer authorizeWarehouse(Integer khoId) {
        if (khoId == null) {
            throw new CommonException("Vui lòng chọn kho bán hàng");
        }
        Kho kho = entityManager.find(Kho.class, khoId);
        if (kho == null) {
            throw new CommonException("Kho đã chọn không tồn tại");
        }
        KhoService.kiemTraKhoBanTaiQuay(kho);

        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();
        boolean isAdmin = currentUser != null && currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        if (isAdmin) {
            return khoId;
        }

        PhanQuyenNguoiDungKho phanQuyen = phanQuyenNguoiDungKhoRepository
                .findByNguoiDungIdAndKhoId(currentUser.getId(), khoId)
                .orElseThrow(() -> new CommonException("Bạn không phụ trách kho [" + kho.getTenKho() +
                        "]. Không thể xem catalog bán hàng của kho này."));

        if (phanQuyen.getTrangThai() != 1 ||
                (phanQuyen.getNgayKetThuc() != null && phanQuyen.getNgayKetThuc().isBefore(Instant.now()))) {
            // Không viết "bị khóa": giao diện coi câu có cụm đó là tài khoản bị khóa và đăng xuất
            throw new CommonException("Quyền truy cập kho [" + kho.getTenKho() + "] của bạn đã hết hạn hoặc đã bị thu hồi.");
        }
        return khoId;
    }

    /** Gắn ảnh vào các phần tử đã trả về: 2 query batch cho cả trang. */
    private void attachImages(List<PosCatalogItemDto> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        List<Integer> variantIds = items.stream().map(PosCatalogItemDto::getBienTheSanPhamId).toList();

        Map<Integer, String> variantImageByVariant = anhBienTheRepository.findActiveByBienTheIds(variantIds)
                .stream()
                .collect(Collectors.toMap(
                        ab -> ab.getBienThe().getId(),
                        ab -> PublicAssetUrl.toHttps(ab.getTepTin().getDuongDan()),
                        (first, second) -> first));

        Map<Integer, String> productImageByProduct = new HashMap<>();
        List<Integer> productIds = items.stream().map(PosCatalogItemDto::getSanPhamId).distinct().toList();
        // Query đã sort (quanAo.id, anhChinh desc, id): ảnh chính (anhChinh=1) luôn gặp trước —
        // putIfAbsent là đủ để ưu tiên ảnh chính, nếu không có ảnh chính thì dùng ảnh đầu tiên.
        for (AnhQuanAo aq : anhQuanAoRepository.findActiveByQuanAoIds(productIds)) {
            productImageByProduct.putIfAbsent(aq.getQuanAo().getId(),
                    PublicAssetUrl.toHttps(aq.getTepTin().getDuongDan()));
        }

        for (PosCatalogItemDto item : items) {
            String url = variantImageByVariant.get(item.getBienTheSanPhamId());
            if (url == null) {
                url = productImageByProduct.get(item.getSanPhamId());
            }
            item.setAnhUrl(url);
        }
    }

    /**
     * Ảnh cho danh mục gộp: mỗi kích cỡ lấy ảnh biến thể (ảnh theo màu) -> ảnh sản phẩm; ảnh của nhóm là
     * ảnh của kích cỡ đầu tiên có ảnh. 2 truy vấn batch cho cả trang (chia lô khi quá KICH_THUOC_LO_IN id).
     */
    private void attachNhomImages(List<PosCatalogNhomDto> nhoms) {
        if (nhoms == null || nhoms.isEmpty()) {
            return;
        }
        List<PosCatalogBienTheDto> bienThes = nhoms.stream()
                .flatMap(nhom -> nhom.getBienThes().stream())
                .toList();
        if (bienThes.isEmpty()) {
            return;
        }
        BoAnh boAnh = taiAnhTheoLo(
                bienThes.stream().map(PosCatalogBienTheDto::getBienTheSanPhamId).toList(),
                bienThes.stream().map(PosCatalogBienTheDto::getSanPhamId).distinct().toList());
        for (PosCatalogNhomDto nhom : nhoms) {
            String anhNhom = null;
            for (PosCatalogBienTheDto bienThe : nhom.getBienThes()) {
                String url = boAnh.chon(bienThe.getBienTheSanPhamId(), bienThe.getSanPhamId());
                bienThe.setAnhUrl(url);
                if (anhNhom == null) {
                    anhNhom = url;
                }
            }
            nhom.setAnhUrl(anhNhom);
        }
    }

    /** Ảnh biến thể theo id biến thể + ảnh sản phẩm (ưu tiên ảnh chính) theo id sản phẩm. */
    private record BoAnh(Map<Integer, String> theoBienThe, Map<Integer, String> theoSanPham) {
        String chon(Integer bienTheId, Integer sanPhamId) {
            String url = theoBienThe.get(bienTheId);
            return url != null ? url : theoSanPham.get(sanPhamId);
        }
    }

    /**
     * Ảnh biến thể + ảnh sản phẩm cho danh mục gộp, truy vấn theo lô id (cùng quy tắc ưu tiên với
     * attachImages; mỗi id nằm trọn trong một lô nên thứ tự ưu tiên ảnh không đổi).
     */
    private BoAnh taiAnhTheoLo(List<Integer> variantIds, List<Integer> productIds) {
        Map<Integer, String> variantImageByVariant = new HashMap<>();
        for (List<Integer> lo : chiaLo(variantIds)) {
            for (AnhBienThe ab : anhBienTheRepository.findActiveByBienTheIds(lo)) {
                variantImageByVariant.putIfAbsent(ab.getBienThe().getId(),
                        PublicAssetUrl.toHttps(ab.getTepTin().getDuongDan()));
            }
        }

        Map<Integer, String> productImageByProduct = new HashMap<>();
        // Query đã sort (quanAo.id, anhChinh desc, id): ảnh chính (anhChinh=1) luôn gặp trước —
        // putIfAbsent là đủ để ưu tiên ảnh chính, nếu không có ảnh chính thì dùng ảnh đầu tiên.
        for (List<Integer> lo : chiaLo(productIds)) {
            for (AnhQuanAo aq : anhQuanAoRepository.findActiveByQuanAoIds(lo)) {
                productImageByProduct.putIfAbsent(aq.getQuanAo().getId(),
                        PublicAssetUrl.toHttps(aq.getTepTin().getDuongDan()));
            }
        }
        return new BoAnh(variantImageByVariant, productImageByProduct);
    }

    /** Chia danh sách id (bỏ trùng, bỏ null) thành các lô tối đa KICH_THUOC_LO_IN phần tử. */
    static List<List<Integer>> chiaLo(List<Integer> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Integer> sach = ids.stream().filter(Objects::nonNull).distinct().toList();
        List<List<Integer>> los = new ArrayList<>();
        for (int i = 0; i < sach.size(); i += KICH_THUOC_LO_IN) {
            los.add(sach.subList(i, Math.min(i + KICH_THUOC_LO_IN, sach.size())));
        }
        return los;
    }
}
