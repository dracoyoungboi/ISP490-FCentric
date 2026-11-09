package com.dev.backend.controller;

import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.request.BaseFilterRequest;
import com.dev.backend.dto.request.DoiGiaBanRequest;
import com.dev.backend.dto.request.LocGiaBanRequest;
import com.dev.backend.dto.request.SanPhamQuanAoBasicInfoUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.NhatKyDto;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.customize.KetQuaDoiGiaBanDto;
import com.dev.backend.dto.response.customize.TrangGiaBanDto;
import com.dev.backend.dto.response.entities.NguoiDungDto;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.services.impl.entities.GiaBanBienTheService;
import com.dev.backend.services.impl.entities.SanPhamQuanAoService;
import com.dev.backend.services.impl.multitable.NhatKyDocService;
import com.dev.backend.utils.XemGiaVon;
import com.dev.backend.i18n.ThongDiep;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/san-pham-quan-ao")
public class SanPhamQuanAoController {

        // ==========================================================
        // PRODUCT MANAGEMENT CONTROLLER
        // Vai trò: nhận request từ FE, kiểm tra quyền, gọi service,
        // và trả ResponseData thống nhất về cho UI.
        // ==========================================================

        @Autowired
        private SanPhamQuanAoService sanPhamQuanAoService;
        @Autowired
        private SanPhamQuanAoMapper sanPhamQuanAoMapper;
        @Autowired
        private GiaBanBienTheService giaBanBienTheService;
        @Autowired
        private NhatKyDocService nhatKyDocService;

