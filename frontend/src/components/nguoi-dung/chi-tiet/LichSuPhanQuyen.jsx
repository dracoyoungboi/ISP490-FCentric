import { useRef, useState } from "react";
import { History } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import TablePagination from "@/components/shared/TablePagination";
import UserAvatar from "@/components/UserAvatar";
import { SO_DONG_MAC_DINH } from "@/constants/phanTrang";
import { cn } from "@/lib/utils";
import { dienGiaiLichSu, ngayGio } from "@/components/nguoi-dung/phanQuyen";

const KIEU_THE = {
  them: "border-green-200 bg-green-50 text-green-900",
  bo: "border-red-200 bg-red-50 text-red-900",
  "": "border-bo-border bg-bo-surface-subtle text-bo-foreground",
};

/** Vùng nội dung của tab; màn rộng thì tự cuộn (index.css › .nd-cuon), phân trang đứng yên ở đáy khối. */
const VUNG_CUON = "nd-cuon flex flex-1 flex-col px-4 pb-3 pt-2 sm:px-6";

/**
 * Tab Lịch sử phân quyền: ai, lúc nào, đổi gì (vai trò, kho, hạn hiệu lực, quyền thêm/bỏ).
 * Dòng vừa lưu trong phiên này tô xanh ở cột thời gian.
 * Phân trang ở máy khách (API trả cả danh sách) bằng TablePagination dùng chung, giống Chi tiết khách hàng.
 */
export default function LichSuPhanQuyen({ lichSu, dangTai, loi, onThuLai, idVuaLuu }) {
  const [trang, setTrang] = useState(0);
  const [soDong, setSoDong] = useState(SO_DONG_MAC_DINH);
  const vungCuonRef = useRef(null);

  if (loi && !lichSu?.length) {
    return (
      <div className={VUNG_CUON}>
        <ErrorState
          className="nd-trong min-h-48"
          title="Không tải được lịch sử phân quyền"
          description="Kiểm tra kết nối rồi thử lại."
          onRetry={onThuLai}
        />
      </div>
    );
  }
  if (dangTai && !lichSu) {
    return (
      <div className={VUNG_CUON}>
        <div className="space-y-3 py-3" aria-label="Đang tải lịch sử phân quyền" role="status">
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
          title="Chưa có thay đổi phân quyền"
          description="Mỗi lần lưu phân quyền sẽ được ghi lại ở đây: ai đổi, lúc nào, đổi gì."
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
        <ol className="m-0 list-none p-0">
          {dongTrang.map((ls) => {
            const { viec, the } = dienGiaiLichSu(ls);
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
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {the.map((t) => (
                        <span
                          key={t.chu}
                          className={cn("mt-1 inline-flex h-[22px] items-center rounded-full border px-2 text-xs", KIEU_THE[t.loai])}
                        >
                          {t.chu}
                        </span>
                      ))}
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
