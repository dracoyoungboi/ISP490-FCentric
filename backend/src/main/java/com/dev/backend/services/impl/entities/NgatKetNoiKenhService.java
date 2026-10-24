package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.DongBoNgayDto;
import com.dev.backend.dto.response.entities.ShopifyConfigResponse;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.services.KenhBanHangDongBoService;
import com.dev.backend.services.KenhBanHangService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Ngắt kết nối gian hàng phía FCentric (DELETE /api/v1/kenh-ban-hang/{maKenh}/ket-noi). Hiện chỉ Shopify.
 * <p>
 * Thứ tự: giữ khóa đẩy tồn của kênh (không chờ) → kiểm không có đợt "Đồng bộ ngay" đang chạy → xóa khóa trong khóa làm
 * mới khóa và commit → thả khóa. Kiểm Đồng bộ ngay sau khi đã giữ khóa đẩy tồn để không hở khe: đợt nào bắt đầu sau
 * đó phải chờ khóa này, và khi chạy sẽ đọc lại khóa từ CSDL (đã xóa).
 * <p>
 * Không có @Transactional: giao dịch nằm bên trong các khóa (KenhBanHangService#xoaKhoaShopify) để commit trước khi thả.
 * Lớp riêng (chỉ controller dùng) vì DongBoNgayService đã phụ thuộc KenhBanHangDongBoService, không tiêm ngược được.
 */
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class NgatKetNoiKenhService {

    KenhBanHangService kenhBanHangService;
    KenhBanHangDongBoService kenhBanHangDongBoService;
    DongBoNgayService dongBoNgayService;

    public ShopifyConfigResponse ngatKetNoi(String maKenh) {
        kenhBanHangService.kiemTraSanShopify(maKenh);
        String ma = KenhBanHangServiceImpl.MA_KENH_SHOPIFY;

        // Kiểm bằng cột khóa, không giải mã: khóa không giải mã được (đổi khóa mã hóa, dữ liệu hỏng) càng phải ngắt được
        if (!kenhBanHangService.coKhoaShopify()) {
            // Đã ngắt (hoặc chưa từng kết nối): không làm gì, bấm lại không lỗi
            return kenhBanHangService.getShopifyConfig();
        }

        boolean daChay = kenhBanHangDongBoService.chayKhiKenhRanh(ma, () -> {
            if (dangDongBoNgay(ma)) {
                throw dangDongBo();
            }
            kenhBanHangService.xoaKhoaShopify();
        });
        if (!daChay) {
            throw dangDongBo();
        }
        kenhBanHangDongBoService.xoaMocLanChay(ma);
        return kenhBanHangService.getShopifyConfig();
    }

    private boolean dangDongBoNgay(String ma) {
        DongBoNgayDto dot = dongBoNgayService.hienTai(ma);
        return dot != null && DongBoNgayService.DANG_CHAY.equals(dot.getTrangThai());
    }

    private static LoiCoMaException dangDongBo() {
        return new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.DANG_DONG_BO,
                "Đang đồng bộ với Shopify. Đợi lượt này xong rồi ngắt kết nối.");
    }
}