        /**
         * Lịch sử thay đổi sản phẩm (ngăn "Lịch sử thay đổi" ở trang chi tiết): tạo, sửa thông tin / biến thể / ảnh / trạng
         * thái, kèm các lần đổi giá bán của mọi biến thể; mới nhất trước, tối đa 300 dòng. Quản trị viên, quản lý kho (N3).
         */
        @GetMapping("/{id}/lich-su")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<List<NhatKyDto>>> lichSu(@PathVariable Integer id) {
                return ResponseEntity.ok(ResponseData.<List<NhatKyDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDocService.theoSanPham(id))
                        .message("Success")
                        .build());
        }

        /** Lịch sử giá bán một biến thể (màn Giá bán & tem mã vạch): ai đổi, khi nào, cũ → mới, lý do. */
        @GetMapping("/sku/{bienTheId}/lich-su-gia")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<List<NhatKyDto>>> lichSuGia(@PathVariable Integer bienTheId) {
                return ResponseEntity.ok(ResponseData.<List<NhatKyDto>>builder()
                        .status(HttpStatus.OK.value())
                        .data(nhatKyDocService.lichSuGiaBienThe(bienTheId))
                        .message("Success")
                        .build());
        }

        @PostMapping(value = "/create", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> create(
                @RequestPart("creating") SanPhamQuanAoCreating creating,
                @RequestPart(value = "anhSanPhams", required = false) List<MultipartFile> anhSanPhams,
                @RequestPart(value = "anhBienThes", required = false) List<MultipartFile> anhBienThes) {
                // FE gửi multipart gồm JSON "creating" + ảnh sản phẩm + ảnh biến thể.
                return chiGiuHoTenNguoiTao(sanPhamQuanAoService.create(creating, anhSanPhams, anhBienThes));

        }

        @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> update(
                @RequestPart SanPhamQuanAoUpdating updating,
                @RequestPart(value = "anhSanPhams", required = false) List<MultipartFile> anhSanPhams,
                @RequestPart(value = "anhBienThes", required = false) List<MultipartFile> anhBienThes) {
                // Cập nhật thông tin sản phẩm/biến thể và ảnh tương ứng.
                return chiGiuHoTenNguoiTao(sanPhamQuanAoService.update(updating, anhSanPhams, anhBienThes));
        }

        @GetMapping("/get-by-id/{id}")
        // Mọi vai trò xem được; giá vốn chỉ trả cho vai trò được xem (XemGiaVon), người tạo chỉ còn họ tên
        @RequireAuth(roles = {
                IRoleType.quan_tri_vien,
                IRoleType.quan_ly_kho,
                IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang,
                IRoleType.nhan_vien_mua_hang
        })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> getById(@PathVariable Integer id) {
                SanPhamQuanAoDto dto = sanPhamQuanAoService.getDetail(id);
                anThongTinNoiBo(List.of(dto));
                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(dto)
                                .message("Success")
                                .build());
        }

        @PatchMapping("/basic-info/{id}")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> updateBasicInfo(
                @PathVariable Integer id,
                @RequestBody SanPhamQuanAoBasicInfoUpdating dto) {
                // Cập nhật riêng thông tin cơ bản (tên/mô tả/mã vạch/danh mục/mức tồn tối thiểu/thương hiệu).
                // KHÔNG tính lại giá/trạng thái theo tồn kho, không đụng ảnh và biến thể.
                SanPhamQuanAoDto daLuu = sanPhamQuanAoService.updateBasicInfo(id, dto);
                anThongTinNoiBo(List.of(daLuu));
                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(daLuu)
                                .message(ThongDiep.dich("sanPhamMuaHang.sanPhamCapNhatThongTinCoBanThanhCong"))
                                .build());
        }

        @PostMapping("/filter")
        @RequireAuth(roles = {
                IRoleType.quan_tri_vien,
                IRoleType.quan_ly_kho,
                IRoleType.nhan_vien_kho,
                IRoleType.nhan_vien_ban_hang,
                IRoleType.nhan_vien_mua_hang
        })
        public ResponseEntity<ResponseData<Page<SanPhamQuanAoDto>>> filter(@RequestBody BaseFilterRequest filter) {
                // Luồng chính cho màn danh sách: lọc + sort + phân trang.
                Page<SanPhamQuanAoDto> trang = sanPhamQuanAoMapper.toDtoPage(sanPhamQuanAoService.filter(filter));
                anThongTinNoiBo(trang);
                return ResponseEntity.ok(
                        ResponseData.<Page<SanPhamQuanAoDto>>builder()
                                .status(HttpStatus.OK.value())
                                .data(trang)
                                .build());
        }

        /**
         * Bỏ phần người xem không được nhận trước khi trả DTO sản phẩm: giá vốn với nhân viên bán hàng (SRS 2.4.1), và thông
         * tin tài khoản của người tạo (tên đăng nhập, email, SĐT, cờ đổi mật khẩu, kho phụ trách) — các màn chỉ cần họ tên.
         */
        static void anThongTinNoiBo(Iterable<SanPhamQuanAoDto> dsSanPham) {
                boolean anGia = !XemGiaVon.nguoiDangNhapDuocXem();
                for (SanPhamQuanAoDto dto : dsSanPham) {
                        if (dto == null) continue;
                        if (anGia) anGiaVon(dto);
                        chiGiuHoTenNguoiTao(dto);
                }
        }

        static void anGiaVon(SanPhamQuanAoDto dto) {
                dto.setGiaVonMacDinh(null);
                if (dto.getBienTheSanPhams() != null) {
                        dto.getBienTheSanPhams().forEach(bt -> bt.setGiaVon(null));
                }
        }

        static void chiGiuHoTenNguoiTao(SanPhamQuanAoDto dto) {
                NguoiDungDto nguoiTao = dto.getNguoiTao();
                if (nguoiTao == null) return;
                dto.setNguoiTao(NguoiDungDto.builder().id(nguoiTao.getId()).hoTen(nguoiTao.getHoTen()).build());
        }

        /** Tạo / sửa (service trả sẵn ResponseEntity): chỉ quản trị viên, quản lý kho nên không cần ẩn giá vốn. */
        private static ResponseEntity<ResponseData<SanPhamQuanAoDto>> chiGiuHoTenNguoiTao(
                ResponseEntity<ResponseData<SanPhamQuanAoDto>> ketQua) {
                if (ketQua.getBody() != null && ketQua.getBody().getData() != null) {
                        chiGiuHoTenNguoiTao(ketQua.getBody().getData());
                }
                return ketQua;
        }

        /**
         * Ngừng kinh doanh (nút "Xóa sản phẩm" ở danh sách): đổi trạng thái sang 2, không xóa vật lý; cùng quyền với
         * PATCH /status. Còn tồn, đơn bán / đơn mua / phiếu chuyển dở dang hoặc đang kiểm kê thì máy chủ trả 409.
         */
        @DeleteMapping("/soft-delete/{id}")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<String>> softDelete(@PathVariable Integer id) {
                sanPhamQuanAoService.changeStatus(id, 2);
                return ResponseEntity.ok(
                        ResponseData.<String>builder()
                                .status(HttpStatus.OK.value())
                                .data("Success")
                                .message("Success")
                                .build());
        }

        @PatchMapping("/status/{id}")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<String>> updateStatus(@PathVariable Integer id,
                                                                 @RequestParam Integer status) {
                // API đổi trạng thái nhanh cho sản phẩm.
                sanPhamQuanAoService.changeStatus(id, status);
                return ResponseEntity.ok(ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message(ThongDiep.dich("sanPhamMuaHang.capNhatTrangThaiThanhCong"))
                        .build());
        }

        /**
         * Màn "Giá bán & tem mã vạch": sản phẩm (phân trang theo sản phẩm) kèm các biến thể khớp bộ lọc, tồn mọi kho,
         * lần đổi giá gần nhất; số đếm theo tab và số SKU cần xử lý giá. Quản lý kho xem để in tem.
         */
        @PostMapping("/gia-ban/filter")
        @RequireAuth(roles = { IRoleType.quan_tri_vien, IRoleType.quan_ly_kho })
        public ResponseEntity<ResponseData<TrangGiaBanDto>> locGiaBan(@RequestBody(required = false) LocGiaBanRequest request) {
                return ResponseEntity.ok(ResponseData.<TrangGiaBanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(giaBanBienTheService.loc(request))
                        .message("Success")
                        .build());
        }

        /**
         * Đổi giá bán một hoặc nhiều biến thể, bắt buộc lý do; chỉ quản trị viên. Không có giá vốn (SRS 2.4.1: giá vốn
         * do hệ thống tính theo lô nhập). Thay API cũ PATCH /sku/{id}/price (đã gỡ: nhận cả giá vốn, không ghi lịch sử).
         */
        @PatchMapping("/sku/gia-ban")
        @RequireAuth(roles = { IRoleType.quan_tri_vien })
        public ResponseEntity<ResponseData<KetQuaDoiGiaBanDto>> doiGiaBan(@RequestBody DoiGiaBanRequest request) {
                KetQuaDoiGiaBanDto ketQua = giaBanBienTheService.doiGia(request);
                return ResponseEntity.ok(ResponseData.<KetQuaDoiGiaBanDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(ketQua)
                        .message(ThongDiep.dich("sanPhamMuaHang.daDoiGiaBanSku", ketQua.getDaDoi().size()))
                        .build());
        }

        //call api thứ 2 để lấy tất cả các sản phẩm theo khoID
        @GetMapping("/theo-kho/{khoId}")
        @RequireAuth(
                roles = {
                        IRoleType.quan_tri_vien,
                        IRoleType.quan_ly_kho,
                        IRoleType.nhan_vien_kho,
                        IRoleType.nhan_vien_mua_hang,
                        IRoleType.nhan_vien_ban_hang
                },
                rolesLogic = RequireAuth.LogicType.OR
        )
        public ResponseEntity<ResponseData<List<SanPhamQuanAoDto>>> getSanPhamByKho(@PathVariable Integer khoId) {
                ResponseEntity<ResponseData<List<SanPhamQuanAoDto>>> ketQua = sanPhamQuanAoService.getAllByKho(khoId);
                if (ketQua.getBody() != null && ketQua.getBody().getData() != null) {
                        anThongTinNoiBo(ketQua.getBody().getData());
                }
                return ketQua;
        }
}
