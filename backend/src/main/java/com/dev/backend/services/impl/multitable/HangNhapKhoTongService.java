package com.dev.backend.services.impl.multitable;

import com.dev.backend.dto.response.HangNhapKhoTongResponse;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.BienThe;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.KhoTong;
import com.dev.backend.dto.response.HangNhapKhoTongResponse.YeuCauMo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.HangNhapKhoTongRepository;
import com.dev.backend.repository.HangNhapKhoTongRepository.HangDong;
import com.dev.backend.repository.TongQuanAdminRepository;
import com.dev.backend.repository.TongQuanVaiTroRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.HE_SO_DU_MAC_DINH;
import static com.dev.backend.services.impl.multitable.TongQuanAdminServiceImpl.NGUONG_TON_MAC_DINH;

/**
 * Hàng nhập về Kho tổng cho màn Tạo yêu cầu nhập hàng: mọi biến thể nhập được kèm khả dụng, đang về, số đề xuất,
 * cờ còn dư và yêu cầu nhập đang mở. Quy tắc dùng chung với mục Cần mua ở Tổng quan (TongQuanVaiTroServiceImpl):
 * - đang về: phần chưa nhận của đơn mua đã chốt về Kho tổng (TongQuanVaiTroRepository.dangVeTheoBienThe);
 * - đề xuất: chỉ mã đã từng nhập về Kho tổng mà khả dụng + đang về không quá ngưỡng, đưa lên gấp đôi ngưỡng
 *   (TongQuanAdminServiceImpl.soLuongDeXuat);
 * - còn dư: khả dụng + đang về vượt ngưỡng × hệ số dư (cùng hệ số SURPLUS_STOCK_RATIO với phân loại "Dư" ở Tổng quan,
 *   nhưng CỐ Ý cộng cả đang về và xét cả mã chưa từng nhập: màn này cảnh báo mua thừa, Tổng quan chỉ xét tồn đang có);
 * - yêu cầu đang mở: Nháp, Chờ duyệt, Đã duyệt, Đã gửi yêu cầu báo giá (TongQuanVaiTroRepository.yeuCauMoTheoBienThe).
 */
@Service
public class HangNhapKhoTongService {

    private static final Logger log = LoggerFactory.getLogger(HangNhapKhoTongService.class);

    private final HangNhapKhoTongRepository repo;
    private final TongQuanVaiTroRepository vaiTro;
    private final TongQuanAdminRepository admin;

    public HangNhapKhoTongService(HangNhapKhoTongRepository repo, TongQuanVaiTroRepository vaiTro,
                                  TongQuanAdminRepository admin) {
        this.repo = repo;
        this.vaiTro = vaiTro;
        this.admin = admin;
    }

    /**
     * @param khoId Kho tổng cần xem; null thì lấy Kho tổng đầu tiên. Không phải Kho tổng đang hoạt động thì báo lỗi.
     */
    @Transactional(readOnly = true)
    public HangNhapKhoTongResponse hangKhoTong(Integer khoId) {
        List<KhoTong> dsKhoTong = repo.khoTongHoatDong();
        int nguong = cauHinh("DEFAULT_MIN_STOCK_ALERT", NGUONG_TON_MAC_DINH);
        int heSoDu = cauHinh("SURPLUS_STOCK_RATIO", HE_SO_DU_MAC_DINH);
        if (dsKhoTong.isEmpty()) {
            if (khoId != null) throw new CommonException("Chưa có Kho tổng đang hoạt động để nhận hàng từ nhà cung cấp");
            return new HangNhapKhoTongResponse(null, List.of(), nguong, heSoDu, List.of());
        }
        KhoTong kho = khoId == null
                ? dsKhoTong.get(0)
                : dsKhoTong.stream().filter(k -> khoId.equals(k.id())).findFirst().orElseThrow(() -> new CommonException(
                        "Kho nhận phải là Kho tổng đang hoạt động: chỉ Kho tổng nhận hàng từ nhà cung cấp"));

        List<HangDong> hang = repo.hangKhoTong(kho.id(), nguong);
        List<Integer> ids = hang.stream().map(HangDong::bienTheId).toList();
        Map<Integer, Long> dangVe = vaiTro.dangVeTheoBienThe(kho.id(), ids);
        Map<Integer, TongQuanVaiTroRepository.YeuCauMo> yeuCau = vaiTro.yeuCauMoTheoBienThe(ids);

        List<BienThe> bienThe = hang.stream().map(h -> {
            long dv = dangVe.getOrDefault(h.bienTheId(), 0L);
            TongQuanVaiTroRepository.YeuCauMo yc = yeuCau.get(h.bienTheId());
            return new BienThe(h.bienTheId(), h.maSku(), h.maVach(), h.sanPhamId(), h.maSanPham(), h.tenSanPham(),
                    h.nhomHang(), h.tenMau(), h.maMauHex(), h.tenSize(), h.tenChatLieu(), h.anh(), h.khaDung(), dv,
                    h.nguong(), h.daTungNhap(), soLuongDeXuat(h.daTungNhap(), h.khaDung(), dv, h.nguong()),
                    conDu(h.khaDung(), dv, h.nguong(), heSoDu),
                    yc == null ? null : new YeuCauMo(yc.id(), yc.ma(), yc.soYeuCau()));
        }).toList();
        return new HangNhapKhoTongResponse(kho, dsKhoTong, nguong, heSoDu, bienThe);
    }

    /** Số đề xuất nhập (0 = không cần): như mục Cần mua ở Tổng quan, mã chưa từng nhập về Kho tổng thì không đề xuất. */
    static long soLuongDeXuat(boolean daTungNhap, long khaDung, long dangVe, int nguong) {
        if (!daTungNhap || khaDung + dangVe > nguong) return 0;
        return TongQuanAdminServiceImpl.soLuongDeXuat(khaDung + dangVe, nguong);
    }

    /** Kho tổng còn dư mã này: khả dụng + đang về vượt ngưỡng × hệ số dư. */
    static boolean conDu(long khaDung, long dangVe, int nguong, int heSoDu) {
        return khaDung + dangVe > (long) nguong * heSoDu;
    }

    private int cauHinh(String ma, int macDinh) {
        try {
            Integer v = admin.cauHinhSo(ma);
            return v != null && v > 0 ? v : macDinh;
        } catch (RuntimeException e) {
            log.warn("Hàng nhập Kho tổng: không đọc được cấu hình {}, dùng {}", ma, macDinh, e);
            return macDinh;
        }
    }
}
