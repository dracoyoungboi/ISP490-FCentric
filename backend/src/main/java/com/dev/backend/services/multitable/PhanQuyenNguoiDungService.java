package com.dev.backend.services.multitable;

import com.dev.backend.dto.request.LuuPhanQuyenRequest;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.phanquyen.CauHinhPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.LichSuPhanQuyenDto;
import com.dev.backend.dto.response.phanquyen.QuyenCuaToiDto;

import java.util.List;

/** Phân quyền người dùng: vai trò + kho phụ trách + quyền tại kho, mẫu quyền theo vai trò, quyền của tôi. */
public interface PhanQuyenNguoiDungService {

    /** Lưu vai trò, kho, hạn hiệu lực và tập quyền đầy đủ trong một giao dịch; ghi một dòng lịch sử nếu có thay đổi. */
    void luuPhanQuyen(Integer nguoiDungId, LuuPhanQuyenRequest request);

    /** Lịch sử phân quyền của một người dùng, mới nhất trước. */
    List<LichSuPhanQuyenDto> layLichSuPhanQuyen(Integer nguoiDungId);

    /** Mẫu quyền theo vai trò, quyền nhạy cảm, quyền máy chủ đang kiểm. */
    CauHinhPhanQuyenDto layCauHinhPhanQuyen();

    /** Thay mẫu quyền của một vai trò. */
    void capNhatMauQuyen(String vaiTro, List<Integer> quyenHanIds);

    /** Quyền của người đang đăng nhập, đọc từ CSDL. */
    QuyenCuaToiDto layQuyenCuaToi();

    /** API cũ gán vai trò: đổi vai trò, giữ kho và quyền hiện có, ghi lịch sử. */
    void doiVaiTro(Integer nguoiDungId, String vaiTro);

    /** Chặn API cũ gán quyền (gan-quyen) khi vi phạm quy tắc phân kho hoặc vượt quyền người cấp. */
    void kiemTraGanQuyenCu(Integer khoIdDangChon, PhanQuyenNguoiDungKhoCreating request);

    /** API cũ xóa quyền: thu hồi (không xóa) một phân quyền kho, ghi lịch sử. */
    void thuHoiPhanQuyenKhoTheoId(Integer phanQuyenId, Integer khoIdDangChon);
}
