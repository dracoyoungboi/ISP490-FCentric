package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.DanhMucQuanAoCreating;
import com.dev.backend.dto.request.DanhMucQuanAoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.DanhMucQuanAoDto;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.DanhMucQuanAoMapper;
import com.dev.backend.services.impl.entities.DanhMucQuanAoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/danh-muc-quan-ao")
class DanhMucQuanAoController {

    @Autowired
    private DanhMucQuanAoService danhMucQuanAoService;

    @Autowired
    private DanhMucQuanAoMapper danhMucQuanAoMapper;


    @GetMapping("/get-cay-danh-muc")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_mua_hang
            }
    )
    public ResponseEntity<ResponseData<List<DanhMucQuanAoDto>>> getCayDanhMuc() {
        return ResponseEntity.ok(
                ResponseData.<List<DanhMucQuanAoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(danhMucQuanAoMapper.toDtoList(danhMucQuanAoService.findAllDanhMucChaByTrangThai(1)))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @GetMapping("/get-by-id/{id}")
    @RequireAuth(
            roles = {
                    IRoleType.quan_tri_vien,
                    IRoleType.quan_ly_kho,
                    IRoleType.nhan_vien_kho,
                    IRoleType.nhan_vien_ban_hang,
                    IRoleType.nhan_vien_mua_hang
            }
    )
    public ResponseEntity<ResponseData<DanhMucQuanAoDto>> getById(@PathVariable Integer id) {
        DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy danh mục id: " + id)
        );
        return ResponseEntity.ok(
                ResponseData.<DanhMucQuanAoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(danhMucQuanAoMapper.toDto(danhMucQuanAo))
                        .build()
        );
    }

    @GetMapping("/all")
    @RequireAuth(roles = {IRoleType.all})
    public ResponseEntity<ResponseData<List<DanhMucQuanAoDto>>> getAll() {
        return ResponseEntity.ok(
                ResponseData.<List<DanhMucQuanAoDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(danhMucQuanAoMapper.toDtoList(danhMucQuanAoService.getAll()))
                        .message("Success")
                        .error(null)
                        .build()
        );
    }

    @PostMapping("/create")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<String>> create(
            @RequestBody DanhMucQuanAoCreating creating
    ) {
        return danhMucQuanAoService.create(creating);
    }

    @PutMapping("/update")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<String>> update(@RequestBody DanhMucQuanAoUpdating updating) {
        return danhMucQuanAoService.update(updating);
    }

    @DeleteMapping("/delete/{id}")
    @RequireAuth(
            roles = {IRoleType.quan_tri_vien}
    )
    public ResponseEntity<ResponseData<String>> delete(@PathVariable Integer id) {
        DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy danh mục id: " + id)
        );
        danhMucQuanAo.setTrangThai(0);
        danhMucQuanAoService.update(id, danhMucQuanAo);
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()
        );
    }

}
