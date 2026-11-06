package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.dto.request.DanhMucQuanAoCreating;
import com.dev.backend.dto.request.DanhMucQuanAoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.entities.DanhMucQuanAo;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.DanhMucQuanAoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

// Luồng: Frontend → Controller → Service (tại đây) → Repository → DB → ResponseData → Frontend
@Service
public class DanhMucQuanAoService extends BaseServiceImpl<DanhMucQuanAo, Integer> {

    // Dùng cho các truy vấn JPQL tuỳ chỉnh ngoài phạm vi JpaRepository
    @Autowired
    private EntityManager entityManager;

    /** Chốt chặn dữ liệu chủ của kiểm kê khoanh vùng; null khi unit test dựng tay. */
    @Autowired(required = false)
    private KhoaKiemKeGuard khoaKiemKeGuard;

    /** Nhật ký nghiệp vụ (danh mục chung); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;
    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    // Truyền repository vào BaseServiceImpl để kế thừa CRUD chung (getOne, save, delete...)
    public DanhMucQuanAoService(DanhMucQuanAoRepository repository) {
        super(repository);
    }

    // Cast sang kiểu cụ thể để gọi các method tuỳ chỉnh của DanhMucQuanAoRepository
    public final DanhMucQuanAoRepository danhMucQuanAoRepository = (DanhMucQuanAoRepository) getRepository();

    private static final int TRANG_THAI_HOAT_DONG = 1;
    private static final int TRANG_THAI_NGUNG = 0;

    // Danh mục đang ngừng hoạt động (trangThai = 0). Trạng thái trống (null) coi như đang hoạt động, giống giao diện
    private static boolean dangNgungHoatDong(DanhMucQuanAo danhMuc) {
        return danhMuc != null && Objects.equals(danhMuc.getTrangThai(), TRANG_THAI_NGUNG);
    }

    /**
     * Chặn vòng lặp cha–con khi đổi danh mục cha.
     * Đi ngược từ danh mục cha mới lên tới gốc: gặp chính danh mục đang sửa nghĩa là cha mới nằm trong nhánh con của nó.
     * Nếu để lọt (VD A là cha của B, rồi lại đặt B làm cha của A), mapper dựng cây đệ quy không dừng → /all lỗi 500,
     * còn cây /get-cay-danh-muc mất luôn hai danh mục đó cùng nhánh con.
     * Giao diện đã chặn, nhưng gọi API thẳng hoặc hai người kéo thả cùng lúc vẫn tới được đây, nên phải chặn ở backend.
     * Gặp lại một danh mục đã đi qua nghĩa là dữ liệu phía trên đã có vòng sẵn: báo lỗi thay vì lặp vô hạn.
     */
    private static void kiemTraKhongTaoVongLap(Integer idDangSua, DanhMucQuanAo chaMoi) {
        Set<Integer> daDiQua = new HashSet<>();
        DanhMucQuanAo hienTai = chaMoi;
        while (hienTai != null) {
            Integer id = hienTai.getId();
            if (Objects.equals(id, idDangSua)) {
                throw new CommonException("Không thể chuyển danh mục vào nhánh con của chính nó");
            }
            if (!daDiQua.add(id)) {
                throw new CommonException("Dữ liệu danh mục cha đang bị lỗi vòng lặp, không chuyển vào đây được");
            }
            hienTai = hienTai.getDanhMucCha();
        }
    }

    // READ – Trả danh sách danh mục cha theo trạng thái → dùng cho API get-cay-danh-muc
    public List<DanhMucQuanAo> findAllDanhMucChaByTrangThai(Integer trangThai) {
        // Repository sinh SQL: SELECT * FROM danh_muc_quan_ao WHERE danh_muc_cha_id IS NULL AND trang_thai = ?
        return danhMucQuanAoRepository.findAllDanhMucChaByTrangThai(trangThai);
    }

