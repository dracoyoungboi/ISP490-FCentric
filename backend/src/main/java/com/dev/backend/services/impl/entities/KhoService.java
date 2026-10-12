package com.dev.backend.services.impl.entities;

import com.dev.backend.dto.request.KhoCreating;
import com.dev.backend.dto.request.KhoUpdating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.KhoDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.KhoMapper;
import com.dev.backend.repository.KhoRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class KhoService extends BaseServiceImpl<Kho, Integer> {
    @Autowired
    private EntityManager entityManager;

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    public KhoService(KhoRepository repository) {
        super(repository);
    }

    private KhoRepository khoRepository = (KhoRepository) getRepository();

    @Autowired
    private NguoiDungService nguoiDungService;
    @Autowired
    private KhoMapper khoMapper;

    /** Loại kho (cột kho.loai_kho). */
    public static final String KHO_TONG = "kho_tong";
    public static final String KHO_BAN_HANG = "cua_hang";
    /** Kho ảo chứa hàng đang chuyển giữa các kho. */
    private static final String MA_KHO_AO = "KHO_TRANSIT";

    /** Kho ảo KHO_TRANSIT (hàng đang chuyển giữa các kho). */
    public static boolean laKhoAo(Kho kho) {
        return kho != null && MA_KHO_AO.equalsIgnoreCase(kho.getMaKho());
    }

    public static boolean laKhoTong(Kho kho) {
        return kho != null && KHO_TONG.equals(kho.getLoaiKho());
    }

    /** Kho của chứng từ mới (chuyển kho, bán hàng...): phải tồn tại, đang hoạt động và không phải kho ảo. */
    public static void kiemTraKhoGiaoDich(Kho kho, String vaiTro) {
        if (kho == null) {
            throw new CommonException(vaiTro + " không tồn tại");
        }
        if (laKhoAo(kho)) {
            throw new CommonException(vaiTro + " không được là Kho Trung Chuyển (kho ảo chứa hàng đang chuyển giữa các kho)");
        }
        if (kho.getTrangThai() == null || kho.getTrangThai() != 1) {
            throw new CommonException(kho.getTenKho() + " đang ngừng hoạt động, không dùng làm " + vaiTro.toLowerCase() + " được");
        }
    }

    /** Bán tại quầy: kho giao dịch và không phải Kho tổng. */
    public static void kiemTraKhoBanTaiQuay(Kho kho) {
        kiemTraKhoGiaoDich(kho, "Kho bán hàng");
        if (laKhoTong(kho)) {
            throw new CommonException("Kho tổng chỉ dùng để phân phối hàng, không bán tại quầy. Hãy chọn một kho bán hàng.");
        }
    }

    /** Nhập hàng từ nhà cung cấp: chỉ Kho tổng. Kho bán hàng nhận hàng bằng phiếu chuyển kho. */
    public static void kiemTraKhoNhapNcc(Kho kho) {
        kiemTraKhoGiaoDich(kho, "Kho nhận hàng");
        if (!laKhoTong(kho)) {
            throw new CommonException("Chỉ Kho tổng được nhập hàng từ nhà cung cấp. " + kho.getTenKho()
                    + " là kho bán hàng, hãy nhận hàng bằng phiếu chuyển kho từ Kho tổng.");
        }
    }

    /** Chỉ nhận kho_tong hoặc cua_hang; để trống thì dùng giá trị mặc định truyền vào. */
    private String chuanHoaLoaiKho(String loaiKho, String macDinh) {
        if (loaiKho == null || loaiKho.isBlank()) {
            return macDinh;
        }
        String giaTri = loaiKho.trim().toLowerCase();
        if (!KHO_TONG.equals(giaTri) && !KHO_BAN_HANG.equals(giaTri)) {
            throw new CommonException("Loại kho không hợp lệ, chỉ nhận Kho tổng hoặc Kho bán hàng");
        }
        return giaTri;
    }

    /** Kho ảo không làm Kho tổng được; hệ thống chỉ có một Kho tổng đang hoạt động. */
    private void kiemTraKhoTong(Integer khoId, String maKho, String loaiKho, Integer trangThai) {
        if (!KHO_TONG.equals(loaiKho)) {
            return;
        }
        if (MA_KHO_AO.equalsIgnoreCase(maKho)) {
            throw new CommonException("Kho Trung Chuyển là kho ảo chứa hàng đang chuyển, không thể làm Kho tổng");
        }
        if (trangThai == null || trangThai != 1) {
            return;
        }
        String jpql = "SELECT k FROM Kho k WHERE k.loaiKho = :loai AND k.trangThai = 1"
                + (khoId != null ? " AND k.id <> :id" : "");
        TypedQuery<Kho> query = entityManager.createQuery(jpql, Kho.class).setParameter("loai", KHO_TONG);
        if (khoId != null) {
            query.setParameter("id", khoId);
        }
        List<Kho> khoTongKhac = query.setMaxResults(1).getResultList();
        if (!khoTongKhac.isEmpty()) {
            throw new CommonException("Đã có Kho tổng đang hoạt động: " + khoTongKhac.get(0).getTenKho()
                    + ". Hãy đổi kho đó thành Kho bán hàng trước.");
        }
    }

    @Transactional
    public ResponseEntity<ResponseData<KhoDto>> create(KhoCreating creating) {

        Optional<NguoiDung> findingQuanLy = nguoiDungService.getOne(creating.getQuanLyId());

        if (findingQuanLy.isEmpty()) {
            throw new CommonException("Không tìm thấy người dùng id: " + creating.getQuanLyId());
        }

        Optional<Kho> findingKho = khoRepository.findByMaKho(creating.getMaKho());
        if (findingKho.isPresent()) {
            throw new CommonException("Mã kho đã tồn tại");
        }
        String loaiKho = chuanHoaLoaiKho(creating.getLoaiKho(), KHO_BAN_HANG);
        kiemTraKhoTong(null, creating.getMaKho(), loaiKho, creating.getTrangThai());

        Kho kho = new Kho();
        kho.setLoaiKho(loaiKho);
        kho.setTenKho(creating.getTenKho());
        kho.setMaKho(creating.getMaKho());
        kho.setDiaChi(creating.getDiaChi());
        kho.setQuanLy(findingQuanLy.get());
        kho.setTrangThai(creating.getTrangThai());
        kho = create(kho);
        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDto(kho))
                        .message("Success")
                        .build()
        );
    }

    @Transactional
    public ResponseEntity<ResponseData<KhoDto>> update(KhoUpdating updating) {

        Optional<NguoiDung> findingQuanLy = nguoiDungService.getOne(updating.getQuanLyId());
        if (findingQuanLy.isEmpty()) {
            throw new CommonException("Không tìm thấy người dùng id: " + updating.getQuanLyId());
        }
        Optional<Kho> findingKho = khoRepository.findByMaKho(updating.getMaKho());
        if (findingKho.isPresent() && !findingKho.get().getId().equals(updating.getId())) {
            throw new CommonException("Mã kho đã tồn tại");
        }
        Kho kho = null;
        if (findingKho.isPresent()) {
            kho = findingKho.get();
        } else {
            Optional<Kho> findingUpdatingKho = getOne(updating.getId());
            if (findingUpdatingKho.isEmpty()){
                throw new CommonException("Không tìm thấy kho id: " + updating.getId());
            }
            kho = findingUpdatingKho.get();
        }
        String loaiKho = chuanHoaLoaiKho(updating.getLoaiKho(), kho.getLoaiKho() != null ? kho.getLoaiKho() : KHO_BAN_HANG);
        kiemTraKhoTong(kho.getId(), updating.getMaKho(), loaiKho, updating.getTrangThai());
        kho.setLoaiKho(loaiKho);
        kho.setMaKho(updating.getMaKho());
        kho.setTenKho(updating.getTenKho());
        kho.setDiaChi(updating.getDiaChi());
        kho.setQuanLy(findingQuanLy.get());
        kho.setTrangThai(updating.getTrangThai());
        kho = update(updating.getId(), kho);

        return ResponseEntity.ok(
                ResponseData.<KhoDto>builder()
                        .status(HttpStatus.OK.value())
                        .data(khoMapper.toDto(kho))
                        .message("Success")
                        .build()
        );
    }

}
