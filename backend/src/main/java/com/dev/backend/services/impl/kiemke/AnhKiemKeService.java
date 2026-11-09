package com.dev.backend.services.impl.kiemke;

import com.dev.backend.constant.enums.FileType;
import com.dev.backend.constant.variables.IKiemKe;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.*;
import com.dev.backend.exception.customize.LoiCoMaException;
import com.dev.backend.exception.customize.MaLoi;
import com.dev.backend.repository.*;
import com.dev.backend.services.MinioService;
import com.dev.backend.utils.KhoDangChon;
import com.dev.backend.utils.KiemTraTepTai;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.*;
import com.dev.backend.i18n.ThongDiep;

/**
 * Ảnh minh chứng của dòng kiểm kê (anh_kiem_ke, loai_anh = van_de; BR-STK-07: khuyến nghị, không bắt buộc). PNG / JPEG /
 * WebP tới 5 MB, nhận dạng theo byte đầu tệp; tối đa {@value #SO_ANH_TOI_DA} ảnh mỗi lần đếm của dòng.
 * Thêm / xóa khi đợt đang kiểm kê và dòng chưa xác nhận; ảnh của lần đếm trước (đã lưu ở kiem_ke_lan_dem) chỉ xem.
 * Tệp tải lên MinIO ngoài giao dịch CSDL; lưu dòng bị chặn thì xóa tệp vừa tải (cùng cách với ảnh biên bản giao nhận).
 */
@Slf4j
@Service
public class AnhKiemKeService {

    public static final long DUNG_LUONG_TOI_DA = 5L * 1024 * 1024;
    public static final int SO_ANH_TOI_DA = 6;
    static final String THU_MUC_MINIO = "kiem-ke/";

    @PersistenceContext
    private EntityManager em;

    private final DotKiemKeRepository dotRepo;
    private final ChiTietKiemKeRepository dongRepo;
    private final AnhKiemKeRepository anhRepo;
    private final KiemKeLanDemRepository lanDemRepo;
    private final TepTinRepository tepTinRepo;
    private final MinioService minioService;
    private final KiemKeQuyen quyen;
    private final KiemKeSanSang sanSang;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate giaoDich;
    private final TransactionTemplate giaoDichChiDoc;

    public AnhKiemKeService(DotKiemKeRepository dotRepo, ChiTietKiemKeRepository dongRepo, AnhKiemKeRepository anhRepo,
                            KiemKeLanDemRepository lanDemRepo, TepTinRepository tepTinRepo, MinioService minioService,
                            KiemKeQuyen quyen, KiemKeSanSang sanSang, ObjectMapper objectMapper,
                            PlatformTransactionManager transactionManager) {
        this.dotRepo = dotRepo;
        this.dongRepo = dongRepo;
        this.anhRepo = anhRepo;
        this.lanDemRepo = lanDemRepo;
        this.tepTinRepo = tepTinRepo;
        this.minioService = minioService;
        this.quyen = quyen;
        this.sanSang = sanSang;
        this.objectMapper = objectMapper;
        TransactionTemplate ghi = new TransactionTemplate(transactionManager);
        ghi.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
        this.giaoDich = ghi;
        TransactionTemplate doc = new TransactionTemplate(transactionManager);
        doc.setReadOnly(true);
        this.giaoDichChiDoc = doc;
    }

    private record DongDuocSua(DotKiemKe dot, ChiTietKiemKe dong) {
    }

    /** Đợt đang kiểm kê, dòng thuộc đợt và chưa xác nhận, người thuộc kho (nhân viên / quản lý kho, quản trị viên). */
    private DongDuocSua kiemTra(Integer dotId, Integer dongId, boolean khoa) {
        DotKiemKe dot = (khoa ? dotRepo.khoaDocTheoId(dotId) : dotRepo.findById(dotId))
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dotKiemKeKhongTimThay")));
        // Lần kiểm có khóa (sau khi tải tệp lên): nạp lại bản mới nhất — với open-in-view, entity đã nạp ở lần kiểm đầu vẫn là
        // bản cũ dù câu khóa đã chạy
        if (khoa) em.refresh(dot);
        KhoDangChon.kiemTra(dot.getKho(), KiemKeService.ten(dot));
        if (dot.getTrangThai() != IKiemKe.DANG_KIEM_KE) {
            throw KiemKeService.saiTrangThai(ThongDiep.of("khoVanHanh.chiThemXoaAnhKhiDangKiem"), dot);
        }
        ChiTietKiemKe dong = (khoa ? dongRepo.khoaTheoId(dongId) : dongRepo.findById(dongId))
                .filter(d -> dotId.equals(d.getDotKiemKeId()))
                .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dongKiemKeKhongThuocDot")));
        if (khoa) em.refresh(dong);
        if (dong.getTrangThai() != null && dong.getTrangThai() == IKiemKe.DONG_DA_XAC_NHAN) {
            throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.dongDaXacNhanAnhChiXem"));
        }
        return new DongDuocSua(dot, dong);
    }

    private Set<Integer> anhLanTruoc(Integer dongId) {
        Set<Integer> kq = new HashSet<>();
        for (KiemKeLanDem l : lanDemRepo.theoDong(List.of(dongId))) {
            if (l.getAnhThamChieu() == null) continue;
            try {
                kq.addAll(Arrays.asList(objectMapper.readValue(l.getAnhThamChieu(), Integer[].class)));
            } catch (Exception ignored) {
                // ảnh tham chiếu hỏng: coi như không có
            }
        }
        return kq;
    }

