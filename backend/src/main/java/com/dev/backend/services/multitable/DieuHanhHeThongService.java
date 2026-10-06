package com.dev.backend.services.multitable;

import com.dev.backend.dto.request.CauHinhHeThongBulkUpdateRequest;
import com.dev.backend.dto.request.CauHinhHeThongUpdateRequest;
import com.dev.backend.dto.request.PhanQuyenNguoiDungKhoCreating;
import com.dev.backend.dto.response.ResponseData;
import com.dev.backend.dto.response.entities.CauHinhHeThongDto;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface DieuHanhHeThongService {
    ResponseEntity<ResponseData<String>> ganQuyenNhanVienKho(PhanQuyenNguoiDungKhoCreating pqndkCreating);
    List<CauHinhHeThongDto> getAllCauHinh();

    CauHinhHeThongDto updateCauHinh(String maCauHinh, CauHinhHeThongUpdateRequest request, Integer userId);

    List<CauHinhHeThongDto> bulkUpdateCauHinh(List<CauHinhHeThongBulkUpdateRequest> requests, Integer userId);
    String getCauHinhString(String maCauHinh, String defaultValue);
    int getCauHinhInt(String maCauHinh, int defaultValue);
    boolean getCauHinhBoolean(String maCauHinh, boolean defaultValue);
}
