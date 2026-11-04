import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Lock, Percent } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import { Input } from "@/components/ui/input";
import {
  SettingsCard,
  SettingsCardHeader,
  SettingsEditButton,
  SettingsFieldHint,
  SettingsFooterLink,
  SettingsFormActions,
  SettingsGroupLabel,
  SettingsPill,
} from "@/components/settings/SettingsUI";
import { settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import {
  HINH_THUC_CHUYEN_KHO,
  TAI_KHOAN,
  formCauHinh,
  hienNgay,
  kiemTraCauHinh,
  payloadCauHinh,
} from "@/components/ke-toan/tinhKeToan";
import { keToanService } from "@/services/keToanService";
import { getApiErrorMessage } from "@/utils/apiError";

const SELECT_CLASS = "h-9 w-full rounded-md border border-[#8a96a6] bg-white px-2 text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 focus-visible:outline-none";

/**
 * Cấu hình › Xuất kế toán: thiết lập xuất dữ liệu sang AMIS Kế toán doanh nghiệp (ngày mốc, tài khoản mặc định, dòng phí vận
 * chuyển, hình thức chuyển kho). Thuế suất GTGT dùng chung với hóa đơn bán hàng, sửa ở Cấu hình › Thuế GTGT. Chỉ quản trị viên.
 */
export default function AccountingSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [cauHinh, setCauHinh] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(false);
  const [lanTai, setLanTai] = useState(0);

  const [dangSua, setDangSua] = useState(false);
  const [form, setForm] = useState(() => formCauHinh(null));
  const [loi, setLoi] = useState({});
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    keToanService.layCauHinh({ signal: ctrl.signal })
      .then((ch) => {
        setCauHinh(ch);
        setLoiTai(false);
      })
      .catch(() => !ctrl.signal.aborted && setLoiTai(true))
      .finally(() => !ctrl.signal.aborted && setDangTai(false));
    return () => ctrl.abort();
  }, [lanTai]);

  const formGoc = useMemo(() => formCauHinh(cauHinh), [cauHinh]);
  const coThayDoi = dangSua && JSON.stringify(form) !== JSON.stringify(formGoc);
  useUnsavedChanges(coThayDoi);

  const batDauSua = () => {
    setForm(formGoc);
    setLoi({});
    setDangSua(true);
  };

  const doi = (ten, giaTri) => {
    setForm((f) => ({ ...f, [ten]: giaTri }));
    if (loi[ten]) setLoi((l) => ({ ...l, [ten]: undefined }));
  };

  const luu = async (event) => {
    event.preventDefault();
    if (dangLuu) return;
    const loiMoi = kiemTraCauHinh(form);
    setLoi(loiMoi);
    if (Object.keys(loiMoi).length) return;
    setDangLuu(true);
    try {
      setCauHinh(await keToanService.luuCauHinh(payloadCauHinh(form, cauHinh?.version)));
      setDangSua(false);
      toast.success("Đã lưu cấu hình kế toán.");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không lưu được cấu hình kế toán"));
    } finally {
      setDangLuu(false);
    }
  };

  if (dangTai) {
    return (
      <SettingsCard>
        <LoadingState className="min-h-48" label="Đang tải cấu hình kế toán" />
      </SettingsCard>
    );
  }
  if (loiTai) {
    return (
      <SettingsCard>
        <ErrorState
          className="min-h-48"
          title="Lỗi tải cấu hình"
          description="Không tải được cấu hình xuất kế toán. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị hệ thống."
          onRetry={() => {
            setDangTai(true);
            setLanTai((k) => k + 1);
          }}
        />
      </SettingsCard>
    );
  }

  const ngayMocKhoa = Boolean(cauHinh?.daCoLoXuat);

  return (
    <div className="flex flex-col gap-4">
      <SettingsCard
        as="form"
        editing={dangSua}
        aria-labelledby="ke-toan-thiet-lap"
        onSubmit={luu}
        noValidate
      >
        <SettingsCardHeader
          titleId="ke-toan-thiet-lap"
          title="Xuất sang AMIS Kế toán doanh nghiệp"
          note="Tệp xuất theo đúng mẫu nhập khẩu nâng cao của AMIS (chế độ TT 99/2025). Tài khoản phải là tài khoản chi tiết nhất trên AMIS."
          action={canEdit && !dangSua ? <SettingsEditButton onClick={batDauSua} /> : null}
        />
        <div className="px-5 pb-4">
          <SettingsGroupLabel>Ngày mốc</SettingsGroupLabel>
          {dangSua ? (
            <div className="flex max-w-sm flex-col gap-1">
              <label htmlFor="kt-ngay-moc" className="text-sm font-medium text-bo-foreground">Ngày bắt đầu chuyển sang kế toán</label>
              <Input
                id="kt-ngay-moc"
                type="date"
                value={form.ngayMoc}
                disabled={ngayMocKhoa}
                onChange={(e) => doi("ngayMoc", e.target.value)}
                className={settingsInputClass({ error: Boolean(loi.ngayMoc) })}
              />
              <SettingsFieldHint error={loi.ngayMoc}>
                {ngayMocKhoa
                  ? "Đã có chứng từ giao kế toán nên không đổi được ngày mốc."
                  : "Đặt trùng \"Ngày bắt đầu dữ liệu\" trên AMIS. Tồn đầu kỳ tính tại ngày này; chứng từ trước ngày này không xuất."}
              </SettingsFieldHint>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-bo-foreground">
              {cauHinh?.ngayMoc ? hienNgay(cauHinh.ngayMoc) : <SettingsPill tone="warn">Chưa đặt — chưa xuất được</SettingsPill>}
              {ngayMocKhoa ? <Lock className="size-3.5 text-bo-muted" aria-label="Đã khóa" /> : null}
            </p>
          )}

          <SettingsGroupLabel className="mt-2">Tài khoản mặc định</SettingsGroupLabel>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {TAI_KHOAN.map((tk) => (
              <div key={tk.key} className="flex min-w-0 flex-col gap-1">
                <label htmlFor={`kt-${tk.key}`} className="text-[13px] font-medium text-bo-foreground">{tk.nhan}</label>
                {dangSua ? (
                  <>
                    <Input
                      id={`kt-${tk.key}`}
                      value={form[tk.key]}
                      inputMode="numeric"
                      maxLength={20}
                      onChange={(e) => doi(tk.key, e.target.value.replace(/\D/g, ""))}
                      className={settingsInputClass({ error: Boolean(loi[tk.key]), className: "tabular-nums" })}
                    />
                    <SettingsFieldHint error={loi[tk.key]}>{tk.moTa}</SettingsFieldHint>
                  </>
                ) : (
                  <p className="text-sm tabular-nums text-bo-foreground">
                    {cauHinh?.[tk.key]} <span className="text-xs text-bo-muted">· {tk.moTa}</span>
                  </p>
                )}
              </div>
            ))}
          </div>

          <SettingsGroupLabel className="mt-2">Phí vận chuyển và chuyển kho</SettingsGroupLabel>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {dangSua ? (
              <>
                <div className="flex flex-col gap-1">
                  <label htmlFor="kt-ma-dv" className="text-[13px] font-medium text-bo-foreground">Mã dịch vụ phí vận chuyển</label>
                  <Input id="kt-ma-dv" value={form.maDichVuVanChuyen} maxLength={50} spellCheck={false}
                    onChange={(e) => doi("maDichVuVanChuyen", e.target.value)}
                    className={settingsInputClass({ error: Boolean(loi.maDichVuVanChuyen), className: "font-mono" })} />
                  <SettingsFieldHint error={loi.maDichVuVanChuyen}>Dòng phí ship thu khách trên chứng từ bán hàng; không được trùng SKU.</SettingsFieldHint>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="kt-ten-dv" className="text-[13px] font-medium text-bo-foreground">Tên dịch vụ</label>
                  <Input id="kt-ten-dv" value={form.tenDichVuVanChuyen} maxLength={100}
                    onChange={(e) => doi("tenDichVuVanChuyen", e.target.value)}
                    className={settingsInputClass({ error: Boolean(loi.tenDichVuVanChuyen) })} />
                  <SettingsFieldHint error={loi.tenDichVuVanChuyen} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="kt-hinh-thuc" className="text-[13px] font-medium text-bo-foreground">Hình thức bước xuất chuyển kho</label>
                  <select id="kt-hinh-thuc" value={form.hinhThucChuyenKho} onChange={(e) => doi("hinhThucChuyenKho", e.target.value)} className={SELECT_CLASS}>
                    {HINH_THUC_CHUYEN_KHO.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <SettingsFieldHint error={loi.hinhThucChuyenKho}>Bước nhận và hủy giữa đường luôn là "Xuất chuyển kho nội bộ".</SettingsFieldHint>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="kt-so-tk" className="text-[13px] font-medium text-bo-foreground">Số tài khoản nhận chuyển khoản tại quầy</label>
                  <Input id="kt-so-tk" value={form.soTkNganHangNhan} maxLength={30} inputMode="numeric"
                    onChange={(e) => doi("soTkNganHangNhan", e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                    className={settingsInputClass({ error: Boolean(loi.soTkNganHangNhan), className: "tabular-nums" })} />
                  <SettingsFieldHint error={loi.soTkNganHangNhan}>Cột "Nộp vào TK"; phải là tài khoản đã khai báo trên AMIS. Để trống nếu chưa có.</SettingsFieldHint>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-bo-foreground"><span className="font-mono">{cauHinh?.maDichVuVanChuyen}</span> · {cauHinh?.tenDichVuVanChuyen}</p>
                <p className="text-sm text-bo-foreground">{cauHinh?.hinhThucChuyenKho}</p>
                <p className="text-sm text-bo-foreground">
                  Nộp vào TK: {cauHinh?.soTkNganHangNhan ? <span className="tabular-nums">{cauHinh.soTkNganHangNhan}</span> : <span className="text-bo-muted">chưa đặt</span>}
                </p>
              </>
            )}
          </div>
        </div>
        {dangSua ? <SettingsFormActions onCancel={() => setDangSua(false)} saving={dangLuu} disabled={!coThayDoi} /> : (
          <SettingsFooterLink
            to="/reports/accounting-export"
            icon={FileSpreadsheet}
            title="Xuất dữ liệu kế toán"
            description="Kiểm tra, tạo lô và tải tệp nén cho kế toán."
          />
        )}
      </SettingsCard>

      {/* Ẩn khi đang sửa thẻ trên: liên kết trong trang không qua hộp hỏi rời trang, bấm sẽ mất phần đang nhập */}
      {dangSua ? null : (
        <SettingsCard as="div">
          <SettingsFooterLink
            to="/settings/vat"
            className="rounded-lg border-t-0"
            icon={Percent}
            title="Thuế suất GTGT"
            description="Bảng thuế suất dùng chung với hóa đơn bán hàng, ở Cấu hình › Thuế GTGT."
          />
        </SettingsCard>
      )}
    </div>
  );
}
