package com.dev.backend.services.impl.multitable;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.KieuDuLieuCauHinh;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.dto.request.ChiTietQuyenKhoCreating;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.CauHinhHeThongDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.CauHinhHeThongMapper;
import com.dev.backend.mapper.ChiTietQuyenKhoMapper;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.repository.CauHinhHeThongRepository;
import com.dev.backend.repository.NguoiDungRepository;
import com.dev.backend.services.impl.entities.*;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@Slf4j
public class DieuHanhHeThongServiceImpl implements DieuHanhHeThongService {

    @Autowired
    private KhoService khoService;
    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private QuyenHanService quyenHanService;
    @Autowired
    private PhanQuyenNguoiDungKhoService phanQuyenNguoiDungKhoService;
    @Autowired
    private ChiTietQuyenKhoService chiTietQuyenKhoService;

    @Autowired
    private LichSuThayDoiService lichSuThayDoiService;

    @Autowired
    private NguoiDungMapper nguoiDungMapper;
    @Autowired
    private ChiTietQuyenKhoMapper chiTietQuyenKhoMapper;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private CauHinhHeThongRepository cauHinhRepository;

    @Autowired
    private NguoiDungRepository nguoiDungRepository;

    @Autowired
    private CauHinhHeThongMapper cauHinhMapper;

