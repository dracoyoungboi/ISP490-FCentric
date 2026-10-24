package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.response.customize.CauHinhTemDto;
import com.dev.backend.dto.response.customize.DongInTemDto;
import com.dev.backend.entities.BienTheSanPham;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.GiaBanBienTheRepository;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.utils.HienThiBienThe;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

import static com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl.*;

/**
 * Dữ liệu cho hộp "In tem sản phẩm": cấu hình tem, dòng in tem của các biến thể (tên, màu, kích cỡ, mã vạch, giá, tồn)
 * và tra một mã quét. Dùng được cho cả nhân viên kho (in tem theo phiếu nhập), nên không trả giá vốn.
 */
@Service
public class TemSanPhamService {

    @Autowired
    private GiaBanBienTheRepository giaBanRepository;
    @Autowired
    private GiaBanBienTheService giaBanBienTheService;
    @Autowired
    private DieuHanhHeThongService dieuHanhHeThongService;
    @Autowired
    private ThongTinCongTyService thongTinCongTyService;

    /** Cấu hình tem đang dùng; giá trị thiếu hoặc bị sửa tay sai thì dùng mặc định thay vì lỗi. */
    @Transactional(readOnly = true)
    public CauHinhTemDto cauHinh() {
        String kho = dieuHanhHeThongService.getCauHinhString(CAU_HINH_TEM_KHO_MAC_DINH, TEM_KHO_MAC_DINH);
        int nguong = dieuHanhHeThongService.getCauHinhInt(CAU_HINH_TEM_NGUONG_XAC_NHAN, TEM_NGUONG_XAC_NHAN_MAC_DINH);
        String tenCuaHang = thongTinCongTyService.getProfile().getName();
        return CauHinhTemDto.builder()
                .kho(kho != null && TEM_KHO_HOP_LE.contains(kho.trim()) ? kho.trim() : TEM_KHO_MAC_DINH)
                .inTenCuaHang(dieuHanhHeThongService.getCauHinhBoolean(CAU_HINH_TEM_IN_TEN_CUA_HANG, false))
                .inSku(dieuHanhHeThongService.getCauHinhBoolean(CAU_HINH_TEM_IN_SKU, false))
                .nguongXacNhan(nguong >= 1 && nguong <= TEM_NGUONG_XAC_NHAN_TOI_DA ? nguong : TEM_NGUONG_XAC_NHAN_MAC_DINH)
                .tenCuaHang(tenCuaHang == null || tenCuaHang.isBlank() ? null : tenCuaHang.trim())
                .build();
    }

    /** Quét mã ở hộp In tem: khớp đúng mã vạch hoặc SKU; không có thì null. */
    @Transactional(readOnly = true)
    public DongInTemDto traMa(String ma) {
        String gon = ma == null ? "" : ma.trim();
        if (gon.isEmpty()) {
            throw new CommonException("Nhập mã vạch hoặc SKU cần tìm");
        }
        List<BienTheSanPham> ds = giaBanRepository.timTheoMa(gon);
        return ds.isEmpty() ? null : dungDong(List.of(ds.get(0)), Map.of()).get(0);
    }

    /**
     * Dòng in tem của các biến thể theo đúng thứ tự {@code ids} (id không còn tồn tại thì bỏ qua).
     * {@code soLuong}: số tem theo phiếu nhập của từng biến thể (có thể rỗng).
     */
    @Transactional(readOnly = true)
    public List<DongInTemDto> dongTheoIds(List<Integer> ids, Map<Integer, Integer> soLuong) {
        if (ids == null || ids.isEmpty()) return List.of();
        Map<Integer, BienTheSanPham> theoId = new HashMap<>();
        for (BienTheSanPham bt : giaBanRepository.bienTheInTem(ids)) {
            theoId.put(bt.getId(), bt);
        }
        List<BienTheSanPham> theoThuTu = ids.stream().distinct().map(theoId::get).filter(Objects::nonNull).toList();
        return dungDong(theoThuTu, soLuong);
    }

    private List<DongInTemDto> dungDong(List<BienTheSanPham> ds, Map<Integer, Integer> soLuong) {
        Map<Integer, BigDecimal> ton = giaBanBienTheService.tonKho(ds.stream().map(BienTheSanPham::getId).toList());
        return ds.stream().map(bt -> DongInTemDto.builder()
                .bienTheId(bt.getId())
                .sanPhamId(HienThiBienThe.sanPhamId(bt))
                .tenSanPham(HienThiBienThe.tenSanPham(bt))
                .maSku(bt.getMaSku())
                .maVachSku(bt.getMaVachSku())
                .tenMau(HienThiBienThe.tenMau(bt))
                .maMauHex(HienThiBienThe.maMauHex(bt))
                .kichCo(HienThiBienThe.kichCo(bt))
                .trangThai(bt.getTrangThai())
                .giaBan(bt.getGiaBan())
                .tonKho(ton.getOrDefault(bt.getId(), BigDecimal.ZERO))
                .soLuong(soLuong.get(bt.getId()))
                .build()).toList();
    }
}
