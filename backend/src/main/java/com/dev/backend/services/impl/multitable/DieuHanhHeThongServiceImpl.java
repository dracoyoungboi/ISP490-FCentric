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
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

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
        List<PhanQuyenNguoiDungKho> activeAssignments = phanQuyenNguoiDungKhoService
                .findByNguoiDungIdAndActive(pqndkCreating.getNguoiDungId());
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

    @Override
    public List<CauHinhHeThongDto> getAllCauHinh() {
        List<CauHinhHeThong> list = cauHinhRepository.findAll();
        return cauHinhMapper.toDtoList(list);
    }

    @Override
    @Transactional
    public CauHinhHeThongDto updateCauHinh(String maCauHinh, CauHinhHeThongUpdateRequest request, Integer userId) {
        CauHinhHeThong entity = cauHinhRepository.findById(maCauHinh)
                .orElseThrow(() -> new CommonException("Không tìm thấy cấu hình với mã: " + maCauHinh));

        // Validate kiểu dữ liệu trước khi lưu
        validateDataType(request.getGiaTri(), entity.getKieuDuLieu(), maCauHinh);

        entity.setGiaTri(request.getGiaTri());
        if (request.getMoTa() != null) {
            entity.setMoTa(request.getMoTa());
        }
        entity.setNgayCapNhat(LocalDateTime.now());

        if (userId != null) {
            NguoiDung user = nguoiDungRepository.findById(userId).orElse(null);
            entity.setNguoiCapNhat(user);
        }

        CauHinhHeThong saved = cauHinhRepository.save(entity);
        return cauHinhMapper.toDto(saved);
    }

    @Override
    @Transactional
    public List<CauHinhHeThongDto> bulkUpdateCauHinh(List<CauHinhHeThongBulkUpdateRequest> requests, Integer userId) {
        NguoiDung user = null;
        if (userId != null) {
            user = nguoiDungRepository.findById(userId).orElse(null);
        }

        List<CauHinhHeThong> updatedList = new ArrayList<>();

        for (CauHinhHeThongBulkUpdateRequest req : requests) {
            CauHinhHeThong entity = cauHinhRepository.findById(req.getMaCauHinh())
                    .orElseThrow(() -> new CommonException("Không tìm thấy cấu hình: " + req.getMaCauHinh()));

            validateDataType(req.getGiaTri(), entity.getKieuDuLieu(), req.getMaCauHinh());

            entity.setGiaTri(req.getGiaTri());
            entity.setNgayCapNhat(LocalDateTime.now());
            entity.setNguoiCapNhat(user);

            updatedList.add(entity);
        }

        cauHinhRepository.saveAll(updatedList);
        return cauHinhMapper.toDtoList(updatedList);
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
}
