import { useRef, useState } from "react";
import { History } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import TablePagination from "@/components/shared/TablePagination";
import UserAvatar from "@/components/UserAvatar";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { cn } from "@/lib/utils";
import { dienGiaiLichSu, ngayGio } from "@/components/nguoi-dung/phanQuyen";
import { dongThayDoi, nhanHanhDong } from "@/constants/nhatKy";

/** Vùng nội dung của tab; màn rộng thì tự cuộn (index.css › .nd-cuon), phân trang đứng yên ở đáy khối. */
const VUNG_CUON = "nd-cuon flex flex-1 flex-col px-4 pb-3 pt-2 sm:px-6";

/**
 * Dòng tài khoản (tạo / sửa / khóa / mở khóa, mật khẩu): câu việc theo nhãn hành động; dòng phụ là các trường đổi
 * ("Email: a → b"), không có trường đổi thì là ghi chú của bản ghi.
 */
function dienGiaiTaiKhoan(ls) {
  const d = ls.dong ?? {};
  const nhan = nhanHanhDong(d.hanhDong);
  const viec = nhan ? nhan.charAt(0).toLocaleLowerCase("vi-VN") + nhan.slice(1) : "cập nhật tài khoản";
  // Chỉ có giá trị mới (tạo tài khoản, thêm email lần đầu) thì không hiện "— →"
  const doi = dongThayDoi(d).map((x) => {
    const giaTri = x.coCu && x.coMoi ? `${x.cu || "—"} → ${x.moi || "—"}` : x.coMoi ? x.moi || "—" : `${x.cu || "—"} → —`;
    return { chu: x.nhan ? `${x.nhan}: ${giaTri}` : giaTri };
  });
  const the = doi.length ? doi : d.ghiChu ? [{ chu: d.ghiChu }] : [];
  return { viec, the };
}

/**
 * Tab Lịch sử thay đổi của người dùng. Dòng phân quyền: ai, lúc nào, đổi gì (vai trò, kho, hạn hiệu lực, quyền thêm/bỏ);
 * dòng tài khoản: tạo, sửa thông tin, khóa / mở khóa, đổi / đặt lại mật khẩu (gộp ở gopLichSuNguoiDung).
 * Quyền thêm/bỏ là một dòng chữ xám ("+ Duyệt đơn mua hàng · − Xuất báo cáo · và N thay đổi khác"), không thẻ màu
 * (chốt 19/10/2026: trang chỉ dùng màu cảnh báo ở khung Cần xem lại). Dòng vừa lưu có chữ "Vừa lưu" dưới giờ.
 * Phân trang ở máy khách (API trả cả danh sách) bằng TablePagination dùng chung, giống Chi tiết khách hàng.
 */
export default function LichSuPhanQuyen({ lichSu, loiMotPhan, dangTai, loi, onThuLai, idVuaLuu }) {
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const vungCuonRef = useRef(null);

  if (loi && !lichSu?.length) {
    return (
      <div className={VUNG_CUON}>
        <ErrorState
          className="nd-trong min-h-48"
          title="Không tải được lịch sử thay đổi"
          description="Kiểm tra kết nối rồi thử lại."
          onRetry={onThuLai}
        />
      </div>
    );
  }
  if (dangTai && !lichSu) {
    return (
      <div className={VUNG_CUON}>
        <div className="space-y-3 py-3" aria-label="Đang tải lịch sử thay đổi" role="status">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3.5">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
              <div className="size-7 animate-pulse rounded-full bg-slate-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!lichSu?.length) {
    return (
      <div className={VUNG_CUON}>
        <EmptyState
          className="nd-trong min-h-48"
          icon={History}
          title="Chưa có thay đổi"
          description="Mỗi lần lưu phân quyền, sửa thông tin, khóa / mở khóa hay đặt lại mật khẩu sẽ được ghi lại ở đây."
        />
      </div>
    );
  }

  const tong = lichSu.length;
  // Danh sách ngắn lại sau khi tải lại thì không đứng ở trang đã hết dòng
  const trangXem = Math.min(trang, Math.max(1, Math.ceil(tong / soDong)) - 1);
  const dongTrang = lichSu.slice(trangXem * soDong, (trangXem + 1) * soDong);
  const doiTrang = (moi) => {
    setTrang(moi);
    vungCuonRef.current?.scrollTo?.({ top: 0 });
  };

  return (
    <>
      <div ref={vungCuonRef} className={VUNG_CUON}>
        {loiMotPhan ? (
          <p role="status" className="m-0 mt-2 rounded-md bg-bo-surface-subtle px-3 py-2 text-[13px] leading-5 text-bo-muted">
            {loiMotPhan}
          </p>
        ) : null}
        <ol className="m-0 list-none p-0">
          {dongTrang.map((ls) => {
            const { viec, the } = ls.loai === "taiKhoan" ? dienGiaiTaiKhoan(ls) : dienGiaiLichSu(ls);
            const vuaLuu = idVuaLuu != null && ls.id === idVuaLuu;
            return (
              <li key={ls.id} className="flex gap-3.5 border-b border-slate-100 py-3 last:border-b-0">
                <div className={cn("w-[118px] shrink-0 text-xs leading-[18px] tabular-nums text-bo-muted max-sm:w-20", vuaLuu && "font-semibold text-bo-primary")}>
                  {ngayGio(ls.luc) || "—"}
                  {/* Giữ giờ thật; nhãn "Vừa lưu" chỉ đánh dấu dòng của lần lưu vừa rồi */}
                  {vuaLuu ? <span className="block">Vừa lưu</span> : null}
                </div>
                <UserAvatar userId={ls.nguoiThucHienId} name={ls.nguoiThucHien} size="xs" className="size-7 shrink-0" />
                <div className="min-w-0 flex-1 text-[13px] leading-5">
                  <div>
                    <b className="font-semibold">{ls.nguoiThucHien || "Hệ thống"}</b> {viec}
                  </div>
                  {the.length ? (
                    <div className="mt-0.5 text-[12.5px] leading-[18px] text-bo-muted">
                      {the.map((t) => t.chu).join(" · ")}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="border-t border-bo-border px-4 py-3 sm:px-6">
        <TablePagination
          page={trangXem}
          size={soDong}
          total={tong}
          totalLabel="thay đổi"
          onPageChange={doiTrang}
          onSizeChange={(n) => {
            setSoDong(n);
            doiTrang(0);
          }}
        />
      </div>
    </>
  );
}
