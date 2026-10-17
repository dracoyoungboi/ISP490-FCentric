package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.TongQuanVaiTroResponse.HangSapVe;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.TrungBinhDon;
import com.dev.backend.dto.response.TongQuanVaiTroResponse.Viec;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.TongQuanAdminRepository.DoanhThuNgay;
import com.dev.backend.repository.TongQuanVaiTroRepository.ViecQuanLyKho;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Các quy tắc thuần của Tổng quan theo vai trò: chọn vai trò, việc chờ quản lý kho, thứ tự hàng sắp về,
 * giá trị trung bình mỗi đơn, chuẩn hóa từ khóa tra tồn. Phần truy vấn được kiểm trên MariaDB thật (xem tài liệu
 * bàn giao).
 */
class TongQuanVaiTroTest {

    @Test
    void chonVaiTro_theoYeuCauNeuCo_khongThiTheoThuTu() {
        assertEquals("nhan_vien_kho", TongQuanVaiTroServiceImpl.chonVaiTro(Set.of("nhan_vien_kho"), null));
        assertEquals("quan_ly_kho",
                TongQuanVaiTroServiceImpl.chonVaiTro(Set.of("nhan_vien_ban_hang", "quan_ly_kho"), " "));
        assertEquals("nhan_vien_ban_hang",
                TongQuanVaiTroServiceImpl.chonVaiTro(Set.of("nhan_vien_ban_hang", "quan_ly_kho"), " nhan_vien_ban_hang "));
        assertEquals("quan_ly_kho",
                TongQuanVaiTroServiceImpl.chonVaiTro(Set.of("nhan_vien_ban_hang", "quan_ly_kho"), "nhan_vien_mua_hang"),
                "không có vai trò được yêu cầu thì theo thứ tự");
        assertThrows(CommonException.class, () -> TongQuanVaiTroServiceImpl.chonVaiTro(null, null));
        assertThrows(CommonException.class,
                () -> TongQuanVaiTroServiceImpl.chonVaiTro(Set.of("quan_tri_vien"), "quan_tri_vien"));
    }

    @Test
    void viecQuanLyKho_chiDongCoSo_gapLenTruoc() {
        LocalDateTime moc = LocalDateTime.of(2026, 10, 17, 13, 25);
        List<Viec> ds = TongQuanVaiTroServiceImpl.danhSachViec(new ViecQuanLyKho(0, null, 0, null,
                3, "2026-10-17T14:00:00", 2, "2026-10-17T09:00:00", 1, "2026-10-01T08:00:00", "Đợt 1"), moc);
        assertEquals(List.of("phan_cong_nhat", "gom_phieu_nhat", "hoan_tat_kiem_ke"),
                ds.stream().map(Viec::loai).toList());
        assertTrue(ds.get(0).gap(), "phiếu nhặt chờ phân công từ 9:00, quá 2 giờ");
        assertFalse(ds.get(1).gap(), "đơn cũ nhất 14:00 chưa quá 2 giờ");
        assertEquals("Đợt 1", ds.get(2).moTa());

        List<Viec> duyet = TongQuanVaiTroServiceImpl.danhSachViec(new ViecQuanLyKho(2, "2026-10-17T15:00:00",
                1, "2026-10-17T15:10:00", 0, null, 0, null, 0, null, null), moc);
        assertTrue(duyet.stream().allMatch(Viec::gap), "việc duyệt luôn gấp");
        assertTrue(TongQuanVaiTroServiceImpl.danhSachViec(new ViecQuanLyKho(0, null, 0, null, 0, null, 0, null, 0,
                null, null), moc).isEmpty());
    }

    @Test
    void hangSapVe_treTruoc_roiDangChuyen_roiTheoNgay() {
        List<HangSapVe> ds = new ArrayList<>(List.of(
                new HangSapVe("don_mua", 3, "c", null, 1, "2026-10-19", false),
                new HangSapVe("phieu_chuyen", 2, "b", null, 1, "2026-10-16", false),
                new HangSapVe("don_mua", 5, "e", null, 1, "2026-10-18", false),
                new HangSapVe("don_mua", 1, "a", null, 1, "2026-10-10", true),
                new HangSapVe("phieu_chuyen", 4, "d", null, 1, null, false)));
        ds.sort(TongQuanVaiTroServiceImpl.THU_TU_SAP_VE);
        assertEquals(List.of(1, 4, 2, 5, 3), ds.stream().map(HangSapVe::id).toList());
    }

    @Test
    void trungBinhDon_lamTron_ngayKhongCoDonLa0() {
        LocalDate hn = LocalDate.of(2026, 10, 17);
        TrungBinhDon t = TongQuanVaiTroServiceImpl.trungBinhDonTu(hn, List.of(
                new DoanhThuNgay(hn.minusDays(7), new BigDecimal("100000"), 3),
                new DoanhThuNgay(hn.minusDays(1), new BigDecimal("50000"), 1),
                new DoanhThuNgay(hn.minusDays(13), new BigDecimal("999999"), 1)), 0, 0);
        assertNull(t.homNay(), "hôm nay chưa có đơn");
        assertEquals(37_500L, t.bayNgayTruoc(), "150.000 ÷ 4; ngày thứ 13 trước không thuộc 7 ngày trước");
        assertEquals(7, t.bayNgay().size());
        assertEquals("2026-10-11", t.bayNgay().get(0).ngay());
        assertEquals(50_000L, t.bayNgay().get(5).giaTri());
        assertEquals(0L, t.bayNgay().get(6).giaTri());
        assertEquals(33_333L, TongQuanVaiTroServiceImpl.trungBinhDonTu(hn, List.of(), 100_000, 3).homNay());
        assertNull(TongQuanVaiTroServiceImpl.trungBinhDonTu(hn, List.of(), 0, 0).bayNgayTruoc());
    }

    @Test
    void tuKhoaTraTon_chuanHoa_vaThoatKyTuLike() {
        assertEquals("áo đũi", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("  ÁO   ĐŨI "));
        assertEquals("", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa(null));
        assertEquals(100, TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("a".repeat(150)).length());
        assertEquals("a\\%b\\_c\\\\", TongQuanVaiTroServiceImpl.thoatLike("a%b_c\\"));
        // Bộ gõ "tổ hợp" gửi chữ và dấu rời nhau (NFD); khoảng trắng không ngắt cũng được gộp
        String nfd = java.text.Normalizer.normalize("Quần  jean", java.text.Normalizer.Form.NFD);
        assertEquals("quần jean", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa(nfd + "\u00A0"));
        assertEquals("ao thun", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("ao\u00A0\u00A0thun"));
        // K\u00FD t\u1EF1 kh\u00F4ng \u0111\u1ED9 r\u1ED9ng d\u00E1n theo t\u1EEB trang web; kho\u1EA3ng tr\u1EAFng to\u00E0n kh\u1ED5 v\u00E0 tab \u1EDF gi\u1EEFa
        assertEquals("qu\u1EA7n", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("\uFEFFqu\u200B\u1EA7n\u200D"));
        assertEquals("ao thun", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("ao\u3000\tthun"));
        // Ký tự không độ rộng nằm giữa chữ và dấu rời (NFD) vẫn được ghép lại
        assertEquals("váy xòe", TongQuanVaiTroServiceImpl.chuanHoaTuKhoa("va\u200B\u0301y xo\u0300e"));
    }
}
