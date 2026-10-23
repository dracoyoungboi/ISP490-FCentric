package com.dev.backend;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * apiClient ở giao diện coi MỌI câu báo lỗi có cụm "bị khóa" là tài khoản đang đăng nhập bị khóa: xóa phiên, đưa về
 * trang đăng nhập. Chỉ AccountDisabledException được dùng cụm này; câu khác (kệ tạm khóa, quyền kho hết hạn, nhân viên
 * khác ngưng hoạt động…) mà viết "bị khóa" là đăng xuất nhầm người đang thao tác.
 */
class CauBaoLoiBiKhoaTest {

    private static final Path MA_NGUON = Path.of("src", "main", "java");
    private static final Pattern CHUOI_BI_KHOA = Pattern.compile("\"[^\"\\r\\n]*bị khóa[^\"\\r\\n]*\"");

    @Test
    void chiAccountDisabledExceptionDuocDungCumBiKhoa() throws IOException {
        // Chạy với thư mục làm việc là backend/ (Maven, IntelliJ); chạy nơi khác thì bỏ qua
        assumeTrue(Files.isDirectory(MA_NGUON), "không thấy " + MA_NGUON.toAbsolutePath());
        List<String> viPham = new ArrayList<>();
        try (Stream<Path> tep = Files.walk(MA_NGUON)) {
            for (Path p : tep.filter(x -> x.toString().endsWith(".java")).toList()) {
                if (p.getFileName().toString().equals("AccountDisabledException.java")) continue;
                List<String> dong = Files.readAllLines(p, StandardCharsets.UTF_8);
                for (int i = 0; i < dong.size(); i++) {
                    String d = dong.get(i).trim();
                    if (d.startsWith("//") || d.startsWith("*") || d.startsWith("/*")) continue;
                    if (CHUOI_BI_KHOA.matcher(d).find()) viPham.add(p + ":" + (i + 1) + "  " + d);
                }
            }
        }
        assertTrue(viPham.isEmpty(), "Câu báo lỗi chứa \"bị khóa\" (giao diện sẽ đăng xuất nhầm):\n" + String.join("\n", viPham));
    }
}
