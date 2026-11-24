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

    void xoaLienKet(Integer lienKetId);

    DayTonResultDto dayTonKhoLenKenh(String maKenh, DayTonKenhRequest request);

    /** Đẩy tồn theo quy tắc đã lưu của kênh, báo tiến độ từng SKU cho {@code theoDoi} (đồng bộ tay chạy nền). */
    DayTonResultDto dayTonTheoQuyTacDaLuu(String maKenh, TheoDoiDayTon theoDoi);

    /**
     * Đẩy tồn theo quy tắc đã lưu với cờ bỏ qua backoff lỗi / ép đẩy toàn bộ SKU bất kể tồn chưa đổi.
     */
    default DayTonResultDto dayTonTheoQuyTacDaLuu(String maKenh, TheoDoiDayTon theoDoi, boolean boQuaBackoffLoi, boolean epDayToanBo) {
        return dayTonTheoQuyTacDaLuu(maKenh, theoDoi);
    }

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

        /** true để thử lại ngay các SKU đang ở trạng thái thất bại thay vì chờ backoff 60 phút. */
        default boolean boQuaBackoffLoi() {
            return false;
        }

        /** true để ép đẩy toàn bộ SKU bất kể số tồn hiện tại khớp lần đẩy trước. */
        default boolean epDayToanBo() {
            return false;
        }

        /** Ghi nhận số SKU bị bỏ qua trong đợt do tồn kho chưa đổi (hoặc đang backoff). */
        default void daBoQuaKhongDoi(int soSkuKhongDoi) {}
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

    default List<ShopifyLocationDto> getLocations(String maKenh, boolean forceRefresh) {
        return getLocations(maKenh);
    }

    /** Định tuyến kho FCentric xuất hàng cho đơn sàn dựa trên bảng ánh xạ kho và cấu hình kênh. */
    default com.dev.backend.entities.Kho resolveKhoXuatChoDonSan(com.dev.backend.entities.KenhBanHang kenh, String maKhoSanTuDon) {
        return null;
    }

    /** Tra cứu address_id Shopee tương ứng với kho xuất FCentric (nếu có ánh xạ nhiều địa chỉ lấy hàng). */
    default Long resolveShopeeAddressIdChoKho(com.dev.backend.entities.KenhBanHang kenh, Integer khoId) {
        return null;
    }

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

    /** Overload truyền trực tiếp mã vận đơn và ĐVVC từ sự kiện xuất kho (bao gồm cả nhập tay qua DispatchDialog). */
    default boolean dongBoTrangThaiFulfilledShopify(Integer donId, String maDonHangKenh, String maVanDon, String donViVanChuyen) {
        return dongBoTrangThaiFulfilledShopify(donId, maDonHangKenh);
    }

    /** Chuyển FulfillmentOrder đang mở sang Location ứng với kho FCentric khi Kho Tổng điều tiết sang kho khác gợi ý. */
    default boolean chuyenKhoShopifyTheoKhoFCentric(String maDonHangKenh, Integer khoFCentricId) {
        return false;
    }

    /** Báo khách sẵn sàng nhận tại cửa hàng (PICK_UP) trên Shopify sau khi kho hoàn tất đóng gói. */
    default boolean dongBoSanSangLayTaiCuaHangShopify(String maDonHangKenh) {
        return false;
    }

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
     * Đồng bộ chuyển đơn hàng Shopee sang Người bán đang chuẩn bị hàng (PROCESSED)
     * khi FCentric hoàn tất nhặt hàng hoặc đóng gói ("Chờ đóng gói" - 7 / "Chờ xuất kho" - 8).
     */
    boolean dongBoTrangThaiChuanBiHangShopee(String maDonHangKenh);

    /**
     * Đồng bộ xác nhận đơn hàng Shopee đã xuất kho vật lý
     * khi FCentric xác nhận xuất kho (Đã xuất kho - DA_XUAT_TOAN_BO = 3).
     */
    boolean dongBoTrangThaiXuatKhoShopee(Integer donId, String maDonHangKenh);

    /**
     * Đồng bộ ghi nhận đơn hàng Shopee giao thành công
     * khi FCentric chuyển trạng thái sang Hoàn thành (HOAN_THANH = 5).
     */
    boolean dongBoTrangThaiGiaoThanhCongShopee(String maDonHangKenh);

    /**
     * Gửi yêu cầu hủy đơn hàng sang sàn Shopee khi đơn FCentric bị hủy (Đã hủy - DA_HUY = 4).
     */
    boolean huyDonHangTrenShopee(String maDonHangKenh, String lyDoHuy);

    /**
     * Đồng bộ ghi nhận đơn hàng Shopee bị hoàn trả
     * khi FCentric chuyển trạng thái sang Bị hoàn trả (BI_HOAN_TRA = 6).
     */
    boolean dongBoTrangThaiHoanTraShopee(String maDonHangKenh);

    /**
     * Lấy cấu hình ánh xạ kho sàn với kho FCentric (tự động phát hiện 1 kho vs đa kho).
     */
    com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto layCauHinhKhoMapping(String maKenh);

    default com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto layCauHinhKhoMapping(String maKenh, boolean forceRefresh) {
        return layCauHinhKhoMapping(maKenh);
    }

    /**
     * Cập nhật cấu hình ánh xạ kho sàn với kho FCentric.
     */
    com.dev.backend.dto.channel.warehouse.KenhKhoMappingConfigDto luuCauHinhKhoMapping(String maKenh, com.dev.backend.dto.channel.warehouse.KenhKhoMappingUpdateRequest request);
}

