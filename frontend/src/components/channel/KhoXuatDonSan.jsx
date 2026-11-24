import { ArrowRight, Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DongCaiDat } from "@/components/channel/KhuonCaiDat";
import { t } from "@/i18n";

/**
 * Cấu hình định tuyến kho xuất đơn nội bộ FCentric cho các sàn đơn kho tồn (Lazada, TikTok Shop, Shopee).
 * Chỉ quyết định kho FCentric nhận đơn khi đồng bộ và chọn sẵn ở hộp "Gửi sang kho" (không bật chia tồn đa kho).
 */
export default function KhoXuatDonSan({ tenSan, mappingConfig, onChange, disabled = false }) {
  if (!mappingConfig) return null;

  const dsKhoSan = mappingConfig.danhSachKho || [];
  const dsKhoFCentric = mappingConfig.dsKhoFCentricKhaDung || [];
  if (dsKhoFCentric.length === 0) return null;

  const handleChonKhoDon = (khoId) => {
    const kId = Number(khoId);
    const khoTim = dsKhoFCentric.find((k) => k.id === kId);
    const dsMoi = dsKhoSan.length === 1
      ? [{
        ...dsKhoSan[0],
        khoIdFCentric: kId,
        tenKhoFCentric: khoTim?.tenKho || "",
        kichHoat: true,
        laMacDinh: true,
      }]
      : dsKhoSan;
    onChange?.({
      ...mappingConfig,
      cheDoDaKho: false,
      khoIdMacDinh: kId,
      tenKhoMacDinh: khoTim?.tenKho || mappingConfig.tenKhoMacDinh || "",
      danhSachKho: dsMoi,
    });
  };

  const handleDoiAnhXaDong = (index, khoId) => {
    const kId = Number(khoId);
    const khoTim = dsKhoFCentric.find((k) => k.id === kId);
    const dsMoi = dsKhoSan.map((item, idx) => {
      if (idx !== index) {
        return { ...item, kichHoat: true };
      }
      return {
        ...item,
        khoIdFCentric: kId,
        tenKhoFCentric: khoTim?.tenKho || "",
        kichHoat: true,
      };
    });
    const dongSua = dsMoi[index];
    const laDongMacDinh = Boolean(dongSua?.laMacDinhSan) || Boolean(dongSua?.laMacDinh);
    const dongMacDinh = dsMoi.find((item) => Boolean(item.laMacDinhSan)) ?? dsMoi.find((item) => Boolean(item.laMacDinh));
    const khoIdMacDinhMoi = laDongMacDinh
      ? kId
      : (dongMacDinh?.khoIdFCentric ?? mappingConfig.khoIdMacDinh ?? kId);
    onChange?.({
      ...mappingConfig,
      cheDoDaKho: false,
      khoIdMacDinh: khoIdMacDinhMoi,
      tenKhoMacDinh: laDongMacDinh ? (khoTim?.tenKho || "") : (mappingConfig.tenKhoMacDinh || ""),
      danhSachKho: dsMoi,
    });
  };

  if (dsKhoSan.length <= 1) {
    const selectedKhoId = dsKhoSan[0]?.khoIdFCentric ?? mappingConfig.khoIdMacDinh ?? dsKhoFCentric[0]?.id;
    return (
      <DongCaiDat
        title={t("Kho xuất đơn tại FCentric")}
        description={t("Đơn từ {{tenSan}} tự động chọn sẵn kho này khi bấm Gửi sang kho.", { tenSan })}
        control={
          <Select
            value={selectedKhoId ? String(selectedKhoId) : ""}
            onValueChange={handleChonKhoDon}
            disabled={disabled}
          >
            <SelectTrigger
              aria-label={t("Kho xuất đơn tại FCentric")}
              className="h-9 w-[220px] max-w-full rounded-lg border-bo-border bg-bo-surface text-sm text-bo-foreground max-sm:data-[size=default]:h-11"
            >
              <SelectValue placeholder={t("Chọn kho FCentric...")} />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="z-50 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg">
              {dsKhoFCentric.map((k) => (
                <SelectItem key={k.id} value={String(k.id)} className="rounded-md focus:bg-bo-primary-soft">
                  {k.tenKho} {k.maKho ? `(${k.maKho})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    );
  }

  return (
    <div className="px-6 py-4">
      <div>
        <p className="text-sm font-medium text-bo-heading">{t("Ánh xạ kho lấy hàng sang kho xuất FCentric")}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-bo-muted">
          {t("Tồn kho đồng bộ trực tiếp vào kho mặc định trên {{tenSan}}. Bảng bên dưới dùng để định tuyến kho xuất FCentric tương ứng khi nhận đơn từ từng kho trên sàn.", { tenSan })}
        </p>
      </div>
      <div className="mt-3 overflow-x-auto rounded-lg border border-bo-border bg-bo-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-bo-border bg-bo-surface-subtle text-xs font-semibold uppercase text-bo-muted">
            <tr>
              <th scope="col" className="px-3.5 py-2.5">{t("Kho trên {{tenSan}}", { tenSan })}</th>
              <th scope="col" className="w-7 px-1 py-2.5 text-center"></th>
              <th scope="col" className="px-3.5 py-2.5">{t("Kho xuất FCentric")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bo-border">
            {dsKhoSan.map((kho, idx) => {
              const tenHienThi = kho.tenKhoSan || kho.maKhoSan;
              return (
                <tr key={kho.maKhoSan || idx} className="hover:bg-bo-surface-subtle/50 transition-colors">
                  <td className="px-3.5 py-2.5 font-medium text-bo-heading">
                    <div className="flex flex-col">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Building2 className="size-4 shrink-0 text-bo-muted" aria-hidden="true" />
                        <span>{tenHienThi}</span>
                        {kho.laMacDinhSan ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            {t("Mặc định trên sàn")}
                          </span>
                        ) : null}
                      </span>
                      {kho.maKhoSan ? <span className="mt-0.5 font-mono text-xs text-bo-muted">{kho.maKhoSan}</span> : null}
                    </div>
                  </td>
                  <td className="px-1 py-2.5 text-center text-bo-muted">
                    <ArrowRight className="inline-block size-4" aria-hidden="true" />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <Select
                      value={kho.khoIdFCentric ? String(kho.khoIdFCentric) : ""}
                      onValueChange={(val) => handleDoiAnhXaDong(idx, val)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        aria-label={t("Chọn kho xuất FCentric cho {{ten}}", { ten: tenHienThi })}
                        className="h-9 w-full min-w-[180px] max-w-[240px] rounded-lg border-bo-border bg-bo-surface text-sm"
                      >
                        <SelectValue placeholder={t("Chọn kho FCentric...")} />
                      </SelectTrigger>
                      <SelectContent className="z-50 rounded-lg border border-bo-border bg-bo-surface p-1 shadow-lg">
                        {dsKhoFCentric.map((k) => (
                          <SelectItem key={k.id} value={String(k.id)} className="rounded-md">
                            {k.tenKho} {k.maKho ? `(${k.maKho})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
