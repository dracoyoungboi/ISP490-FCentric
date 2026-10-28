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
    @DisplayName("TC-16: Dọn tệp bằng chứng đã quá hạn lưu (ngay_het_han): xóa MinIO và đánh dấu trangThai = 0")
    void testCleanUpOldProofs_Success() {
        TepTin tep = TepTin.builder().id(99).tenLuuTru("packing-proofs/101/uuid.jpg").build();
        BangChungDongGoi bc = BangChungDongGoi.builder()
                .id(1)
                .tepTin(tep)
                .trangThai(1)
                .ngayTao(Instant.now().minus(95, ChronoUnit.DAYS))
                .ngayHetHan(Instant.now().minus(65, ChronoUnit.DAYS)) // tệp cũ: hạn ghi lúc tải + 30
                .build();

        // Lần 1 trả về 1 bản ghi quá hạn, lần 2 trả về rỗng để ngắt vòng lặp
        when(bangChungDongGoiRepository.findTop100ByTrangThaiAndNgayHetHanBeforeAndNgayTaoBeforeOrderByIdAsc(eq(1), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of(bc))
                .thenReturn(List.of());

        int deleted = cleanupJob.cleanUpOldProofs();

        assertEquals(1, deleted);
        verify(minioService, times(1)).delete("packing-proofs/101/uuid.jpg");
        verify(tepTinService, times(1)).hardDeleteNoMessage(99);
        assertEquals(0, bc.getTrangThai());
        // Ghi hạn thật lúc dọn (ngày tạo + 90 muộn hơn hạn đã ghi) để màn hình báo đúng ngày tự xóa
        assertEquals(bc.getNgayTao().plus(90, ChronoUnit.DAYS), bc.getNgayHetHan());
        verify(bangChungDongGoiRepository, times(1)).save(bc);
    }

    @Test
    @DisplayName("Chỉ dọn tệp đã qua cả hạn đã ghi lẫn ngày tạo + 90: tệp hạn 30 ngày cũ không bị xóa sớm")
    void testCleanUp_MocLaBayGioTheoHanLuu() {
        when(bangChungDongGoiRepository.findTop100ByTrangThaiAndNgayHetHanBeforeAndNgayTaoBeforeOrderByIdAsc(eq(1), any(Instant.class), any(Instant.class)))
                .thenReturn(List.of());
        Instant truoc = Instant.now();

        assertEquals(0, cleanupJob.cleanUpOldProofs());

        org.mockito.ArgumentCaptor<Instant> moc = org.mockito.ArgumentCaptor.forClass(Instant.class);
        org.mockito.ArgumentCaptor<Instant> taoTruoc = org.mockito.ArgumentCaptor.forClass(Instant.class);
        verify(bangChungDongGoiRepository).findTop100ByTrangThaiAndNgayHetHanBeforeAndNgayTaoBeforeOrderByIdAsc(
                eq(1), moc.capture(), taoTruoc.capture());
        assertEquals(true, !moc.getValue().isBefore(truoc) && !moc.getValue().isAfter(Instant.now()), "mốc = lúc chạy");
        assertEquals(moc.getValue().minus(90, ChronoUnit.DAYS), taoTruoc.getValue(), "tạo trước 90 ngày");
        verifyNoInteractions(minioService, tepTinService);
    }
}
