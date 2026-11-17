package com.dev.backend.services;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Duration;
import java.util.List;

public interface KenhBanHangDongBoService {

    TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh);

    TuDongLienKetResultDto tuDongLienKet(String maKenh);

    Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable);

    /**
     * Liên kết của kênh, phân trang theo sản phẩm: mỗi phần tử là một sản phẩm kèm đủ các SKU khớp bộ lọc,
     * nên một sản phẩm không bị cắt sang hai trang. {@code totalElements} là số sản phẩm.
     * Bộ lọc {@code search}, {@code trangThai} giống {@link #filterLienKet}; phần sắp xếp của {@code pageable} bị bỏ qua.
     */
    Page<NhomLienKetDto> filterLienKetTheoSanPham(String maKenh, String search, String trangThai, Pageable pageable);

    LienKetSanPhamDto capNhatLienKet(Integer lienKetId, CapNhatLienKetRequest request);

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request);

    /** Đẩy tồn theo quy tắc đã lưu của kênh, báo tiến độ từng SKU cho {@code theoDoi} (đồng bộ tay chạy nền). */
    DayTonResultDto dayTonTheoQuyTacDaLuu(String maKenh, TheoDoiDayTon theoDoi);

    /**
     * Nhận tiến độ của một đợt đẩy tồn. Gọi trên luồng đang đẩy, theo thứ tự:
     * {@code batDauDay} (đã kết nối Shopify) → mỗi SKU {@code dangDay} rồi {@code daDay}.
     * Lỗi cả gian hàng thì dừng giữa chừng, SKU gặp lỗi đó không có {@code daDay}.
     */
    interface TheoDoiDayTon {
        TheoDoiDayTon KHONG_THEO_DOI = new TheoDoiDayTon() {};

        default void batDauDay(int tongSku) {}

        default void dangDay(String maSku) {}

        /** {@code tenSku} chỉ có khi lỗi (để hiện danh sách lỗi), thành công thì null. */
        default void daDay(String maSku, String tenSku, boolean thanhCong, String lyDo) {}

        /** true thì dừng trước SKU kế tiếp; SKU đã đẩy giữ nguyên. */
        default boolean canDung() {
            return false;
        }

        /**
         * Kênh đang có đợt đẩy tồn khác thì chờ tối đa bấy lâu rồi mới đẩy; mặc định không chờ:
         * trả ngay lỗi cả gian hàng "kênh đang có đợt đẩy tồn khác" (job định kỳ bỏ lượt này).
         */
        default Duration choKenhRanhToiDa() {
            return Duration.ZERO;
        }
    }

    /** Có kênh bán hàng với mã (hoặc id) này không, cùng cách tìm kênh với các thao tác đồng bộ. */
    boolean coKenh(String maKenh);

    /** Kênh chưa có khóa truy cập (chưa kết nối hoặc đã ngắt) thì ném lỗi KENH_CHUA_KET_NOI (409). */
    void kiemTraDaKetNoi(String maKenh);

    /**
     * Chạy {@code viec} khi đang giữ khóa đẩy tồn của kênh, không chờ: kênh đang có đợt đẩy tồn thì trả false và
     * không chạy. Dùng cho ngắt kết nối, để không lượt đẩy nào chen vào giữa lúc xóa khóa.
     */
    boolean chayKhiKenhRanh(String maKenh, Runnable viec);

    /** Quên mốc "lần đẩy tồn / lấy đơn gần nhất" của kênh (sau khi ngắt kết nối). */
    void xoaMocLanChay(String maKenh);

    void dayTonKhoKhanCap(Integer bienTheSanPhamId);

    DongBoTongQuanDto getTongQuan(String maKenh);

    List<BienTheOptionDto> timBienThe(String q, int limit);

    List<ShopifyLocationDto> getLocations(String maKenh);

    DongBoTongQuanDto luuCaiDat(String maKenh, KenhBanHangCaiDatRequest request);

    Page<NhatKyDongBoDto> filterNhatKy(String maKenh, String loai, String trangThai, String search, Pageable pageable);

    NhatKyDongBoDto getNhatKyDetail(Integer id);

    LayDonResultDto layDonHang(String maKenh, LayDonHangKenhRequest request);

    DayTonResultDto dongBoTatCa();

    LienKetSanPhamDto thuLai(Integer lienKetId);

    boolean huyDonHangTrenShopify(String maDonHangKenh, String lyDoHuy);

    boolean huyDonHangTrenLazada(String maDonHangKenh, String lyDoHuy);

    boolean dongBoTrangThaiPackedLazada(String maDonHangKenh);

    boolean dongBoTrangThaiReadyToShipLazada(String maDonHangKenh);

    /**
     * Đồng bộ chuyển đơn hàng TikTok Shop sang Đang chờ lấy hàng (AWAITING_COLLECTION)
     * khi FCentric hoàn tất đóng gói ("Chờ xuất kho" - DA_DONG_GOI = 8).
     */
    boolean dongBoTrangThaiReadyToShipTikTok(String maDonHangKenh);

    /**
     * Lấy đường dẫn tải file PDF vận đơn chính thức (A6) từ TikTok Shop Open Platform.
     */
    String layShippingDocumentUrlTikTok(String maDonHangKenh);

    /**
     * Đồng bộ chuyển đơn hàng Shopify sang Đang thực hiện (in_progress)
     * khi FCentric bắt đầu quy trình kho (Chờ nhặt hàng, Chờ đóng gói, Chờ xuất kho).
     */
    boolean dongBoTrangThaiDangThucHienShopify(String maDonHangKenh);

    /**
     * Đồng bộ chuyển đơn hàng Shopify sang Đã hoàn tất (fulfilled)
     * khi FCentric hoàn tất xuất kho vật lý (Đã xuất kho - DA_XUAT_TOAN_BO = 3).
     */
    boolean dongBoTrangThaiFulfilledShopify(Integer donId, String maDonHangKenh);

    /**
     * Đồng bộ chuyển đơn hàng Shopify sang Đã giao (delivered)
     * khi FCentric xác nhận đơn hàng thành công (Hoàn thành - HOAN_THANH = 5).
     */
    boolean dongBoTrangThaiDeliveredShopify(String maDonHangKenh);

    /**
     * Đồng bộ ghi nhận hoàn trả đơn hàng trên Shopify
     * khi FCentric chuyển đơn sang Bị hoàn trả (BI_HOAN_TRA = 6).
     */
    boolean dongBoTrangThaiReturnedShopify(String maDonHangKenh);

    /**
     * Đồng bộ hoàn trả và hoàn tiền đơn hàng trên Shopify (Refunds API - partially_refunded/refunded)
     * với cơ chế tự động fulfill nếu đơn chưa fulfilled và restock_type = no_restock theo chuẩn Sapo.
     */
    boolean dongBoHoanTraVaHoanTienShopify(Integer donBanHangId, String maDonHangKenh);

    /**
     * Lấy cấu hình ánh xạ kho sàn với kho FCentric (tự động phát hiện 1 kho vs đa kho).
     */
    com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto layCauHinhKhoMapping(String maKenh);

    /**
     * Cập nhật cấu hình ánh xạ kho sàn với kho FCentric.
     */
    com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto luuCauHinhKhoMapping(String maKenh, com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest request);
}

