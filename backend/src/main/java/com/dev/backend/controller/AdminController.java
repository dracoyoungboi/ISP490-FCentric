package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.LuuPhanQuyenRequest;
import com.dev.backend.dto.request.NguoiDungCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.CanChuYDangNhapDto;
import com.dev.backend.dto.response.entities.DongDangNhapHeThongDto;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.dto.response.entities.NhatKyDangNhapNguoiDungDto;
import com.dev.backend.dto.response.entities.TrangThaiDangNhapDto;
import com.dev.backend.dto.response.phanquyen.LichSuPhanQuyenDto;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.services.impl.entities.NguoiDungService;
import com.dev.backend.services.impl.multitable.NhatKyDangNhapService;
import com.dev.backend.services.multitable.PhanQuyenNguoiDungService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/")
public class AdminController {
    private final NguoiDungService nguoiDungService;

    private final NguoiDungMapper nguoiDungMapper;

    private final PhanQuyenNguoiDungService phanQuyenNguoiDungService;

    private final NhatKyDangNhapService nhatKyDangNhapService;

    public AdminController(NguoiDungService nguoiDungService, NguoiDungMapper nguoiDungMapper,
                           PhanQuyenNguoiDungService phanQuyenNguoiDungService,
                           NhatKyDangNhapService nhatKyDangNhapService) {
        this.nguoiDungService = nguoiDungService;
        this.nguoiDungMapper = nguoiDungMapper;
        this.phanQuyenNguoiDungService = phanQuyenNguoiDungService;
        this.nhatKyDangNhapService = nhatKyDangNhapService;
    }

