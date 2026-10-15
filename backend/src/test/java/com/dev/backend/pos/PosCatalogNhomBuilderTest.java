package com.dev.backend.pos;

import com.dev.backend.dto.PosCatalogBienTheDto;
import com.dev.backend.dto.PosCatalogNhomDto;
import com.dev.backend.services.impl.entities.PosCatalogNhomBuilder;
import com.dev.backend.services.impl.entities.PosCatalogNhomBuilder.KetQua;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Gộp danh mục POS theo mẫu + màu + chất liệu (PosCatalogNhomBuilder) — logic thuần, không cần CSDL.
 */
class PosCatalogNhomBuilderTest {

    /** Áo khoác (sp 59) màu Đen (ms 1), chất liệu 5: S/M/L/XL. */
    private static final List<PosCatalogBienTheDto> AO_KHOAC = List.of(
            bt(101, 59, "Áo Khoác Lông Cừu", 1, "Đen", 5, "S", 1, "120000", "50"),
            bt(102, 59, "Áo Khoác Lông Cừu", 1, "Đen", 5, "M", 2, "120000", "90"),
            bt(103, 59, "Áo Khoác Lông Cừu", 1, "Đen", 5, "L", 3, "120000", "49"),
            bt(104, 59, "Áo Khoác Lông Cừu", 1, "Đen", 5, "XL", 4, "120000", "50"));

    /** Áo thun (sp 60): màu Trắng (ms 2) còn hàng một phần, màu Đen (ms 1) hết sạch. */
    private static final List<PosCatalogBienTheDto> AO_THUN = List.of(
            bt(201, 60, "Áo Thun Basic", 2, "Trắng", 7, "S", 1, "150000", "12"),
            bt(202, 60, "Áo Thun Basic", 2, "Trắng", 7, "M", 2, "150000", "0"),
            bt(203, 60, "Áo Thun Basic", 1, "Đen", 7, "S", 1, "150000", "0"),
            bt(204, 60, "Áo Thun Basic", 1, "Đen", 7, "M", 2, "150000", "-2"));

    private static List<PosCatalogBienTheDto> tatCa() {
        List<PosCatalogBienTheDto> ds = new ArrayList<>(AO_KHOAC);
        ds.addAll(AO_THUN);
        return ds;
    }

    @Test
    @DisplayName("Không tìm kiếm: mỗi mẫu + màu một nhóm, đúng thứ tự xuất hiện, đủ kích cỡ")
    void gopTheoMauVaMau() {
        KetQua kq = PosCatalogNhomBuilder.xayDung(tatCa(), tatCa(), "tat_ca", 0, 60);

        assertEquals(3, kq.tongSoNhom());
        assertEquals(List.of("59-1-5", "60-2-7", "60-1-7"), kq.trang().stream().map(PosCatalogNhomDto::getKhoaNhom).toList());

        PosCatalogNhomDto aoKhoac = kq.trang().get(0);
        assertEquals("Áo Khoác Lông Cừu", aoKhoac.getTenSanPham());
        assertEquals("Đen", aoKhoac.getTenMau());
        assertEquals(1, aoKhoac.getMauSacId());
        assertEquals(5, aoKhoac.getChatLieuId());
        assertEquals("Chất liệu 5", aoKhoac.getTenChatLieu());
        assertEquals(10, aoKhoac.getDanhMucId());
        assertEquals(List.of("S", "M", "L", "XL"), aoKhoac.getBienThes().stream().map(PosCatalogBienTheDto::getTenSize).toList());
        assertEquals(new BigDecimal("239"), aoKhoac.getTongTonKhaDung());
    }

    @Test
    @DisplayName("Kích cỡ xếp theo thứ tự kích cỡ, kích cỡ chưa có thứ tự xuống cuối")
    void sapXepKichCo() {
        List<PosCatalogBienTheDto> ds = List.of(
                bt(3, 1, "Quần Jean", 4, "Xanh", 2, "32", null, "390000", "1"),
                bt(2, 1, "Quần Jean", 4, "Xanh", 2, "30", 12, "390000", "1"),
                bt(1, 1, "Quần Jean", 4, "Xanh", 2, "28", 10, "390000", "1"),
                bt(4, 1, "Quần Jean", 4, "Xanh", 2, "29", 11, "390000", "1"));

        PosCatalogNhomDto nhom = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 0, 10).trang().get(0);

