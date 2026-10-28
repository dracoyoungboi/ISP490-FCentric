import { useState } from "react";
import { AlertCircle, CirclePause, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { demSeNgungTheo, kiemTraPhanHoi, taoBodyCapNhat } from "./cayDanhMuc";

/**
 * Xác nhận Ngừng hoạt động một danh mục: nói rõ hệ quả trước khi đổi (cùng khung với hộp
 * Ngừng hoạt động nhà cung cấp). Chỉ đổi trạng thái của chính danh mục; các con ngừng theo
 * nhưng giữ trạng thái riêng, nên cho hoạt động lại thì trở về như cũ.
 * `nut` là bản mới nhất trong cây của trang; body gửi đi dựng từ bản này lúc bấm xác nhận.
 * `onDaNgung({ nut, soTheo, body })` gọi sau khi máy chủ lưu xong.
 */
export default function HopNgungHoatDong({ open, onOpenChange, cay, trangThai, nut, onDaNgung }) {
  const [phien, setPhien] = useState(0);
  const [moTruoc, setMoTruoc] = useState(open);
  if (open !== moTruoc) {
    setMoTruoc(open);
    if (open) setPhien((so) => so + 1);
  }

  return (
    <AlertDialog open={open && Boolean(nut)} onOpenChange={onOpenChange}>
      {open && nut ? (
        <NoiDung key={phien} cay={cay} trangThai={trangThai} nut={nut} onDong={() => onOpenChange(false)} onDaNgung={onDaNgung} />
      ) : null}
    </AlertDialog>
  );
}

function NoiDung({ cay, trangThai, nut: nutMoiNhat, onDong, onDaNgung }) {
  // Giữ chữ lúc mở để hộp không đổi nội dung khi trang tải lại cây; body vẫn dựng từ bản mới nhất
  const [nut] = useState(nutMoiNhat);
  const [soTheo] = useState(() => demSeNgungTheo(cay, nutMoiNhat.id, trangThai));
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");

  const xacNhan = async () => {
    setDangLuu(true);
    setLoi("");
    try {
      const body = taoBodyCapNhat(nutMoiNhat, { trangThai: 0 });
      kiemTraPhanHoi(await danhMucQuanAoService.update(body));
      onDaNgung?.({ nut: nutMoiNhat, soTheo, body });
      onDong();
    } catch (err) {
      setLoi(getApiErrorMessage(err, "Không đổi được trạng thái danh mục. Vui lòng thử lại."));
      setDangLuu(false);
    }
  };

  const so = (chu) => <span className="font-semibold text-bo-foreground">{chu}</span>;

  return (
    <AlertDialogContent
      className="border-bo-border bg-bo-surface sm:max-w-md"
      onEscapeKeyDown={(event) => { if (dangLuu) event.preventDefault(); }}
    >
      <AlertDialogHeader className="text-left">
        <AlertDialogTitle className="flex items-center gap-2 text-base text-bo-foreground">
          <CirclePause className="size-5 shrink-0 text-bo-warning" aria-hidden="true" />
          Ngừng hoạt động danh mục?
        </AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-2 text-sm leading-6 text-bo-muted">
            <p>
              {so(nut.ten)}
              {nut.ma ? <span className="font-mono text-bo-muted"> ({nut.ma})</span> : null} sẽ không được chọn khi thêm sản phẩm mới
              hoặc khi chuyển danh mục, và không thêm được danh mục con.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {soTheo > 0 ? (
                <li>
                  {so(`${soTheo} danh mục con`)} sẽ ngừng theo. Khi cho hoạt động lại, các danh mục con trở về như cũ.
                </li>
              ) : null}
              <li>Sản phẩm đang gắn vẫn giữ danh mục này và vẫn bán bình thường.</li>
              <li>Có thể cho hoạt động lại bất cứ lúc nào.</li>
            </ul>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      {loi ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-bo-danger/20 bg-bo-danger-soft px-3 py-2.5 text-sm text-bo-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{loi}</span>
        </div>
      ) : null}

      <AlertDialogFooter className="gap-2">
        <AlertDialogCancel
          disabled={dangLuu}
          className="border-bo-border bg-bo-surface text-bo-foreground shadow-none hover:bg-bo-surface-subtle"
        >
          Hủy
        </AlertDialogCancel>
        <Button
          type="button"
          onClick={xacNhan}
          disabled={dangLuu}
          className="min-w-[150px] bg-bo-warning text-white hover:bg-bo-warning/90"
        >
          {dangLuu ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Đang lưu...
            </>
          ) : "Ngừng hoạt động"}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
