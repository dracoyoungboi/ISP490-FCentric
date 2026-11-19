import { useState, useEffect } from "react";
import { Building2, ArrowRight, ShieldCheck, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TheCaiDat, DongCaiDat, DongCongTac } from "@/components/channel/KhuonCaiDat";
import { t } from "@/i18n";

/**
 * Bảng ánh xạ đa kho (Multi-Location) giữa địa điểm Shopify và kho FCentric nội bộ.
 * Tự động ẩn hoặc hiển thị chỉ đọc khi sàn <= 1 kho; kích hoạt cấu hình phân bổ khi >= 2 kho.
 */
export default function BangMappingKhoSan({
  maKenh = "SHOPIFY",
  tenSan = "Shopify",
  mappingConfig,
  onChange,
  disabled = false,
}) {
  const [data, setData] = useState(() => mappingConfig);

  useEffect(() => {
    setData(mappingConfig);
  }, [mappingConfig]);

  if (!data) return null;

  const soKhoSan = data.soKhoSanHopLe ?? data.danhSachKho?.length ?? 0;
  const dsKhoSan = data.danhSachKho || [];
  const dsKhoFCentric = data.dsKhoFCentricKhaDung || [];
  const cheDoDaKho = Boolean(data.cheDoDaKho);

  const handleToggleDaKho = (checked) => {
    const updated = { ...data, cheDoDaKho: checked };
    setData(updated);
    if (onChange) onChange(updated);
  };

  const handleDoiKhoFCentric = (index, khoId) => {
    const dsMoi = [...dsKhoSan];
    const kId = Number(khoId);
    const khoTim = dsKhoFCentric.find((k) => k.id === kId);
    dsMoi[index] = {
      ...dsMoi[index],
      khoIdFCentric: kId,
      tenKhoFCentric: khoTim?.tenKho || "",
    };
    const updated = { ...data, danhSachKho: dsMoi };
    setData(updated);
    if (onChange) onChange(updated);
  };

  const handleToggleKichHoatKho = (index, kichHoat) => {
    const dsMoi = [...dsKhoSan];
    dsMoi[index] = { ...dsMoi[index], kichHoat };
    const updated = { ...data, danhSachKho: dsMoi };
    setData(updated);
    if (onChange) onChange(updated);
  };

  const handleChonMacDinh = (index) => {
    const dsMoi = dsKhoSan.map((item, i) => ({
      ...item,
      laMacDinh: i === index,
    }));
    const updated = { ...data, danhSachKho: dsMoi };
    setData(updated);
    if (onChange) onChange(updated);
  };

  return (
    <TheCaiDat
      title={t("Ánh xạ kho phân tán (Multi-Location)")}
      description={t(
        "Liên kết từng địa điểm kho của {{tenSan}} với các kho vật lý nội bộ FCentric để phân bổ tồn và định tuyến đơn hàng.",
        { tenSan }
      )}
    >
      {/* Công tắc bật chế độ đa kho */}
      <DongCongTac
        title={t("Kích hoạt chế độ đồng bộ đa kho")}
        description={
          soKhoSan <= 1
            ? t("{{tenSan}} hiện chỉ có 1 kho hoạt động. Chế độ đồng bộ đa kho sẽ tự động kích hoạt khi có từ 2 kho trở lên.", { tenSan })
            : t("Đẩy số tồn riêng biệt cho từng địa điểm và tự động xuất kho theo đúng địa điểm phát sinh đơn hàng.")
        }
        checked={cheDoDaKho}
        onCheckedChange={handleToggleDaKho}
        disabled={disabled || soKhoSan <= 1}
      />

      {/* Bảng mapping khi chế độ đa kho được bật */}
      {cheDoDaKho && dsKhoSan.length > 0 && (
        <div className="px-6 py-4">
          <div className="overflow-x-auto rounded-lg border border-bo-border bg-bo-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-bo-border bg-bo-surface-subtle text-xs font-semibold uppercase text-bo-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">{t("Kho trên {{tenSan}}", { tenSan })}</th>
                  <th scope="col" className="w-8 px-2 py-3 text-center"></th>
                  <th scope="col" className="px-4 py-3">{t("Kho FCentric liên kết")}</th>
                  <th scope="col" className="px-4 py-3 text-center">{t("Đẩy tồn")}</th>
                  <th scope="col" className="px-4 py-3 text-center">{t("Mặc định đơn")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bo-border">
                {dsKhoSan.map((kho, idx) => (
                  <tr key={kho.maKhoSan || idx} className="hover:bg-bo-surface-subtle/50 transition-colors">
                    {/* Cột Kho sàn */}
                    <td className="px-4 py-3 font-medium text-bo-heading">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="size-4 text-bo-muted shrink-0" />
                          <span>{kho.tenKhoSan || t("Địa điểm {{id}}", { id: kho.maKhoSan })}</span>
                          {kho.laMacDinh && (
                            <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                              {t("Mặc định sàn")}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 text-xs text-bo-muted font-mono">{kho.maKhoSan}</span>
                      </div>
                    </td>

                    {/* Mũi tên */}
                    <td className="px-2 py-3 text-center text-bo-muted">
                      <ArrowRight className="size-4 inline-block" />
                    </td>

                    {/* Dropdown Kho FCentric */}
                    <td className="px-4 py-3">
                      <Select
                        value={kho.khoIdFCentric ? String(kho.khoIdFCentric) : ""}
                        onValueChange={(val) => handleDoiKhoFCentric(idx, val)}
                        disabled={disabled || !kho.kichHoat}
                      >
                        <SelectTrigger className="h-9 w-full min-w-[200px] max-w-[260px] rounded-lg border-bo-border bg-bo-surface text-sm">
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

                    {/* Công tắc đẩy tồn từng kho */}
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={Boolean(kho.kichHoat)}
                          onCheckedChange={(checked) => handleToggleKichHoatKho(idx, checked)}
                          disabled={disabled}
                          aria-label={t("Đẩy tồn kho {{ten}}", { ten: kho.tenKhoSan })}
                        />
                      </div>
                    </td>

                    {/* Radio chọn kho nhận đơn mặc định */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="radio"
                        name="khoMacDinhDonHang"
                        checked={Boolean(kho.laMacDinh)}
                        onChange={() => handleChonMacDinh(idx)}
                        disabled={disabled}
                        className="size-4 text-bo-primary focus:ring-bo-primary/30"
                        aria-label={t("Kho mặc định nhận đơn cho {{ten}}", { ten: kho.tenKhoSan })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ghi chú thông minh giải thích cơ chế phân bổ và safeguard */}
          <div className="mt-4 rounded-lg bg-bo-surface-subtle p-3.5 border border-bo-border/60">
            <div className="flex items-start gap-2.5 text-xs text-bo-muted leading-relaxed">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-bo-heading">
                  {t("Giữ tồn đệm ở kho nhiều hàng nhất (Waterfall):")}
                </p>
                <p className="mt-0.5">
                  {t("Hệ thống ưu tiên trừ phần giữ lại ở kho có tồn lớn nhất trước và giữ nguyên số tồn ở các kho ít hàng để tránh khóa tồn ở chi nhánh nhỏ. Nếu mọi kho đều nhỏ hơn mức giữ lại, phần giữ lại sẽ được rút dần từ kho lớn xuống kho nhỏ để vẫn bảo toàn tổng đệm.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </TheCaiDat>
  );
}

