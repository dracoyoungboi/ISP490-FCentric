package com.dev.backend.repository;

import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Thứ tự khóa dòng tồn: mọi luồng ghi tồn khóa theo PK tăng dần. Khóa theo lô (nhận chuyển kho, nhập, kiểm kê) phải
 * lấy id trước (không khóa) rồi khóa theo PK: một câu FOR UPDATE lọc theo lô đi qua chỉ mục (lo_hang_id, kho_id) nên
 * khóa theo thứ tự (lô, kho), ngược với xuất chuyển kho (khóa theo PK) → deadlock. Không cần CSDL: kiểm cấu trúc.
 */
class TonKhoTheoLoRepositoryKhoaTest {

    @Test
    void khoaTheoLo_haiBuoc_layIdKhongKhoaRoiKhoaTheoPk() throws Exception {
        Method khoaTheoLo = TonKhoTheoLoRepository.class.getMethod("lockLotsForUpdateByLotIds", Collection.class);
        assertTrue(khoaTheoLo.isDefault(), "không được là một câu FOR UPDATE lọc theo lô");
        assertNull(khoaTheoLo.getAnnotation(Lock.class));

        Method layId = TonKhoTheoLoRepository.class.getMethod("findIdsByLots", Collection.class);
        assertNull(layId.getAnnotation(Lock.class), "bước lấy id không khóa");
        assertTrue(layId.getAnnotation(Query.class).value().contains("order by t.id"));

        Method khoaTheoPk = TonKhoTheoLoRepository.class.getMethod("lockLotsForUpdateByIds", Collection.class);
        assertEquals(LockModeType.PESSIMISTIC_WRITE, khoaTheoPk.getAnnotation(Lock.class).value());
        assertTrue(khoaTheoPk.getAnnotation(Query.class).value().contains("t.id in :ids"));
    }

    @Test
    void khoaTheoLo_khoaDungCacIdTheoPk_khongCoIdThiKhongKhoa() {
        TonKhoTheoLoRepository repo = mock(TonKhoTheoLoRepository.class);
        when(repo.lockLotsForUpdateByLotIds(any())).thenCallRealMethod();
        when(repo.findIdsByLots(List.of(5, 6))).thenReturn(List.of(12, 40));

        repo.lockLotsForUpdateByLotIds(List.of(5, 6));
        verify(repo).lockLotsForUpdateByIds(List.of(12, 40));

        clearInvocations(repo);
        when(repo.findIdsByLots(List.of(7))).thenReturn(List.of());
        assertEquals(List.of(), repo.lockLotsForUpdateByLotIds(List.of(7)));
        verify(repo, never()).lockLotsForUpdateByIds(any());
    }
}