    // CREATE – Tạo mới danh mục; @Transactional rollback toàn bộ nếu bất kỳ bước nào thất bại
    @Transactional
    public ResponseEntity<ResponseData<String>> create(DanhMucQuanAoCreating creating) {

        // Bước 1 – Kiểm tra trùng mã: Repository sinh SQL SELECT WHERE ma_danh_muc = ?
        Optional<DanhMucQuanAo> findingDanhMucQuanAo = danhMucQuanAoRepository
                .findByMaDanhMuc(creating.getMaDanhMuc());
        if (findingDanhMucQuanAo.isPresent()) {
            // Mã đã tồn tại → ném exception → GlobalExceptionHandler trả 400 cho Frontend
            throw new CommonException("Mã danh mục đã tồn tại");
        }

        // Bước 2 – Map RequestDTO → Entity (không nhận Entity trực tiếp từ FE để tránh lỗ hổng bảo mật)
        DanhMucQuanAo danhMucQuanAo = new DanhMucQuanAo();
        danhMucQuanAo.setMaDanhMuc(creating.getMaDanhMuc());
        danhMucQuanAo.setTenDanhMuc(creating.getTenDanhMuc());
        danhMucQuanAo.setMoTa(creating.getMoTa());
        // Không gửi trạng thái thì tạo ở trạng thái hoạt động (1), không để trống: trạng thái trống từng gây lỗi 500 khi sửa danh mục con
        danhMucQuanAo.setTrangThai(creating.getTrangThai() != null ? creating.getTrangThai() : TRANG_THAI_HOAT_DONG);

        // Bước 3 – Xử lý quan hệ cha-con: có cha → kiểm tra cha tồn tại; null → danh mục gốc
        if (creating.getDanhMucChaId() != null) {
            // Repository sinh SQL: SELECT * FROM danh_muc_quan_ao WHERE id = ?
            DanhMucQuanAo danhMucCha = getOne(creating.getDanhMucChaId()).orElseThrow(
                    () -> new CommonException("Danh mục cha không tồn tại id: " + creating.getDanhMucChaId())
            );
            danhMucQuanAo.setDanhMucCha(danhMucCha);
        } else {
            danhMucQuanAo.setDanhMucCha(null); // null = danh mục gốc, không có cha
        }

        // Bước 4 – Lưu vào DB: Hibernate sinh SQL INSERT INTO danh_muc_quan_ao(...)
        DanhMucQuanAo daTao = danhMucQuanAoRepository.save(danhMucQuanAo);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.danh_muc_quan_ao, daTao.getId(), IHanhDong.them_danh_muc_chung)
                .ma(daTao.getTenDanhMuc())
                .moi(anhDanhMuc(daTao)));
        // Bước 5 – Trả ResponseData về Controller → FE nhận status=200 → toast.success + reload cây
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Success")
                        .build()
        );
    }

    // UPDATE – Cập nhật thông tin danh mục (sửa thông tin, đổi cha, khoá/mở khoá, drag & drop về root)
    @Transactional
    public ResponseEntity<ResponseData<String>> update(DanhMucQuanAoUpdating updating) {

        // Bước 1 – Kiểm tra danh mục cần cập nhật có tồn tại không; không có → ném exception 400
        DanhMucQuanAo danhMucQuanAo = getOne(updating.getId()).orElseThrow(
                () -> new CommonException("Không tìm thấy danh mục id: " + updating.getId())
        );

        Map<String, Object> truoc = anhDanhMuc(danhMucQuanAo);
        // Kiểm kê theo danh mục đang chạy: không đổi cha của danh mục thuộc tập đang kiểm, cũng không đưa danh mục
        // khác vào nhánh đang kiểm (Master Data Guard)
        Integer chaCu = danhMucQuanAo.getDanhMucCha() == null ? null : danhMucQuanAo.getDanhMucCha().getId();
        if (khoaKiemKeGuard != null && !java.util.Objects.equals(chaCu, updating.getDanhMucChaId())) {
            khoaKiemKeGuard.giuTatCaKho();
            java.util.List<Integer> lienQuan = new java.util.ArrayList<>();
            lienQuan.add(danhMucQuanAo.getId());
            if (updating.getDanhMucChaId() != null) lienQuan.add(updating.getDanhMucChaId());
            khoaKiemKeGuard.kiemTraDanhMuc(lienQuan, "đổi danh mục cha");
        }

        // Bước 2 – Validate và xử lý quan hệ cha-con
        if (updating.getDanhMucChaId() != null) {

            if (updating.getDanhMucChaId().equals(updating.getId())) {
                throw new CommonException("Không thể gán danh mục cha cho chính nó");
            }

            // Kiểm tra danh mục cha tồn tại trong DB
            DanhMucQuanAo danhMucCha = getOne(updating.getDanhMucChaId()).orElseThrow(
                    () -> new CommonException("Danh mục cha không tồn tại id: " + updating.getDanhMucChaId())
            );

            // Không cho phép gán cha đang bị khoá (trangThai = 0).
            // So sánh an toàn với null: trước đây `getTrangThai() == 0` ném NullPointerException (lỗi 500) khi cha có trạng thái trống
            if (dangNgungHoatDong(danhMucCha)) {
                throw new CommonException("Danh mục cha đã bị xoá");
            }

            // Không cho chuyển vào nhánh con của chính nó (tạo vòng lặp cha–con)
            kiemTraKhongTaoVongLap(updating.getId(), danhMucCha);
            danhMucQuanAo.setDanhMucCha(danhMucCha);
        } else {
            danhMucQuanAo.setDanhMucCha(null); // null = chuyển về danh mục gốc (dùng khi drag & drop về root)
        }

        // Bước 3 – Cập nhật các trường từ RequestDTO vào Entity đang được JPA quản lý
        danhMucQuanAo.setTenDanhMuc(updating.getTenDanhMuc());
        danhMucQuanAo.setMoTa(updating.getMoTa());
        // 1 = hoạt động, 0 = ngừng hoạt động (khoá). Không gửi trạng thái thì giữ nguyên, không ghi trống
        if (updating.getTrangThai() != null) {
            danhMucQuanAo.setTrangThai(updating.getTrangThai());
        }

        // Bước 4 – Lưu vào DB: Hibernate sinh SQL UPDATE danh_muc_quan_ao SET ... WHERE id=?
        danhMucQuanAoRepository.save(danhMucQuanAo);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.danh_muc_quan_ao, danhMucQuanAo.getId(), IHanhDong.sua_danh_muc_chung)
                .ma(danhMucQuanAo.getTenDanhMuc())
                .thayDoi(truoc, anhDanhMuc(danhMucQuanAo)));
        // Bước 5 – Trả ResponseData về Controller → FE nhận status=200 → toast.success + reload cây
        return ResponseEntity.ok(
                ResponseData.<String>builder()
                        .status(HttpStatus.OK.value())
                        .data("Success")
                        .message("Cập nhật danh mục thành công")
                        .build()
        );
    }

    /** "Xóa" danh mục (DELETE /delete/{id}): chỉ chuyển ngừng hoạt động, nhật ký ghi xoa_danh_muc_chung. */
    @Transactional
    public void xoaMem(Integer id) {
        DanhMucQuanAo danhMuc = getOne(id).orElseThrow(
                () -> new CommonException("Không tìm thấy danh mục id: " + id)
        );
        Map<String, Object> truoc = anhDanhMuc(danhMuc);
        boolean daNgung = java.util.Objects.equals(danhMuc.getTrangThai(), TRANG_THAI_NGUNG);
        danhMuc.setTrangThai(TRANG_THAI_NGUNG);
        danhMucQuanAoRepository.save(danhMuc);
        // Đã ngừng từ trước (bấm xóa lần nữa): không ghi thêm dòng vô nghĩa
        if (daNgung) return;
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.danh_muc_quan_ao, danhMuc.getId(), IHanhDong.xoa_danh_muc_chung)
                .ma(danhMuc.getTenDanhMuc())
                .cu(truoc)
                .moi(NhatKyNghiepVu.anh("trangThai", TRANG_THAI_NGUNG)));
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    private static Map<String, Object> anhDanhMuc(DanhMucQuanAo d) {
        return NhatKyNghiepVu.anh(
                "ma", d.getMaDanhMuc(),
                "ten", d.getTenDanhMuc(),
                "danhMucCha", d.getDanhMucCha() == null ? null : d.getDanhMucCha().getTenDanhMuc(),
                "moTa", d.getMoTa(),
                "trangThai", d.getTrangThai());
    }

}
