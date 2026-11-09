package com.dev.backend.controller;

import com.dev.backend.constant.variables.IPermissionType;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.customizeanotation.RequireAuth;
import com.dev.backend.dto.kiemke.KiemKeDto;
import com.dev.backend.dto.kiemke.KiemKeYeuCau;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.AnhKiemKe;
import com.dev.backend.services.impl.kiemke.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import com.dev.backend.i18n.ThongDiep;

/**
 * Kiểm kê khoanh vùng (đặc tả BA 03/11). Thay /api/phieu-kiem-ke của luồng cũ (kiểm toàn kho, ghi đè tồn khi hoàn thành).
 * Lệnh đổi trạng thái nhận header Idempotency-Key và phiên bản đợt (expectedVersion) trong thân yêu cầu.
 * Quyền (chốt Đ7): xem — quản trị viên, quản lý kho, nhân viên kho; tạo / sửa nháp / bắt đầu / hủy — quản lý kho;
 * đếm / lô phát sinh / ảnh / trình duyệt — quản lý kho, nhân viên kho; đếm lại / phê duyệt — quản lý kho có quyền
 * dieu_chinh_ton_kho. Quản trị viên làm được mọi bước.
 */
@RestController
@RequestMapping("/api/v1/kiem-ke")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class KiemKeController {

    static final String KHOA_LENH = "Idempotency-Key";

    private final KiemKeService kiemKe;
    private final KiemKeDuyetService duyet;
    private final KiemKeDocService doc;
    private final AnhKiemKeService anh;
    private final SoTonKeService soTonKe;
    private final HangChuaCoKeService hangChuaCoKeService;

    private static <T> ResponseEntity<ResponseData<T>> ok(T data, String message) {
        return ResponseEntity.ok(ResponseData.<T>builder().status(200).data(data).message(message).build());
    }

    // ───────────────────────────── Xem ─────────────────────────────

    @GetMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.Dot>>> danhSach(
            @RequestParam(required = false) Integer khoId, @RequestParam(required = false) Byte trangThai,
            @RequestParam(required = false) String loai, @RequestParam(required = false) String tuKhoa) {
        return ok(doc.danhSach(khoId, trangThai, loai, tuKhoa), ThongDiep.dich("khoVanHanh.layDanhSachDotKiemKeThanhCong"));
    }

    @GetMapping("/tong-quan")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<KiemKeDto.TongQuan>> tongQuan(@RequestParam(required = false) Integer khoId) {
        return ok(doc.tongQuan(khoId), ThongDiep.dich("khoVanHanh.layTongQuanKiemKeThanhCong"));
    }

    @GetMapping("/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<KiemKeDto.Dot>> chiTiet(@PathVariable Integer id) {
        return ok(doc.chiTiet(id), ThongDiep.dich("khoVanHanh.layDotKiemKeThanhCong"));
    }

    @GetMapping("/{id}/dong")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.Dong>>> dong(@PathVariable Integer id) {
        return ok(doc.dong(id), ThongDiep.dich("khoVanHanh.layDongKiemKeThanhCong"));
    }

    @GetMapping("/{id}/nhat-ky")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.NhatKy>>> nhatKy(@PathVariable Integer id) {
        return ok(doc.nhatKy(id), ThongDiep.dich("khoVanHanh.layNhatKyKiemKeThanhCong"));
    }

    @GetMapping("/{id}/phieu-dieu-chinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<KiemKeDto.PhieuDieuChinh>> phieuDieuChinh(@PathVariable Integer id) {
        return ok(doc.phieuDieuChinh(id), ThongDiep.dich("khoVanHanh.layPhieuDieuChinhThanhCong"));
    }

    @GetMapping("/{id}/tim-lo")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.LoTim>>> timLo(@PathVariable Integer id,
                                                                    @RequestParam(required = false) String tuKhoa) {
        return ok(doc.timLo(id, tuKhoa), ThongDiep.dich("khoVanHanh.timLoThanhCong"));
    }

    @GetMapping("/so-do")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<KiemKeDto.SoDo>> soDo(@RequestParam Integer khoId) {
        return ok(doc.soDo(khoId), ThongDiep.dich("khoVanHanh.laySoDoKhoaThanhCong"));
    }

    @GetMapping("/nguoi-chu-tri")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.Nguoi>>> nguoiChuTri(@RequestParam Integer khoId) {
        return ok(doc.nguoiChuTri(khoId), ThongDiep.dich("khoVanHanh.layNguoiChuTriThanhCong"));
    }

    /** Số kệ và sản phẩm trên sổ kệ theo danh mục (gộp cây con) — bảng chọn danh mục ở Tạo đợt kiểm kê. */
    @GetMapping("/danh-muc-tren-ke")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.DanhMucTrenKe>>> danhMucTrenKe(@RequestParam Integer khoId) {
        return ok(doc.danhMucTrenKe(khoId), ThongDiep.dich("khoVanHanh.layHangTrenKeTheoDanhMucThanhCong"));
    }

    @GetMapping("/hang-chua-co-ke")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<List<KiemKeDto.HangChuaCoKe>>> hangChuaCoKe(@RequestParam Integer khoId) {
        return ok(hangChuaCoKeService.danhSach(khoId), ThongDiep.dich("khoVanHanh.layHangChuaCoKeThanhCong"));
    }

    /**
     * Số lô, số sản phẩm chưa có kệ ở kho — số đếm cạnh mục Hàng chưa có kệ trên menu; kèm {@code phieuChuyenId} /
     * {@code phieuNhapId}: chỉ hàng của chứng từ đó (dòng nhắc trên phiếu chuyển kho, phiếu nhập).
     */
    @GetMapping("/hang-chua-co-ke/dem")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho})
    public ResponseEntity<ResponseData<KiemKeDto.DemChuaCoKe>> demHangChuaCoKe(
            @RequestParam Integer khoId, @RequestParam(required = false) Integer phieuChuyenId,
            @RequestParam(required = false) Integer phieuNhapId) {
        return ok(hangChuaCoKeService.dem(khoId, phieuChuyenId, phieuNhapId), ThongDiep.dich("khoVanHanh.demHangChuaCoKeThanhCong"));
    }

    @PostMapping("/xem-truoc")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho})
    public ResponseEntity<ResponseData<KiemKeDto.XemTruoc>> xemTruoc(@RequestBody KiemKeYeuCau.Dot yc,
                                                                     @RequestParam(required = false) Integer dotId) {
        return ok(kiemKe.xemTruoc(yc, dotId), ThongDiep.dich("khoVanHanh.xemTruocPhamViThanhCong"));
    }

    // ───────────────────────────── Nháp, bắt đầu ─────────────────────────────

    @PostMapping
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> taoNhap(@RequestBody KiemKeYeuCau.Dot yc) {
        return ok(kiemKe.taoNhap(yc), ThongDiep.dich("khoVanHanh.daLuuNhapKhoVanHanh"));
    }

    @PostMapping("/bat-dau-ngay")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> taoVaBatDau(
            @RequestBody KiemKeYeuCau.Dot yc, @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(kiemKe.taoVaBatDau(yc, khoa), ThongDiep.dich("khoVanHanh.daBatDauChotTon"));
    }

    @PutMapping("/{id}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> suaNhap(@PathVariable Integer id, @RequestBody KiemKeYeuCau.Dot yc) {
        return ok(kiemKe.suaNhap(id, yc), ThongDiep.dich("khoVanHanh.daLuuNhap"));
    }

    @PostMapping("/{id}/bat-dau")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> batDau(
            @PathVariable Integer id, @RequestBody KiemKeYeuCau.PhienBan yc,
            @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(kiemKe.batDau(id, yc.phienBan(), khoa), ThongDiep.dich("khoVanHanh.daBatDauChotTon"));
    }

    // ───────────────────────────── Kiểm đếm ─────────────────────────────

    @PutMapping("/{id}/dong/{dongId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.Dong>> dem(@PathVariable Integer id, @PathVariable Integer dongId,
                                                            @RequestBody KiemKeYeuCau.DemDong yc) {
        return ok(doc.mot(kiemKe.demDong(id, dongId, yc)), ThongDiep.dich("khoVanHanh.daLuuSoDem"));
    }

    @PostMapping("/{id}/phat-sinh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.Dong>> phatSinh(@PathVariable Integer id, @RequestBody KiemKeYeuCau.PhatSinh yc) {
        return ok(doc.mot(kiemKe.themPhatSinh(id, yc)), ThongDiep.dich("khoVanHanh.daThemLoPhatSinh"));
    }

    @PostMapping("/{id}/dong/{dongId}/anh")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<Integer>> themAnh(@PathVariable Integer id, @PathVariable Integer dongId,
                                                         @RequestParam("file") MultipartFile file,
                                                         @RequestParam(value = "moTa", required = false) String moTa) {
        AnhKiemKe a = anh.them(id, dongId, file, moTa);
        return ok(a.getId(), ThongDiep.dich("khoVanHanh.daThemAnhMinhChung"));
    }

    @DeleteMapping("/{id}/dong/{dongId}/anh/{anhId}")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<String>> xoaAnh(@PathVariable Integer id, @PathVariable Integer dongId,
                                                       @PathVariable Integer anhId) {
        anh.xoa(id, dongId, anhId);
        return ok("Success", ThongDiep.dich("khoVanHanh.daXoaAnh"));
    }

    @PostMapping("/{id}/trinh-duyet")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> trinhDuyet(
            @PathVariable Integer id, @RequestBody KiemKeYeuCau.PhienBan yc,
            @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(kiemKe.trinhDuyet(id, yc.phienBan(), khoa), ThongDiep.dich("khoVanHanh.daTrinhDuyet"));
    }

    // ───────────────────────────── Thẩm định ─────────────────────────────

    @PostMapping("/{id}/dem-lai")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true,
            permissions = {IPermissionType.dieu_chinh_ton_kho})
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> demLai(
            @PathVariable Integer id, @RequestBody KiemKeYeuCau.DemLai yc,
            @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(kiemKe.demLai(id, yc, khoa), ThongDiep.dich("khoVanHanh.daYeuCauDemLai"));
    }

    @PostMapping("/{id}/phe-duyet")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true,
            permissions = {IPermissionType.dieu_chinh_ton_kho})
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> pheDuyet(
            @PathVariable Integer id, @RequestBody KiemKeYeuCau.PhienBan yc,
            @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(duyet.pheDuyet(id, yc.phienBan(), khoa), ThongDiep.dich("khoVanHanh.daPheDuyetMoKhoa"));
    }

    @PostMapping("/{id}/huy")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<KiemKeDto.KetQuaLenh>> huy(
            @PathVariable Integer id, @RequestBody KiemKeYeuCau.Huy yc,
            @RequestHeader(value = KHOA_LENH, required = false) String khoa) {
        return ok(kiemKe.huy(id, yc, khoa), ThongDiep.dich("khoVanHanh.daHuyDot"));
    }

    // ───────────────────────────── Xếp kệ ─────────────────────────────

    @PostMapping("/xep-ke")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<String>> xepKe(@RequestParam Integer khoId, @RequestBody KiemKeYeuCau.XepKe yc) {
        com.dev.backend.utils.KhoDangChon.kiemTra(com.dev.backend.entities.Kho.builder().id(khoId).build(), "Kho đang chọn");
        soTonKe.xepKe(khoId, yc.loHangId(), yc.viTriKhoId(), yc.soLuong() == null ? 0 : yc.soLuong());
        return ok("Success", ThongDiep.dich("khoVanHanh.daXepHangLenKe"));
    }

    /** Xếp nhiều lô một lượt; phần nào lỗi báo riêng trong kết quả, các phần khác vẫn ghi. */
    @PostMapping("/xep-ke-nhieu")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<List<KiemKeDto.KetQuaXepKe>>> xepKeNhieu(@RequestParam Integer khoId,
                                                                               @RequestBody KiemKeYeuCau.XepNhieu yc) {
        com.dev.backend.utils.KhoDangChon.kiemTra(com.dev.backend.entities.Kho.builder().id(khoId).build(), "Kho đang chọn");
        List<KiemKeDto.KetQuaXepKe> kq = hangChuaCoKeService.xepNhieu(khoId, yc);
        long daXep = kq.stream().filter(KiemKeDto.KetQuaXepKe::daXep).count();
        return ok(kq, ThongDiep.dich("khoVanHanh.daXepPhanLenKe", daXep, kq.size()));
    }

    @PostMapping("/chuyen-ke")
    @RequireAuth(roles = {IRoleType.quan_tri_vien, IRoleType.quan_ly_kho, IRoleType.nhan_vien_kho}, inWarehouse = true)
    public ResponseEntity<ResponseData<String>> chuyenKe(@RequestParam Integer khoId, @RequestBody KiemKeYeuCau.ChuyenKe yc) {
        com.dev.backend.utils.KhoDangChon.kiemTra(com.dev.backend.entities.Kho.builder().id(khoId).build(), "Kho đang chọn");
        soTonKe.chuyenKe(khoId, yc.loHangId(), yc.tuViTriKhoId(), yc.denViTriKhoId(), yc.soLuong() == null ? 0 : yc.soLuong());
        return ok("Success", ThongDiep.dich("khoVanHanh.daChuyenKe"));
    }
}
