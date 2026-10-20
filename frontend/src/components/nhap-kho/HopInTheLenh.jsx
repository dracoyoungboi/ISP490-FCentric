import { useRef, useState } from "react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";
import { Loader2, Printer } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LY_DO_LOI } from "@/constants/nhapKho";
import { THE_LENH, maTheLyDo } from "@/pages/receipt/kiemDem";
import { TIEN_TO_THE_LENH } from "@/utils/maVach";
import { taoBoNhanQuetNhanh } from "@/utils/quetNhanh";

const THE_CHINH = [
  { ma: THE_LENH.KHONG_DAT, ten: "KHÔNG ĐẠT", moTa: "Đổi lượt vừa quét thành không đạt", do: true },
  { ma: THE_LENH.HOAN_TAC, ten: "HOÀN TÁC", moTa: "Hủy lượt vừa quét (quét nhiều lần thì lùi dần), hoặc bỏ qua mã chưa có" },
  { ma: THE_LENH.KHOA_LO, ten: "KHÓA LÔ", moTa: "Khóa lô đang kiểm khi đủ điều kiện, thiếu thì mở hộp Khóa lô" },
  { ma: THE_LENH.DAT, ten: "ĐẠT", moTa: "Đổi lại thành đạt, hoặc xác nhận khi phải chọn từng cái" },
];

// Thẻ lệnh khổ A4: 2 cột thẻ chính, 3 cột thẻ lý do; chỉ áp cho tài liệu in thẻ.
const KIEU_TRANG_IN = `
  @page { size: A4 portrait; margin: 12mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    .the-lenh-to { background: #fff !important; padding: 0 !important; }
    .the-lenh-luoi { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 5mm !important; }
    .the-lenh-luoi-3 { grid-template-columns: repeat(3, 1fr) !important; }
    .the-lenh { box-shadow: none !important; border: 0.3mm solid #666 !important; border-radius: 2mm !important; break-inside: avoid !important; page-break-inside: avoid !important; }
    .the-lenh * { color: #000 !important; }
    .the-lenh svg { display: block !important; max-width: 100% !important; height: auto !important; margin: 0 auto !important; }
  }
`;

/**
 * In thẻ lệnh kiểm đếm (mã Code 128) để ở bàn kiểm: nhân viên quét thẻ bằng chính máy quét như quét sản phẩm,
 * không phải buông máy để bấm chuột. Máy quét laser cần in ra giấy; máy quét ảnh (CCD, 2D) đọc được trên màn hình.
 *
 * Quét một thẻ ngay trên màn khi hộp đang mở: hộp đóng và mã được xử lý như quét ở ô quét (`onQuet`), không để
 * phím Enter của máy quét bấm nhầm nút "Đóng" làm mất mã.
 */
export default function HopInTheLenh({ open, onOpenChange, onQuet }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <NoiDung
          onDong={() => onOpenChange(false)}
          onQuet={(ma) => {
            onOpenChange(false);
            onQuet?.(ma);
          }}
        />
      ) : null}
    </Dialog>
  );
}

function TheMa({ ma, ten, moTa, lon, doDam }) {
  return (
    <article className={`the-lenh flex flex-col items-center gap-1.5 rounded-lg border bg-white px-4 py-3 text-center ${doDam ? "border-red-200" : "border-bo-border"}`}>
      <p className={`font-bold tracking-wide ${lon ? "text-lg" : "text-[15px]"} ${doDam ? "text-bo-danger" : "text-bo-heading"}`}>{ten}</p>
      {moTa ? <p className="text-xs leading-4 text-bo-muted">{moTa}</p> : null}
      <div role="img" aria-label={`Mã vạch ${ma}`} className="mt-1 max-w-full [&_svg]:h-auto [&_svg]:max-w-full">
        <Barcode value={ma} format="CODE128" renderer="svg" width={lon ? 2 : 1.6} height={lon ? 64 : 48} displayValue={false} margin={0} background="#ffffff" lineColor="#000000" />
      </div>
      <p className="font-mono text-xs text-slate-600">{ma}</p>
    </article>
  );
}

function NoiDung({ onDong, onQuet }) {
  const toRef = useRef(null);
  const hopRef = useRef(null);
  const boNhanRef = useRef(null);
  const nhanQuetNhanh = (e) => {
    if (!boNhanRef.current) boNhanRef.current = taoBoNhanQuetNhanh({ onMa: (ma) => onQuet(ma) });
    boNhanRef.current(e);
  };
  const [dangIn, setDangIn] = useState(false);
  const dangInRef = useRef(false);
  const xong = () => {
    dangInRef.current = false;
    setDangIn(false);
  };
  const inThe = useReactToPrint({
    contentRef: toRef,
    documentTitle: "FCentric - Thẻ lệnh kiểm đếm",
    pageStyle: KIEU_TRANG_IN,
    onAfterPrint: xong,
    onPrintError: () => {
      xong();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    },
  });
  const batDauIn = () => {
    if (dangInRef.current) return;
    dangInRef.current = true;
    setDangIn(true);
    try {
      inThe();
    } catch {
      xong();
      toast.error("Không mở được bản in. Vui lòng thử lại.");
    }
  };

  return (
    <DialogContent
      showCloseButton={!dangIn}
      ref={hopRef}
      // Con trỏ vào chính hộp, không vào nút: Enter của máy quét không bấm nhầm "Đóng", và phím của máy quét
      // tới được bộ nhận lần quét của hộp (con trỏ ở lại nút "In thẻ lệnh" ngoài hộp thì mã quét mất lặng lẽ)
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        hopRef.current?.focus();
      }}
      onKeyDownCapture={nhanQuetNhanh}
      className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-xl border-bo-border p-0 outline-none sm:max-w-[min(860px,calc(100%-2rem))]"
    >
      <DialogHeader className="shrink-0 border-b border-bo-border px-6 py-4 text-left">
        <DialogTitle className="text-base text-bo-foreground">Thẻ lệnh kiểm đếm</DialogTitle>
        <DialogDescription className="text-[13px] text-bo-muted">
          Đặt ở bàn kiểm, cạnh máy tính. Quét thẻ bằng chính máy quét như quét sản phẩm, không cần chạm bàn phím hay chuột.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto bg-bo-surface-subtle px-6 py-5">
        <div ref={toRef} className="the-lenh-to flex flex-col gap-4">
          <div className="the-lenh-luoi grid grid-cols-1 gap-3 sm:grid-cols-2">
            {THE_CHINH.map((t) => (
              <TheMa key={t.ma} ma={t.ma} ten={t.ten} moTa={t.moTa} lon doDam={t.do} />
            ))}
          </div>
          <p className="text-sm font-semibold text-bo-foreground">
            Lý do không đạt <span className="font-normal text-bo-muted">· quét sau thẻ KHÔNG ĐẠT</span>
          </p>
          <div className="the-lenh-luoi the-lenh-luoi-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {LY_DO_LOI.map((ten, i) => (
              <TheMa key={ten} ma={maTheLyDo(i + 1)} ten={`${i + 1} · ${ten}`} />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter className="shrink-0 border-t border-bo-border bg-white px-6 py-3">
        <p className="mr-auto self-center text-xs text-bo-muted">Mã thẻ lệnh bắt đầu bằng {TIEN_TO_THE_LENH}; mã vạch nhà cung cấp bắt đầu như vậy không liên kết được.</p>
        <Button variant="outline" disabled={dangIn} onClick={onDong} className="min-w-24 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle">
          Đóng
        </Button>
        <Button disabled={dangIn} onClick={batDauIn} className="min-w-28 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
          {dangIn ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} In thẻ lệnh
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
