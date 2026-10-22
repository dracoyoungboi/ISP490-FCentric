import { useEffect, useState, useCallback } from "react";
import { X, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import PackingProofSection from "@/components/outbound/PackingProofSection";
import { dongGoiService } from "@/services/dongGoiService";
import { getApiErrorMessage } from "@/utils/apiError";

export default function PackingProofModal({
  isOpen,
  onClose,
  donId,
  soDonHang,
  tongTienDonHang,
  readOnly = false,
  lyDoKhoaXoa = "",
  onProofChanged,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProofs = useCallback(async () => {
    if (!donId || !isOpen) return;
    setLoading(true);
    try {
      const res = await dongGoiService.layBangChung(donId);
      setData(res);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Không tải được bằng chứng đóng gói"));
    } finally {
      setLoading(false);
    }
  }, [donId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchProofs();
    } else {
      setData(null);
    }
  }, [isOpen, fetchProofs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="relative w-full max-w-3xl rounded-xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-bo-border px-5 py-3.5 bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-bo-primary" />
            <h3 className="text-base font-semibold text-slate-800">
              Bằng chứng đóng gói · Đơn {soDonHang || data?.soDonHang || `#${donId}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="size-7 animate-spin text-bo-primary mb-2" />
              <p className="text-sm">Đang tải thông tin bằng chứng...</p>
            </div>
          ) : (
            <PackingProofSection
              donId={donId}
              soDonHang={soDonHang || data?.soDonHang}
              tongTienDonHang={tongTienDonHang != null ? tongTienDonHang : data?.tongTienDonHang}
              yeuCauVideo={data?.yeuCauVideo}
              huongDan={data?.huongDan}
              danhSachBangChung={data?.danhSachBangChung || []}
              daDuBangChung={data?.daDuBangChung}
              coTieuDe={false}
              className="-mx-5 -mt-5 border-t-0"
              onRefresh={() => {
                fetchProofs();
                if (onProofChanged) onProofChanged();
              }}
              readOnly={readOnly}
              lyDoKhoaXoa={lyDoKhoaXoa}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-bo-border px-5 py-3 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
