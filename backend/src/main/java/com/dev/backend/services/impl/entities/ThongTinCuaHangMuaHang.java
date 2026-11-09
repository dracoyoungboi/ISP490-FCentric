package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.congncc.CuaHangCongDto;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.utils.PublicAssetUrl;
import com.dev.backend.utils.ThongTinCuaHangBatBuoc;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Thông tin cửa hàng mà luồng mua hàng cần, đọc thẳng bảng thong_tin_cong_ty (không qua ThongTinCongTyService,
 * vốn trả giá trị mặc định khi chưa nhập).
 * - Chặn gửi yêu cầu báo giá khi thiếu Tên đăng ký kinh doanh / Địa chỉ đăng ký: chân email gửi nhà cung cấp phải
 *   có hai thông tin này, đúng giấy chứng nhận (không lấy tên cửa hàng thay).
 * - Tên và logo cửa hàng cho cổng nhà cung cấp (có thể null).
 */
@Component
public class ThongTinCuaHangMuaHang {

    /** Bảng một dòng duy nhất, id luôn = 1. */
    static final int ID_HO_SO = 1;

    @Autowired
    private ThongTinCongTyRepository thongTinCongTyRepository;

    /** Các ô còn thiếu để gửi được email cho nhà cung cấp, theo thứ tự trên giao diện; rỗng = đủ (ThongTinCuaHangBatBuoc). */
    @Transactional(readOnly = true)
    public List<String> oThieuDeGuiNhaCungCap() {
        Optional<ThongTinCongTy> hoSo = thongTinCongTyRepository.findById(ID_HO_SO);
        return ThongTinCuaHangBatBuoc.thieuDeGuiNhaCungCap(
                hoSo.map(ThongTinCongTy::getTenDangKyKinhDoanh).orElse(null),
                hoSo.map(ThongTinCongTy::getDiaChi).orElse(null));
    }

    /** 409 THIEU_THONG_TIN_CUA_HANG kèm data.thieu (chỉ các ô thiếu) khi chưa đủ thông tin. */
    public void kiemDuDeGuiNhaCungCap() {
        List<String> thieu = oThieuDeGuiNhaCungCap();
        if (!thieu.isEmpty()) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.THIEU_THONG_TIN_CUA_HANG,
                    cauThieu(thieu),
                    Map.of("thieu", List.copyOf(thieu)));
        }
    }

    /** "Thông tin cửa hàng còn thiếu A và B. ..." — tên ô dịch được; nối bằng " và " như câu cũ. */
    private static ThongDiep cauThieu(List<String> thieu) {
        List<Object> ten = thieu.stream().map(ThongTinCuaHangMuaHang::tenO).toList();
        if (ten.size() == 1) return ThongDiep.of("sanPhamMuaHang.cuaHangThieuMotO", ten.get(0));
        if (ten.size() == 2) return ThongDiep.of("sanPhamMuaHang.cuaHangThieuHaiO", ten.get(0), ten.get(1));
        return ThongDiep.of("sanPhamMuaHang.cuaHangThieuMotO", String.join(" và ", thieu));
    }

    private static Object tenO(String o) {
        if (ThongTinCuaHangBatBuoc.TEN_DANG_KY.equals(o)) return ThongDiep.of("sanPhamMuaHang.oTenDangKyKinhDoanh");
        if (ThongTinCuaHangBatBuoc.DIA_CHI_DANG_KY.equals(o)) return ThongDiep.of("sanPhamMuaHang.oDiaChiDangKy");
        return o;
    }

    /** Tên cửa hàng và logo (https) cho cổng nhà cung cấp. Chưa có hồ sơ: cả hai null, không dùng tên phần mềm. */
    @Transactional(readOnly = true)
    public CuaHangCongDto choCongNhaCungCap() {
        return thongTinCongTyRepository.findById(ID_HO_SO)
                .map(hs -> CuaHangCongDto.builder()
                        .ten(blankToNull(hs.getTenCongTy()))
                        .logoUrl(logo(hs))
                        .build())
                .orElseGet(() -> CuaHangCongDto.builder().build());
    }

    private static String logo(ThongTinCongTy hs) {
        String duongDan = hs.getTepTin() != null && hs.getTepTin().getDuongDan() != null
                ? hs.getTepTin().getDuongDan()
                : hs.getLogoDuongDan();
        return blankToNull(PublicAssetUrl.toHttps(blankToNull(duongDan)));
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
