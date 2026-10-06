package com.dev.backend.mapper;

import com.dev.backend.dto.response.entities.AnhQuanAoDto;
import com.dev.backend.dto.response.entities.TepTinDto;
import com.dev.backend.entities.AnhQuanAo;
import com.dev.backend.entities.TepTin;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Test mapper ảnh sản phẩm (TepTinMapper + chuỗi AnhQuanAoMapper như SanPhamQuanAoMapper dùng):
 * hành vi cũ phải giữ nguyên sau khi chuyển sang utility dùng chung.
 */
class TepTinMapperTest {

    private final TepTinMapper tepTinMapper = new TepTinMapperImpl();

    @Test
    void toDto_urlLegacy_doiSangHttps() {
        TepTin tepTin = TepTin.builder()
                .id(1)
                .duongDan("http://171.244.142.43:9000/fashion/products/ao-1.png")
                .build();

        TepTinDto dto = tepTinMapper.toDto(tepTin);

        assertEquals("https://minio.slmglobal.vn/fashion/products/ao-1.png", dto.getDuongDan());
        assertEquals(1, dto.getId());
    }

    @Test
    void toDto_urlHttpsSan_giuNguyen() {
        TepTin tepTin = TepTin.builder()
                .duongDan("https://minio.slmglobal.vn/fashion/products/ao-1.png")
                .build();

        assertEquals("https://minio.slmglobal.vn/fashion/products/ao-1.png",
                tepTinMapper.toDto(tepTin).getDuongDan());
    }

    @Test
    void toDto_duongDanNull_giuNguyenNull() {
        TepTin tepTin = TepTin.builder().id(1).build();

        assertNull(tepTinMapper.toDto(tepTin).getDuongDan());
    }

    @Test
    void toDto_entityNull_traNull() {
        assertNull(tepTinMapper.toDto(null));
    }

    @Test
    void toDto_assetTuongDoi_giuNguyen() {
        TepTin tepTin = TepTin.builder().duongDan("/branding/f-centric-icon.svg").build();

        assertEquals("/branding/f-centric-icon.svg", tepTinMapper.toDto(tepTin).getDuongDan());
    }

    @Test
    void chuoiAnhQuanAoMapper_doiOriginLegacyGiongTruocDay() {
        AnhQuanAoMapper anhQuanAoMapper = new AnhQuanAoMapperImpl();
        ReflectionTestUtils.setField(anhQuanAoMapper, "tepTinMapper", new TepTinMapperImpl());

        AnhQuanAo anh = AnhQuanAo.builder()
                .id(10)
                .anhChinh(1)
                .tepTin(TepTin.builder()
                        .duongDan("http://171.244.142.43:9000/fashion/products/ao-1.png")
                        .build())
                .build();

        AnhQuanAoDto dto = anhQuanAoMapper.toDto(anh);

        assertEquals("https://minio.slmglobal.vn/fashion/products/ao-1.png",
                dto.getTepTin().getDuongDan());
    }
}
