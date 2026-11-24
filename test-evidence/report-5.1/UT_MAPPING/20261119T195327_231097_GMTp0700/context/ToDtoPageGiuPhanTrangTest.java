package com.dev.backend.mapper;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * toDtoPage của mọi mapper phải giữ nguyên phân trang khi trang rỗng: xin trang vượt số trang (vd. vừa xóa dòng cuối
 * của trang cuối) thì tổng vẫn là tổng thật để giao diện lùi về trang cuối còn dữ liệu; kết quả rỗng vẫn giữ cỡ trang
 * (Page.empty() trước đây trả size 0 → màn Kho tự đặt cỡ trang thành 1 dòng).
 * Trang rỗng không gọi toDto nên dựng MapperImpl trần, không cần gắn các mapper trong "uses".
 */
class ToDtoPageGiuPhanTrangTest {

    private static final PageRequest TRANG_4 = PageRequest.of(3, 20);

    private static <T> Page<T> trangRong(PageRequest pageable, long tong) {
        return new PageImpl<>(List.of(), pageable, tong);
    }

    static Stream<Arguments> cacMapper() {
        return Stream.of(
                mapper("ChatLieuMapper", p -> new ChatLieuMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("DonMuaHangMapper", p -> new DonMuaHangMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("KhachHangMapper", p -> new KhachHangMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("KhoMapper", p -> new KhoMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("LoHangMapper", p -> new LoHangMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("MauSacMapper", p -> new MauSacMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("NguoiDungMapper", p -> new NguoiDungMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("PhanQuyenNguoiDungKhoMapper",
                        p -> new PhanQuyenNguoiDungKhoMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("PhieuXuatKhoMapper", p -> new PhieuXuatKhoMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("QuyenHanMapper", p -> new QuyenHanMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("SanPhamQuanAoMapper", p -> new SanPhamQuanAoMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("SizeMapper", p -> new SizeMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("ThuongHieuMapper", p -> new ThuongHieuMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("TonKhoTheoLoMapper", p -> new TonKhoTheoLoMapperImpl().toDtoPage(trangRong(p.pageable, p.tong))),
                mapper("YeuCauMuaHangMapper", p -> new YeuCauMuaHangMapperImpl().toDtoPage(trangRong(p.pageable, p.tong)))
        );
    }

    private record DauVao(PageRequest pageable, long tong) {
    }

    private static Arguments mapper(String ten, Function<DauVao, Page<?>> toDtoPage) {
        return Arguments.of(ten, toDtoPage);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cacMapper")
    void trangVuotSoTrang_giuTongThatVaTrangDangXin(String ten, Function<DauVao, Page<?>> toDtoPage) {
        Page<?> ketQua = toDtoPage.apply(new DauVao(TRANG_4, 45));

        assertTrue(ketQua.getContent().isEmpty());
        assertEquals(45, ketQua.getTotalElements(), ten + ": phải giữ tổng thật");
        assertEquals(3, ketQua.getTotalPages());
        assertEquals(3, ketQua.getNumber());
        assertEquals(20, ketQua.getSize());
        assertEquals(TRANG_4, ketQua.getPageable());
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cacMapper")
    void ketQuaRong_giuCoTrang(String ten, Function<DauVao, Page<?>> toDtoPage) {
        Page<?> ketQua = toDtoPage.apply(new DauVao(PageRequest.of(0, 20), 0));

        assertTrue(ketQua.getContent().isEmpty());
        assertEquals(0, ketQua.getTotalElements());
        assertEquals(0, ketQua.getNumber());
        assertEquals(20, ketQua.getSize(), ten + ": không được trả size 0");
        assertTrue(ketQua.getPageable().isPaged());
    }
}
