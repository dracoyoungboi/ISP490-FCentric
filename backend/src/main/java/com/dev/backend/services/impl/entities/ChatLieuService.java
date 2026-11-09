package com.dev.backend.services.impl.entities;

import com.dev.backend.constant.variables.IHanhDong;
import com.dev.backend.constant.variables.ITable;
import com.dev.backend.services.impl.utils.NhatKyNghiepVu;
import com.dev.backend.dto.request.ChatLieuCreating;
import com.dev.backend.dto.request.ChatLieuUpdating;
import com.dev.backend.dto.response.entities.ChatLieuDto;
import com.dev.backend.entities.ChatLieu;
import com.dev.backend.mapper.ChatLieuMapper;
import com.dev.backend.repository.ChatLieuRepository;
import com.dev.backend.services.impl.BaseServiceImpl;
import com.dev.backend.i18n.ThongDiep;
import com.dev.backend.i18n.LoiChungException;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ChatLieuService extends BaseServiceImpl<ChatLieu, Integer> {

    private final ChatLieuRepository repository;
    private final ChatLieuMapper mapper;
    private final EntityManager entityManager;

    /** Nhật ký nghiệp vụ (danh mục chung); null khi unit test dựng tay. */
    @Autowired(required = false)
    private NhatKyNghiepVu nhatKy;
    @Autowired
    public ChatLieuService(ChatLieuRepository repository,
                           ChatLieuMapper mapper,
                           EntityManager entityManager) {
        super(repository);
        this.repository = repository;
        this.mapper = mapper;
        this.entityManager = entityManager;
    }

    @Override
    protected EntityManager getEntityManager() {
        return entityManager;
    }

    // Lấy danh sách chất liệu, có hỗ trợ tìm kiếm theo mã hoặc tên
    public List<ChatLieuDto> findAll(String searchKeyword) {
        if (searchKeyword == null || searchKeyword.trim().isEmpty()) {
            return repository.findAll().stream()
                    .map(mapper::toDto)
                    .collect(Collectors.toList());
        }

        List<ChatLieu> entities =
                repository.findByMaChatLieuContainingIgnoreCaseOrTenChatLieuContainingIgnoreCase(
                        searchKeyword, searchKeyword);

        return mapper.toDtoList(entities);
    }

    // Lấy chi tiết chất liệu theo ID
    public ChatLieuDto findByIdDto(Integer id) {
        ChatLieu entity = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("sanPhamMuaHang.chatLieuKhongTimThay", id)));
        return mapper.toDto(entity);
    }

    // Tạo mới chất liệu
    @Transactional
    public ChatLieuDto create(ChatLieuCreating creating) {

        // Map DTO -> Entity
        ChatLieu entity = mapper.toEntity(creating);

        // Lưu vào DB (nếu trùng unique thì DB tự ném lỗi)
        entity = repository.save(entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.chat_lieu, entity.getId(), IHanhDong.them_danh_muc_chung)
                .ma(entity.getTenChatLieu())
                .moi(anhChatLieu(entity)));
        // Trả về DTO
        return mapper.toDto(entity);
    }

    // Cập nhật chất liệu
    @Transactional
    public ChatLieuDto update(Integer id, ChatLieuUpdating updating) {

        // 1. Tìm entity theo ID
        ChatLieu entity = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("sanPhamMuaHang.chatLieuKhongTimThay", id)));

        Map<String, Object> truoc = anhChatLieu(entity);
        // 2. Nếu có sửa mã thì kiểm tra trùng
        if (updating.getMaChatLieu() != null
                && repository.existsByMaChatLieu(updating.getMaChatLieu())
                && !updating.getMaChatLieu().equals(entity.getMaChatLieu())) {

            // Trả về lỗi nghiệp vụ: trùng mã khi edit
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    ThongDiep.vi("sanPhamMuaHang.chatLieuDaTonTai")
            );
        }

        // 3. Cập nhật từng field (MapStruct partialUpdate)
        mapper.partialUpdate(updating, entity);

        // 4. Lưu lại DB
        entity = repository.save(entity);
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.chat_lieu, entity.getId(), IHanhDong.sua_danh_muc_chung)
                .ma(entity.getTenChatLieu())
                .thayDoi(truoc, anhChatLieu(entity)));
        // 5. Trả về DTO
        return mapper.toDto(entity);
    }

    // Xóa chất liệu
    @Transactional
    public void delete(Integer id) {
        ChatLieu entity = repository.findById(id)
                .orElseThrow(() -> new LoiChungException(ThongDiep.of("sanPhamMuaHang.chatLieuKhongTimThay", id)));
        ghiNhatKy(NhatKyNghiepVu.dong(ITable.chat_lieu, entity.getId(), IHanhDong.xoa_danh_muc_chung)
                .ma(entity.getTenChatLieu())
                .cu(anhChatLieu(entity)));
        repository.deleteById(id);
    }

    private void ghiNhatKy(NhatKyNghiepVu.Dong dong) {
        if (nhatKy != null) nhatKy.ghi(dong);
    }

    private static Map<String, Object> anhChatLieu(ChatLieu c) {
        return NhatKyNghiepVu.anh(
                "ma", c.getMaChatLieu(),
                "ten", c.getTenChatLieu(),
                "moTa", c.getMoTa());
    }
}
