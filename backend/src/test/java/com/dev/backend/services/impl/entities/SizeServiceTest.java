package com.dev.backend.services.impl.entities;

import com.dev.backend.entities.Size;
import com.dev.backend.repository.SizeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

/** Danh sách kích cỡ trả về theo thứ tự hiển thị chuẩn để form sản phẩm hiện XS → S → M → L → XL. */
@ExtendWith(MockitoExtension.class)
class SizeServiceTest {

    @Mock
    private SizeRepository repository;

    @Test
    void getAllTheoThuTu_sapTheoThuTuRoiTheoId() {
        List<Size> theoThuTu = List.of(
                Size.builder().id(18).maSize("S").thuTuSapXep(20).build(),
                Size.builder().id(19).maSize("M").thuTuSapXep(30).build());
        when(repository.findAll(Sort.by("thuTuSapXep").and(Sort.by("id")))).thenReturn(theoThuTu);

        assertEquals(theoThuTu, new SizeService(repository).getAllTheoThuTu());
    }
}