    @Override
    @Transactional
    public ResponseEntity<ResponseData<String>> ganQuyenNhanVienKho(PhanQuyenNguoiDungKhoCreating pqndkCreating) {

        // lấy thông tin người dùng
        NguoiDungAuthInfo contextUser = SecurityContextHolder.getUser();

        // từ contextUser lấy ra ID của user của ADMIN
        Optional<NguoiDung> findingCurrentUser = nguoiDungService.getOne(contextUser.getId());

        if (findingCurrentUser.isEmpty()) {
            throw new CommonException("Context không được khởi tạo hoặc đã bị xoá");
        }

        // lấy ra id user cần gán quyền
        Optional<NguoiDung> findingNguoiDung = nguoiDungService.getOne(pqndkCreating.getNguoiDungId());
        if (findingNguoiDung.isEmpty()) {
            throw new CommonException("Không tìm thấy người dùng id: " + pqndkCreating.getNguoiDungId());
        }

        //lấy thông tin người dùng mà admin đang sửa(tk đang bị sửa)
        NguoiDung nguoiDung = findingNguoiDung.get();

        //truyền giá trị cũ của người dùng dưới dạng JSON
        //(trước khi sửa là giá trị nào thì lưu nó dưới dạng JSON) lưu trong bảng lịch sử thay đổi
        String giaTriCuJson;

        //viết giá trị cũ chưa thay đổi của người dùng dưới dạng JSON
        try {
            giaTriCuJson = objectMapper.writeValueAsString(nguoiDungMapper.toDto(nguoiDung));
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            giaTriCuJson = "error when parse";
        }

        // lấy id kho. Xem admin đang muốn gán kho nào
        Optional<Kho> findingKho = khoService.getOne(pqndkCreating.getKhoId());
        if (findingKho.isEmpty()) {
            throw new CommonException("Không tìm thấy kho id: " + pqndkCreating.getKhoId());
        }

        // Quy định nghiệp vụ: mỗi người dùng chỉ được có TỐI ĐA 1 phân quyền kho đang hoạt động.
        // Chỉ cho phép khi toàn bộ phân quyền đang hoạt động hiện có đều thuộc đúng kho đang gán.
        // Tính cả phân quyền hẹn ngày bắt đầu ở tương lai, để tới ngày không thành hai kho
        List<PhanQuyenNguoiDungKho> activeAssignments = phanQuyenNguoiDungKhoService
                .findGiuChoByNguoiDungId(pqndkCreating.getNguoiDungId());
        if (activeAssignments != null && !activeAssignments.isEmpty()) {
            boolean allSameKho = activeAssignments.stream()
                    .allMatch(pq -> pq.getKho() != null
                            && Objects.equals(pq.getKho().getId(), pqndkCreating.getKhoId()));
            if (!allSameKho) {
                throw new CommonException(
                        "Người dùng đang có phân quyền kho đang hoạt động tại kho khác. "
                                + "Hãy xóa phân quyền kho hiện tại trước khi phân kho mới.");
            }
        }

        //kiểm tra xem user đã được gán với kho này hay chưa
        boolean firstTimeInWorkSpace = true;
        PhanQuyenNguoiDungKho phanQuyenNguoiDungKho = new PhanQuyenNguoiDungKho();

        // Kiểm tra xem nhân viên đã nằm trong kho này chưa
        Optional<PhanQuyenNguoiDungKho> findingPQNDK = phanQuyenNguoiDungKhoService
                .findByNguoiDungIdAndKhoId(pqndkCreating.getNguoiDungId(), pqndkCreating.getKhoId());

        //nếu tìm được phân quyền người dùng kho thì chuyển thành FALSE
        if (findingPQNDK.isPresent()) {
            phanQuyenNguoiDungKho = findingPQNDK.get();
            firstTimeInWorkSpace = false;
        }

        // Cập nhật các thông tin cơ bản về vai trò trong kho
        phanQuyenNguoiDungKho.setLaQuanLyKho(pqndkCreating.getLaQuanLyKho());
        // 0: không hoạt động 1: hoạt động
        phanQuyenNguoiDungKho.setTrangThai(1);
        phanQuyenNguoiDungKho.setNgayBatDau(pqndkCreating.getNgayBatDau());
        phanQuyenNguoiDungKho.setNgayKetThuc(pqndkCreating.getNgayKetThuc());
        phanQuyenNguoiDungKho.setNguoiCapQuyen(findingCurrentUser.get());
        phanQuyenNguoiDungKho.setGhiChu(pqndkCreating.getGhiChu());

        // Nếu lần đầu vào kho: thêm User vào phân quyền người dùng vào kho rồi tạo mới
        if (firstTimeInWorkSpace) {
            phanQuyenNguoiDungKho.setNguoiDung(findingNguoiDung.get());
            phanQuyenNguoiDungKho.setKho(findingKho.get());
            phanQuyenNguoiDungKho = phanQuyenNguoiDungKhoService.create(phanQuyenNguoiDungKho);
        } else {
            phanQuyenNguoiDungKhoService.update(phanQuyenNguoiDungKho.getId(), phanQuyenNguoiDungKho);
        }

        Instant now = Instant.now();
        // xử lý chi tiết từng quyền hạn
        for (ChiTietQuyenKhoCreating chiTietQuyenKhoCreating : pqndkCreating.getChiTietQuyenKhos()) {
            Optional<QuyenHan> findingQuyenHan = quyenHanService.getOne(chiTietQuyenKhoCreating.getQuyenHanId());
            if (findingQuyenHan.isEmpty()) {
                continue;
            }
            ChiTietQuyenKho chiTietQuyenKho = null;

            // Trường hợp nhân viên mới: Tạo mới tất cả các chi tiết quyền
            if (firstTimeInWorkSpace) {
                chiTietQuyenKho = new ChiTietQuyenKho();
                chiTietQuyenKho.setQuyenHan(findingQuyenHan.get());
                chiTietQuyenKho.setTrangThai(chiTietQuyenKhoCreating.getTrangThai());
                chiTietQuyenKho.setNgayCap(pqndkCreating.getNgayBatDau());
                chiTietQuyenKho.setPhanQuyenNguoiDungKho(phanQuyenNguoiDungKho);
                chiTietQuyenKhoService.create(chiTietQuyenKho);
            } else {
                // Trường hợp nhân viên cũ: Kiểm tra từng quyền cụ thể đã có chưa
                boolean firstTimeHasPermissionInWorkSpace = true;

                String gtCuJson = "";
                String gtMoiJson = "";

                Optional<ChiTietQuyenKho> findingChiTietQuyenKho = chiTietQuyenKhoService
                        .findByPhanQuyenNguoiDungKhoIdAndQuyenHanId(
                                phanQuyenNguoiDungKho.getId(),
                                chiTietQuyenKhoCreating.getQuyenHanId());
                if (findingChiTietQuyenKho.isPresent()) {
                    chiTietQuyenKho = findingChiTietQuyenKho.get();
                    firstTimeHasPermissionInWorkSpace = false;
                }
                // Quyền này mới hoàn toàn với nhân viên này: Create
                if (firstTimeHasPermissionInWorkSpace) {
                    chiTietQuyenKho = new ChiTietQuyenKho();
                    chiTietQuyenKho.setQuyenHan(findingQuyenHan.get());
                    chiTietQuyenKho.setTrangThai(chiTietQuyenKhoCreating.getTrangThai());
                    chiTietQuyenKho.setNgayCap(pqndkCreating.getNgayBatDau());
                    chiTietQuyenKho.setPhanQuyenNguoiDungKho(phanQuyenNguoiDungKho);
                    chiTietQuyenKho = chiTietQuyenKhoService.create(chiTietQuyenKho);
                } else {
                    // Quyền này đã từng có: Lưu lại JSON cũ và Update trạng thái mới
                    try {
                        gtCuJson = objectMapper.writeValueAsString(chiTietQuyenKhoMapper.toDto(chiTietQuyenKho));
                    } catch (JsonProcessingException e) {
                        e.printStackTrace();
                        gtCuJson = "error when parse";
                    }
                    chiTietQuyenKho.setTrangThai(chiTietQuyenKhoCreating.getTrangThai());
                    chiTietQuyenKho.setNgayCap(pqndkCreating.getNgayBatDau());
                    chiTietQuyenKho = chiTietQuyenKhoService.update(chiTietQuyenKho.getId(), chiTietQuyenKho);

                }
                //lưu giá trị mới vào giá trị cũ của quyền hạn
                try {
                    gtMoiJson = objectMapper.writeValueAsString(chiTietQuyenKhoMapper.toDto(chiTietQuyenKho));
                } catch (JsonProcessingException e) {
                    e.printStackTrace();
                    gtMoiJson = "error when parse";
                }
                // CẬP NHẬT THAY ĐỔI QUYỀN VÀO DB
                String hanhDong = firstTimeHasPermissionInWorkSpace ? IHanhDong.cap_quyen : IHanhDong.cap_nhat_quyen;
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.nguoi_dung)
                                .idThamChieu(nguoiDung.getId())
                                .kho(findingKho.get())
                                .hanhDong(hanhDong)
                                .giaTriCu(gtCuJson)
                                .giaTriMoi(gtMoiJson)
                                .nguoiThucHien(findingCurrentUser.get())
                                .ngayThucHien(now)
                                .ghiChu("Thực hiện " + hanhDong + " cho " + ITable.nguoi_dung + " id: " + nguoiDung.getId())
                                .build()
                );
            }

        }


        // Danh sách gửi lên là TẬP QUYỀN ĐẦY ĐỦ của kho này: quyền đang bật mà không có trong danh sách
        // thì thu hồi (trang_thai = 0) và ghi lịch sử. Trước đây popup bỏ tick nhưng quyền vẫn còn (lỗi B1).
        if (!firstTimeInWorkSpace && phanQuyenNguoiDungKho.getChiTietQuyenKhos() != null) {
            Set<Integer> idGuiLen = new HashSet<>();
            for (ChiTietQuyenKhoCreating ct : pqndkCreating.getChiTietQuyenKhos()) {
                idGuiLen.add(ct.getQuyenHanId());
            }
            for (ChiTietQuyenKho dangCo : new ArrayList<>(phanQuyenNguoiDungKho.getChiTietQuyenKhos())) {
                boolean conTrongDanhSach = idGuiLen.contains(dangCo.getQuyenHan().getId());
                if (conTrongDanhSach || !Integer.valueOf(1).equals(dangCo.getTrangThai())) {
                    continue;
                }
                String cu;
                String moi;
                try {
                    cu = objectMapper.writeValueAsString(chiTietQuyenKhoMapper.toDto(dangCo));
                } catch (JsonProcessingException e) {
                    cu = "error when parse";
                }
                dangCo.setTrangThai(0);
                dangCo = chiTietQuyenKhoService.update(dangCo.getId(), dangCo);
                try {
                    moi = objectMapper.writeValueAsString(
                            Map.of("quyenHanId", dangCo.getQuyenHan().getId(), "trangThai", 0));
                } catch (JsonProcessingException e) {
                    moi = "error when parse";
                }
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.nguoi_dung)
                                .idThamChieu(nguoiDung.getId())
                                .kho(findingKho.get())
                                .hanhDong(IHanhDong.thu_hoi_quyen)
                                .giaTriCu(cu)
                                .giaTriMoi(moi)
                                .nguoiThucHien(findingCurrentUser.get())
                                .ngayThucHien(now)
                                .ghiChu("Thu hồi quyen_han id " + dangCo.getQuyenHan().getId()
                                        + " của " + ITable.nguoi_dung + " id: " + nguoiDung.getId())
                                .build()
                );
            }
        }
        String giaTriMoiJson;

        nguoiDung = nguoiDungService.update(nguoiDung.getId(), nguoiDung);

        try {
            giaTriMoiJson = objectMapper.writeValueAsString(nguoiDungMapper.toDto(nguoiDung));
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            giaTriMoiJson = "error when parse";
        }
        // Tạo log cuối cùng xác nhận việc "Nâng cấp chức vụ" thành công
        lichSuThayDoiService.create(
                LichSuThayDoi.builder()
                        .loaiThamChieu(ITable.nguoi_dung)
                        .idThamChieu(nguoiDung.getId())
                        .kho(findingKho.get())
                        .hanhDong(IHanhDong.nang_cap_chuc_vu)
                        .giaTriCu(giaTriCuJson)
                        .giaTriMoi(giaTriMoiJson)
                        .nguoiThucHien(findingCurrentUser.get())
                        .ngayThucHien(now)
                        .ghiChu("Thực hiện " + IHanhDong.nang_cap_chuc_vu + " cho " + ITable.nguoi_dung + " id: " + nguoiDung.getId())
                        .build()
        );
        // Trả về kết quả thành công cho Client
        return ResponseEntity.ok(
                ResponseData.<String>builder().message("Success").build()
        );
    }

    public static final String CAU_HINH_DEFAULT_MIN_STOCK_ALERT = "DEFAULT_MIN_STOCK_ALERT";
    public static final String CAU_HINH_OMNI_SYNC_INTERVAL_MINS = "OMNI_SYNC_INTERVAL_MINS";
    public static final String CAU_HINH_REALTIME_SYNC_THRESHOLD = "REALTIME_SYNC_THRESHOLD";
    /** Tiền tố của mã khách hàng hệ thống tự tạo (thêm khách mà để trống mã): tiền tố + id 6 số, VD KH000124. */
    public static final String CAU_HINH_MA_KHACH_HANG_TIEN_TO = "MA_KHACH_HANG_TIEN_TO";
    public static final String MA_KHACH_HANG_TIEN_TO_MAC_DINH = "KH";
    /** Tiền tố mã: 1–10 ký tự in hoa không dấu, số hoặc . _ - (mã đầy đủ vẫn nằm trong 50 ký tự của cột). */
    public static final Pattern TIEN_TO_MA_PATTERN = Pattern.compile("^[A-Z0-9._-]{1,10}$");

    /** Tiền tố mã lô sinh mã gợi ý (tiền tố + "-" + …) có chứa FC- — dạng thẻ lệnh kiểm đếm, khóa lô sẽ bị chặn. */
    public static boolean laTienToMaLoTrungTheLenh(String tienTo) {
        return tienTo != null && (tienTo + "-").toUpperCase().contains(com.dev.backend.utils.MaVachUtils.TIEN_TO_THE_LENH);
    }
    /**
     * Cách xác nhận chất lượng khi kiểm đếm hàng nhập (màn Kiểm đếm & khóa lô):
     * QUET_TIEP_LA_DAT  — quét sản phẩm kế tiếp là lượt trước giữ Đạt; hàng lỗi quét thẻ KHÔNG ĐẠT.
     * QUET_THE_TUNG_CAI — mỗi lượt phải quét thẻ ĐẠT hoặc KHÔNG ĐẠT mới quét tiếp được.
     */
    public static final String CAU_HINH_KIEM_DEM_XAC_NHAN = "KIEM_DEM_XAC_NHAN";
    public static final String KIEM_DEM_QUET_TIEP_LA_DAT = "QUET_TIEP_LA_DAT";
    public static final String KIEM_DEM_QUET_THE_TUNG_CAI = "QUET_THE_TUNG_CAI";
    /** Tiền tố mã lô gợi ý khi khóa lô ở màn kiểm đếm: tiền tố-số phiếu-thứ tự, VD LO-PN202610201-01. */
    public static final String CAU_HINH_MA_LO_TIEN_TO = "MA_LO_TIEN_TO";
    public static final String MA_LO_TIEN_TO_MAC_DINH = "LO";

    @EventListener(ApplicationReadyEvent.class)
    @Transactional(rollbackFor = Exception.class)
    public void initDefaultConfigurations() {
        log.info("[DieuHanhHeThong] Khởi động kiểm tra và seed cấu hình hệ thống kho tự động (Fail-safe Seed)...");
        seedIfMissing(CAU_HINH_DEFAULT_MIN_STOCK_ALERT, "100", KieuDuLieuCauHinh.INT, "Ngưỡng cảnh báo tồn kho tối thiểu mặc định");
        seedIfMissing(CAU_HINH_OMNI_SYNC_INTERVAL_MINS, "10", KieuDuLieuCauHinh.INT, "Chu kỳ đồng bộ đơn hàng đa kênh (phút)");
        seedIfMissing(CAU_HINH_REALTIME_SYNC_THRESHOLD, "3", KieuDuLieuCauHinh.INT, "Ngưỡng chuyển sang đồng bộ tức thời (số lượng)");
        seedIfMissing(CAU_HINH_MA_KHACH_HANG_TIEN_TO, MA_KHACH_HANG_TIEN_TO_MAC_DINH, KieuDuLieuCauHinh.STRING, "Tiền tố mã khách hàng tự tạo");
        seedIfMissing(CAU_HINH_KIEM_DEM_XAC_NHAN, KIEM_DEM_QUET_TIEP_LA_DAT, KieuDuLieuCauHinh.STRING, "Cách xác nhận chất lượng khi kiểm đếm hàng nhập");
        seedIfMissing(CAU_HINH_MA_LO_TIEN_TO, MA_LO_TIEN_TO_MAC_DINH, KieuDuLieuCauHinh.STRING, "Tiền tố mã lô gợi ý khi khóa lô");
    }

    private void seedIfMissing(String maCauHinh, String defaultValue, KieuDuLieuCauHinh kieuDuLieu, String moTa) {
        if (!cauHinhRepository.existsById(maCauHinh)) {
            CauHinhHeThong entity = CauHinhHeThong.builder()
                    .maCauHinh(maCauHinh)
                    .giaTri(defaultValue)
                    .kieuDuLieu(kieuDuLieu)
                    .moTa(moTa)
                    .ngayCapNhat(LocalDateTime.now())
                    .build();
            cauHinhRepository.save(entity);
            log.info("[DieuHanhHeThong] Đã tự động seed cấu hình mặc định: {} = {}", maCauHinh, defaultValue);
        }
    }

    @Override
    public List<CauHinhHeThongDto> getAllCauHinh() {
        List<CauHinhHeThong> list = cauHinhRepository.findAllWithNguoiCapNhat();
        return cauHinhMapper.toDtoList(list);
    }

    @Override
    @Transactional
    public CauHinhHeThongDto updateCauHinh(String maCauHinh, CauHinhHeThongUpdateRequest request, Integer userId) {
        CauHinhHeThong entity = cauHinhRepository.findById(maCauHinh)
                .orElseThrow(() -> new CommonException("Không tìm thấy cấu hình với mã: " + maCauHinh));

        // Validate kiểu dữ liệu trước khi lưu
        validateDataType(request.getGiaTri(), entity.getKieuDuLieu(), maCauHinh);
        validateBoundary(maCauHinh, request.getGiaTri());

        String giaTriCu = entity.getGiaTri();
        entity.setGiaTri(request.getGiaTri());
        if (request.getMoTa() != null) {
            entity.setMoTa(request.getMoTa());
        }
        entity.setNgayCapNhat(LocalDateTime.now());

        if (userId == null) {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            if (auth != null) {
                userId = auth.getId();
            }
        }

        NguoiDung user = null;
        if (userId != null) {
            user = nguoiDungRepository.findById(userId).orElse(null);
            entity.setNguoiCapNhat(user);
        }

        CauHinhHeThong saved = cauHinhRepository.save(entity);

        // Ghi nhật ký kiểm toán hành vi (Rule 7) - Chỉ ghi khi có user để tránh vi phạm @NotNull gây bẫy rollback-only
        if (user != null) {
            try {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.cau_hinh_he_thong)
                                .idThamChieu(0)
                                .hanhDong(IHanhDong.cap_nhat_cau_hinh)
                                .giaTriCu("{\"" + maCauHinh + "\":\"" + giaTriCu + "\"}")
                                .giaTriMoi("{\"" + maCauHinh + "\":\"" + request.getGiaTri() + "\"}")
                                .nguoiThucHien(user)
                                .ngayThucHien(Instant.now())
                                .ghiChu("Cập nhật cấu hình: " + maCauHinh + " = " + request.getGiaTri())
                                .build()
                );
            } catch (Exception e) {
                log.warn("[DieuHanhHeThong] Không thể ghi nhật ký kiểm toán thay đổi cấu hình {}: {}", maCauHinh, e.getMessage());
            }
        } else {
            log.info("[DieuHanhHeThong] Bỏ qua ghi nhật ký kiểm toán thay đổi cấu hình {} do không có thông tin người dùng", maCauHinh);
        }

        return cauHinhMapper.toDto(saved);
    }

    @Override
    @Transactional
    public List<CauHinhHeThongDto> bulkUpdateCauHinh(List<CauHinhHeThongBulkUpdateRequest> requests, Integer userId) {
        if (userId == null) {
            NguoiDungAuthInfo auth = SecurityContextHolder.getUser();
            if (auth != null) {
                userId = auth.getId();
            }
        }

        NguoiDung user = null;
        if (userId != null) {
            user = nguoiDungRepository.findById(userId).orElse(null);
        }

        List<CauHinhHeThong> updatedList = new ArrayList<>();
        StringBuilder gtCuBuilder = new StringBuilder("{");
        StringBuilder gtMoiBuilder = new StringBuilder("{");

        for (int i = 0; i < requests.size(); i++) {
            CauHinhHeThongBulkUpdateRequest req = requests.get(i);
            CauHinhHeThong entity = cauHinhRepository.findById(req.getMaCauHinh())
                    .orElseThrow(() -> new CommonException("Không tìm thấy cấu hình: " + req.getMaCauHinh()));

            validateDataType(req.getGiaTri(), entity.getKieuDuLieu(), req.getMaCauHinh());
            validateBoundary(req.getMaCauHinh(), req.getGiaTri());

            if (i > 0) {
                gtCuBuilder.append(",");
                gtMoiBuilder.append(",");
            }
            gtCuBuilder.append("\"").append(req.getMaCauHinh()).append("\":\"").append(entity.getGiaTri()).append("\"");
            gtMoiBuilder.append("\"").append(req.getMaCauHinh()).append("\":\"").append(req.getGiaTri()).append("\"");

            entity.setGiaTri(req.getGiaTri());
            entity.setNgayCapNhat(LocalDateTime.now());
            entity.setNguoiCapNhat(user);

            updatedList.add(entity);
        }
        gtCuBuilder.append("}");
        gtMoiBuilder.append("}");

        cauHinhRepository.saveAll(updatedList);

        // Ghi nhật ký kiểm toán hành vi (Rule 7) - Chỉ ghi khi có user để tránh vi phạm @NotNull gây bẫy rollback-only
        if (user != null) {
            try {
                lichSuThayDoiService.create(
                        LichSuThayDoi.builder()
                                .loaiThamChieu(ITable.cau_hinh_he_thong)
                                .idThamChieu(0)
                                .hanhDong(IHanhDong.cap_nhat_cau_hinh)
                                .giaTriCu(gtCuBuilder.toString())
                                .giaTriMoi(gtMoiBuilder.toString())
                                .nguoiThucHien(user)
                                .ngayThucHien(Instant.now())
                                .ghiChu("Cập nhật hàng loạt " + updatedList.size() + " thông số cấu hình hệ thống")
                                .build()
                );
            } catch (Exception e) {
                log.warn("[DieuHanhHeThong] Không thể ghi nhật ký kiểm toán cập nhật hàng loạt cấu hình: {}", e.getMessage());
            }
        } else {
            log.info("[DieuHanhHeThong] Bỏ qua ghi nhật ký kiểm toán cập nhật hàng loạt do không có thông tin người dùng");
        }

        return cauHinhMapper.toDtoList(updatedList);
    }

    // Kiểm tra giới hạn biên giá trị an toàn (Boundary Validation)
    private void validateBoundary(String maCauHinh, String giaTri) {
        if (CAU_HINH_DEFAULT_MIN_STOCK_ALERT.equals(maCauHinh)) {
            int val = Integer.parseInt(giaTri);
            if (val < 0 || val > 100_000) {
                throw new CommonException("Ngưỡng cảnh báo tồn kho tối thiểu phải từ 0 đến 100,000 đơn vị");
            }
        } else if (CAU_HINH_OMNI_SYNC_INTERVAL_MINS.equals(maCauHinh)) {
            int val = Integer.parseInt(giaTri);
            if (val < 1 || val > 1440) {
                throw new CommonException("Chu kỳ đồng bộ đơn hàng đa kênh phải từ 1 đến 1440 phút (tối đa 24 giờ)");
            }
        } else if (CAU_HINH_REALTIME_SYNC_THRESHOLD.equals(maCauHinh)) {
            int val = Integer.parseInt(giaTri);
            if (val < 0 || val > 100) {
                throw new CommonException("Ngưỡng chuyển sang đồng bộ tức thời phải từ 0 đến 100 đơn vị");
            }
        } else if (CAU_HINH_MA_KHACH_HANG_TIEN_TO.equals(maCauHinh)) {
            if (giaTri == null || !TIEN_TO_MA_PATTERN.matcher(giaTri).matches()) {
                throw new CommonException("Tiền tố mã khách hàng gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -");
            }
        } else if (CAU_HINH_MA_LO_TIEN_TO.equals(maCauHinh)) {
            if (giaTri == null || !TIEN_TO_MA_PATTERN.matcher(giaTri).matches()) {
                throw new CommonException("Tiền tố mã lô gồm 1–10 ký tự: chữ in hoa không dấu, số hoặc . _ -");
            }
            // Mã lô gợi ý = tiền tố + "-" + số phiếu; mã lô chứa FC- bị chặn (dạng thẻ lệnh kiểm đếm): tiền tố kết thúc
            // bằng FC hoặc có FC- sẽ làm mọi mã lô gợi ý bị từ chối
            if (laTienToMaLoTrungTheLenh(giaTri)) {
                throw new CommonException("Tiền tố mã lô không được kết thúc bằng FC hoặc chứa FC- (dạng thẻ lệnh kiểm đếm FC-…)");
            }
        } else if (CAU_HINH_KIEM_DEM_XAC_NHAN.equals(maCauHinh)) {
            if (!KIEM_DEM_QUET_TIEP_LA_DAT.equals(giaTri) && !KIEM_DEM_QUET_THE_TUNG_CAI.equals(giaTri)) {
                throw new CommonException("Cách xác nhận chất lượng khi kiểm đếm không hợp lệ. Chọn \"Quét tiếp là Đạt\" hoặc \"Quét thẻ cho từng cái\".");
            }
        }
    }

    // Hàm tiện ích validate dữ liệu
    private void validateDataType(String giaTri, KieuDuLieuCauHinh type, String maCauHinh) {
        try {
            switch (type) {
                case INT:
                    Integer.parseInt(giaTri);
                    break;
                case DECIMAL:
                    Double.parseDouble(giaTri);
                    break;
                case BOOLEAN:
                    if (!giaTri.equalsIgnoreCase("true") && !giaTri.equalsIgnoreCase("false") &&
                            !giaTri.equals("1") && !giaTri.equals("0")) {
                        throw new IllegalArgumentException();
                    }
                    break;
                case STRING:
                    break; // Chuỗi thì luôn hợp lệ
            }
        } catch (Exception e) {
            throw new CommonException("Giá trị '" + giaTri + "' không hợp lệ cho cấu hình " + maCauHinh + " (Yêu cầu định dạng: " + type.name() + ")");
        }
    }
    @Override
    public String getCauHinhString(String maCauHinh, String defaultValue) {
        return cauHinhRepository.findById(maCauHinh)
                .map(CauHinhHeThong::getGiaTri)
                .orElse(defaultValue);
    }

    @Override
    public int getCauHinhInt(String maCauHinh, int defaultValue) {
        return cauHinhRepository.findById(maCauHinh)
                .map(c -> {
                    try {
                        return Integer.parseInt(c.getGiaTri());
                    } catch (NumberFormatException e) {
                        return defaultValue;
                    }
                })
                .orElse(defaultValue);
    }

    @Override
    public boolean getCauHinhBoolean(String maCauHinh, boolean defaultValue) {
        return cauHinhRepository.findById(maCauHinh)
                .map(c -> Boolean.parseBoolean(c.getGiaTri()) || c.getGiaTri().equals("1"))
                .orElse(defaultValue);
    }
}
