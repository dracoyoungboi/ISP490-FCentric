package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.request.BienTheSanPhamCreating;
import com.dev.backend.dto.request.BienTheSanPhamUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoBasicInfoUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@Slf4j
public class SanPhamQuanAoService extends BaseServiceImpl<SanPhamQuanAo, Integer> {

        // ==========================================================
        // PRODUCT SERVICE (Nghiệp vụ chính của màn Quản lý sản phẩm)
        // - Tạo/cập nhật sản phẩm + biến thể + ảnh.
        // - Tính lại giá và trạng thái theo tồn kho thực tế.
        // - Trả DTO cho controller.
        // ==========================================================

        //Core bussiness logic
        @Autowired
        private EntityManager entityManager;
        @Autowired
        private DanhMucQuanAoService danhMucQuanAoService;
        @Autowired
        private BienTheSanPhamService bienTheSanPhamService;
        @Autowired
        private BienTheSanPhamRepository bienTheSanPhamRepository;
        @Autowired
        private MauSacService mauSacService;
        @Autowired
        private SizeService sizeService;
        @Autowired
        private ChatLieuService chatLieuService;
        @Autowired
        private ThuongHieuService thuongHieuService;
        @Autowired
        private NguoiDungService nguoiDungService;
        @Autowired
        private LichSuThayDoiService lichSuThayDoiService;

        //Image
        @Autowired
        private AnhQuanAoService anhQuanAoService;
        @Autowired
        private AnhBienTheService anhBienTheService;
        @Autowired
        private TepTinService tepTinService;
        @Autowired
        private MinioService minioService;

        //Mapper
        @Autowired
        private SanPhamQuanAoMapper sanPhamQuanAoMapper;
        private final ObjectMapper objectMapper = new ObjectMapper();

        @Override
        protected EntityManager getEntityManager() {
                return entityManager;
        }

        public SanPhamQuanAoService(SanPhamQuanAoRepository repository) {
                super(repository);
        }

        private final SanPhamQuanAoRepository repository = (SanPhamQuanAoRepository) getRepository();


