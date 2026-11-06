package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.ThongTinCongTy;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.repository.ThongTinCongTyRepository;
import com.dev.backend.services.impl.entities.LichSuThayDoiService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phần dùng chung của mọi lần xuất Excel báo cáo:
 * - Đầu trang (tên đơn vị, địa chỉ, mã số thuế lấy từ hồ sơ cửa hàng; người lập; giờ lập).
 * - Chữ phạm vi kho theo bộ lọc và quyền người xem.
 * - Ghi nhật ký mỗi lần tải tệp (ai, báo cáo nào, bộ lọc gì) vào lich_su_thay_doi.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class XuatBaoCaoService {

    /** Tệp đã dựng: nội dung và tên tệp (không dấu). */
    public record TepExcel(byte[] noiDung, String tenTep) {

        public ResponseEntity<byte[]> phanHoi() {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(tenTep).build().toString())
                    .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    .body(noiDung);
        }
    }

    /** loai_tham_chieu của dòng nhật ký xuất báo cáo (không phải tên bảng). */
    static final String THAM_CHIEU_BAO_CAO = "bao_cao";
    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final int HO_SO_CONG_TY = 1;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final ThongTinCongTyRepository thongTinCongTyRepository;
    private final KhoRepository khoRepository;
    private final NguoiDungRepository nguoiDungRepository;
    private final LichSuThayDoiService lichSuThayDoiService;

    /** Thông tin đầu trang với phạm vi đã viết thành chữ. */
    public KhuonExcelBaoCao.ThongTin thongTin(String phamVi) {
        ThongTinCongTy ct = thongTinCongTyRepository.findById(HO_SO_CONG_TY).orElse(null);
        NguoiDungAuthInfo user = SecurityContextHolder.getUser();
        return new KhuonExcelBaoCao.ThongTin(
                ct == null ? null : (ct.getTenCongTy() != null && !ct.getTenCongTy().isBlank() ? ct.getTenCongTy() : ct.getTenDangKyKinhDoanh()),
                ct == null ? null : ct.getDiaChi(),
                ct == null ? null : ct.getMaSoThue(),
                phamVi,
                user == null ? null : (user.getHoTen() != null && !user.getHoTen().isBlank() ? user.getHoTen() : user.getTenDangNhap()),
                LocalDateTime.now(VN));
    }

    /** Tên một kho (không thấy thì "Kho #id"); null = "Tất cả kho". */
    public String tenKho(Integer khoId) {
        if (khoId == null) return "Tất cả kho";
        return khoRepository.findById(khoId).map(Kho::getTenKho).orElse("Kho #" + khoId);
    }

    /** Phạm vi theo quyền xem cửa hàng (báo cáo doanh thu, sản phẩm): một kho, mọi kho, hoặc các cửa hàng phụ trách. */
    String phamViKho(Integer khoId, DoanhThuReportService.PhamVi pv) {
        if (khoId != null || pv.tatCaKho()) return tenKho(khoId);
        List<String> ten = khoRepository.findAllById(pv.khoIds()).stream().map(Kho::getTenKho).toList();
        return ten.isEmpty() ? "Không có cửa hàng phụ trách" : "Các cửa hàng phụ trách: " + String.join(", ", ten);
    }

    /**
     * Ghi một dòng nhật ký "xuất báo cáo". Lỗi ghi nhật ký không chặn việc tải tệp (chỉ ghi cảnh báo vào log máy chủ):
     * người dùng đã được kiểm quyền trước khi tới đây.
     * boLoc: các bộ lọc đang chọn (giá trị null bị bỏ).
     */
    public void ghiNhatKy(String tenBaoCao, String tenTep, Map<String, Object> boLoc) {
        try {
            NguoiDungAuthInfo user = SecurityContextHolder.getUser();
            Map<String, Object> loc = new LinkedHashMap<>();
            if (boLoc != null) boLoc.forEach((k, v) -> { if (v != null && !"".equals(v)) loc.put(k, v); });
            Map<String, Object> moi = new LinkedHashMap<>();
            moi.put("baoCao", tenBaoCao);
            moi.put("tenTep", tenTep);
            moi.put("boLoc", loc);
            lichSuThayDoiService.createGiaoDichRieng(LichSuThayDoi.builder()
                    .loaiThamChieu(THAM_CHIEU_BAO_CAO)
                    .hanhDong(IHanhDong.xuat_bao_cao)
                    .giaTriMoi(JSON.writeValueAsString(moi))
                    .nguoiThucHien(user == null || user.getId() == null ? null : nguoiDungRepository.getReferenceById(user.getId()))
                    .ngayThucHien(Instant.now())
                    .ghiChu(tenBaoCao)
                    .build());
        } catch (JsonProcessingException | RuntimeException e) {
            log.warn("Không ghi được nhật ký xuất báo cáo {}: {}", tenBaoCao, e.getMessage());
        }
    }
}