        assertEquals(List.of("28", "29", "30", "32"), nhom.getBienThes().stream().map(PosCatalogBienTheDto::getTenSize).toList());
    }

    @Test
    @DisplayName("Còn hàng: giữ nhóm còn ít nhất một kích cỡ, kích cỡ đã hết vẫn nằm trong nhóm")
    void locConHang() {
        KetQua kq = PosCatalogNhomBuilder.xayDung(tatCa(), tatCa(), "con_hang", 0, 60);

        assertEquals(List.of("59-1-5", "60-2-7"), kq.trang().stream().map(PosCatalogNhomDto::getKhoaNhom).toList());
        assertEquals(2, kq.tongSoNhom());
        PosCatalogNhomDto trang = kq.trang().get(1);
        assertEquals(2, trang.getBienThes().size(), "kích cỡ M đã hết vẫn được trả về để màn POS làm mờ");
        assertEquals(new BigDecimal("12"), trang.getTongTonKhaDung());
    }

    @Test
    @DisplayName("Hết hàng: chỉ nhóm mà mọi kích cỡ đều <= 0; tồn âm và null tính là hết")
    void locHetHang() {
        List<PosCatalogBienTheDto> ds = new ArrayList<>(tatCa());
        ds.add(bt(301, 61, "Hoodie", 3, "Xám", 7, "M", 2, "320000", null));

        KetQua kq = PosCatalogNhomBuilder.xayDung(ds, ds, "het_hang", 0, 60);

        assertEquals(List.of("60-1-7", "61-3-7"), kq.trang().stream().map(PosCatalogNhomDto::getKhoaNhom).toList());
        assertEquals(BigDecimal.ZERO, kq.trang().get(0).getTongTonKhaDung(), "tồn âm không cộng vào tổng");
    }

    @Test
    @DisplayName("Tìm theo mã SKU một kích cỡ: nhóm vẫn hiện đủ các kích cỡ của mẫu + màu đó")
    void timTheoSkuHienDuKichCo() {
        List<PosCatalogBienTheDto> khop = List.of(AO_KHOAC.get(2)); // chỉ khớp size L

        KetQua kq = PosCatalogNhomBuilder.xayDung(khop, tatCa(), "tat_ca", 0, 60);

        assertEquals(1, kq.tongSoNhom(), "chỉ nhóm có SKU khớp mới hiện, áo thun không hiện");
        assertEquals(List.of(101, 102, 103, 104),
                kq.trang().get(0).getBienThes().stream().map(PosCatalogBienTheDto::getBienTheSanPhamId).toList());
    }

    @Test
    @DisplayName("Danh sách đầy đủ thiếu nhóm (dữ liệu vừa đổi): dùng phần SKU đã khớp")
    void duPhongKhiThieuDanhSachDayDu() {
        List<PosCatalogBienTheDto> khop = List.of(AO_THUN.get(0));

        KetQua kq = PosCatalogNhomBuilder.xayDung(khop, List.of(), "tat_ca", 0, 60);

        assertEquals(1, kq.tongSoNhom());
        assertEquals(List.of(201), kq.trang().get(0).getBienThes().stream().map(PosCatalogBienTheDto::getBienTheSanPhamId).toList());
    }

    @Test
    @DisplayName("Cùng mẫu + màu nhưng khác chất liệu là hai nhóm; trùng tên màu nhưng khác id màu cũng tách")
    void khoaNhomTheoId() {
        List<PosCatalogBienTheDto> ds = List.of(
                bt(1, 5, "Sơ Mi", 1, "Đen", 7, "M", 2, "200000", "3"),
                bt(2, 5, "Sơ Mi", 1, "Đen", 8, "M", 2, "210000", "3"),
                bt(3, 5, "Sơ Mi", 9, "Đen", 7, "M", 2, "200000", "3"));

        KetQua kq = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 0, 60);

        assertEquals(List.of("5-1-7", "5-1-8", "5-9-7"), kq.trang().stream().map(PosCatalogNhomDto::getKhoaNhom).toList());
    }

    @Test
    @DisplayName("Giá theo từng biến thể: nhóm trả giá thấp nhất và cao nhất, bỏ qua giá null")
    void khoangGia() {
        List<PosCatalogBienTheDto> ds = List.of(
                bt(1, 7, "Quần Jean", 4, "Xanh", 2, "28", 10, "390000", "6"),
                bt(2, 7, "Quần Jean", 4, "Xanh", 2, "32", 14, "410000", "3"),
                bt(3, 7, "Quần Jean", 4, "Xanh", 2, "34", 15, null, "1"));

        PosCatalogNhomDto nhom = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 0, 10).trang().get(0);

        assertEquals(new BigDecimal("390000"), nhom.getGiaThapNhat());
        assertEquals(new BigDecimal("410000"), nhom.getGiaCaoNhat());
        assertEquals(new BigDecimal("10"), nhom.getTongTonKhaDung());
    }

    @Test
    @DisplayName("Nhóm không có giá nào: giá thấp/cao nhất = 0")
    void khongCoGia() {
        List<PosCatalogBienTheDto> ds = List.of(bt(1, 7, "Mẫu", 4, "Xanh", 2, "M", 2, null, "1"));

        PosCatalogNhomDto nhom = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 0, 10).trang().get(0);

        assertEquals(BigDecimal.ZERO, nhom.getGiaThapNhat());
        assertEquals(BigDecimal.ZERO, nhom.getGiaCaoNhat());
        assertNull(nhom.getAnhUrl(), "ảnh do service gắn sau");
    }

    @Test
    @DisplayName("Phân trang theo nhóm: đúng lát cắt, tổng số nhóm; trang vượt cuối trả rỗng")
    void phanTrangTheoNhom() {
        List<PosCatalogBienTheDto> ds = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            ds.add(bt(i * 10, i, "Mẫu " + i, 1, "Đen", 1, "S", 1, "100000", "1"));
            ds.add(bt(i * 10 + 1, i, "Mẫu " + i, 1, "Đen", 1, "M", 2, "100000", "1"));
        }

        KetQua trang1 = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 1, 3);
        KetQua trangCuoi = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 2, 3);
        KetQua vuotCuoi = PosCatalogNhomBuilder.xayDung(ds, ds, "tat_ca", 5, 3);

        assertEquals(7, trang1.tongSoNhom());
        assertEquals(List.of(4, 5, 6), trang1.trang().stream().map(PosCatalogNhomDto::getSanPhamId).toList());
        assertEquals(List.of(7), trangCuoi.trang().stream().map(PosCatalogNhomDto::getSanPhamId).toList());
        assertTrue(vuotCuoi.trang().isEmpty());
        assertEquals(7, vuotCuoi.tongSoNhom());
    }

    @Test
    @DisplayName("Trang âm và cỡ trang < 1 được đưa về giá trị an toàn")
    void thamSoPhanTrangKhongHopLe() {
        KetQua kq = PosCatalogNhomBuilder.xayDung(tatCa(), tatCa(), "tat_ca", -3, 0);

        assertEquals(1, kq.trang().size());
        assertEquals("59-1-5", kq.trang().get(0).getKhoaNhom());
        assertEquals(3, kq.tongSoNhom());
    }

    @Test
    @DisplayName("SKU trùng id trong dữ liệu vào chỉ tính một lần; danh sách rỗng hoặc null không lỗi")
    void trungIdVaRong() {
        List<PosCatalogBienTheDto> trung = new ArrayList<>(AO_KHOAC);
        trung.add(AO_KHOAC.get(0));

        KetQua kq = PosCatalogNhomBuilder.xayDung(trung, trung, "tat_ca", 0, 10);
        KetQua rong = PosCatalogNhomBuilder.xayDung(List.of(), List.of(), "con_hang", 0, 10);
        KetQua nullVao = PosCatalogNhomBuilder.xayDung(null, null, "tat_ca", 0, 10);

        assertEquals(4, kq.trang().get(0).getBienThes().size());
        assertEquals(0, rong.tongSoNhom());
        assertTrue(rong.trang().isEmpty());
        assertEquals(0, nullVao.tongSoNhom());
    }

    private static PosCatalogBienTheDto bt(int id, int sanPhamId, String tenSanPham,
                                           int mauSacId, String tenMau, int chatLieuId,
                                           String tenSize, Integer thuTuSize, String giaBan, String ton) {
        return new PosCatalogBienTheDto(
                id, sanPhamId, tenSanPham, "SKU-" + id, null,
                mauSacId, tenMau, "#000000", tenSize, thuTuSize,
                chatLieuId, "Chất liệu " + chatLieuId,
                giaBan == null ? null : new BigDecimal(giaBan),
                ton == null ? null : new BigDecimal(ton),
                10, "Áo");
    }
}