    public AnhKiemKe them(Integer dotId, Integer dongId, MultipartFile file, String moTa) {
        sanSang.batBuoc();
        NguoiDungAuthInfo user = quyen.nguoiXem();
        KiemTraTepTai.LoaiTep loai = KiemTraTepTai.batBuoc(file, KiemTraTepTai.ANH_CHUP, DUNG_LUONG_TOI_DA,
                "Ảnh minh chứng", "ảnh PNG, JPEG hoặc WebP");
        String moTaGon = moTa == null || moTa.isBlank() ? null : moTa.trim();
        if (moTaGon != null && moTaGon.length() > 500) {
            throw KiemKePhamViService.phamViSai(ThongDiep.of("khoVanHanh.moTaAnhToiDa"));
        }
        giaoDichChiDoc.execute(s -> kiemTra(dotId, dongId, false));

        String objectName = THU_MUC_MINIO + dotId + "/" + dongId + "/" + UUID.randomUUID() + "." + loai.duoi;
        String url;
        try {
            minioService.upload(file, objectName);
            url = minioService.getPublicUrl(objectName);
        } catch (Exception e) {
            log.error("Lỗi tải ảnh kiểm kê {} lên MinIO: {}", dotId, e.getMessage(), e);
            throw new LoiCoMaException(HttpStatus.INTERNAL_SERVER_ERROR, MaLoi.STK_INVALID_STATE,
                    ThongDiep.of("khoVanHanh.khongLuuDuocAnh"));
        }
        try {
            return giaoDich.execute(s -> {
                DongDuocSua x = kiemTra(dotId, dongId, true);
                List<Integer> co = new ArrayList<>(anhRepo.idTheoDong(dongId));
                co.removeAll(anhLanTruoc(dongId));
                if (co.size() >= SO_ANH_TOI_DA) {
                    throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE,
                            ThongDiep.of("khoVanHanh.anhToiDaMoiLanDem", SO_ANH_TOI_DA));
                }
                NguoiDung nguoi = quyen.nguoiHienTai();
                Instant bayGio = Instant.now();
                String tenGoc = file.getOriginalFilename() == null ? null
                        : file.getOriginalFilename().length() > 255 ? file.getOriginalFilename().substring(0, 255) : file.getOriginalFilename();
                TepTin tep = tepTinRepo.save(TepTin.builder()
                        .tenTepGoc(tenGoc)
                        .tenTaiLen(tenGoc)
                        .tenLuuTru(objectName)
                        .duongDan(url)
                        .loaiTepTin(FileType.IMAGE.toString())
                        .duoiTep(loai.duoi)
                        .kichCo((int) file.getSize())
                        .moTa("Ảnh minh chứng kiểm kê " + x.dot().getMaDotKiemKe())
                        .ngayTao(bayGio)
                        .build());
                AnhKiemKe anh = new AnhKiemKe();
                anh.setChiTietKiemKe(x.dong());
                anh.setTepTin(tep);
                anh.setLoaiAnh("van_de");
                anh.setMoTa(moTaGon);
                anh.setNgayChup(bayGio);
                anh.setNguoiChup(nguoi);
                return anhRepo.save(anh);
            });
        } catch (RuntimeException e) {
            xoaTep(objectName);
            throw e;
        }
    }

    public void xoa(Integer dotId, Integer dongId, Integer anhId) {
        sanSang.batBuoc();
        NguoiDungAuthInfo user = quyen.nguoiXem();
        String tenLuuTru = giaoDich.execute(s -> {
            kiemTra(dotId, dongId, true);
            AnhKiemKe anh = anhRepo.findById(anhId)
                    .filter(a -> a.getChiTietKiemKe() != null && dongId.equals(a.getChiTietKiemKe().getId()))
                    .orElseThrow(() -> new LoiCoMaException(HttpStatus.NOT_FOUND, MaLoi.STK_INVALID_STATE,
                            ThongDiep.of("khoVanHanh.anhKhongTimThayODong")));
            if (anhLanTruoc(dongId).contains(anhId)) {
                throw new LoiCoMaException(HttpStatus.CONFLICT, MaLoi.STK_INVALID_STATE, ThongDiep.of("khoVanHanh.anhLanDemTruocChiXem"));
            }
            boolean laNguoiChup = anh.getNguoiChup() != null && user != null && user.getId() != null
                    && user.getId().equals(anh.getNguoiChup().getId());
            if (!laNguoiChup && !KiemKeQuyen.laQuanTri(user) && !KiemKeQuyen.co(user, IRoleType.quan_ly_kho)) {
                throw new LoiCoMaException(HttpStatus.FORBIDDEN, MaLoi.STK_INVALID_STATE,
                        ThongDiep.of("khoVanHanh.chiNguoiChupXoaAnh"));
            }
            TepTin tep = anh.getTepTin();
            anhRepo.delete(anh);
            anhRepo.flush();
            String ten = tep == null ? null : tep.getTenLuuTru();
            if (tep != null) tepTinRepo.delete(tep);
            return ten;
        });
        if (tenLuuTru != null) xoaTep(tenLuuTru);
    }

    private void xoaTep(String objectName) {
        try {
            if (!minioService.delete(objectName)) log.warn("Không xóa được tệp MinIO {}", objectName);
        } catch (Exception e) {
            log.warn("Không xóa được tệp MinIO {}: {}", objectName, e.getMessage());
        }
    }
}
