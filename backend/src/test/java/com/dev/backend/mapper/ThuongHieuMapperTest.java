package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.dto.response.entities.ThuongHieuDto;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.SanPhamQuanAo;
import com.dev.backend.entities.TepTin;
import com.dev.backend.entities.ThuongHieu;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test mapping logo thương hiệu: tepTin.duongDan -> logoUrl phải qua chuẩn hoá
 * origin legacy MinIO -> HTTPS, chỉ đúng field logoUrl (field String khác không bị đụng).
 */
class ThuongHieuMapperTest {

    private final ThuongHieuMapper mapper = new ThuongHieuMapperImpl();

    private ThuongHieu brandWithLegacyLogo() {
        return ThuongHieu.builder()
                .id(1)
                .maThuongHieu("NK")
                .tenThuongHieu("Nike")
                .moTa("mô tả")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/brands/nike.png")
                        .build())
                .build();
    }

    @Test
    void toDto_logoTuTepTinLegacy_doiSangHttps() {
        ThuongHieuDto dto = mapper.toDto(brandWithLegacyLogo());

        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike.png", dto.getLogoUrl());
    }

    @Test
    void toDto_logoHttpsSan_giuNguyen() {
        ThuongHieu brand = ThuongHieu.builder()
                .id(1).maThuongHieu("NK").tenThuongHieu("Nike")
                .tepTin(TepTin.builder()
                        .duongDan("https://minio.slmglobal.vn/fashion/brands/nike.png")
                        .build())
                .build();

        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike.png",
                mapper.toDto(brand).getLogoUrl());
    }

    @Test
    void toDto_khongCoTepTin_logoNull_vaFieldKhacGiNguyen() {
        ThuongHieu brand = ThuongHieu.builder()
                .id(2).maThuongHieu("AD").tenThuongHieu("Adidas").moTa("mô tả adidas")
                .build();

        ThuongHieuDto dto = mapper.toDto(brand);

        assertNull(dto.getLogoUrl());
        assertEquals("Adidas", dto.getTenThuongHieu());
        assertEquals("mô tả adidas", dto.getMoTa());
        assertEquals(2, dto.getId());
    }

    @Test
    void toDtoList_apDungChuanHoaChoTungPhanTu() {
        ThuongHieu brand2 = ThuongHieu.builder()
                .id(2).maThuongHieu("AD").tenThuongHieu("Adidas")
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/brands/adidas.png")
                        .build())
                .build();

        List<ThuongHieuDto> dtos = mapper.toDtoList(List.of(brandWithLegacyLogo(), brand2));

        assertEquals(2, dtos.size());
        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike.png", dtos.get(0).getLogoUrl());
        assertEquals("https://minio.slmglobal.vn/fashion/brands/adidas.png", dtos.get(1).getLogoUrl());
    }

    @Test
    void toDtoPage_apDungChuanHoa() {
        Page<ThuongHieu> page = new PageImpl<>(List.of(brandWithLegacyLogo()));

        Page<ThuongHieuDto> dtoPage = mapper.toDtoPage(page);

        assertEquals(1, dtoPage.getTotalElements());
        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike.png",
                dtoPage.getContent().get(0).getLogoUrl());
    }

    /**
     * Dựng SanPhamQuanAoMapperImpl và gắn tay đủ các mapper trong "uses"
     * (không có Spring context nên phải tự inject).
     */
    private SanPhamQuanAoMapper productMapperDayDu() {
        TepTinMapper tepTinMapper = new TepTinMapperImpl();

        AnhQuanAoMapper anhQuanAoMapper = new AnhQuanAoMapperImpl();
        ReflectionTestUtils.setField(anhQuanAoMapper, "tepTinMapper", tepTinMapper);

        NguoiDungMapper nguoiDungMapper = new NguoiDungMapperImpl();
        ReflectionTestUtils.setField(nguoiDungMapper, "phanQuyenNguoiDungKhoMapper", new PhanQuyenNguoiDungKhoMapperImpl());

        AnhBienTheMapper anhBienTheMapper = new AnhBienTheMapperImpl();
        ReflectionTestUtils.setField(anhBienTheMapper, "tepTinMapper", tepTinMapper);
        BienTheSanPhamMapper bienTheSanPhamMapper = new BienTheSanPhamMapperImpl();
        ReflectionTestUtils.setField(bienTheSanPhamMapper, "anhBienTheMapper", anhBienTheMapper);

        SanPhamQuanAoMapper productMapper = new SanPhamQuanAoMapperImpl();
        ReflectionTestUtils.setField(productMapper, "anhQuanAoMapper", anhQuanAoMapper);
        ReflectionTestUtils.setField(productMapper, "thuongHieuMapper", new ThuongHieuMapperImpl());
        ReflectionTestUtils.setField(productMapper, "nguoiDungMapper", nguoiDungMapper);
        ReflectionTestUtils.setField(productMapper, "bienTheSanPhamMapper", bienTheSanPhamMapper);
        return productMapper;
    }

    @Test
    void sanPhamLongNguoiTao_avatarDuocChuanHoa() {
        // SanPhamQuanAoMapper -> NguoiDungMapper: avatar người tạo lồng trong sản phẩm cũng phải chuẩn hoá HTTPS
        SanPhamQuanAo product = SanPhamQuanAo.builder()
                .maSanPham("SP02")
                .tenSanPham("Quần jean")
                .nguoiTao(NguoiDung.builder()
                        .id(1).hoTen("Khang")
                        .avatarTepTin(TepTin.builder()
                                .duongDan("http://171.244.142.43:9000/fashion/avatars/abc.png")
                                .build())
                        .build())
                .build();

        SanPhamQuanAoDto dto = productMapperDayDu().toDto(product);

        assertNotNull(dto.getNguoiTao());
        assertEquals("https://minio.slmglobal.vn/fashion/avatars/abc.png", dto.getNguoiTao().getAvatarUrl());
    }

    @Test
    void sanPhamLongThuongHieu_logoDuocChuanHoa() {
        // SanPhamQuanAoMapper -> ThuongHieuMapper (nested brand DTO trong sản phẩm)
        SanPhamQuanAoMapper productMapper = productMapperDayDu();

        SanPhamQuanAo product = SanPhamQuanAo.builder()
                .maSanPham("SP01")
                .tenSanPham("Áo thun")
                .thuongHieu(brandWithLegacyLogo())
                .build();

        SanPhamQuanAoDto dto = productMapper.toDto(product);

        assertNotNull(dto.getThuongHieu());
        assertEquals("https://minio.slmglobal.vn/fashion/brands/nike.png",
                dto.getThuongHieu().getLogoUrl());
    }
}
