package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Catalog POS (chỉ đọc). Mỗi phần tử là một SKU đang bán được của KHO ĐƯỢC ỦY QUYỀN:
 * - Kho được kiểm tra server-side bằng đúng pattern PhieuXuatKhoService.createFromSO
 *   (admin bỏ qua; người khác phải có phân quyền kho active + chưa hết hạn).
 * - Tồn khả dụng = SUM(ton - dat) theo lô của ĐÚNG kho truy vấn (trong JPQL), không phải
 *   tồn toàn hệ thống; không có lô nào -> 0 (dữ liệu đã biết, không bịa).
 * - Ảnh: anh_bien_the -> fallback anh_quan_ao (anhChinh=1 ưu tiên) -> null; URL qua
 *   PublicAssetUrl.toHttps (convention chống Mixed Content của dự án).
 * - Không N+1: 1 query trang (LEFT JOIN + GROUP BY) + 2 query batch ảnh.
 */
@Service
public class PosCatalogService {

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

    @Transactional(readOnly = true)
    public Page<PosCatalogItemDto> getCatalog(Integer khoId, String q, int page, int size) {
        Integer authorizedKhoId = authorizeWarehouse(khoId);
        int safeSize = Math.min(Math.max(size, 1), 120);
        String query = (q == null || q.isBlank()) ? null : q.trim();

        Page<PosCatalogItemDto> result = bienTheSanPhamRepository.findPosCatalog(
                authorizedKhoId, query, PageRequest.of(Math.max(page, 0), safeSize));
        attachImages(result.getContent());
        return result;
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
     * Kiểm tra quyền kho server-side (pattern PhieuXuatKhoService.createFromSO).
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
            throw new CommonException("Quyền truy cập kho [" + kho.getTenKho() + "] của bạn đã hết hạn hoặc bị khóa.");
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
}
