package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.AdminUpdateRequest;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.NguoiDungCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.mapper.NguoiDungMapper;
import com.dev.backend.services.impl.entities.NguoiDungService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/")
public class AdminController {
    private final NguoiDungService nguoiDungService;

    private final NguoiDungMapper nguoiDungMapper;

    public AdminController(NguoiDungService nguoiDungService, NguoiDungMapper nguoiDungMapper) {
        this.nguoiDungService = nguoiDungService;
        this.nguoiDungMapper = nguoiDungMapper;
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
                        .data(
                                nguoiDungMapper.toDtoPage(
                                        nguoiDungService.filter(filter)
                                )
                        )
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
                        .message("Lấy danh sách người dùng thành công")
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
                        .message("Lấy chi tiết người dùng thành công")
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
                        .message("Tạo tài khoản người dùng thành công")
                        .build()
        );
    }

    @PostMapping("/users/{id}/reset-password")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<Void>> resetUserPasswordByAdmin(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable Integer id,
            @RequestBody AdminUpdateRequest request
    ) {

        nguoiDungService.updateUserByAdmin(id, request);

        return ResponseEntity.ok(
                ResponseData.<Void>builder()
                        .status(HttpStatus.OK.value())
                        .message("Đặt lại mật khẩu cho người dùng thành công")
                        .error(null)
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
                        .message("Đã cấp mật khẩu ngẫu nhiên cho người dùng")
                        .error(null)
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
                        .message("Cập nhật trạng thái tài khoản thành công")
                        .build()
        );
    }


}

