package com.dev.backend.workers;

import com.dev.backend.entities.BangChungDongGoi;
import com.dev.backend.entities.TepTin;
import com.dev.backend.repository.BangChungDongGoiRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.entities.TepTinService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class PackingProofCleanupJobTest {

    @Mock
    private BangChungDongGoiRepository bangChungDongGoiRepository;

    @Mock
    private MinioService minioService;

    @Mock
    private TepTinService tepTinService;

    @InjectMocks
    private PackingProofCleanupJob cleanupJob;

    @Test
    @DisplayName("TC-16: Dọn dẹp tệp bằng chứng quá hạn 30 ngày: xóa MinIO và đánh dấu trangThai = 0")
    void testCleanUpOldProofs_Success() {
        TepTin tep = TepTin.builder().id(99).tenLuuTru("packing-proofs/101/uuid.jpg").build();
        BangChungDongGoi bc = BangChungDongGoi.builder()
                .id(1)
                .tepTin(tep)
                .trangThai(1)
                .ngayTao(Instant.now().minus(35, ChronoUnit.DAYS))
                .build();

        // Lần 1 trả về 1 bản ghi quá hạn, lần 2 trả về rỗng để ngắt vòng lặp
        when(bangChungDongGoiRepository.findTop100ByTrangThaiAndNgayTaoBefore(eq(1), any(Instant.class)))
                .thenReturn(List.of(bc))
                .thenReturn(List.of());

        int deleted = cleanupJob.cleanUpOldProofs();

        assertEquals(1, deleted);
        verify(minioService, times(1)).delete("packing-proofs/101/uuid.jpg");
        verify(tepTinService, times(1)).hardDeleteNoMessage(99);
        assertEquals(0, bc.getTrangThai());
        verify(bangChungDongGoiRepository, times(1)).save(bc);
    }
}