    @PostMapping("/filter")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<Page<NguoiDungDto>>> filterByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody BaseFilterRequest filter) {

        return ResponseEntity.ok(
                ResponseData.<Page<NguoiDungDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nguoiDungService.locChoQuanTri(filter))
                        .message("Success")
                        .build()
        );
    }

    @GetMapping("/user-list")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<Page<NguoiDungDto>>> getUserListByAdmin(
            @RequestHeader("Authorization") String authHeader,
            Pageable pageable
    ) {
            return ResponseEntity.ok(
                ResponseData.<Page<NguoiDungDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                nguoiDungMapper.toDtoPage(
                                        nguoiDungService.getUserListByAdmin(
                                                pageable
                                        )
                                )
                        )
                        .message(ThongDiep.dich("heThong.layDanhSachNguoiDungThanhCong"))
                        .build()
        );
    }

    @GetMapping("/users/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<NguoiDungDto>> getUserDetailByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                nguoiDungMapper.toDto(
                                        nguoiDungService.getDetailByAdmin(id)
                                )
                        )
                        .message(ThongDiep.dich("heThong.layChiTietNguoiDungThanhCong"))
                        .build()
        );
    }

    @PostMapping("/add-user")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<NguoiDungDto>> createUserByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody NguoiDungCreating request
    ) {
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(
                                nguoiDungMapper.toDto(
                                        nguoiDungService.createInternalUserByAdmin(request)
                                )
                        )
                        .message(ThongDiep.dich("heThong.taoTaiKhoanThanhCong"))
                        .build()
        );
    }

    @PostMapping("/users/{id}/reset-password-random")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<Void>> resetPasswordRandomByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id
    ) {
        nguoiDungService.resetPasswordRandomByAdmin(id);

        return ResponseEntity.ok(
                ResponseData.<Void>builder()
                        .status(HttpStatus.OK.value())
                        .message(ThongDiep.dich("heThong.daGuiLienKetDatLaiMatKhau"))
                        .error(null)
                        .build()
        );
    }

    // Lưu phân quyền trong một lần (ngăn kéo Phân quyền ở trang chi tiết): vai trò, kho, hạn hiệu lực
    // và TẬP QUYỀN ĐẦY ĐỦ tại kho. Quyền không có trong danh sách bị thu hồi. Trả về chi tiết mới nhất.
    @PutMapping("/users/{id}/phan-quyen")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<NguoiDungDto>> luuPhanQuyen(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id,
            @RequestBody LuuPhanQuyenRequest request
    ) {
        phanQuyenNguoiDungService.luuPhanQuyen(id, request);
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(nguoiDungMapper.toDto(nguoiDungService.getDetailByAdmin(id)))
                        .message(ThongDiep.dich("heThong.daLuuPhanQuyen"))
                        .build()
        );
    }

    // Lịch sử phân quyền của người dùng (đổi vai trò, kho, quyền), mới nhất trước
    @GetMapping("/users/{id}/lich-su-phan-quyen")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<LichSuPhanQuyenDto>>> layLichSuPhanQuyen(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<LichSuPhanQuyenDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(phanQuyenNguoiDungService.layLichSuPhanQuyen(id))
                        .message("Success")
                        .build()
        );
    }

    // Trạng thái đăng nhập của các người dùng đang hiện trên danh sách (biểu tượng bất thường — PA C). ids trên URL,
    // tối đa bằng cỡ trang, nên nhẹ. Dựng từ dữ liệu sẵn có, không thêm cột.
    @GetMapping("/users/trang-thai-dang-nhap")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<TrangThaiDangNhapDto>>> trangThaiDangNhap(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) List<Integer> ids
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<TrangThaiDangNhapDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDangNhapService.trangThaiNhieuNguoi(ids == null ? List.of() : ids))
                        .message("Success")
                        .build()
        );
    }

    // Màn Nhật ký đăng nhập toàn hệ thống: lọc theo từ khóa (họ tên / tên đăng nhập / IP), kết quả, khoảng ngày.
    @GetMapping("/nhat-ky-dang-nhap")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<Page<DongDangNhapHeThongDto>>> nhatKyDangNhapHeThong(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String q,
            @RequestParam(required = false, defaultValue = "all") String ketQua,
            @RequestParam(required = false, defaultValue = "7") int soNgay,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(
                ResponseData.<Page<DongDangNhapHeThongDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDangNhapService.heThong(q, ketQua, soNgay, PageRequest.of(Math.max(page, 0), size)))
                        .message("Success")
                        .build()
        );
    }

    // Khung "Cần chú ý" của màn Nhật ký đăng nhập (24 giờ gần nhất).
    @GetMapping("/nhat-ky-dang-nhap/can-chu-y")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<List<CanChuYDangNhapDto>>> canChuYDangNhap(
            @RequestHeader("Authorization") String authHeader
    ) {
        return ResponseEntity.ok(
                ResponseData.<List<CanChuYDangNhapDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDangNhapService.canChuYHeThong())
                        .message("Success")
                        .build()
        );
    }

    // Nhật ký đăng nhập của một người dùng (tab "Đăng nhập" ở Chi tiết): thiết bị đang đăng nhập + lịch sử 90 ngày,
    // dựng từ dữ liệu sẵn có (không thêm bảng). Chỉ xem, không có nút đăng xuất thiết bị của người khác.
    @GetMapping("/users/{id}/nhat-ky-dang-nhap")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<NhatKyDangNhapNguoiDungDto>> nhatKyDangNhap(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<NhatKyDangNhapNguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDangNhapService.cuaNguoiDung(id))
                        .message("Success")
                        .build()
        );
    }

    @PostMapping("/users/{id}/toggle-status")
    @RequireAuth(roles = {IRoleType.quan_tri_vien})
    public ResponseEntity<ResponseData<NguoiDungDto>> toggleUserStatusByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id
    ) {
        return ResponseEntity.ok(
                ResponseData.<NguoiDungDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(nguoiDungMapper.toDto(
                                nguoiDungService.toggleStatusByAdmin(id)
                        ))
                        .message(ThongDiep.dich("heThong.capNhatTrangThaiTaiKhoanThanhCong"))
                        .build()
        );
    }


}

