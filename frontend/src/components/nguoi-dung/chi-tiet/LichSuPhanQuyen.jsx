import { History } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import ErrorState from "@/components/shared/ErrorState";
import UserAvatar from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { dienGiaiLichSu, ngayGio } from "@/components/nguoi-dung/phanQuyen";

const KIEU_THE = {
  them: "border-green-200 bg-green-50 text-green-900",
  bo: "border-red-200 bg-red-50 text-red-900",
  "": "border-bo-border bg-bo-surface-subtle text-bo-foreground",
};

/**
 * Tab Lịch sử phân quyền: ai, lúc nào, đổi gì (vai trò, kho, hạn hiệu lực, quyền thêm/bỏ).
 * Dòng vừa lưu trong phiên này tô xanh ở cột thời gian.
 */
export default function LichSuPhanQuyen({ lichSu, dangTai, loi, onThuLai, idVuaLuu }) {
  if (loi && !lichSu?.length) {
    return (
      <ErrorState
        className="min-h-48"
        title="Không tải được lịch sử phân quyền"
        description="Kiểm tra kết nối rồi thử lại."
        onRetry={onThuLai}
      />
    );
  }
  if (dangTai && !lichSu) {
    return (
      <div className="space-y-3 py-3" aria-label="Đang tải lịch sử phân quyền" role="status">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3.5">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="size-7 animate-pulse rounded-full bg-slate-100" />
            <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }
  if (!lichSu?.length) {
    return (
      <EmptyState
        className="min-h-48"
        icon={History}
        title="Chưa có thay đổi phân quyền"
        description="Mỗi lần lưu phân quyền sẽ được ghi lại ở đây: ai đổi, lúc nào, đổi gì."
      />
    );
  }

  return (
    <ol className="m-0 list-none p-0">
      {lichSu.map((ls) => {
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
  );
}
