package com.dev.backend.services;

import com.dev.backend.dto.request.inbound.KhuVucKhoRequest;
import com.dev.backend.dto.request.inbound.ViTriKhoRequest;
import com.dev.backend.dto.response.inbound.KhuVucKhoDto;
import com.dev.backend.dto.response.inbound.LoTrenKeDto;
import com.dev.backend.dto.response.inbound.ViTriKhoDto;

import java.util.List;
import java.util.Map;

public interface ViTriKhoService {
    // Khu vực
    List<KhuVucKhoDto> dsKhuVuc(Integer khoId);
    KhuVucKhoDto taoKhuVuc(Integer khoId, KhuVucKhoRequest request);
    KhuVucKhoDto suaKhuVuc(Integer khoId, Integer khuVucId, KhuVucKhoRequest request);
    void xoaKhuVuc(Integer khoId, Integer khuVucId);

    // Vị trí kệ
    List<ViTriKhoDto> dsViTri(Integer khoId);
    List<ViTriKhoDto> dsViTriKhaDung(Integer khoId);
    List<ViTriKhoDto> taoViTri(Integer khoId, ViTriKhoRequest request);
    ViTriKhoDto suaViTri(Integer khoId, Integer viTriId, ViTriKhoRequest request);
    void xoaViTri(Integer khoId, Integer viTriId);
    List<LoTrenKeDto> loTrenKe(Integer khoId, Integer viTriId);

    // Mặt bằng
    Map<String, Object> layMatBang(Integer khoId);
    Map<String, Object> luuMatBang(Integer khoId, Map<String, Object> matBang);
}

