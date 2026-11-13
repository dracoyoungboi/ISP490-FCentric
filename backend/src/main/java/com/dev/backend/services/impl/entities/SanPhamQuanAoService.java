package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.variables.IChuyenKho;
import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.constant.variables.ITrangThaiDonBanHang;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.dto.request.AnhSanPhamSapXep;
import com.dev.backend.dto.request.BienTheSanPhamCreating;
import com.dev.backend.dto.request.BienTheSanPhamUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoBasicInfoUpdating;
import com.dev.backend.dto.request.SanPhamQuanAoCreating;
import com.dev.backend.dto.request.SanPhamQuanAoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.SanPhamQuanAoDto;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.exception.customize.InvalidFieldException;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.mapper.SanPhamQuanAoMapper;
import com.dev.backend.repository.AnhBienTheRepository;
import com.dev.backend.repository.AnhQuanAoRepository;
import com.dev.backend.repository.BienTheSanPhamRepository;
import com.dev.backend.repository.SanPhamQuanAoRepository;
import com.dev.backend.services.MinioService;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.services.impl.multitable.DieuHanhHeThongServiceImpl;
import com.dev.backend.services.multitable.DieuHanhHeThongService;
import com.dev.backend.utils.GioiHanSoThapPhan;
import com.dev.backend.utils.KiemTraTepTai;
import com.dev.backend.utils.MaVachSku;
import com.dev.backend.services.impl.kiemke.KhoaKiemKeGuard;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiChungException;
import com.fasterxml.jackson.core.JsonProcessingException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.hibernate.Hibernate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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

        static final long ANH_TOI_DA_BYTE = 20L * 1024 * 1024;

        //Core bussiness logic
        /** Chốt chặn dữ liệu chủ của kiểm kê khoanh vùng; null khi unit test dựng tay. */
        @Autowired(required = false)
        private KhoaKiemKeGuard khoaKiemKeGuard;
        /** Nhật ký sản phẩm (lịch sử master data, ghi trong giao dịch); null khi unit test dựng tay. */
        @Autowired(required = false)
        private NhatKyNghiepVu nhatKy;

        /**
         * Đổi danh mục của sản phẩm khi danh mục cũ hoặc mới (kể cả danh mục con tạo sau, xét theo cha) đang được kiểm kê ở
         * kho mà sản phẩm có hàng: dừng (Master Data Guard). Sản phẩm không có hàng ở kho đang kiểm thì đổi được.
         */
        private void kiemTraDoiDanhMucKhiKiemKe(SanPhamQuanAo sanPham, DanhMucQuanAo cu, DanhMucQuanAo moi) {
                if (khoaKiemKeGuard == null || cu == null || moi == null || cu.getId().equals(moi.getId())) return;
                khoaKiemKeGuard.giuTatCaKho();
                khoaKiemKeGuard.kiemTraDoiDanhMucSanPham(sanPham.getId(), cu.getId(), moi.getId(), "đổi danh mục sản phẩm");
        }

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
        // Không còn ghi trực tiếp (nhật ký đi qua NhatKyNghiepVu); giữ vì các test dựng service gán field này
        @Autowired
        private LichSuThayDoiService lichSuThayDoiService;
        @Autowired
        private GiaBanBienTheService giaBanBienTheService;
        @Autowired
        private DieuHanhHeThongService dieuHanhHeThongService;

        //Image
        @Autowired
        private AnhQuanAoService anhQuanAoService;
        @Autowired
        private AnhBienTheService anhBienTheService;
        @Autowired
        private AnhBienTheRepository anhBienTheRepository;
        @Autowired
        private AnhQuanAoRepository anhQuanAoRepository;
        @Autowired
        private TepTinService tepTinService;
        @Autowired
        private MinioService minioService;

        //Mapper
        @Autowired
        private SanPhamQuanAoMapper sanPhamQuanAoMapper;

        /** Số biến thể tối đa của một sản phẩm khi tạo mới (form sinh tổ hợp Màu × Kích cỡ). */
        private static final int SO_BIEN_THE_TOI_DA = 100;
        private static final BigDecimal NGHIN = BigDecimal.valueOf(1000);

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
                        .orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongTimThay", sanPhamId)));

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

                                        // Công thức 3: biến thể CHƯA có giá bán thì gợi ý Giá vốn * 1.2. Giá bán đã đặt
                                        // (màn Giá bán & tem mã vạch, form Sửa) giữ nguyên: tính lại mỗi lần nhập / xuất
                                        // kho sẽ xóa giá người dùng vừa đổi và làm tem đã in sai giá.
                                        // Làm tròn LÊN hàng nghìn, khớp "giá sàn" form sản phẩm gợi ý (logicBienThe.giaBanGoiY).
                                        if (bienThe.getGiaBan() == null || bienThe.getGiaBan().signum() <= 0) {
                                                bienThe.setGiaBan(giaVonTongVariant.multiply(new BigDecimal("1.2"))
                                                        .divide(NGHIN, 0, RoundingMode.CEILING)
                                                        .multiply(NGHIN));
                                        }
                                        BigDecimal giaBanVariant = bienThe.getGiaBan();

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

                // Bước 1: Validate nghiệp vụ trước khi ghi (số biến thể, trùng tổ hợp, giá, tệp ảnh biến thể).
                kiemTraTepAnh(anhSanPhams);
                kiemTraTepAnh(anhBienThes);
                kiemTraBienTheTaoMoi(creating.getBienTheSanPhams(), anhBienThes);
                kiemTraMaVachNhapTay(creating.getBienTheSanPhams());
                creating.setTenSanPham(chuanHoaTenSanPham(creating.getTenSanPham()));
                kiemTraTenKhongTrung(creating.getTenSanPham(), null);

                Instant instantNow = Instant.now();
                Date now = new Date();

                DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(creating.getDanhMucId()).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamDanhMucKhongTonTai", creating.getDanhMucId()))
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
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamNguoiTaoKhongTonTai", nguoiTaoId))
                );

                sanPhamQuanAo.setMaSanPham(maSanPhamAuto);
                sanPhamQuanAo.setDanhMuc(danhMucQuanAo);
                sanPhamQuanAo.setNguoiTao(nguoiTao);
                sanPhamQuanAo.setNgayTao(instantNow);

                // Gán thương hiệu (nếu có). Sản phẩm mới = gán mới nên chỉ chấp nhận thương hiệu đang hoạt động.
                if (creating.getThuongHieuId() != null) {
                        ThuongHieu thuongHieu = thuongHieuService.getOne(creating.getThuongHieuId()).orElseThrow(
                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamThuongHieuKhongTonTai", creating.getThuongHieuId()))
                        );
                        if (!Integer.valueOf(1).equals(thuongHieu.getTrangThai())) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamThuongHieuNgungChoSanPhamMoi", thuongHieu.getTenThuongHieu()));
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
                                throw new LoiChungException(ThongDiep.of("sanPhamMuaHang.sanPhamLoiTaoTepTin", creating.getTenSanPham()));
                        }
                }

                // Bước 4: Tạo biến thể + gắn ảnh biến thể. Mỗi tệp trong anhBienThes chỉ tải lên 1 lần;
                // các biến thể có cùng viTriAnh (cùng màu) dùng chung một tệp.
                List<BienTheSanPhamCreating> dsBienThe = creating.getBienTheSanPhams();
                Map<Integer, TepTin> tepAnhTheoViTri = new HashMap<>();
                String tienToMaVach = tienToMaVach();
                for (int i = 0; i < dsBienThe.size(); i++) {
                        BienTheSanPhamCreating btspCreating = dsBienThe.get(i);

                        MauSac mauSac = mauSacService.getOne(btspCreating.getMauSacId()).orElseThrow(
                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.mauKhongTimThay", btspCreating.getMauSacId())));

                        Size size = sizeService.getOne(btspCreating.getSizeId()).orElseThrow(
                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.kichCoKhongTimThay", btspCreating.getSizeId())));

                        ChatLieu chatLieu = chatLieuService.getOne(btspCreating.getChatLieuId()).orElseThrow(
                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.chatLieuKhongTimThayId", btspCreating.getChatLieuId())));

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
                        // Mã vạch nhập tay đã kiểm không trùng (kiemTraMaVachNhapTay); để trống thì cấp mã sau khi có id
                        bienTheSanPham.setMaVachSku(btspCreating.getMaVachSku());

                        bienTheSanPhamService.create(bienTheSanPham);
                        if (bienTheSanPham.getMaVachSku() == null) {
                                ganMaVachTuSinh(bienTheSanPham, tienToMaVach);
                        }

                        // viTriAnh = null là cách gửi cũ: tệp thứ i ứng với biến thể thứ i.
                        int viTriAnh = btspCreating.getViTriAnh() != null ? btspCreating.getViTriAnh() : i;
                        MultipartFile tepAnh = layTepAnh(anhBienThes, viTriAnh);
                        if (tepAnh != null) {
                                TepTin tepTin = tepAnhTheoViTri.get(viTriAnh);
                                if (tepTin == null) {
                                        tepTin = taiLenTepAnhBienThe(tepAnh, maSanPhamAuto, now.getTime(), viTriAnh, instantNow);
                                        tepAnhTheoViTri.put(viTriAnh, tepTin);
                                }
                                anhBienTheService.create(
                                        AnhBienThe.builder()
                                                .bienThe(bienTheSanPham)
                                                .tepTin(tepTin)
                                                .trangThai(1)
                                                .ngayTao(instantNow)
                                                .build()
                                );
                        }
                }

                // Bước 5: Tính lại giá/trạng thái theo tồn kho và ghi lịch sử thao tác.
                recalculatePriceAndStatus(sanPhamQuanAo.getId());

                sanPhamQuanAo = getOne(sanPhamQuanAo.getId()).get();

                ghiNhatKy(NhatKyNghiepVu.dong(ITable.san_pham_quan_ao, sanPhamQuanAo.getId(), IHanhDong.them_moi_san_pham)
                        .ma(sanPhamQuanAo.getMaSanPham())
                        .moi(anhTaoMoi(sanPhamQuanAo, dsBienThe.size()))
                        .ghiChu("Tạo sản phẩm " + sanPhamQuanAo.getMaSanPham()));

                return ResponseEntity.ok(
                        ResponseData.<SanPhamQuanAoDto>builder()
                                .status(HttpStatus.OK.value())
                                .data(sanPhamQuanAoMapper.toDto(sanPhamQuanAo))
                                .message(ThongDiep.dich("sanPhamMuaHang.sanPhamTaoThanhCong", maSanPhamAuto))
                                .build()
                );
        }

        /**
         * Kiểm tra danh sách biến thể của sản phẩm mới trước khi ghi (lỗi không để lại dữ liệu lưu dở):
         * có 1 đến SO_BIEN_THE_TOI_DA biến thể, đủ màu/kích cỡ/chất liệu, không trùng tổ hợp,
         * giá không âm, và viTriAnh (nếu có) trỏ tới một tệp ảnh thật trong anhBienThes.
         */
        private void kiemTraBienTheTaoMoi(List<BienTheSanPhamCreating> dsBienThe, List<MultipartFile> anhBienThes) {
                if (dsBienThe == null || dsBienThe.isEmpty()) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamItNhatMotBienThe"));
                }
                if (dsBienThe.size() > SO_BIEN_THE_TOI_DA) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamToiDaBienThe", SO_BIEN_THE_TOI_DA));
                }
                Set<String> toHopDaGap = new HashSet<>();
                for (int i = 0; i < dsBienThe.size(); i++) {
                        BienTheSanPhamCreating bt = dsBienThe.get(i);
                        int stt = i + 1;
                        if (bt == null || bt.getMauSacId() == null || bt.getSizeId() == null || bt.getChatLieuId() == null) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheChonMauCoChatLieu", stt));
                        }
                        if (!toHopDaGap.add(bt.getMauSacId() + "-" + bt.getSizeId() + "-" + bt.getChatLieuId())) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheTrungToHop"));
                        }
                        if ((bt.getGiaVon() != null && bt.getGiaVon().signum() < 0)
                                || (bt.getGiaBan() != null && bt.getGiaBan().signum() < 0)) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheGiaAm", stt));
                        }
                        if (bt.getViTriAnh() != null && layTepAnh(anhBienThes, bt.getViTriAnh()) == null) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheThieuTepAnhCham", stt));
                        }
                }
        }

        // ---------- Mã vạch biến thể (utils/MaVachSku) ----------

        /** Tiền tố mã vạch tự sinh đang cấu hình (đọc một lần cho mỗi lần lưu sản phẩm). */
        private String tienToMaVach() {
                return MaVachSku.tienToDung(dieuHanhHeThongService.getCauHinhString(
                        DieuHanhHeThongServiceImpl.CAU_HINH_MA_VACH_TIEN_TO, MaVachSku.TIEN_TO_MAC_DINH));
        }

        /**
         * Mã vạch nhập tay khi tạo sản phẩm (chưa ghi gì): chuỗi trống lưu null, không trùng giữa các biến thể gửi lên
         * và không trùng mã đã có (CSDL cũng có khóa duy nhất uq_bien_the_ma_vach).
         */
        private void kiemTraMaVachNhapTay(List<BienTheSanPhamCreating> dsBienThe) {
                Set<String> daGap = new HashSet<>();
                for (BienTheSanPhamCreating bt : dsBienThe) {
                        String ma = MaVachSku.chuanHoa(bt.getMaVachSku());
                        bt.setMaVachSku(ma);
                        if (ma == null) continue;
                        if (ma.length() > 100) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.maVachDaiQua100", ma));
                        }
                        if (!daGap.add(ma.toLowerCase(Locale.ROOT))) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.maVachTrungGiuaBienThe", ma));
                        }
                        bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase(ma).ifPresent(cu -> {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.maVachDaDungChoSku", ma, cu.getMaSku()));
                        });
                }
        }

        /** Biến thể vừa lưu (đã có id) để trống mã vạch: cấp mã tiền tố + id đệm 0, ghi trong cùng giao dịch. */
        private void ganMaVachTuSinh(BienTheSanPham bienThe, String tienTo) {
                String ma = MaVachSku.sinh(tienTo, bienThe.getId());
                bienTheSanPhamRepository.findFirstByMaVachSkuIgnoreCase(ma).ifPresent(cu -> {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.maVachTuSinhTrung", ma, cu.getMaSku()));
                });
                bienThe.setMaVachSku(ma);
                bienTheSanPhamService.update(bienThe.getId(), bienThe);
        }

        /**
         * Mọi tệp ảnh gửi lên (bỏ qua tệp rỗng giữ chỗ) phải là ảnh thật theo byte đầu tệp: SVG / HTML đổi đuôi thành
         * .png bị từ chối trước khi ghi gì.
         */
        static void kiemTraTepAnh(List<MultipartFile> dsTep) {
                if (dsTep == null) return;
                for (MultipartFile tep : dsTep) {
                        if (tep == null || tep.isEmpty()) continue;
                        String ten = tep.getOriginalFilename();
                        KiemTraTepTai.batBuoc(tep, KiemTraTepTai.ANH_WEB, ANH_TOI_DA_BYTE,
                                ten == null || ten.isBlank() ? "Ảnh tải lên" : "Ảnh \"" + ten + "\"",
                                KiemTraTepTai.MO_TA_ANH_WEB);
                }
        }

        /** Tệp ở vị trí viTri trong anhBienThes; null nếu không có hoặc là tệp rỗng giữ chỗ. */
        private static MultipartFile layTepAnh(List<MultipartFile> anhBienThes, int viTri) {
                if (anhBienThes == null || viTri < 0 || viTri >= anhBienThes.size()) {
                        return null;
                }
                MultipartFile tep = anhBienThes.get(viTri);
                return tep == null || tep.isEmpty() ? null : tep;
        }

        /** Tải một tệp ảnh biến thể lên MinIO và lưu bản ghi tep_tin tương ứng. */
        private TepTin taiLenTepAnhBienThe(MultipartFile tep, String maSanPham, long dauThoiGian, int viTri, Instant bayGio) {
                try {
                        String objectName = minioService.upload(tep, ITable.bien_the_san_pham + "_" + maSanPham + "_" + dauThoiGian + "_" + viTri);
                        return tepTinService.create(TepTin.builder()
                                .tenTepGoc(objectName)
                                .tenTaiLen(objectName)
                                .tenLuuTru(objectName)
                                .duongDan(minioService.getPublicUrl(objectName))
                                .loaiTepTin(FileType.IMAGE.toString())
                                .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                .ngayTao(bayGio)
                                .trangThai(1)
                                .build());
                } catch (Exception e) {
                        log.error("Lỗi tải ảnh biến thể của sản phẩm {}", maSanPham, e);
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheTaiAnhLoi"), e);
                }
        }

        /**
         * Xóa tệp ảnh biến thể khi không còn ảnh nào trỏ tới.
         * Các biến thể cùng màu dùng chung tệp; xóa sớm sẽ kéo theo xóa ảnh của biến thể khác
         * vì khóa ngoại anh_bien_the.tep_tin_id để ON DELETE CASCADE.
         */
        private void xoaTepAnhBienTheNeuKhongConDung(Integer tepTinId) {
                xoaTepNeuKhongConDung(tepTinId);
        }

        /**
         * Xóa tệp (bản ghi tep_tin + đối tượng trên MinIO) nếu không còn ảnh sản phẩm hay ảnh biến thể nào dùng.
         * Bản ghi xóa trong giao dịch hiện tại; đối tượng MinIO chỉ xóa sau khi giao dịch ghi xong
         * (MinIO không rollback được, xóa sớm mà giao dịch lỗi thì mất ảnh thật).
         */
        private void xoaTepNeuKhongConDung(Integer tepTinId) {
                entityManager.flush();
                if (anhBienTheRepository.countByTepTin_Id(tepTinId) > 0 || anhQuanAoRepository.countByTepTin_Id(tepTinId) > 0) {
                        return;
                }
                TepTin tep = tepTinService.getOne(tepTinId).orElse(null);
                if (tep == null) return;
                String tenLuuTru = tep.getTenLuuTru();
                tepTinService.delete(tepTinId);
                Runnable xoaTrenMinio = () -> {
                        try {
                                minioService.delete(tenLuuTru);
                        } catch (Exception e) {
                                log.warn("Không xóa được tệp {} trên MinIO: {}", tenLuuTru, e.getMessage());
                        }
                };
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                        xoaTrenMinio.run();
                                }
                        });
                } else {
                        xoaTrenMinio.run();
                }
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

        // ---------- Nhật ký sản phẩm (lịch sử master data) ----------

        /** Ảnh chụp các trường chính của sản phẩm cho nhật ký: danh mục / thương hiệu ghi TÊN (không ghi id). */
        static Map<String, Object> anhSanPham(SanPhamQuanAo sp) {
                return NhatKyNghiepVu.anh(
                        "tenSanPham", sp.getTenSanPham(),
                        "maVach", sp.getMaVach(),
                        "danhMuc", sp.getDanhMuc() == null ? null : sp.getDanhMuc().getTenDanhMuc(),
                        "thuongHieu", sp.getThuongHieu() == null ? null : sp.getThuongHieu().getTenThuongHieu(),
                        "moTa", sp.getMoTa(),
                        "trangThai", sp.getTrangThai(),
                        "mucTonToiThieu", sp.getMucTonToiThieu(),
                        // Giá vốn trống coi như 0 (form gửi 0 khi trống): không sinh dòng "trống → 0" giả
                        "giaVonMacDinh", sp.getGiaVonMacDinh() == null ? java.math.BigDecimal.ZERO : sp.getGiaVonMacDinh());
        }

        /** Ảnh chụp gọn lúc tạo sản phẩm: các trường chính + mã + số biến thể (không ghi nguyên yêu cầu gửi lên). */
        static Map<String, Object> anhTaoMoi(SanPhamQuanAo sp, int soBienThe) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("maSanPham", sp.getMaSanPham());
                m.putAll(anhSanPham(sp));
                m.put("soBienThe", soBienThe);
                return m;
        }

        private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
                if (nhatKy != null) nhatKy.ghi(dong);
        }

        /** Số tệp ảnh thật (bỏ tệp rỗng giữ chỗ) trong danh sách gửi lên. */
        private static long soTepAnh(List<MultipartFile> ds) {
                return ds == null ? 0 : ds.stream().filter(t -> t != null && !t.isEmpty()).count();
        }


        /** READ_COMMITTED: xem {@link #kiemTraTruocKhiNgung} (đổi sang trạng thái 2 qua form Sửa). */
        @Transactional(isolation = Isolation.READ_COMMITTED)
        public ResponseEntity<ResponseData<SanPhamQuanAoDto>> update(
                SanPhamQuanAoUpdating updating,
                List<MultipartFile> anhSanPhams,
                List<MultipartFile> anhBienThes) {

                // Luồng cập nhật: kiểm tra toàn bộ (sản phẩm + biến thể) -> cập nhật thông tin chính -> ảnh sản phẩm
                // -> cập nhật/thêm biến thể (+ ảnh) -> ghi lịch sử -> tính lại giá/trạng thái.
                // Mọi kiểm tra nghiệp vụ chạy TRƯỚC khi ghi, nên lỗi không để lại dữ liệu lưu dở.
                kiemTraTepAnh(anhSanPhams);
                kiemTraTepAnh(anhBienThes);

                SanPhamQuanAo sanPhamQuanAo = getOne(updating.getId()).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongTimThay", updating.getId()))
                );

                // Mã sản phẩm do hệ thống sinh khi tạo và đã dùng để ghép mã SKU -> không cho đổi.
                // FE gửi lại đúng mã cũ (hoặc để trống) thì bỏ qua; gửi mã khác thì từ chối.
                String maSanPhamGuiLen = updating.getMaSanPham() == null ? "" : updating.getMaSanPham().trim();
                if (!maSanPhamGuiLen.isEmpty() && !maSanPhamGuiLen.equals(sanPhamQuanAo.getMaSanPham())) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongDoiMa"));
                }

                DanhMucQuanAo danhMucQuanAo = danhMucQuanAoService.getOne(updating.getDanhMucId()).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.danhMucQuanAoKhongTimThay", updating.getDanhMucId()))
                );

                // Kiểm tra và lập kế hoạch ghi cho từng biến thể (sửa giá/trạng thái, đổi màu/size, thêm mới).
                List<BienTheSanPhamUpdating> dsBienTheGuiLen = updating.getBienTheSanPhams() == null
                        ? List.of() : updating.getBienTheSanPhams();
                List<KeHoachBienThe> keHoachBienThes = lapKeHoachBienThe(sanPhamQuanAo, dsBienTheGuiLen, anhBienThes);
                List<AnhSanPhamSapXep> sapXepAnh = updating.isImageUpdated()
                        ? kiemTraAnhSanPhamCapNhat(sanPhamQuanAo, updating.getAnhSanPhamSapXep(), anhSanPhams)
                        : List.of();
                // Chỉ kiểm tra khi tên thật sự đổi, để sản phẩm đang trùng tên từ trước vẫn sửa được các ô khác.
                String tenMoi = chuanHoaTenSanPham(updating.getTenSanPham());
                if (!cungTenSanPham(tenMoi, sanPhamQuanAo.getTenSanPham())) {
                        kiemTraTenKhongTrung(tenMoi, sanPhamQuanAo.getId());
                }
                // Form Sửa gửi lại trạng thái đang có; gọi thẳng API đổi sang 2 thì kiểm như nút Ngừng kinh doanh
                if (laNgungKinhDoanh(sanPhamQuanAo.getTrangThai(), updating.getTrangThai())) {
                        kiemTraTruocKhiNgung(sanPhamQuanAo);
                }

                // ===================== GHI DỮ LIỆU =====================
                // Ảnh chụp trước khi sửa (nhật ký chỉ giữ trường đổi); các mục biến thể / ảnh thêm vào sau
                Map<String, Object> truocSua = anhSanPham(sanPhamQuanAo);
                kiemTraDoiDanhMucKhiKiemKe(sanPhamQuanAo, sanPhamQuanAo.getDanhMuc(), danhMucQuanAo);
                sanPhamQuanAo.setTenSanPham(tenMoi);
                sanPhamQuanAo.setDanhMuc(danhMucQuanAo);
                // Giống PATCH /basic-info: ô để trống lưu null.
                sanPhamQuanAo.setMoTa(blankToNull(updating.getMoTa()));
                sanPhamQuanAo.setMaVach(blankToNull(updating.getMaVach()));
                sanPhamQuanAo.setGiaVonMacDinh(updating.getGiaVonMacDinh());
                sanPhamQuanAo.setMucTonToiThieu(updating.getMucTonToiThieu());
                sanPhamQuanAo.setTrangThai(updating.getTrangThai());
                // Thay đổi thương hiệu chỉ áp dụng khi FE gửi cờ capNhatThuongHieu = true
                if (updating.isCapNhatThuongHieu()) {
                        applyThuongHieu(sanPhamQuanAo, updating.getThuongHieuId());
                }
                sanPhamQuanAo = update(updating.getId(), sanPhamQuanAo);
                Map<String, Object> sauSua = anhSanPham(sanPhamQuanAo);
                if (updating.isImageUpdated()) {
                        capNhatAnhSanPham(sanPhamQuanAo, sapXepAnh, anhSanPhams);
                        // Ảnh: chỉ ghi tóm tắt (không ghi đường dẫn)
                        long soTepMoi = soTepAnh(anhSanPhams);
                        sauSua.put("anhSanPham", "Sắp xếp / thay ảnh" + (soTepMoi > 0 ? ", tải lên " + soTepMoi + " ảnh mới" : ""));
                }

                // Ảnh biến thể:
                // - viTriAnh: tệp thứ viTriAnh trong anhBienThes, mỗi tệp tải lên 1 lần, các biến thể cùng màu dùng chung.
                // - isImageUpdated (cách gửi cũ): tệp thứ i ứng với biến thể thứ i (FE gửi tệp rỗng giữ chỗ).
                // - Biến thể mới không gửi ảnh: dùng lại tệp ảnh đang có của màu đó.
                Instant bayGio = Instant.now();
                long dauThoiGian = bayGio.toEpochMilli();
                Map<Integer, TepTin> tepAnhTheoViTri = new HashMap<>();
                Map<Integer, TepTin> tepAnhTheoMau = tepAnhHienCoTheoMau(keHoachBienThes);
                List<Map<String, Object>> thuocTinhCu = new ArrayList<>();
                List<Map<String, Object>> thuocTinhMoi = new ArrayList<>();
                List<Map<String, Object>> bienTheThemMoi = new ArrayList<>();
                List<Map<String, Object>> trangThaiBienTheCu = new ArrayList<>();
                List<Map<String, Object>> trangThaiBienTheMoi = new ArrayList<>();
                List<String> bienTheDoiAnh = new ArrayList<>();
                String tienToMaVach = keHoachBienThes.stream().anyMatch(k -> k.bienThe == null) ? tienToMaVach() : null;
                NguoiDung nguoiDoiGia = null;
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
                                // Form chỉ gửi giá đã sửa; trống (null) là giữ giá vốn đang lưu (vd. vừa tính lại theo lô)
                                if (duLieu.getGiaVon() != null) {
                                        bienThe.setGiaVon(duLieu.getGiaVon());
                                }
                                // Giá bán gửi trống hoặc như cũ thì giữ nguyên; đổi giá đã qua kiểm tra ở lapKeHoachBienThe
                                if (keHoach.doiGiaBan) {
                                        bienThe.setGiaBan(keHoach.giaBanMoi);
                                }
                                // Ngừng / mở bán biến thể: ghi SKU + trạng thái cũ → mới
                                if (duLieu.getTrangThai() != null && !Objects.equals(bienThe.getTrangThai(), duLieu.getTrangThai())) {
                                        trangThaiBienTheCu.add(NhatKyNghiepVu.anh("sku", bienThe.getMaSku(), "trangThai", bienThe.getTrangThai()));
                                        trangThaiBienTheMoi.add(NhatKyNghiepVu.anh("sku", bienThe.getMaSku(), "trangThai", duLieu.getTrangThai()));
                                }
                                bienThe.setTrangThai(duLieu.getTrangThai());
                                bienThe = bienTheSanPhamService.update(bienThe.getId(), bienThe);
                                if (keHoach.doiGiaBan) {
                                        if (nguoiDoiGia == null) nguoiDoiGia = giaBanBienTheService.nguoiDangThucHien();
                                        giaBanBienTheService.ghiLichSuDoiGia(bienThe.getId(), keHoach.giaBanCu, keHoach.giaBanMoi,
                                                GiaBanBienTheService.LY_DO_SUA_SAN_PHAM, nguoiDoiGia, bayGio);
                                }
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
                                ganMaVachTuSinh(bienThe, tienToMaVach);
                                // Giữ danh sách biến thể trong bộ nhớ khớp DB để bước tính giá phía sau thấy biến thể mới.
                                if (sanPhamQuanAo.getBienTheSanPhams() != null
                                        && Hibernate.isInitialized(sanPhamQuanAo.getBienTheSanPhams())) {
                                        sanPhamQuanAo.getBienTheSanPhams().add(bienThe);
                                }
                                bienTheThemMoi.add(moTaBienThe(bienThe));
                        }
                        if (keHoach.bienThe != null && (duLieu.getViTriAnh() != null || duLieu.isImageUpdated())) {
                                bienTheDoiAnh.add(bienThe.getMaSku());
                        }
                        if (duLieu.getViTriAnh() != null) {
                                int viTriAnh = duLieu.getViTriAnh();
                                TepTin tepAnh = tepAnhTheoViTri.get(viTriAnh);
                                if (tepAnh == null) {
                                        tepAnh = taiLenTepAnhBienThe(layTepAnh(anhBienThes, viTriAnh),
                                                sanPhamQuanAo.getMaSanPham(), dauThoiGian, viTriAnh, bayGio);
                                        tepAnhTheoViTri.put(viTriAnh, tepAnh);
                                }
                                ganTepAnhBienThe(bienThe, tepAnh, bayGio);
                        } else if (duLieu.isImageUpdated()) {
                                capNhatAnhBienThe(bienThe, anhBienThes.get(keHoach.viTri),
                                        sanPhamQuanAo.getMaSanPham(), dauThoiGian, keHoach.viTri, bayGio);
                        } else if (keHoach.bienThe == null) {
                                TepTin tepCuaMau = tepAnhTheoMau.get(keHoach.mauSac.getId());
                                if (tepCuaMau != null) ganTepAnhBienThe(bienThe, tepCuaMau, bayGio);
                        }
                }

                // Một dòng nhật ký cho cả lần lưu: trường chính đổi + biến thể (đổi màu/size, thêm, ngừng/mở bán, đổi ảnh)
                // + ảnh sản phẩm. Đổi giá bán đã ghi riêng doi_gia_ban ở trên. Không đổi gì thì không ghi.
                List<String> noiDung = new ArrayList<>();
                if (!thuocTinhMoi.isEmpty()) {
                        truocSua.put("bienTheDoiThuocTinh", thuocTinhCu);
                        sauSua.put("bienTheDoiThuocTinh", thuocTinhMoi);
                        noiDung.add("đổi màu/kích cỡ " + thuocTinhMoi.size() + " biến thể");
                }
                if (!bienTheThemMoi.isEmpty()) {
                        sauSua.put("bienTheThemMoi", bienTheThemMoi);
                        noiDung.add("thêm " + bienTheThemMoi.size() + " biến thể");
                }
                if (!trangThaiBienTheMoi.isEmpty()) {
                        truocSua.put("bienTheDoiTrangThai", trangThaiBienTheCu);
                        sauSua.put("bienTheDoiTrangThai", trangThaiBienTheMoi);
                        noiDung.add("đổi trạng thái bán " + trangThaiBienTheMoi.size() + " biến thể");
                }
                if (!bienTheDoiAnh.isEmpty()) {
                        sauSua.put("bienTheDoiAnh", bienTheDoiAnh);
                        noiDung.add("đổi ảnh " + bienTheDoiAnh.size() + " biến thể");
                }
                if (sauSua.containsKey("anhSanPham")) noiDung.add(0, "cập nhật ảnh sản phẩm");

                recalculatePriceAndStatus(sanPhamQuanAo.getId());
                sanPhamQuanAo = getOne(sanPhamQuanAo.getId()).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamQuanAoKhongTimThay", updating.getId()))
                );
                // Trường chính lấy từ bản ĐÃ tính lại (trạng thái có thể đổi theo tồn), không theo dữ liệu gửi lên
                sauSua.putAll(anhSanPham(sanPhamQuanAo));
                NhatKyNghiepVu.Dong dongSua = NhatKyNghiepVu.dong(ITable.san_pham_quan_ao, sanPhamQuanAo.getId(),
                                IHanhDong.cap_nhat_san_pham)
                        .ma(sanPhamQuanAo.getMaSanPham())
                        .thayDoi(truocSua, sauSua);
                if (dongSua.coThayDoi()) {
                        dongSua.ghiChu("Sửa sản phẩm" + (noiDung.isEmpty() ? "" : ": " + String.join(", ", noiDung)));
                        ghiNhatKy(dongSua);
                }
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
                // Biến thể đã có đổi giá bán: giá cũ / giá mới (đã làm tròn) để ghi lịch sử doi_gia_ban
                boolean doiGiaBan;
                BigDecimal giaBanCu;
                BigDecimal giaBanMoi;

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
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheDuLieuKhongHopLe", stt));
                        }
                        if (duLieu.getGiaVon() != null && duLieu.getGiaVon().signum() < 0) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheGiaVonAm", stt));
                        }
                        if (duLieu.getGiaBan() != null && duLieu.getGiaBan().signum() < 0) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheGiaBanAm", stt));
                        }

                        KeHoachBienThe keHoach;
                        if (duLieu.getId() != null) {
                                // ----- Biến thể đã có -----
                                if (!idDaGap.add(duLieu.getId())) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheGuiTrung", duLieu.getId()));
                                }
                                BienTheSanPham bienThe = bienTheTheoId.get(duLieu.getId());
                                if (bienThe == null) {
                                        // Chặn sửa chéo biến thể của sản phẩm khác.
                                        if (bienTheSanPhamRepository.existsById(duLieu.getId())) {
                                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheKhongThuocSanPham", duLieu.getId()));
                                        }
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheKhongTimThay", duLieu.getId()));
                                }
                                if (duLieu.getChatLieuId() != null
                                        && !duLieu.getChatLieuId().equals(bienThe.getChatLieu().getId())) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheKhongDoiChatLieu", bienThe.getMaSku()));
                                }
                                boolean doiMau = duLieu.getMauSacId() != null
                                        && !duLieu.getMauSacId().equals(bienThe.getMauSac().getId());
                                boolean doiSize = duLieu.getSizeId() != null
                                        && !duLieu.getSizeId().equals(bienThe.getSize().getId());

                                keHoach = new KeHoachBienThe(i, duLieu, bienThe);
                                keHoach.doiThuocTinh = doiMau || doiSize;
                                if (keHoach.doiThuocTinh && idDaPhatSinhGiaoDich.contains(bienThe.getId())) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheDaPhatSinhGiaoDich", bienThe.getMaSku()));
                                }
                                keHoach.mauSac = doiMau ? timMauSac(duLieu.getMauSacId()) : bienThe.getMauSac();
                                keHoach.size = doiSize ? timSize(duLieu.getSizeId()) : bienThe.getSize();
                                keHoach.chatLieu = bienThe.getChatLieu();
                                // Đổi giá bán ở form Sửa: cùng kiểm tra với màn Giá bán (giá > 0, trong giới hạn) và cùng ghi
                                // lịch sử (lý do "Sửa sản phẩm"); gửi trống hoặc như cũ là không đổi. Biến thể đang chưa có giá
                                // (null / 0) mà form gửi 0 cũng là không đổi (form hiện ô trống thành 0), không chặn cả lần lưu.
                                boolean chuaCoGia = bienThe.getGiaBan() == null || bienThe.getGiaBan().signum() <= 0;
                                boolean guiGiaTrong = duLieu.getGiaBan() == null || (chuaCoGia && duLieu.getGiaBan().signum() <= 0);
                                if (!guiGiaTrong && GiaBanBienTheService.laGiaDoi(bienThe.getGiaBan(), duLieu.getGiaBan())) {
                                        if (!GiaBanBienTheService.duocDoiGiaBan()) {
                                                throw new CommonException(HttpStatus.FORBIDDEN, ThongDiep.of("sanPhamMuaHang.bienTheChiAdminDoiGia", bienThe.getMaSku()));
                                        }
                                        BigDecimal giaMoi;
                                        try {
                                                giaMoi = GiaBanBienTheService.kiemTraGiaBan(duLieu.getGiaBan());
                                        } catch (CommonException e) {
                                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheLoi", bienThe.getMaSku(), e.getThongDiep() != null ? e.getThongDiep() : e.getMessage()));
                                        }
                                        keHoach.doiGiaBan = GiaBanBienTheService.laGiaDoi(bienThe.getGiaBan(), giaMoi);
                                        keHoach.giaBanCu = bienThe.getGiaBan();
                                        keHoach.giaBanMoi = giaMoi;
                                }
                        } else {
                                // ----- Biến thể mới -----
                                if (duLieu.getMauSacId() == null || duLieu.getSizeId() == null) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheMoiChonMauCo", stt));
                                }
                                keHoach = new KeHoachBienThe(i, duLieu, null);
                                keHoach.doiThuocTinh = true;
                                keHoach.mauSac = timMauSac(duLieu.getMauSacId());
                                keHoach.size = timSize(duLieu.getSizeId());
                                if (duLieu.getChatLieuId() != null) {
                                        keHoach.chatLieu = chatLieuService.getOne(duLieu.getChatLieuId()).orElseThrow(
                                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.chatLieuKhongTimThayId", duLieu.getChatLieuId())));
                                } else if (idChatLieuHienCo.size() == 1) {
                                        keHoach.chatLieu = bienTheHienCo.get(0).getChatLieu();
                                } else {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheMoiChonChatLieu", stt));
                                }
                        }

                        if (duLieu.getViTriAnh() != null) {
                                if (layTepAnh(anhBienThes, duLieu.getViTriAnh()) == null) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheThieuTepAnh", stt));
                                }
                        } else if (duLieu.isImageUpdated()) {
                                MultipartFile file = anhBienThes != null && i < anhBienThes.size() ? anhBienThes.get(i) : null;
                                if (file == null || file.isEmpty()) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheThieuTepAnh", stt));
                                }
                        }
                        if (keHoach.doiThuocTinh) {
                                // Công thức SKU giống lúc tạo: [Mã SP]-[Mã chất liệu]-[Mã size]-[Mã màu]
                                keHoach.maSkuMoi = sanPham.getMaSanPham() + "-" + keHoach.chatLieu.getMaChatLieu()
                                        + "-" + keHoach.size.getMaSize() + "-" + keHoach.mauSac.getMaMau();
                        }
                        dsKeHoach.add(keHoach);
                }

                long soBienTheMoi = dsKeHoach.stream().filter(k -> k.bienThe == null).count();
                if (soBienTheMoi > 0 && bienTheHienCo.size() + soBienTheMoi > SO_BIEN_THE_TOI_DA) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamToiDaBienTheDangCo", SO_BIEN_THE_TOI_DA, bienTheHienCo.size()));
                }

                // Tổ hợp (màu + kích cỡ + chất liệu) của TẤT CẢ biến thể sau khi lưu phải khác nhau.
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
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheDaCoToHop", moTaToHop(keHoach)));
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
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.bienTheDoiCheo", moTaToHop(keHoach), dangGiu.getMaSku()));
                        }
                        if (!skuMoi.add(keHoach.maSkuMoi)) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.skuTrungGiuaBienThe", keHoach.maSkuMoi));
                        }
                        boolean skuDaTonTai = keHoach.bienThe == null
                                ? bienTheSanPhamRepository.existsByMaSku(keHoach.maSkuMoi)
                                : bienTheSanPhamRepository.existsByMaSkuAndIdNot(keHoach.maSkuMoi, keHoach.bienThe.getId());
                        if (skuDaTonTai) {
                                throw new CommonException(ThongDiep.of("sanPhamMuaHang.skuDaTonTai", keHoach.maSkuMoi));
                        }
                }
                return dsKeHoach;
        }

        private MauSac timMauSac(Integer id) {
                return mauSacService.getOne(id).orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.mauKhongTimThay", id)));
        }

        private Size timSize(Integer id) {
                return sizeService.getOne(id).orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.kichCoKhongTimThay", id)));
        }

        private String khoaToHop(MauSac mauSac, Size size, ChatLieu chatLieu) {
                return mauSac.getId() + "-" + size.getId() + "-" + chatLieu.getId();
        }

        private String moTaToHop(KeHoachBienThe keHoach) {
                return keHoach.mauSac.getTenMau() + " / " + keHoach.size.getTenSize() + " / " + keHoach.chatLieu.getTenChatLieu();
        }

        private Map<String, Object> moTaBienThe(BienTheSanPham bt) {
                Map<String, Object> moTa = new LinkedHashMap<>();
                // Nhật ký: chỉ chữ đọc được (SKU, tên màu / kích cỡ / chất liệu), không ghi id
                moTa.put("maSku", bt.getMaSku());
                moTa.put("tenMau", bt.getMauSac().getTenMau());
                moTa.put("tenSize", bt.getSize().getTenSize());
                moTa.put("tenChatLieu", bt.getChatLieu().getTenChatLieu());
                return moTa;
        }

        /** Tải ảnh mới cho một biến thể (cách gửi cũ, từng biến thể một). */
        private void capNhatAnhBienThe(BienTheSanPham bienThe, MultipartFile file, String maSanPham,
                                       long dauThoiGian, int viTri, Instant bayGio) {
                ganTepAnhBienThe(bienThe, taiLenTepAnhBienThe(file, maSanPham, dauThoiGian, viTri, bayGio), bayGio);
        }

        /**
         * Gắn tệp ảnh cho biến thể: thay tệp của ảnh hiện tại hoặc tạo ảnh biến thể nếu chưa có.
         * Tệp cũ chỉ bị xóa khi không còn chỗ nào dùng (các biến thể cùng màu dùng chung tệp).
         */
        private void ganTepAnhBienThe(BienTheSanPham bienThe, TepTin tepTin, Instant bayGio) {
                AnhBienThe anhHienTai = bienThe.getAnhBienThe();
                if (anhHienTai != null) {
                        Integer idTepCu = anhHienTai.getTepTin().getId();
                        if (idTepCu.equals(tepTin.getId())) return;
                        anhHienTai.setTepTin(tepTin);
                        anhBienTheService.update(anhHienTai.getId(), anhHienTai);
                        xoaTepAnhBienTheNeuKhongConDung(idTepCu);
                } else {
                        bienThe.setAnhBienThe(anhBienTheService.create(
                                AnhBienThe.builder()
                                        .bienThe(bienThe)
                                        .tepTin(tepTin)
                                        .trangThai(1)
                                        .ngayTao(bayGio)
                                        .build()
                        ));
                }
        }

        /** Tệp ảnh đang dùng của mỗi màu (lấy từ biến thể đã có), để biến thể mới của màu đó dùng lại. */
        private static Map<Integer, TepTin> tepAnhHienCoTheoMau(List<KeHoachBienThe> keHoachBienThes) {
                Map<Integer, TepTin> theoMau = new HashMap<>();
                for (KeHoachBienThe keHoach : keHoachBienThes) {
                        BienTheSanPham bt = keHoach.bienThe;
                        if (bt == null || bt.getAnhBienThe() == null || bt.getAnhBienThe().getTepTin() == null) continue;
                        theoMau.putIfAbsent(bt.getMauSac().getId(), bt.getAnhBienThe().getTepTin());
                }
                return theoMau;
        }

        /**
         * Kiểm tra danh sách ảnh sản phẩm gửi lên khi sửa (chưa ghi gì). Trả về thứ tự ảnh sau khi lưu.
         * Không có anhSanPhamSapXep (cách gửi cũ) thì coi mọi tệp gửi lên là ảnh mới, thay toàn bộ ảnh cũ.
         */
        private List<AnhSanPhamSapXep> kiemTraAnhSanPhamCapNhat(SanPhamQuanAo sanPham, List<AnhSanPhamSapXep> sapXep,
                                                               List<MultipartFile> anhSanPhams) {
                List<AnhSanPhamSapXep> ketQua = new ArrayList<>();
                if (sapXep == null) {
                        int soTep = anhSanPhams == null ? 0 : anhSanPhams.size();
                        for (int i = 0; i < soTep; i++) {
                                if (layTepAnh(anhSanPhams, i) != null) ketQua.add(AnhSanPhamSapXep.builder().viTriTep(i).build());
                        }
                } else {
                        Set<Integer> idHienCo = new HashSet<>();
                        sanPham.getAnhQuanAos().forEach(anh -> idHienCo.add(anh.getId()));
                        Set<Integer> idDaGap = new HashSet<>();
                        Set<Integer> viTriDaGap = new HashSet<>();
                        for (AnhSanPhamSapXep o : sapXep) {
                                if (o == null || (o.getId() == null) == (o.getViTriTep() == null)) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.anhSanPhamDuLieuKhongHopLe"));
                                }
                                if (o.getId() != null && (!idHienCo.contains(o.getId()) || !idDaGap.add(o.getId()))) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.anhSanPhamKhongCon"));
                                }
                                if (o.getViTriTep() != null
                                        && (layTepAnh(anhSanPhams, o.getViTriTep()) == null || !viTriDaGap.add(o.getViTriTep()))) {
                                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.anhSanPhamThieuTepMoi"));
                                }
                                ketQua.add(o);
                        }
                }
                if (ketQua.isEmpty()) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.anhSanPhamItNhatMot"));
                }
                return ketQua;
        }

        /**
         * Cập nhật ảnh sản phẩm theo thứ tự đã kiểm tra: tải ảnh mới lên trước, rồi mới gỡ ảnh bị bỏ.
         * Tệp của ảnh bị bỏ chỉ xóa khỏi MinIO sau khi giao dịch ghi xong, nên lỗi giữa chừng không làm mất ảnh cũ.
         */
        private void capNhatAnhSanPham(SanPhamQuanAo sanPham, List<AnhSanPhamSapXep> sapXep, List<MultipartFile> anhSanPhams) {
                Instant bayGio = Instant.now();
                long dauThoiGian = bayGio.toEpochMilli();
                Map<Integer, AnhQuanAo> anhCuTheoId = new HashMap<>();
                sanPham.getAnhQuanAos().forEach(anh -> anhCuTheoId.put(anh.getId(), anh));

                List<AnhQuanAo> anhSauLuu = new ArrayList<>();
                for (int i = 0; i < sapXep.size(); i++) {
                        AnhSanPhamSapXep o = sapXep.get(i);
                        AnhQuanAo anh = o.getId() != null
                                ? anhCuTheoId.remove(o.getId())
                                : AnhQuanAo.builder()
                                        .quanAo(sanPham)
                                        .tepTin(taiLenTepAnhSanPham(anhSanPhams.get(o.getViTriTep()), sanPham.getMaSanPham(), dauThoiGian, i))
                                        .trangThai(1)
                                        .ngayTao(bayGio)
                                        .build();
                        anh.setAnhChinh(i == 0 ? 1 : 0);
                        anhSauLuu.add(anh);
                }

                // Ảnh còn lại trong anhCuTheoId là ảnh bị gỡ: orphanRemoval xóa bản ghi anh_quan_ao.
                List<Integer> idTepBiGo = anhCuTheoId.values().stream().map(anh -> anh.getTepTin().getId()).toList();
                sanPham.getAnhQuanAos().clear();
                sanPham.getAnhQuanAos().addAll(anhSauLuu);
                entityManager.flush();
                idTepBiGo.forEach(this::xoaTepNeuKhongConDung);
        }

        private TepTin taiLenTepAnhSanPham(MultipartFile tep, String maSanPham, long dauThoiGian, int viTri) {
                try {
                        String objectName = minioService.upload(tep, ITable.san_pham_quan_ao + "_" + maSanPham + "_" + dauThoiGian + "_" + viTri);
                        return tepTinService.create(TepTin.builder()
                                .tenTepGoc(objectName)
                                .tenTaiLen(objectName)
                                .tenLuuTru(objectName)
                                .duongDan(minioService.getPublicUrl(objectName))
                                .loaiTepTin(FileType.IMAGE.toString())
                                .duoiTep(minioService.getObjectInfo(objectName).getUserMetadata().get("file-extension"))
                                .trangThai(1)
                                .ngayTao(Instant.now())
                                .build());
                } catch (Exception e) {
                        log.error("Lỗi tải ảnh sản phẩm {}", maSanPham, e);
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.anhSanPhamTaiLoi"), e);
                }
        }

        /**
         * Cập nhật riêng thông tin cơ bản (không đụng giá/ảnh/biến thể/trạng thái).
         * KHÔNG gọi recalculatePriceAndStatus để tránh giá/trạng thái bị tính lại theo tồn kho.
         */
        @Transactional
        public SanPhamQuanAoDto updateBasicInfo(Integer id, SanPhamQuanAoBasicInfoUpdating dto) {
                SanPhamQuanAo sp = getOne(id).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongTimThay", id)));
                // Nhật ký: so ảnh chụp trước / sau (danh mục, thương hiệu ghi tên)
                Map<String, Object> truocSua = anhSanPham(sp);

                if (dto.getTenSanPham() != null && !dto.getTenSanPham().isBlank()) {
                        String ten = chuanHoaTenSanPham(dto.getTenSanPham());
                        if (!ten.equals(sp.getTenSanPham())) {
                                if (!cungTenSanPham(ten, sp.getTenSanPham())) kiemTraTenKhongTrung(ten, sp.getId());
                                sp.setTenSanPham(ten);
                        }
                }
                if (dto.getMoTa() != null) {
                        String moTa = blankToNull(dto.getMoTa());
                        if (!Objects.equals(moTa, sp.getMoTa())) {
                                sp.setMoTa(moTa);
                        }
                }
                if (dto.getMaVach() != null) {
                        String maVach = blankToNull(dto.getMaVach());
                        if (!Objects.equals(maVach, sp.getMaVach())) {
                                sp.setMaVach(maVach);
                        }
                }
                if (dto.getDanhMucId() != null) {
                        DanhMucQuanAo danhMuc = danhMucQuanAoService.getOne(dto.getDanhMucId()).orElseThrow(
                                () -> new CommonException(ThongDiep.of("sanPhamMuaHang.danhMucQuanAoKhongTimThay", dto.getDanhMucId()))
                        );
                        if (!danhMuc.getId().equals(sp.getDanhMuc().getId())) {
                                kiemTraDoiDanhMucKhiKiemKe(sp, sp.getDanhMuc(), danhMuc);
                                sp.setDanhMuc(danhMuc);
                        }
                }
                if (dto.getMucTonToiThieu() != null && !dto.getMucTonToiThieu().equals(sp.getMucTonToiThieu())) {
                        sp.setMucTonToiThieu(dto.getMucTonToiThieu());
                }
                if (dto.isCapNhatThuongHieu()) {
                        Integer oldId = sp.getThuongHieu() != null ? sp.getThuongHieu().getId() : null;
                        Integer newId = dto.getThuongHieuId();
                        if (!Objects.equals(oldId, newId)) {
                                applyThuongHieu(sp, newId);
                        }
                }

                sp = repository.save(sp);

                // Ghi lịch sử nếu thực sự có trường đổi (thayDoi bỏ dòng khi không đổi gì)
                ghiNhatKy(NhatKyNghiepVu.dong(ITable.san_pham_quan_ao, sp.getId(), IHanhDong.cap_nhat_san_pham)
                        .ma(sp.getMaSanPham())
                        .thayDoi(truocSua, anhSanPham(sp))
                        .ghiChu("Sửa nhanh thông tin cơ bản sản phẩm"));

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
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamThuongHieuKhongTonTai", thuongHieuId))
                );
                boolean laThuongHieuHienTai = sp.getThuongHieu() != null
                        && sp.getThuongHieu().getId().equals(thuongHieuId);
                if (!Integer.valueOf(1).equals(thuongHieu.getTrangThai()) && !laThuongHieuHienTai) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamThuongHieuNgung", thuongHieu.getTenThuongHieu()));
                }
                sp.setThuongHieu(thuongHieu);
        }

        private String blankToNull(String value) {
                return value == null || value.isBlank() ? null : value.trim();
        }

        // ---------- Tên sản phẩm không trùng ----------

        /** Tên lưu xuống: dạng NFC, bỏ khoảng trắng hai đầu, gộp khoảng trắng liên tiếp (kể cả NBSP) thành một dấu cách. */
        static String chuanHoaTenSanPham(String ten) {
                if (ten == null) return null;
                return Normalizer.normalize(ten, Normalizer.Form.NFC).replaceAll("(?U)\\s+", " ").trim();
        }

        /** Khóa so trùng tên: không phân biệt hoa thường, có phân biệt dấu ("Áo bò" khác "Ao bo"). */
        static String khoaSoTenSanPham(String ten) {
                String chuan = chuanHoaTenSanPham(ten);
                return chuan == null ? "" : chuan.toLowerCase(Locale.ROOT);
        }

        /** Hai tên được coi là một (đổi hoa thường hoặc khoảng trắng không tính là đổi tên). */
        static boolean cungTenSanPham(String a, String b) {
                return khoaSoTenSanPham(a).equals(khoaSoTenSanPham(b));
        }

        /**
         * Chặn tên đã có ở sản phẩm khác, tính mọi trạng thái (kể cả 2 = Ngừng hoạt động). {@code boQuaId}: sản phẩm đang sửa.
         * Truy vấn theo collation của cột (bỏ qua dấu) lấy ứng viên rồi lọc lại để giữ phân biệt dấu.
         * Không có khóa duy nhất ở CSDL (dữ liệu cũ có thể đang trùng) nên hai yêu cầu cùng lúc vẫn có thể lọt.
         */
        private void kiemTraTenKhongTrung(String ten, Integer boQuaId) {
                if (ten == null || ten.isEmpty()) {
                        throw new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamNhapTen"));
                }
                String khoa = khoaSoTenSanPham(ten);
                for (Object[] dong : repository.findUngVienTrungTen(ten)) {
                        Integer id = ((Number) dong[0]).intValue();
                        if (Objects.equals(id, boQuaId) || !khoa.equals(khoaSoTenSanPham((String) dong[2]))) continue;
                        String maSanPham = (String) dong[1];
                        boolean ngungHoatDong = dong[3] instanceof Number trangThai && trangThai.intValue() == 2;
                        Map<String, Object> duLieu = new LinkedHashMap<>();
                        duLieu.put("sanPhamId", id);
                        duLieu.put("maSanPham", maSanPham);
                        throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.TEN_SAN_PHAM_TRUNG,
                                ngungHoatDong
                                        ? ThongDiep.of("sanPhamMuaHang.sanPhamTenTrungDangNgung", dong[2], maSanPham)
                                        : ThongDiep.of("sanPhamMuaHang.sanPhamTenTrung", dong[2], maSanPham),
                                duLieu);
                }
        }

        @Transactional(readOnly = true)
        public SanPhamQuanAoDto getDetail(Integer id) {
                // Sử dụng findDetailById vừa tạo ở Bước 1
                SanPhamQuanAo sp = repository.findDetailById(id)
                        .orElseThrow(() -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongTimThay", id)));

                SanPhamQuanAoDto dto = sanPhamQuanAoMapper.toDto(sp);
                // Đánh dấu biến thể đã phát sinh giao dịch để form Sửa khóa màu/size đúng như backend kiểm tra.
                if (dto.getBienTheSanPhams() != null && !dto.getBienTheSanPhams().isEmpty()) {
                        Set<Integer> idDaPhatSinhGiaoDich = new HashSet<>(bienTheSanPhamRepository.findIdDaPhatSinhGiaoDich(id));
                        // Biến thể còn tồn kho: giá vốn do hệ thống tính lại theo lô nhập -> form Sửa chỉ cho xem giá
                        // (giá bán đổi ở màn Giá bán & tem mã vạch).
                        Set<Integer> idConTonKho = new HashSet<>(bienTheSanPhamRepository.findIdConTonKho(id));
                        dto.getBienTheSanPhams().forEach(bt -> {
                                bt.setDaPhatSinhGiaoDich(idDaPhatSinhGiaoDich.contains(bt.getId()));
                                bt.setConTonKho(idConTonKho.contains(bt.getId()));
                        });
                }
                return dto;
        }

        /** READ_COMMITTED: xem {@link #kiemTraTruocKhiNgung}. */
        @Transactional(isolation = Isolation.READ_COMMITTED)
        public SanPhamQuanAo changeStatus(Integer id, Integer status) {
                // Đổi trạng thái nhanh cho sản phẩm (1/0/2).
                SanPhamQuanAo sanPhamQuanAo = getOne(id).orElseThrow(
                        () -> new CommonException(ThongDiep.of("sanPhamMuaHang.sanPhamKhongTimThay", id)));
                Integer trangThaiCu = sanPhamQuanAo.getTrangThai();
                if (laNgungKinhDoanh(trangThaiCu, status)) {
                        kiemTraTruocKhiNgung(sanPhamQuanAo);
                }
                sanPhamQuanAo.setTrangThai(status);
                SanPhamQuanAo daLuu = repository.save(sanPhamQuanAo);
                ghiNhatKy(NhatKyNghiepVu.dong(ITable.san_pham_quan_ao, daLuu.getId(), IHanhDong.cap_nhat_san_pham)
                        .ma(daLuu.getMaSanPham())
                        .thayDoi(NhatKyNghiepVu.anh("trangThai", trangThaiCu), NhatKyNghiepVu.anh("trangThai", status))
                        .ghiChu("Đổi trạng thái sản phẩm"));
                return daLuu;
        }

        // ---------- Ngừng kinh doanh (trạng thái 2) ----------

        /** Trạng thái 2 = Ngừng hoạt động (ngừng kinh doanh), do người dùng đặt. */
        static final int TRANG_THAI_NGUNG_KINH_DOANH = 2;
        /** Ghép vào câu báo kiểm kê: "Tạm dừng việc ngừng kinh doanh sản phẩm tới khi đợt được duyệt hoặc hủy." */
        private static final String THAO_TAC_NGUNG = "việc ngừng kinh doanh sản phẩm";

        static boolean laNgungKinhDoanh(Integer trangThaiCu, Integer trangThaiMoi) {
                return Objects.equals(trangThaiMoi, TRANG_THAI_NGUNG_KINH_DOANH)
                        && !Objects.equals(trangThaiCu, TRANG_THAI_NGUNG_KINH_DOANH);
        }

        /**
         * Chỉ ngừng kinh doanh khi sản phẩm không còn gì dở dang: còn tồn ở kho thật (không tính Kho Trung Chuyển — hàng đang
         * đi đường thuộc phiếu chuyển), đơn bán còn giữ hàng, đơn mua đang về chưa nhận đủ, phiếu chuyển kho chưa xong
         * → 409 kèm số liệu. Sản phẩm đang thuộc đợt kiểm kê (danh mục đang kiểm, hoặc biến thể có dòng trong đợt đang kiểm /
         * chờ duyệt) → 409 STK_LOCKED như các thao tác sửa dữ liệu chủ khác.
         * Hai luồng gọi (changeStatus, update) chạy READ_COMMITTED: ở REPEATABLE READ, lần đọc thường đầu tiên của giao dịch
         * (getOne sản phẩm, cả câu đọc danh sách kho trong giuTatCaKho) chốt ảnh dữ liệu trước lúc chờ mutex, nên đợt kiểm
         * kê vừa bắt đầu, tồn và chứng từ vừa ghi trong lúc chờ không hiện ở các câu đếm dưới (xem
         * KhoaKiemKeGuard.khoaMutex). Luồng không đổi sang 2 không gọi hàm này, không giữ mutex.
         */
        void kiemTraTruocKhiNgung(SanPhamQuanAo sanPham) {
                Integer id = sanPham.getId();
                // Giữ mutex mọi kho trước khi đọc: đợt kiểm kê không bắt đầu xen giữa lúc kiểm và lúc lưu
                if (khoaKiemKeGuard != null) khoaKiemKeGuard.giuTatCaKho();

                List<ThongDiep> conDo = new ArrayList<>();
                Object[] ton = (Object[]) entityManager.createNativeQuery(
                                "SELECT COALESCE(SUM(t.so_luong_ton), 0), COUNT(DISTINCT t.kho_id) FROM ton_kho_theo_lo t "
                                        + "JOIN lo_hang l ON l.id = t.lo_hang_id "
                                        + "JOIN bien_the_san_pham bt ON bt.id = l.bien_the_san_pham_id "
                                        + "JOIN kho k ON k.id = t.kho_id "
                                        + "WHERE bt.san_pham_id = :id AND t.so_luong_ton > 0 AND k.ma_kho <> :khoAo")
                        .setParameter("id", id)
                        .setParameter("khoAo", IKiemKe.MA_KHO_AO)
                        .getSingleResult();
                BigDecimal tongTon = ton[0] == null ? BigDecimal.ZERO : new BigDecimal(ton[0].toString());
                if (tongTon.signum() > 0) {
                        conDo.add(ThongDiep.of("sanPhamMuaHang.ngungConTon", dinhDangSoLuong(tongTon), donViTinhChuThuong(sanPham), ((Number) ton[1]).longValue()));
                }

                long donBan = demChungTu("SELECT COUNT(DISTINCT d.id) FROM don_ban_hang d "
                                + "JOIN chi_tiet_don_ban_hang ct ON ct.don_ban_hang_id = d.id "
                                + "JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id "
                                + "WHERE bt.san_pham_id = :id AND d.loai_chung_tu = 'don_ban_hang' AND d.trang_thai IN (:trangThai)",
                        id, ITrangThaiDonBanHang.DANG_GIU_HANG);
                if (donBan > 0) conDo.add(ThongDiep.of("sanPhamMuaHang.ngungConDonBan", donBan));

                long donMua = demChungTu("SELECT COUNT(DISTINCT d.id) FROM don_mua_hang d "
                                + "JOIN chi_tiet_don_mua_hang ct ON ct.don_mua_hang_id = d.id "
                                + "JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id "
                                + "WHERE bt.san_pham_id = :id AND d.trang_thai IN (:trangThai) "
                                + "AND COALESCE(ct.so_luong_da_nhan, 0) < ct.so_luong_dat",
                        id, List.of(DonMuaHangService.TRANG_THAI_DA_CHAP_NHAN));
                if (donMua > 0) conDo.add(ThongDiep.of("sanPhamMuaHang.ngungConDonMua", donMua));

                long phieuChuyen = demChungTu("SELECT COUNT(DISTINCT p.id) FROM phieu_chuyen_kho p "
                                + "JOIN chi_tiet_phieu_chuyen_kho ct ON ct.phieu_chuyen_kho_id = p.id "
                                + "JOIN bien_the_san_pham bt ON bt.id = ct.bien_the_san_pham_id "
                                + "WHERE bt.san_pham_id = :id AND p.trang_thai NOT IN (:trangThai)",
                        id, List.of(IChuyenKho.HOAN_TAT, IChuyenKho.DA_HUY));
                if (phieuChuyen > 0) conDo.add(ThongDiep.of("sanPhamMuaHang.ngungConPhieuChuyen", phieuChuyen));

                if (!conDo.isEmpty()) {
                        throw new CommonException(HttpStatus.CONFLICT, cauKhongTheNgung(conDo));
                }

                if (khoaKiemKeGuard != null && sanPham.getDanhMuc() != null) {
                        khoaKiemKeGuard.kiemTraDanhMuc(List.of(sanPham.getDanhMuc().getId()), THAO_TAC_NGUNG);
                }
                @SuppressWarnings("unchecked")
                List<Object[]> dotDangKiem = entityManager.createNativeQuery(
                                "SELECT d.id, d.ma_dot_kiem_ke FROM dot_kiem_ke d WHERE d.trang_thai IN (:trangThai) "
                                        + "AND EXISTS (SELECT 1 FROM chi_tiet_kiem_ke c "
                                        + "JOIN bien_the_san_pham bt ON bt.id = c.bien_the_san_pham_id "
                                        + "WHERE c.dot_kiem_ke_id = d.id AND bt.san_pham_id = :id) ORDER BY d.id LIMIT 1")
                        .setParameter("trangThai", List.of((int) IKiemKe.DANG_KIEM_KE, (int) IKiemKe.CHO_DUYET))
                        .setParameter("id", id)
                        .getResultList();
                if (!dotDangKiem.isEmpty()) {
                        String ma = (String) dotDangKiem.get(0)[1];
                        throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_LOCKED,
                                ThongDiep.of("sanPhamMuaHang.ngungDangKiemKe", ma),
                                Map.of("dotKiemKeId", ((Number) dotDangKiem.get(0)[0]).intValue(), "maDotKiemKe", ma));
                }
        }

        private long demChungTu(String sql, Integer sanPhamId, Collection<?> trangThai) {
                Object kq = entityManager.createNativeQuery(sql)
                        .setParameter("id", sanPhamId)
                        .setParameter("trangThai", trangThai)
                        .getSingleResult();
                return kq == null ? 0 : ((Number) kq).longValue();
        }

        /** "Còn a — …", "Còn a và b — …", "Còn a, b và c — …" (1–4 phần; mỗi số phần một khóa để dịch được). */
        static ThongDiep cauKhongTheNgung(List<ThongDiep> ds) {
                return switch (ds.size()) {
                        case 1 -> ThongDiep.of("sanPhamMuaHang.ngungKhongDuoc", ds.get(0));
                        case 2 -> ThongDiep.of("sanPhamMuaHang.ngungKhongDuocHai", ds.get(0), ds.get(1));
                        case 3 -> ThongDiep.of("sanPhamMuaHang.ngungKhongDuocBa", ds.get(0), ds.get(1), ds.get(2));
                        default -> ThongDiep.of("sanPhamMuaHang.ngungKhongDuocBon", ds.get(0), ds.get(1), ds.get(2), ds.get(3));
                };
        }

        /** "1.542" — đặt cứng dấu chấm ngăn nghìn (JRE thiếu dữ liệu locale vi-VN sẽ in "1,542"). */
        static String dinhDangSoLuong(BigDecimal so) {
                java.text.DecimalFormatSymbols kyHieu = java.text.DecimalFormatSymbols.getInstance(Locale.ROOT);
                kyHieu.setGroupingSeparator('.');
                kyHieu.setDecimalSeparator(',');
                return new java.text.DecimalFormat("#,##0.###", kyHieu).format(so);
        }

        private static Object donViTinhChuThuong(SanPhamQuanAo sanPham) {
                String dvt = sanPham.getDonViTinh();
                return dvt == null || dvt.isBlank() ? ThongDiep.of("sanPhamMuaHang.donViCai") : dvt.trim().toLowerCase(Locale.forLanguageTag("vi"));
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

        // ==========================================================
        // LỌC THEO GIÁ BIẾN THỂ (trang Sản phẩm, ô "Giá từ / Giá đến")
        // giaBanMacDinh chỉ tính trên biến thể còn hàng nên sản phẩm hết hàng luôn là 0;
        // danh sách hiện giá theo biến thể đang bán nên bộ lọc cũng phải lọc theo đó.
        // ==========================================================

        /** Trường lọc ảo: có ít nhất một biến thể đang bán (trang_thai = 1, giá > 0) có giá bán thỏa mọi điều kiện. */
        public static final String TRUONG_LOC_GIA_BIEN_THE = "giaBanBienThe";

        @Override
        protected org.springframework.data.jpa.domain.Specification<SanPhamQuanAo> createSpecification(
                List<com.dev.backend.dto.request.FilterCriteria> filters) {
                if (filters == null || filters.stream().noneMatch(f -> TRUONG_LOC_GIA_BIEN_THE.equals(f.getFieldName()))) {
                        return super.createSpecification(filters);
                }
                List<com.dev.backend.dto.request.FilterCriteria> locGia = filters.stream()
                        .filter(f -> TRUONG_LOC_GIA_BIEN_THE.equals(f.getFieldName()))
                        .toList();
                List<com.dev.backend.dto.request.FilterCriteria> conLai = filters.stream()
                        .filter(f -> !TRUONG_LOC_GIA_BIEN_THE.equals(f.getFieldName()))
                        .toList();

                org.springframework.data.jpa.domain.Specification<SanPhamQuanAo> theoGia = (root, query, cb) -> {
                        jakarta.persistence.criteria.Subquery<Integer> sub = query.subquery(Integer.class);
                        jakarta.persistence.criteria.Root<BienTheSanPham> bt = sub.from(BienTheSanPham.class);
                        List<jakarta.persistence.criteria.Predicate> dieuKien = new ArrayList<>();
                        dieuKien.add(cb.equal(bt.get("sanPham"), root));
                        dieuKien.add(cb.equal(bt.get("trangThai"), 1));
                        // Giống cột giá ở danh sách: biến thể chưa đặt giá (0 hoặc trống) không tính
                        dieuKien.add(cb.greaterThan(bt.<BigDecimal>get("giaBan"), BigDecimal.ZERO));
                        for (com.dev.backend.dto.request.FilterCriteria f : locGia) {
                                if (f.getValue() == null || String.valueOf(f.getValue()).isBlank()) continue;
                                BigDecimal giaTri;
                                try {
                                        giaTri = new BigDecimal(String.valueOf(f.getValue()).trim());
                                } catch (NumberFormatException e) {
                                        // InvalidFieldException: filter() trả 400, lỗi khác bị bọc thành 500
                                        throw new InvalidFieldException(ThongDiep.of("sanPhamMuaHang.giaLocKhongHopLe", f.getValue()));
                                }
                                // Số mũ khổng lồ ("1e900000000"): driver ghi toPlainString → gần 1 tỷ chữ số, hết bộ nhớ
                                if (!GioiHanSoThapPhan.hopLe(giaTri)) {
                                        throw new InvalidFieldException(ThongDiep.of("sanPhamMuaHang.giaLocVuotGioiHan"));
                                }
                                jakarta.persistence.criteria.Path<BigDecimal> gia = bt.get("giaBan");
                                switch (f.getOperation()) {
                                        case GREATER_THAN_OR_EQUAL -> dieuKien.add(cb.greaterThanOrEqualTo(gia, giaTri));
                                        case GREATER_THAN -> dieuKien.add(cb.greaterThan(gia, giaTri));
                                        case LESS_THAN_OR_EQUAL -> dieuKien.add(cb.lessThanOrEqualTo(gia, giaTri));
                                        case LESS_THAN -> dieuKien.add(cb.lessThan(gia, giaTri));
                                        case EQUALS -> dieuKien.add(cb.equal(gia, giaTri));
                                        default -> throw new CommonException(ThongDiep.of("sanPhamMuaHang.giaLocKhongHoTroPhep", f.getOperation()));
                                }
                        }
                        sub.select(bt.get("id")).where(dieuKien.toArray(new jakarta.persistence.criteria.Predicate[0]));
                        return cb.exists(sub);
                };
                return super.createSpecification(conLai).and(theoGia);
        }
}
