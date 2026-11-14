package com.dev.backend.services.impl.entities;

import com.dev.backend.config.SecurityContextHolder;
import com.dev.backend.constant.variables.IRoleType;
import com.dev.backend.dto.response.entities.LichSuGiaoDichKhoDto;
import com.dev.backend.dto.response.entities.NguoiDungAuthInfo;
import com.dev.backend.entities.ChiTietPhieuChuyenKe;
import com.dev.backend.entities.LichSuGiaoDichKho;
import com.dev.backend.entities.ViTriKho;
import com.dev.backend.exception.customize.CommonException;
import com.dev.backend.mapper.LichSuGiaoDichKhoMapper;
import com.dev.backend.repository.ChiTietPhieuChuyenKeRepository;
import com.dev.backend.repository.LichSuGiaoDichKhoRepository;
import com.dev.backend.repository.ViTriKhoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.dev.backend.i18n.ThongDiep;

@Service
@RequiredArgsConstructor
public class LichSuGiaoDichKhoService {

    private final LichSuGiaoDichKhoRepository repository;
    private final LichSuGiaoDichKhoMapper mapper;
    private final ViTriKhoRepository viTriKhoRepository;
    private final ChiTietPhieuChuyenKeRepository chiTietPhieuChuyenKeRepository;

    /**
     * Lấy danh sách lịch sử giao dịch theo phân quyền:
     *  - quan_tri_vien  → xem tất cả
     *  - quan_ly_kho    → chỉ xem kho mình được phân quyền (phan_quyen_nguoi_dung_kho, trangThai=1)
     *  - nhan_vien_kho  → chỉ xem kho mình được phân công (phan_quyen_nguoi_dung_kho, trangThai=1)
     */
    @Transactional(readOnly = true)
    public List<LichSuGiaoDichKhoDto> getAll() {
        NguoiDungAuthInfo currentUser = SecurityContextHolder.getUser();

        boolean isAdmin    = currentUser.getVaiTro().contains(IRoleType.quan_tri_vien);
        boolean isQuanLy   = currentUser.getVaiTro().contains(IRoleType.quan_ly_kho);
        boolean isNhanVien = currentUser.getVaiTro().contains(IRoleType.nhan_vien_kho);

        List<LichSuGiaoDichKho> result;

        if (isAdmin) {
            result = repository.findAllWithDetails();

        } else if (isQuanLy) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByQuanLyId(currentUser.getId());

        } else if (isNhanVien) {
            // Lấy theo bảng phan_quyen_nguoi_dung_kho, trangThai=1
            result = repository.findAllByNhanVienId(currentUser.getId());

        } else {
            throw new CommonException(ThongDiep.of("chungTuKho.khongCoQuyenTruyCap"));
        }

        return result.stream()
                .map(mapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LichSuGiaoDichKhoDto getChiTiet(Integer id) {
        LichSuGiaoDichKho entity = repository.findByIdWithDetails(id)
                .orElseThrow(() -> new CommonException(ThongDiep.of("chungTuKho.lichSuKhongTimThay", id)));
        LichSuGiaoDichKhoDto dto = mapper.toDto(entity);
        // Dòng chuyển kệ: thêm khu, dãy, hàng, tầng của hai kệ. Mã kệ giữ như sổ ghi lúc chuyển.
        if (dto.getKeNguon() != null && dto.getKeDich() != null) {
            ChiTietPhieuChuyenKe dong = timDongPhieu(entity);
            if (dong != null) {
                // Lấy đúng hai kệ của dòng phiếu: kệ có đổi mã sau đó vẫn ra vị trí đúng
                dto.setKeNguon(keCo(dto.getKeNguon().getMa(), dong.getKeNguon()));
                dto.setKeDich(keCo(dto.getKeDich().getMa(), dong.getKeDich()));
            } else if (dto.getKhoId() != null) {
                // Không thấy dòng phiếu (dữ liệu cũ, lệch): tra theo mã kệ trong kho của dòng sổ
                dto.setKeNguon(theoMa(dto.getKhoId(), dto.getKeNguon()));
                dto.setKeDich(theoMa(dto.getKhoId(), dto.getKeDich()));
            }
        }
        return dto;
    }

    /**
     * Dòng phiếu chuyển kệ ứng với dòng sổ: theo phiếu (id_tham_chieu) và lô. Một lô sang nhiều kệ đích thì có nhiều dòng;
     * ChuyenKeNoiBoService ghi dòng phiếu và dòng sổ xen kẽ trong cùng vòng lặp nên thứ tự id của hai bên trùng nhau.
     */
    private ChiTietPhieuChuyenKe timDongPhieu(LichSuGiaoDichKho e) {
        if (e.getIdThamChieu() == null || e.getLoHang() == null) return null;
        Integer loId = e.getLoHang().getId();
        List<ChiTietPhieuChuyenKe> ds = chiTietPhieuChuyenKeRepository.theoPhieuVaLo(e.getIdThamChieu(), loId);
        if (ds.size() <= 1) return ds.isEmpty() ? null : ds.get(0);
        List<Integer> soCungLo = repository.findByLoaiThamChieuAndIdThamChieuOrderByIdAsc(e.getLoaiThamChieu(), e.getIdThamChieu())
                .stream()
                .filter(x -> x.getLoHang() != null && loId.equals(x.getLoHang().getId()))
                .map(LichSuGiaoDichKho::getId)
                .toList();
        int viTri = soCungLo.indexOf(e.getId());
        return viTri >= 0 && soCungLo.size() == ds.size() ? ds.get(viTri) : null;
    }

    private static LichSuGiaoDichKhoDto.KeGiaoDich keCo(String maTrongSo, ViTriKho vt) {
        return new LichSuGiaoDichKhoDto.KeGiaoDich(maTrongSo,
                vt.getKhuVucKho() != null ? vt.getKhuVucKho().getTenKhuVuc() : null,
                vt.getDayKe(), vt.getHangKe(), vt.getTangKe());
    }

    /** Kệ đã bị xóa thì giữ nguyên mã đã ghi trong sổ. */
    private LichSuGiaoDichKhoDto.KeGiaoDich theoMa(Integer khoId, LichSuGiaoDichKhoDto.KeGiaoDich ke) {
        if (ke.getMa() == null) return ke;
        return viTriKhoRepository.findFirstByKho_IdAndMaViTriIgnoreCase(khoId, ke.getMa())
                .map(vt -> keCo(ke.getMa(), vt))
                .orElse(ke);
    }

    @Transactional
    public LichSuGiaoDichKho create(LichSuGiaoDichKho entity) {
        return repository.save(entity);
    }
}