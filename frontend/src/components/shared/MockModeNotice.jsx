import { FlaskConical } from "lucide-react";

/**
 * Nhắc rõ trang (hoặc một phần trang) đang chạy dữ liệu mẫu, thao tác không ghi vào hệ thống.
 * `reason` nói vì sao (ví dụ backend chưa có API); bỏ trống khi bật bằng VITE_*_MOCK=true.
 * `note`: thay câu nhắc mặc định khi trang chỉ dùng dữ liệu mẫu cho một phần (phần còn lại vẫn ghi thật).
 */
export default function MockModeNotice({ show, reason, note }) {
  if (!show) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-bo-primary-soft px-3 py-2.5 text-sm text-blue-800">
      <FlaskConical className="mt-0.5 size-4 shrink-0" />
      <p>
        Đang dùng <strong className="font-semibold">dữ liệu mẫu</strong>
        {reason ? ` vì ${reason}` : ""}.{" "}
        {note ?? "Thao tác chỉ thay đổi dữ liệu trong trình duyệt, tải lại trang sẽ về trạng thái ban đầu."}
      </p>
    </div>
  );
}