        @Transactional
        public void recalculatePriceAndStatus(Integer sanPhamId) {
                // Đồng bộ giá và trạng thái sản phẩm dựa trên dữ liệu tồn kho theo lô.
                // 1. Ép Hibernate đẩy dữ liệu xuống DB để đảm bảo Query Native đọc được số mới nhất
                entityManager.flush();

                SanPhamQuanAo sp = repository.findById(sanPhamId)
                        .orElseThrow(() -> new CommonException("Không tìm thấy sản phẩm id: " + sanPhamId));

                List<BienTheSanPham> danhSachBienThe = sp.getBienTheSanPhams();

                // 2. Xử lý cache Hibernate nếu danh sách bị null khi vừa tạo mới
                if (danhSachBienThe == null || danhSachBienThe.isEmpty()) {
                        danhSachBienThe = entityManager.createQuery("SELECT b FROM BienTheSanPham b WHERE b.sanPham.id = :id", BienTheSanPham.class)
                                .setParameter("id", sanPhamId)
                                .getResultList();
                        sp.setBienTheSanPhams(danhSachBienThe);
                }
                BigDecimal tongGiaVonBienThe = BigDecimal.ZERO;
                BigDecimal tongGiaBanBienThe = BigDecimal.ZERO;
                int soBienTheCoHang = 0;

                // Trạng thái biến thể (1 Hoạt động / 0 Tạm ngừng) do người dùng quản lý,
                // KHÔNG suy ra từ tồn kho — chỉ tính lại giá ở đây.
                if (danhSachBienThe != null) {
                        for (BienTheSanPham bienThe : danhSachBienThe) {
                                // Query tính: SUM(so_luong_ton * gia_von) và SUM(so_luong_ton)
                                String sql = "SELECT SUM(t.so_luong_ton * l.gia_von), SUM(t.so_luong_ton) " +
                                        "FROM ton_kho_theo_lo t " +
                                        "JOIN lo_hang l ON t.lo_hang_id = l.id " +
                                        "WHERE l.bien_the_san_pham_id = :bienTheId";

                                Query query = entityManager.createNativeQuery(sql);
                                query.setParameter("bienTheId", bienThe.getId());
                                Object[] result = (Object[]) query.getSingleResult();

                                BigDecimal tongGiaTriTon = result[0] != null ? new BigDecimal(result[0].toString()) : BigDecimal.ZERO;
                                BigDecimal tongSoLuongTon = result[1] != null ? new BigDecimal(result[1].toString()) : BigDecimal.ZERO;

                                // Nếu biến thể còn tồn kho
                                if (tongSoLuongTon.compareTo(BigDecimal.ZERO) > 0) {
                                        // Công thức 2: Giá vốn biến thể = Tổng giá trị / Tổng tồn hệ thống
                                        BigDecimal giaVonTongVariant = tongGiaTriTon.divide(tongSoLuongTon, 2, RoundingMode.HALF_UP);
                                        bienThe.setGiaVon(giaVonTongVariant);

                                        // Công thức 3: Giá bán biến thể = Giá vốn * 1.2
                                        BigDecimal giaBanVariant = giaVonTongVariant.multiply(new BigDecimal("1.2"))
                                                .setScale(0, RoundingMode.CEILING);
                                        bienThe.setGiaBan(giaBanVariant);

                                        // Tích lũy để tính trung bình cộng cho sản phẩm cha
                                        tongGiaVonBienThe = tongGiaVonBienThe.add(giaVonTongVariant);
                                        tongGiaBanBienThe = tongGiaBanBienThe.add(giaBanVariant);
                                        soBienTheCoHang++;
                                } else {
                                        // Giữ nguyên hoặc set về 0 tùy bạn, ở đây tôi gán 0 cho minh bạch
                                        if (bienThe.getGiaVon() == null) bienThe.setGiaVon(BigDecimal.ZERO);
                                        if (bienThe.getGiaBan() == null) bienThe.setGiaBan(BigDecimal.ZERO);
                                }
                                bienTheSanPhamService.update(bienThe.getId(), bienThe);
                        }
                }

                // 3. Cập nhật giá cho Sản phẩm cha (SanPhamQuanAo)
                // Trạng thái 2 (Ngừng hoạt động) do người dùng đặt — giữ nguyên, chỉ tự đổi giữa 1/0.
                boolean ngungHoatDong = Integer.valueOf(2).equals(sp.getTrangThai());
                if (soBienTheCoHang > 0) {
                        // Giá vốn sản phẩm = Trung bình cộng giá vốn các biến thể còn hàng
                        sp.setGiaVonMacDinh(tongGiaVonBienThe.divide(new BigDecimal(soBienTheCoHang), 2, RoundingMode.HALF_UP));
                        // Giá bán sản phẩm = Trung bình cộng giá bán các biến thể còn hàng
                        sp.setGiaBanMacDinh(tongGiaBanBienThe.divide(new BigDecimal(soBienTheCoHang), 0, RoundingMode.CEILING));
                        if (!ngungHoatDong) sp.setTrangThai(1);
                } else {
                        // Nếu tất cả biến thể hết hàng
                        if (!ngungHoatDong) sp.setTrangThai(0);
                        sp.setGiaVonMacDinh(BigDecimal.ZERO);
                        sp.setGiaBanMacDinh(BigDecimal.ZERO);
                }

                repository.save(sp);
        }
        @Transactional
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> create(
                SanPhamQuanAoCreating creating,
                List<MultipartFile> anhSanPhams,
                List<MultipartFile> anhBienThes) {

                // Bước 1: Validate nghiệp vụ (không trùng tổ hợp thuộc tính biến thể).

                Set<String> checkDuplicateSet = new HashSet<>();
                for (BienTheSanPhamCreating bt : creating.getBienTheSanPhams()) {
                        String key = bt.getMauSacId() + "-" + bt.getSizeId() + "-" + bt.getChatLieuId();
                        if (!checkDuplicateSet.add(key)) {
                                throw new CommonException("Có biến thể sản phẩm trùng lặp về thuộc tính (Màu, Size, Chất liệu)!");
                        }
                }

                Instant instantNow = Instant.now();
                Date now = new Date();

                DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(creating.getDanhMucId()).orElseThrow(
                        () -> new CommonException("Danh mục không tồn tại id: " + creating.getDanhMucId())
                );

                String maVietTatDM = generateCodeFromName(danhMucQuanAo.getTenDanhMuc());
                String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
                String prefixMaSp = maVietTatDM + datePart; // VD: AT260314

                // Đếm số sản phẩm đã tồn tại trong ngày để lấy STT
                long stt = repository.countByMaSanPhamStartingWith(prefixMaSp) + 1;
                String maSanPhamAuto = prefixMaSp + stt;

                SanPhamQuanAo sanPhamQuanAo = SanPhamQuanAoCreating.toEntity(creating);

                Integer nguoiTaoId = SecurityContextHolder.getUser().getId();
                NguoiDung nguoiTao = nguoiDungService.getOne(nguoiTaoId).orElseThrow(
                        () -> new CommonException("Người tạo không tồn tại id: " + nguoiTaoId)
                );

                sanPhamQuanAo.setMaSanPham(maSanPhamAuto);
                sanPhamQuanAo.setDanhMuc(danhMucQuanAo);
                sanPhamQuanAo.setNguoiTao(nguoiTao);
                sanPhamQuanAo.setNgayTao(instantNow);

                // Gán thương hiệu (nếu có). Sản phẩm mới = gán mới nên chỉ chấp nhận thương hiệu đang hoạt động.
                if (creating.getThuongHieuId() != null) {
                        ThuongHieu thuongHieu = thuongHieuService.getOne(creating.getThuongHieuId()).orElseThrow(
                                () -> new CommonException("Thương hiệu không tồn tại id: " + creating.getThuongHieuId())
                        );
                        if (!Integer.valueOf(1).equals(thuongHieu.getTrangThai())) {
                                throw new CommonException("Thương hiệu \"" + thuongHieu.getTenThuongHieu()
                                        + "\" đang ngừng hoạt động, không thể gán cho sản phẩm mới");
                        }
                        sanPhamQuanAo.setThuongHieu(thuongHieu);
                }

                // Bước 2: Lưu sản phẩm cha trước để lấy id tham chiếu.
                sanPhamQuanAo = create(sanPhamQuanAo);

                // Bước 3: Upload ảnh sản phẩm chính (nếu có) và lưu metadata ảnh.
                if (anhSanPhams != null && !anhSanPhams.isEmpty()) {
                        try {
                                int i = 0;
                                for (MultipartFile file : anhSanPhams) {
                                        String objectName = minioService.upload(file, ITable.san_pham_quan_ao + "_" + sanPhamQuanAo.getMaSanPham() + "_" + now.getTime() + "_" + i++);
                                        TepTin tepTin = tepTinService.create(
                                                TepTin.builder()
                                                        .tenTepGoc(objectName)
                                                        .tenTaiLen(objectName)
                                                        .tenLuuTru(objectName)
                                                        .duongDan(minioService.getPublicUrl(objectName))
                                                        .loaiTepTin(FileType.IMAGE.toString())
                                                        .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                                        .trangThai(1)
                                                        .ngayTao(instantNow)
                                                        .build()
                                        );

                                        anhQuanAoService.create(
                                                AnhQuanAo.builder()
                                                        .quanAo(sanPhamQuanAo)
                                                        .tepTin(tepTin)
                                                        .anhChinh(i == 1 ? 1 : 0)
                                                        .trangThai(1)
                                                        .ngayTao(instantNow)
                                                        .build()
                                        );
                                }
                        } catch (Exception e) {
                                log.error("Lỗi tạo tệp tin cho quần áo: {}", creating.getTenSanPham(), e);
                                throw new RuntimeException("Lỗi tạo tệp tin cho quần áo: " + creating.getTenSanPham());
                        }
                }

                int imageCount = 0;

                // Bước 4: Tạo biến thể + upload ảnh biến thể tương ứng.
                for (BienTheSanPhamCreating btspCreating : creating.getBienTheSanPhams()) {

                        MauSac mauSac = mauSacService.getOne(btspCreating.getMauSacId()).orElseThrow(
                                () -> new CommonException("Không tìm thấy màu id: " + btspCreating.getMauSacId()));

                        Size size = sizeService.getOne(btspCreating.getSizeId()).orElseThrow(
                                () -> new CommonException("Không tìm thấy size id: " + btspCreating.getSizeId()));

                        ChatLieu chatLieu = chatLieuService.getOne(btspCreating.getChatLieuId()).orElseThrow(
                                () -> new CommonException("Không tìm thấy chất liệu id: " + btspCreating.getChatLieuId()));

                        // Công thức SKU = [Mã SP] + [Mã chất liệu] + [Mã size] + [Mã màu]
                        String maCL = chatLieu.getMaChatLieu();
                        String maSize = size.getMaSize();
                        String maMau = mauSac.getMaMau();

                        String autoSku = maSanPhamAuto + "-" + maCL + "-" + maSize + "-" + maMau;

                        BienTheSanPham bienTheSanPham = BienTheSanPhamCreating.toEntity(btspCreating);
                        bienTheSanPham.setSanPham(sanPhamQuanAo);
                        bienTheSanPham.setMaSku(autoSku); // Gán SKU tự động
                        bienTheSanPham.setMauSac(mauSac);
                        bienTheSanPham.setSize(size);
                        bienTheSanPham.setChatLieu(chatLieu);
                        bienTheSanPham.setTrangThai(1);
                        bienTheSanPham.setNgayTao(instantNow);

                        bienTheSanPhamService.create(bienTheSanPham);

                        // Xử lý ảnh biến thể
                        if (anhBienThes != null && imageCount < anhBienThes.size()) {
                                try {
                                        String objectName = minioService.upload(anhBienThes.get(imageCount), ITable.bien_the_san_pham + "_" + autoSku + "_" + now.getTime());
                                        TepTin tepTin = tepTinService.create(
                                                TepTin.builder()
                                                        .tenTepGoc(objectName)
                                                        .tenTaiLen(objectName)
                                                        .tenLuuTru(objectName)
                                                        .duongDan(minioService.getPublicUrl(objectName))
                                                        .loaiTepTin(FileType.IMAGE.toString())
                                                        .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                                        .trangThai(1)
                                                        .ngayTao(instantNow)
                                                        .build()
                                        );

                                        anhBienTheService.create(
                                                AnhBienThe.builder()
                                                        .bienThe(bienTheSanPham)
                                                        .tepTin(tepTin)
                                                        .trangThai(1)
                                                        .ngayTao(instantNow)
                                                        .build()
                                        );
                                        imageCount++;
                                } catch (Exception e) {
                                        log.error("Lỗi tạo tệp tin cho biến thể: {}", autoSku, e);
                                }
                        }
                }

                // Bước 5: Tính lại giá/trạng thái theo tồn kho và ghi lịch sử thao tác.
                recalculatePriceAndStatus(sanPhamQuanAo.getId());

                sanPhamQuanAo = getOne(sanPhamQuanAo.getId()).get();

                saveLichSu(sanPhamQuanAo, creating, nguoiTao, instantNow);

                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoMapper.toDto(sanPhamQuanAo))
                                .message("Tạo sản phẩm thành công với mã: " + maSanPhamAuto)
                                .build()
                );
        }

        private String generateCodeFromName(String name) {
                if (name == null || name.isEmpty()) return "XX";
                String normalized = Normalizer.normalize(name, Normalizer.Form.NFD)
                        .replaceAll("\\p{M}", "")
                        .toUpperCase();
                String[] words = normalized.split("\\s+");
                StringBuilder code = new StringBuilder();
                for (String word : words) {
                        if (!word.isEmpty()) code.append(word.charAt(0));
                }
                return code.toString();
        }

        private void saveLichSu(SanPhamQuanAo sp, SanPhamQuanAoCreating creating, NguoiDung nguoiTao, Instant now) {
                try {
                        objectMapper.registerModule(new JavaTimeModule());
                        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
                        String giaTriMoiJson = objectMapper.writeValueAsString(creating);

                        lichSuThayDoiService.create(
                                LichSuThayDoi.builder()
                                        .loaiThamChieu(ITable.san_pham_quan_ao)
                                        .idThamChieu(sp.getId())
                                        .hanhDong(IHanhDong.them_moi_san_pham)
                                        .giaTriMoi(giaTriMoiJson)
                                        .nguoiThucHien(nguoiTao)
                                        .ngayThucHien(now)
                                        .ghiChu("Tạo sản phẩm tự động mã: " + sp.getMaSanPham())
                                        .build()
                        );
                } catch (Exception e) {
                        log.error("Lỗi lưu lịch sử", e);
                }
        }


        @Transactional
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> update(
                SanPhamQuanAoUpdating updating,
                List<MultipartFile> anhSanPhams,
                List<MultipartFile> anhBienThes) {

                // Luồng cập nhật: kiểm tra toàn bộ (sản phẩm + biến thể) -> cập nhật thông tin chính -> ảnh sản phẩm
                // -> cập nhật/thêm biến thể (+ ảnh) -> ghi lịch sử -> tính lại giá/trạng thái.
                // Mọi kiểm tra nghiệp vụ chạy TRƯỚC khi ghi, nên lỗi không để lại dữ liệu lưu dở.

                SanPhamQuanAo sanPhamQuanAo = getOne(updating.getId()).orElseThrow(
                        () -> new CommonException("Không tìm thấy sản phẩm id: " + updating.getId())
                );

                // Mã sản phẩm do hệ thống sinh khi tạo và đã dùng để ghép mã SKU -> không cho đổi.
                // FE gửi lại đúng mã cũ (hoặc để trống) thì bỏ qua; gửi mã khác thì từ chối.
                String maSanPhamGuiLen = updating.getMaSanPham() == null ? "" : updating.getMaSanPham().trim();
                if (!maSanPhamGuiLen.isEmpty() && !maSanPhamGuiLen.equals(sanPhamQuanAo.getMaSanPham())) {
                        throw new CommonException("Mã sản phẩm được hệ thống sinh tự động, không thể thay đổi");
                }

                DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(updating.getDanhMucId()).orElseThrow(
                        () -> new CommonException("Không tìm thấy danh mục quần áo id: " + updating.getDanhMucId())
                );

                // Kiểm tra và lập kế hoạch ghi cho từng biến thể (sửa giá/trạng thái, đổi màu/size, thêm mới).
                List<BienTheSanPhamUpdating> dsBienTheGuiLen = updating.getBienTheSanPhams() == null
                        ? List.of() : updating.getBienTheSanPhams();
                List<KeHoachBienThe> keHoachBienThes = lapKeHoachBienThe(sanPhamQuanAo, dsBienTheGuiLen, anhBienThes);

                // ===================== GHI DỮ LIỆU =====================
                sanPhamQuanAo.setTenSanPham(updating.getTenSanPham());
                sanPhamQuanAo.setDanhMuc(danhMucQuanAo);
                sanPhamQuanAo.setMoTa(updating.getMoTa());
                sanPhamQuanAo.setMaVach(updating.getMaVach());
                sanPhamQuanAo.setGiaVonMacDinh(updating.getGiaVonMacDinh());
                sanPhamQuanAo.setMucTonToiThieu(updating.getMucTonToiThieu());
                sanPhamQuanAo.setTrangThai(updating.getTrangThai());
                // Thay đổi thương hiệu chỉ áp dụng khi FE gửi cờ capNhatThuongHieu = true
                if (updating.isCapNhatThuongHieu()) {
                        applyThuongHieu(sanPhamQuanAo, updating.getThuongHieuId());
                }
                sanPhamQuanAo = update(updating.getId(), sanPhamQuanAo);
                if (updating.isImageUpdated()) {
                        //Lấy danh sách ID tệp tin để xóa file vật lý sau
                        List<Integer> tepTinIds = sanPhamQuanAo.getAnhQuanAos()
                                .stream()
                                .map(anh -> anh.getTepTin().getId())
                                .toList();

                        //Xóa sạch danh sách ảnh trong Object (Hibernate sẽ tự xóa bản ghi AnhQuanAo trong DB)
                        sanPhamQuanAo.getAnhQuanAos().clear();

                        //Ép Hibernate đồng bộ ngay để tránh xung đột với logic upload phía sau
                        entityManager.flush();

                        //Xóa tệp tin (DB và MinIO)
                        tepTinIds.forEach(id -> tepTinService.hardDeleteNoMessage(id));
                        try {
                                Date now = new Date();
                                int i = 0;
                                for (MultipartFile file : anhSanPhams) {
                                        String objectName = minioService.upload(file, ITable.san_pham_quan_ao + "_" + sanPhamQuanAo.getMaSanPham() + "_" + now.getTime() + "_" + i++);

                                        TepTin tepTin = tepTinService.create(TepTin.builder()
                                                .tenTepGoc(objectName)
                                                .tenTaiLen(objectName)
                                                .tenLuuTru(objectName)
                                                .duongDan(minioService.getPublicUrl(objectName))
                                                .loaiTepTin(FileType.IMAGE.toString())
                                                .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                                .trangThai(1)
                                                .ngayTao(Instant.now())
                                                .build()
                                        );

                                        //Thêm ảnh mới trực tiếp vào list của sản phẩm
                                        AnhQuanAo newAnh = AnhQuanAo.builder()
                                                .quanAo(sanPhamQuanAo)
                                                .tepTin(tepTin)
                                                .anhChinh(i == 1 ? 1 : 0)
                                                .trangThai(1)
                                                .ngayTao(Instant.now())
                                                .build();

                                        sanPhamQuanAo.getAnhQuanAos().add(newAnh);
                                }
                                System.out.println("Có tổng cộng " + i + " ảnh");

                        } catch (Exception e) {
                                throw new RuntimeException("Lỗi upload ảnh: " + e.getMessage());
                        }


                }

                // Biến thể: file ảnh thứ i trong anhBienThes ứng với biến thể thứ i gửi lên
                // (FE gửi file rỗng giữ chỗ cho biến thể không đổi ảnh).
                Instant bayGio = Instant.now();
                long dauThoiGian = bayGio.toEpochMilli();
                List<Map<String, Object>> thuocTinhCu = new ArrayList<>();
                List<Map<String, Object>> thuocTinhMoi = new ArrayList<>();
                List<Map<String, Object>> bienTheThemMoi = new ArrayList<>();
                for (KeHoachBienThe keHoach : keHoachBienThes) {
                        BienTheSanPhamUpdating duLieu = keHoach.duLieu;
                        BienTheSanPham bienThe;
                        if (keHoach.bienThe != null) {
                                bienThe = keHoach.bienThe;
                                if (keHoach.doiThuocTinh) {
                                        thuocTinhCu.add(moTaBienThe(bienThe));
                                        bienThe.setMauSac(keHoach.mauSac);
                                        bienThe.setSize(keHoach.size);
                                        bienThe.setMaSku(keHoach.maSkuMoi);
                                        thuocTinhMoi.add(moTaBienThe(bienThe));
                                }
                                bienThe.setGiaVon(duLieu.getGiaVon());
                                bienThe.setGiaBan(duLieu.getGiaBan());
                                bienThe.setTrangThai(duLieu.getTrangThai());
                                bienThe = bienTheSanPhamService.update(bienThe.getId(), bienThe);
                        } else {
                                bienThe = bienTheSanPhamService.create(
                                        BienTheSanPham.builder()
                                                .sanPham(sanPhamQuanAo)
                                                .mauSac(keHoach.mauSac)
                                                .size(keHoach.size)
                                                .chatLieu(keHoach.chatLieu)
                                                .maSku(keHoach.maSkuMoi)
                                                .giaVon(duLieu.getGiaVon() != null ? duLieu.getGiaVon() : BigDecimal.ZERO)
                                                .giaBan(duLieu.getGiaBan() != null ? duLieu.getGiaBan() : BigDecimal.ZERO)
                                                .trangThai(duLieu.getTrangThai() != null ? duLieu.getTrangThai() : 1)
                                                .ngayTao(bayGio)
                                                .build()
                                );
                                // Giữ danh sách biến thể trong bộ nhớ khớp DB để bước tính giá phía sau thấy biến thể mới.
                                if (sanPhamQuanAo.getBienTheSanPhams() != null
                                        && Hibernate.isInitialized(sanPhamQuanAo.getBienTheSanPhams())) {
                                        sanPhamQuanAo.getBienTheSanPhams().add(bienThe);
                                }
                                bienTheThemMoi.add(moTaBienThe(bienThe));
                        }
                        if (duLieu.isImageUpdated()) {
                                capNhatAnhBienThe(bienThe, anhBienThes.get(keHoach.viTri),
                                        sanPhamQuanAo.getMaSanPham(), dauThoiGian, keHoach.viTri, bayGio);
                        }
                }

                if (!thuocTinhMoi.isEmpty() || !bienTheThemMoi.isEmpty()) {
                        Map<String, Object> giaTriCu = new LinkedHashMap<>();
                        Map<String, Object> giaTriMoi = new LinkedHashMap<>();
                        if (!thuocTinhMoi.isEmpty()) {
                                giaTriCu.put("bienTheDoiThuocTinh", thuocTinhCu);
                                giaTriMoi.put("bienTheDoiThuocTinh", thuocTinhMoi);
                        }
                        if (!bienTheThemMoi.isEmpty()) {
                                giaTriMoi.put("bienTheThemMoi", bienTheThemMoi);
                        }
                        List<String> noiDung = new ArrayList<>();
                        if (!thuocTinhMoi.isEmpty()) noiDung.add("đổi màu/size " + thuocTinhMoi.size() + " biến thể");
                        if (!bienTheThemMoi.isEmpty()) noiDung.add("thêm " + bienTheThemMoi.size() + " biến thể mới");
                        ghiLichSuCapNhat(sanPhamQuanAo, giaTriCu, giaTriMoi,
                                "Cập nhật biến thể sản phẩm " + sanPhamQuanAo.getMaSanPham() + ": " + String.join(", ", noiDung));
                }

                recalculatePriceAndStatus(sanPhamQuanAo.getId());
                sanPhamQuanAo = getOne(sanPhamQuanAo.getId()).orElseThrow(
                        () -> new CommonException("Không tìm thấy sản phẩm quần áo id: " + updating.getId())
                );
                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoMapper.toDto(sanPhamQuanAo))
                                .message("Success")
                                .build());
        }

        /**
         * Kế hoạch ghi cho một dòng biến thể gửi lên, đã được kiểm tra hợp lệ.
         * bienThe = null nghĩa là biến thể mới; mauSac/size/chatLieu là thuộc tính SAU khi lưu.
         */
        private static final class KeHoachBienThe {
                final int viTri;
                final BienTheSanPhamUpdating duLieu;
                final BienTheSanPham bienThe;
                MauSac mauSac;
                Size size;
                ChatLieu chatLieu;
                boolean doiThuocTinh;
                String maSkuMoi;

                KeHoachBienThe(int viTri, BienTheSanPhamUpdating duLieu, BienTheSanPham bienThe) {
                        this.viTri = viTri;
                        this.duLieu = duLieu;
                        this.bienThe = bienThe;
                }
        }

        /**
         * Kiểm tra toàn bộ danh sách biến thể gửi lên (chưa ghi gì xuống DB):
         * - Biến thể có id: phải thuộc đúng sản phẩm, không gửi trùng; chỉ đổi được màu/size khi CHƯA phát sinh
         *   giao dịch; không đổi chất liệu.
         * - Biến thể mới (id = null): bắt buộc màu + size; chất liệu lấy theo lựa chọn hoặc chất liệu chung của sản phẩm.
         * - Sau khi lưu, mọi biến thể của sản phẩm phải khác nhau (màu + size + chất liệu) và mã SKU là duy nhất.
         * - Không cho đổi chéo trong một lần lưu (tổ hợp/SKU đích đang thuộc biến thể khác) vì ràng buộc UNIQUE
         *   của DB sẽ vỡ giữa chừng khi ghi.
         */
        private List<KeHoachBienThe> lapKeHoachBienThe(SanPhamQuanAo sanPham,
                                                       List<BienTheSanPhamUpdating> dsGuiLen,
                                                       List<MultipartFile> anhBienThes) {
                List<BienTheSanPham> bienTheHienCo = bienTheSanPhamRepository.findBySanPham_Id(sanPham.getId());
                Map<Integer, BienTheSanPham> bienTheTheoId = new HashMap<>();
                for (BienTheSanPham bt : bienTheHienCo) {
                        bienTheTheoId.put(bt.getId(), bt);
                }
                Set<Integer> idDaPhatSinhGiaoDich = new HashSet<>(
                        bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(sanPham.getId()));
                Set<Integer> idChatLieuHienCo = new LinkedHashSet<>();
                for (BienTheSanPham bt : bienTheHienCo) {
                        idChatLieuHienCo.add(bt.getChatLieu().getId());
                }

                List<KeHoachBienThe> dsKeHoach = new ArrayList<>();
                Set<Integer> idDaGap = new HashSet<>();
                for (int i = 0; i < dsGuiLen.size(); i++) {
                        BienTheSanPhamUpdating duLieu = dsGuiLen.get(i);
                        int stt = i + 1;
                        if (duLieu == null) {
                                throw new CommonException("Dữ liệu biến thể #" + stt + " không hợp lệ");
                        }
                        if (duLieu.getGiaVon() != null && duLieu.getGiaVon().signum() < 0) {
                                throw new CommonException("Giá vốn của biến thể #" + stt + " không được âm");
                        }
                        if (duLieu.getGiaBan() != null && duLieu.getGiaBan().signum() < 0) {
                                throw new CommonException("Giá bán của biến thể #" + stt + " không được âm");
                        }

                        KeHoachBienThe keHoach;
                        if (duLieu.getId() != null) {
                                // ----- Biến thể đã có -----
                                if (!idDaGap.add(duLieu.getId())) {
                                        throw new CommonException("Biến thể id " + duLieu.getId() + " bị gửi trùng trong cùng một lần lưu");
                                }
                                BienTheSanPham bienThe = bienTheTheoId.get(duLieu.getId());
                                if (bienThe == null) {
                                        // Chặn sửa chéo biến thể của sản phẩm khác.
                                        if (bienTheSanPhamRepository.existsById(duLieu.getId())) {
                                                throw new CommonException("Biến thể id " + duLieu.getId() + " không thuộc sản phẩm đang cập nhật");
                                        }
                                        throw new CommonException("Không tìm thấy biến thể sản phẩm id: " + duLieu.getId());
                                }
                                if (duLieu.getChatLieuId() != null
                                        && !duLieu.getChatLieuId().equals(bienThe.getChatLieu().getId())) {
                                        throw new CommonException("Không thể đổi chất liệu của biến thể đã tạo (" + bienThe.getMaSku() + ")");
                                }
                                boolean doiMau = duLieu.getMauSacId() != null
                                        && !duLieu.getMauSacId().equals(bienThe.getMauSac().getId());
                                boolean doiSize = duLieu.getSizeId() != null
                                        && !duLieu.getSizeId().equals(bienThe.getSize().getId());

                                keHoach = new KeHoachBienThe(i, duLieu, bienThe);
                                keHoach.doiThuocTinh = doiMau || doiSize;
                                if (keHoach.doiThuocTinh && idDaPhatSinhGiaoDich.contains(bienThe.getId())) {
                                        throw new CommonException("Biến thể " + bienThe.getMaSku()
                                                + " đã phát sinh giao dịch (tồn kho, chứng từ hoặc đồng bộ sàn) nên không thể đổi màu sắc/size."
                                                + " Hãy chuyển biến thể này sang Tạm ngừng và thêm biến thể mới.");
                                }
                                keHoach.mauSac = doiMau ? timMauSac(duLieu.getMauSacId()) : bienThe.getMauSac();
                                keHoach.size = doiSize ? timSize(duLieu.getSizeId()) : bienThe.getSize();
                                keHoach.chatLieu = bienThe.getChatLieu();
                        } else {
                                // ----- Biến thể mới -----
                                if (duLieu.getMauSacId() == null || duLieu.getSizeId() == null) {
                                        throw new CommonException("Biến thể mới #" + stt + ": vui lòng chọn màu sắc và size");
                                }
                                keHoach = new KeHoachBienThe(i, duLieu, null);
                                keHoach.doiThuocTinh = true;
                                keHoach.mauSac = timMauSac(duLieu.getMauSacId());
                                keHoach.size = timSize(duLieu.getSizeId());
                                if (duLieu.getChatLieuId() != null) {
                                        keHoach.chatLieu = chatLieuService.getOne(duLieu.getChatLieuId()).orElseThrow(
                                                () -> new CommonException("Không tìm thấy chất liệu id: " + duLieu.getChatLieuId()));
                                } else if (idChatLieuHienCo.size() == 1) {
                                        keHoach.chatLieu = bienTheHienCo.get(0).getChatLieu();
                                } else {
                                        throw new CommonException("Biến thể mới #" + stt + ": vui lòng chọn chất liệu");
                                }
                        }

                        if (duLieu.isImageUpdated()) {
                                MultipartFile file = anhBienThes != null && i < anhBienThes.size() ? anhBienThes.get(i) : null;
                                if (file == null || file.isEmpty()) {
                                        throw new CommonException("Thiếu tệp ảnh cho biến thể #" + stt);
                                }
                        }
                        if (keHoach.doiThuocTinh) {
                                // Công thức SKU giống lúc tạo: [Mã SP]-[Mã chất liệu]-[Mã size]-[Mã màu]
                                keHoach.maSkuMoi = sanPham.getMaSanPham() + "-" + keHoach.chatLieu.getMaChatLieu()
                                        + "-" + keHoach.size.getMaSize() + "-" + keHoach.mauSac.getMaMau();
                        }
                        dsKeHoach.add(keHoach);
                }

                // Tổ hợp (màu + size + chất liệu) của TẤT CẢ biến thể sau khi lưu phải khác nhau.
                Set<Integer> idCoTrongYeuCau = new HashSet<>();
                for (KeHoachBienThe keHoach : dsKeHoach) {
                        if (keHoach.bienThe != null) idCoTrongYeuCau.add(keHoach.bienThe.getId());
                }
                Set<String> toHopSauLuu = new HashSet<>();
                for (BienTheSanPham bt : bienTheHienCo) {
                        if (!idCoTrongYeuCau.contains(bt.getId())) {
                                toHopSauLuu.add(khoaToHop(bt.getMauSac(), bt.getSize(), bt.getChatLieu()));
                        }
                }
                for (KeHoachBienThe keHoach : dsKeHoach) {
                        if (!toHopSauLuu.add(khoaToHop(keHoach.mauSac, keHoach.size, keHoach.chatLieu))) {
                                throw new CommonException("Đã có biến thể cùng màu sắc, size và chất liệu ("
                                        + moTaToHop(keHoach) + "). Mỗi biến thể phải khác nhau.");
                        }
                }

                // Không cho đổi chéo trong cùng một lần lưu + mã SKU mới phải duy nhất toàn hệ thống.
                Map<String, BienTheSanPham> bienTheTheoToHopHienTai = new HashMap<>();
                for (BienTheSanPham bt : bienTheHienCo) {
                        bienTheTheoToHopHienTai.put(khoaToHop(bt.getMauSac(), bt.getSize(), bt.getChatLieu()), bt);
                }
                Set<String> skuMoi = new HashSet<>();
                for (KeHoachBienThe keHoach : dsKeHoach) {
                        if (!keHoach.doiThuocTinh) continue;
                        BienTheSanPham dangGiu = bienTheTheoToHopHienTai.get(
                                khoaToHop(keHoach.mauSac, keHoach.size, keHoach.chatLieu));
                        if (dangGiu != null && (keHoach.bienThe == null || !dangGiu.getId().equals(keHoach.bienThe.getId()))) {
                                throw new CommonException("Tổ hợp " + moTaToHop(keHoach) + " hiện đang thuộc biến thể "
                                        + dangGiu.getMaSku() + ". Không thể đổi chéo màu/size giữa các biến thể trong cùng một lần lưu,"
                                        + " hãy lưu thay đổi của biến thể " + dangGiu.getMaSku() + " trước.");
                        }
                        if (!skuMoi.add(keHoach.maSkuMoi)) {
                                throw new CommonException("Mã SKU " + keHoach.maSkuMoi + " bị trùng giữa các biến thể");
                        }
                        boolean skuDaTonTai = keHoach.bienThe == null
                                ? bienTheSanPhamRepository.existsByMaSku(keHoach.maSkuMoi)
                                : bienTheSanPhamRepository.existsByMaSkuAndIdNot(keHoach.maSkuMoi, keHoach.bienThe.getId());
                        if (skuDaTonTai) {
                                throw new CommonException("Mã SKU " + keHoach.maSkuMoi + " đã tồn tại trong hệ thống. Vui lòng chọn màu sắc/size khác.");
                        }
                }
                return dsKeHoach;
        }

        private MauSac timMauSac(Integer id) {
                return mauSacService.getOne(id).orElseThrow(() -> new CommonException("Không tìm thấy màu id: " + id));
        }

        private Size timSize(Integer id) {
                return sizeService.getOne(id).orElseThrow(() -> new CommonException("Không tìm thấy size id: " + id));
        }

        private String khoaToHop(MauSac mauSac, Size size, ChatLieu chatLieu) {
                return mauSac.getId() + "-" + size.getId() + "-" + chatLieu.getId();
        }

        private String moTaToHop(KeHoachBienThe keHoach) {
                return keHoach.mauSac.getTenMau() + " / " + keHoach.size.getTenSize() + " / " + keHoach.chatLieu.getTenChatLieu();
        }

        private Map<String, Object> moTaBienThe(BienTheSanPham bt) {
                Map<String, Object> moTa = new LinkedHashMap<>();
                moTa.put("id", bt.getId());
                moTa.put("maSku", bt.getMaSku());
                moTa.put("mauSacId", bt.getMauSac().getId());
                moTa.put("tenMau", bt.getMauSac().getTenMau());
                moTa.put("sizeId", bt.getSize().getId());
                moTa.put("tenSize", bt.getSize().getTenSize());
                moTa.put("chatLieuId", bt.getChatLieu().getId());
                moTa.put("tenChatLieu", bt.getChatLieu().getTenChatLieu());
                return moTa;
        }

        /** Tải ảnh mới cho biến thể: thay tệp của ảnh cũ (xóa tệp cũ) hoặc tạo ảnh biến thể nếu chưa có. */
        private void capNhatAnhBienThe(BienTheSanPham bienThe, MultipartFile file, String maSanPham,
                                       long dauThoiGian, int viTri, Instant bayGio) {
                try {
                        String objectName = minioService.upload(file, ITable.bien_the_san_pham + "_" + maSanPham + "_" + dauThoiGian + "_" + viTri);
                        TepTin tepTin = tepTinService.create(TepTin.builder()
                                .tenTepGoc(objectName)
                                .tenTaiLen(objectName)
                                .tenLuuTru(objectName)
                                .duongDan(minioService.getPublicUrl(objectName))
                                .loaiTepTin(FileType.IMAGE.toString())
                                .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                .ngayTao(bayGio)
                                .trangThai(1)
                                .build());

                        if (bienThe.getAnhBienThe() != null) {
                                Integer idTepCu = bienThe.getAnhBienThe().getTepTin().getId();
                                bienThe.getAnhBienThe().setTepTin(tepTin);
                                anhBienTheService.update(bienThe.getAnhBienThe().getId(), bienThe.getAnhBienThe());
                                tepTinService.hardDeleteNoMessage(idTepCu);
                        } else {
                                AnhBienThe anhBienThe = anhBienTheService.create(
                                        AnhBienThe.builder()
                                                .bienThe(bienThe)
                                                .tepTin(tepTin)
                                                .trangThai(1)
                                                .ngayTao(bayGio)
                                                .build()
                                );
                                bienThe.setAnhBienThe(anhBienThe);
                        }
                } catch (Exception e) {
                        log.error("Lỗi tạo tệp tin cho biến thể: {}", bienThe.getMaSku(), e);
                        throw new RuntimeException("Lỗi tạo tệp tin cho biến thể " + bienThe.getMaSku(), e);
                }
        }

        /**
         * Cập nhật riêng thông tin cơ bản (không đụng giá/ảnh/biến thể/trạng thái).
         * KHÔNG gọi recalculatePriceAndStatus để tránh giá/trạng thái bị tính lại theo tồn kho.
         */
        @Transactional
        public SanPhamQuanAoDto updateBasicInfo(Integer id, SanPhamQuanAoBasicInfoUpdating dto) {
                SanPhamQuanAo sp = getOne(id).orElseThrow(
                        () -> new CommonException("Không tìm thấy sản phẩm id: " + id));

                Map<String, Object> giaTriCu = new LinkedHashMap<>();
                Map<String, Object> giaTriMoi = new LinkedHashMap<>();

                if (dto.getTenSanPham() != null && !dto.getTenSanPham().isBlank()) {
                        String ten = dto.getTenSanPham().trim();
                        if (!ten.equals(sp.getTenSanPham())) {
                                giaTriCu.put("tenSanPham", sp.getTenSanPham());
                                giaTriMoi.put("tenSanPham", ten);
                                sp.setTenSanPham(ten);
                        }
                }
                if (dto.getMoTa() != null) {
                        String moTa = blankToNull(dto.getMoTa());
                        if (!Objects.equals(moTa, sp.getMoTa())) {
                                giaTriCu.put("moTa", sp.getMoTa());
                                giaTriMoi.put("moTa", moTa);
                                sp.setMoTa(moTa);
                        }
                }
                if (dto.getMaVach() != null) {
                        String maVach = blankToNull(dto.getMaVach());
                        if (!Objects.equals(maVach, sp.getMaVach())) {
                                giaTriCu.put("maVach", sp.getMaVach());
                                giaTriMoi.put("maVach", maVach);
                                sp.setMaVach(maVach);
                        }
                }
                if (dto.getDanhMucId() != null) {
                        DanhMucQuanAo danhMuc = danhMucQuanAoService.getOne(dto.getDanhMucId()).orElseThrow(
                                () -> new CommonException("Không tìm thấy danh mục quần áo id: " + dto.getDanhMucId())
                        );
                        if (!danhMuc.getId().equals(sp.getDanhMuc().getId())) {
                                giaTriCu.put("danhMucId", sp.getDanhMuc().getId());
                                giaTriMoi.put("danhMucId", danhMuc.getId());
                                sp.setDanhMuc(danhMuc);
                        }
                }
                if (dto.getMucTonToiThieu() != null && !dto.getMucTonToiThieu().equals(sp.getMucTonToiThieu())) {
                        giaTriCu.put("mucTonToiThieu", sp.getMucTonToiThieu());
                        giaTriMoi.put("mucTonToiThieu", dto.getMucTonToiThieu());
                        sp.setMucTonToiThieu(dto.getMucTonToiThieu());
                }
                if (dto.isCapNhatThuongHieu()) {
                        Integer oldId = sp.getThuongHieu() != null ? sp.getThuongHieu().getId() : null;
                        Integer newId = dto.getThuongHieuId();
                        if (!Objects.equals(oldId, newId)) {
                                applyThuongHieu(sp, newId);
                                giaTriCu.put("thuongHieuId", oldId);
                                giaTriMoi.put("thuongHieuId", newId);
                        }
                }

                sp = repository.save(sp);

                // Ghi lịch sử thay đổi nếu thực sự có field được cập nhật
                if (!giaTriMoi.isEmpty()) {
                        saveLichSuBasicInfo(sp, giaTriCu, giaTriMoi);
                }

                return getDetail(id);
        }

        /**
         * Áp dụng thay đổi thương hiệu cho sản phẩm:
         * - null  -> gỡ liên kết (ON DELETE SET NULL tương ứng khi FE gửi null).
         * - có id -> phải tồn tại và đang hoạt động, TRỪ KHI chính là thương hiệu hiện tại
         *   (cho phép giữ nguyên liên kết cũ dù thương hiệu đã ngừng hoạt động).
         */
        private void applyThuongHieu(SanPhamQuanAo sp, Integer thuongHieuId) {
                if (thuongHieuId == null) {
                        sp.setThuongHieu(null);
                        return;
                }
                ThuongHieu thuongHieu = thuongHieuService.getOne(thuongHieuId).orElseThrow(
                        () -> new CommonException("Thương hiệu không tồn tại id: " + thuongHieuId)
                );
                boolean laThuongHieuHienTai = sp.getThuongHieu() != null
                        && sp.getThuongHieu().getId().equals(thuongHieuId);
                if (!Integer.valueOf(1).equals(thuongHieu.getTrangThai()) && !laThuongHieuHienTai) {
                        throw new CommonException("Thương hiệu \"" + thuongHieu.getTenThuongHieu()
                                + "\" đang ngừng hoạt động, không thể gán cho sản phẩm");
                }
                sp.setThuongHieu(thuongHieu);
        }

        private void saveLichSuBasicInfo(SanPhamQuanAo sp, Map<String, Object> giaTriCu, Map<String, Object> giaTriMoi) {
                ghiLichSuCapNhat(sp, giaTriCu, giaTriMoi, "Cập nhật thông tin cơ bản sản phẩm: " + sp.getMaSanPham());
        }

        private void ghiLichSuCapNhat(SanPhamQuanAo sp, Map<String, Object> giaTriCu, Map<String, Object> giaTriMoi, String ghiChu) {
                try {
                        objectMapper.registerModule(new JavaTimeModule());
                        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
                        NguoiDung nguoiTao = nguoiDungService.getOne(SecurityContextHolder.getUser().getId()).orElse(null);
                        if (nguoiTao == null) {
                                return;
                        }
                        lichSuThayDoiService.create(
                                LichSuThayDoi.builder()
                                        .loaiThamChieu(ITable.san_pham_quan_ao)
                                        .idThamChieu(sp.getId())
                                        .hanhDong(IHanhDong.cap_nhat_san_pham)
                                        .giaTriCu(objectMapper.writeValueAsString(giaTriCu))
                                        .giaTriMoi(objectMapper.writeValueAsString(giaTriMoi))
                                        .nguoiThucHien(nguoiTao)
                                        .ngayThucHien(Instant.now())
                                        .ghiChu(ghiChu)
                                        .build()
                        );
                } catch (Exception e) {
                        log.error("Lỗi lưu lịch sử cập nhật sản phẩm", e);
                }
        }

        private String blankToNull(String value) {
                return value == null || value.isBlank() ? null : value.trim();
        }

        @Transactional(readOnly = true)
        public SanPhamQuanAoDto getDetail(Integer id) {
                // Sử dụng findDetailById vừa tạo ở Bước 1
                SanPhamQuanAo sp = repository.findDetailById(id)
                        .orElseThrow(() -> new CommonException("Không tìm thấy sản phẩm id: " + id));

                SanPhamQuanAoDto dto = sanPhamQuanAoMapper.toDto(sp);
                // Đánh dấu biến thể đã phát sinh giao dịch để form Sửa khóa màu/size đúng như backend kiểm tra.
                if (dto.getBienTheSanPhams() != null && !dto.getBienTheSanPhams().isEmpty()) {
                        Set<Integer> idDaPhatSinhGiaoDich = new HashSet<>(bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(id));
                        dto.getBienTheSanPhams().forEach(bt -> bt.setDaPhatSinhGiaoDich(idDaPhatSinhGiaoDich.contains(bt.getId())));
                }
                return dto;
        }

        @Transactional
        public SanPhamQuanAo changeStatus(Integer id, Integer status) {
                // Đổi trạng thái nhanh cho sản phẩm (1/0/2).
                SanPhamQuanAo sanPhamQuanAo = getOne(id).orElseThrow(
                        () -> new CommonException("Không tìm thấy sản phẩm id: " + id));
                sanPhamQuanAo.setTrangThai(status);
                return repository.save(sanPhamQuanAo);
        }

        @Transactional
        public void updateSkuPrice(Integer skuId, BigDecimal newPrice, BigDecimal newCost) {
                // Cập nhật giá theo SKU ở mức biến thể.
                BienTheSanPham bienThe = bienTheSanPhamService.getOne(skuId).orElseThrow(
                        () -> new CommonException("Không tìm thấy biến thể id: " + skuId));
                if (newPrice != null)
                        bienThe.setGiaBan(newPrice);
                if (newCost != null)
                        bienThe.setGiaVon(newCost);
                bienTheSanPhamService.update(skuId, bienThe);
        }

        public ResponseEntity<ResponseData<List<SanPhamQuanAoDto>>> getAllByKho(Integer khoId) {

                return ResponseEntity.ok(
                        ResponseData.<List<SanPhamQuanAoDto>>builder()
                                .status(HttpStatus.OK.value())
                                .message("Success")
                                .data(sanPhamQuanAoMapper.toDtoList(repository.findSanPhamTrongKho(khoId)))
                                .build()
                );
        }
}