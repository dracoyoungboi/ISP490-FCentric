package com.dev.backend.services;

import com.dev.backend.dto.request.CapNhatLienKetRequest;
import com.dev.backend.dto.request.DayTonKenhRequest;
import com.dev.backend.dto.request.KenhBanHangCaiDatRequest;
import com.dev.backend.dto.request.LayDonHangKenhRequest;
import com.dev.backend.dto.response.customize.*;
import com.dev.backend.dto.response.entities.LienKetSanPhamDto;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface KenhBanHangDongBoService {

    TaiSanPhamResultDto taiSanPhamTuKenh(String maKenh);

    TuDongLienKetResultDto tuDongLienKet(String maKenh);

    Page<LienKetSanPhamDto> filterLienKet(String maKenh, String search, String trangThai, Pageable pageable);

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
    }

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
}

