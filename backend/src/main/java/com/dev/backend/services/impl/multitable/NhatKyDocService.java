package com.dev.backend.services.impl.multitable;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.INguonNhatKy;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.dto.response.NhatKyDto;
import com.dev.backend.entities.Kho;
import com.dev.backend.entities.KhuVucKho;
import com.dev.backend.entities.LichSuThayDoi;
import com.dev.backend.entities.MatBangKho;
import com.dev.backend.entities.NguoiDung;
import com.dev.backend.entities.ViTriKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.repository.LichSuThayDoiRepository;
import com.dev.backend.utils.KhoDangChon;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Đọc lịch sử thay đổi của MASTER DATA (lich_su_thay_doi) cho ngăn "Lịch sử thay đổi" ở trang chi tiết (BA 05/11: chỉ
 * lưu / xem lịch sử danh mục — người dùng, sản phẩm, giá bán, danh mục, thuộc tính, nhà cung cấp, kho, vị trí kệ, khách
 * hàng; không còn màn Nhật ký hệ thống).
 * <ul>
 *   <li>{@link #theoDoiTuongQuanTri}: mọi danh mục, chỉ quản trị viên (kèm tên đăng nhập).</li>
 *   <li>{@link #theoSanPham}, {@link #lichSuGiaBienThe}, {@link #theoViTriKho}: quản trị viên + quản lý kho (N3), không
 *   trả tên đăng nhập; vị trí kệ chỉ kho mình.</li>
 * </ul>
 * Không trả dòng quét mã / đồng bộ sàn (ghi rất nhiều), dòng lượt in cũ và dòng đăng nhập (N4: vẫn ghi ngầm, không hiện).
 */
@Service
public class NhatKyDocService {

    static final int TOI_DA_THEO_DOI_TUONG = 300;

    // Hành động không hiện ở ngăn Lịch sử. "in_chung_tu": lượt in đã bỏ (05/11), dòng cũ còn trong DB
    static final List<String> BO_QUA_THEO_DOI_TUONG;

    static {
        List<String> boQua = new ArrayList<>(IHanhDong.DUOC_DON);
        boQua.add("in_chung_tu");
        boQua.add(IHanhDong.dang_nhap);
        boQua.add(IHanhDong.dang_nhap_that_bai);
        BO_QUA_THEO_DOI_TUONG = List.copyOf(boQua);
    }

    private final LichSuThayDoiRepository repository;
    private final EntityManager entityManager;

    public NhatKyDocService(LichSuThayDoiRepository repository, EntityManager entityManager) {
        this.repository = repository;
        this.entityManager = entityManager;
    }

    /** Lịch sử một đối tượng, kèm tên đăng nhập — chỉ endpoint của quản trị viên (GET /admin/nhat-ky/doi-tuong). */
    @Transactional(readOnly = true)
    public List<NhatKyDto> theoDoiTuongQuanTri(String loaiThamChieu, Integer idThamChieu) {
        return docTheoDoiTuong(loaiThamChieu, idThamChieu, true);
    }

    private List<NhatKyDto> docTheoDoiTuong(String loai, Integer id, boolean coTenDangNhap) {
        if (loai == null || id == null) return List.of();
        return repository.lichSuTruHanhDong(loai, id, BO_QUA_THEO_DOI_TUONG, PageRequest.of(0, TOI_DA_THEO_DOI_TUONG))
                .stream().map(l -> toDto(l, coTenDangNhap)).toList();
    }

    /**
     * Lịch sử sản phẩm: dòng của sản phẩm + các lần đổi giá bán của mọi biến thể thuộc sản phẩm, mới nhất trước (tối đa
     * 300). 404 nếu không có sản phẩm.
     */
    @Transactional(readOnly = true)
    public List<NhatKyDto> theoSanPham(Integer sanPhamId) {
        if (sanPhamId == null || entityManager.find(com.dev.backend.entities.SanPhamQuanAo.class, sanPhamId) == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy sản phẩm.");
        }
        List<Integer> bienTheIds = entityManager.createQuery(
                        "SELECT b.id FROM BienTheSanPham b WHERE b.sanPham.id = :id", Integer.class)
                .setParameter("id", sanPhamId)
                .getResultList();
        return repository.lichSuSanPham(ITable.san_pham_quan_ao, sanPhamId, BO_QUA_THEO_DOI_TUONG, ITable.bien_the_san_pham,
                        bienTheIds.isEmpty() ? List.of(-1) : bienTheIds, IHanhDong.doi_gia_ban,
                        PageRequest.of(0, TOI_DA_THEO_DOI_TUONG))
                .stream().map(l -> toDto(l, false)).toList();
    }

    /** Các lần đổi giá bán của một biến thể (màn Giá bán & tem), mới nhất trước. 404 nếu không có biến thể. */
    @Transactional(readOnly = true)
    public List<NhatKyDto> lichSuGiaBienThe(Integer bienTheId) {
        if (bienTheId == null || entityManager.find(com.dev.backend.entities.BienTheSanPham.class, bienTheId) == null) {
            throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy biến thể.");
        }
        return repository.findByLoaiThamChieuAndIdThamChieuAndHanhDongInOrderByNgayThucHienDescIdDesc(
                        ITable.bien_the_san_pham, bienTheId, List.of(IHanhDong.doi_gia_ban),
                        PageRequest.of(0, TOI_DA_THEO_DOI_TUONG))
                .stream().map(l -> toDto(l, false)).toList();
    }

    /**
     * Lịch sử khu vực / kệ / mặt bằng của một kho. Người xem phải xem được kho (quản trị viên mọi kho; quản lý kho chỉ
     * kho được phân công) và đối tượng phải thuộc đúng kho trong đường dẫn. Mặt bằng: id = id dòng mat_bang_kho của kho;
     * truyền id trống thì lấy mặt bằng của kho.
     */
    @Transactional(readOnly = true)
    public List<NhatKyDto> theoViTriKho(Integer khoId, String loai, Integer id) {
        Kho kho = khoId == null ? null : entityManager.find(Kho.class, khoId);
        if (kho == null) throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy kho.");
        KhoDangChon.kiemTraXem(kho, "Kho " + kho.getTenKho());
        Integer idDoiTuong = id;
        if (ITable.khu_vuc_kho.equals(loai)) {
            KhuVucKho kv = id == null ? null : entityManager.find(KhuVucKho.class, id);
            if (kv == null || kv.getKho() == null || !Objects.equals(kv.getKho().getId(), khoId)) {
                throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy khu vực trong kho này.");
            }
        } else if (ITable.vi_tri_kho.equals(loai)) {
            ViTriKho vt = id == null ? null : entityManager.find(ViTriKho.class, id);
            if (vt == null || vt.getKho() == null || !Objects.equals(vt.getKho().getId(), khoId)) {
                throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy kệ trong kho này.");
            }
        } else if (ITable.mat_bang_kho.equals(loai)) {
            List<Integer> ids = entityManager.createQuery(
                            "SELECT m.id FROM MatBangKho m WHERE m.kho.id = :khoId", Integer.class)
                    .setParameter("khoId", khoId)
                    .getResultList();
            if (id == null) {
                if (ids.isEmpty()) return List.of();
                idDoiTuong = ids.get(0);
            } else if (!ids.contains(id)) {
                throw new CommonException(HttpStatus.NOT_FOUND, "Không tìm thấy mặt bằng của kho này.");
            }
        } else {
            throw new CommonException("Loại đối tượng không hợp lệ (khu_vuc_kho, vi_tri_kho, mat_bang_kho).");
        }
        return docTheoDoiTuong(loai, idDoiTuong, false);
    }

    static NhatKyDto toDto(LichSuThayDoi l, boolean coTenDangNhap) {
        NguoiDung n = l.getNguoiThucHien();
        Kho k = l.getKho();
        return NhatKyDto.builder()
                .id(l.getId())
                .loaiThamChieu(l.getLoaiThamChieu())
                .idThamChieu(l.getIdThamChieu())
                .maDoiTuong(l.getMaDoiTuong())
                .hanhDong(l.getHanhDong())
                .giaTriCu(l.getGiaTriCu())
                .giaTriMoi(l.getGiaTriMoi())
                .ghiChu(l.getGhiChu())
                .nguon(l.getNguon() != null ? l.getNguon() : (n != null ? INguonNhatKy.nguoi_dung : null))
                .nguoiThucHienId(n == null ? null : n.getId())
                .nguoiThucHienTen(n == null ? null : n.getHoTen())
                .nguoiThucHienTenDangNhap(n == null || !coTenDangNhap ? null : n.getTenDangNhap())
                .khoId(k == null ? null : k.getId())
                .tenKho(k == null ? null : k.getTenKho())
                .ngayThucHien(l.getNgayThucHien())
                .build();
    }
}
