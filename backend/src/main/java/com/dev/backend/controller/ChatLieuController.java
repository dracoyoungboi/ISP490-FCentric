package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.ChatLieuCreating;
import com.dev.backend.dto.request.ChatLieuUpdating;
import com.dev.backend.dto.response.entities.ChatLieuDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.mapper.ChatLieuMapper;
import com.dev.backend.services.impl.entities.ChatLieuService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat-lieu")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ChatLieuController {


    private final ChatLieuService service;
    @Autowired
    private ChatLieuMapper chatLieuMapper;

    // Material List - GET /api/material
    // Roles: quan_ly_kho, nhan_vien_mua_hang, nhan_vien_ban_hang, quan_tri_vien, nhan_vien_kho
    @GetMapping
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_tri_vien,
                    IRoleType.nhan_vien_kho
            }
    )
    public ResponseEntity<ResponseData> getAll(@RequestParam(required = false) String search) {
        List<ChatLieuDto> dtos = service.findAll(search);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dtos)
                .message("Lấy danh sách chất liệu thành công")
                .build());
    }

    @GetMapping("/all")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<List<ChatLieuDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<ChatLieuDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(chatLieuMapper.toDtoList(service.getAll()))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    // Material Detail (View) - GET /api/material/{id}
    // Roles: quan_ly_kho, nhan_vien_kho, nhan_vien_mua_hang, nhan_vien_ban_hang, quan_tri_vien
    @GetMapping("/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_mua_hang,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.quan_tri_vien
            }
    )
    public ResponseEntity<ResponseData> getById(@PathVariable Integer id) {
        ChatLieuDto dto = service.findByIdDto(id);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message("Lấy chi tiết chất liệu thành công")
                .build());
    }

    // Add Material - POST /api/material
    // Roles: quan_ly_kho, quan_tri_vien
    @PostMapping
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.quan_tri_vien
            }
    )
    public ResponseEntity<ResponseData> create(@RequestBody ChatLieuCreating creating) {
        ChatLieuDto dto = service.create(creating);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message("Thêm chất liệu mới thành công")
                .build());
    }

    // Edit Material - PUT /api/material/{id}
    // Roles: quan_ly_kho, quan_tri_vien
    @PutMapping("/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.quan_tri_vien
            }
    )
    public ResponseEntity<ResponseData> update(@PathVariable Integer id, @RequestBody ChatLieuUpdating updating) {
        ChatLieuDto dto = service.update(id, updating);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .data(dto)
                .message("Cập nhật chất liệu thành công")
                .build());
    }

    // Delete Material - DELETE /api/material/{id}
    // Roles: quan_ly_kho, quan_tri_vien
    @DeleteMapping("/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_ly_kho,
                    IRoleType.quan_tri_vien
            }
    )
    public ResponseEntity<ResponseData> delete(@PathVariable Integer id) {
        service.delete(id);
        return ResponseEntity.ok(ResponseData.builder()
                .status(200)
                .message("Xóa chất liệu thành công")
                .build());
    }
}