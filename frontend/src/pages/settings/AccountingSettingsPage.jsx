import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "@/lib/thongBaoNhanh";
import LoadingState from "@/components/shared/LoadingState";
import ErrorState from "@/components/shared/ErrorState";
import ConfirmModal from "@/components/ui/confirm-modal";
import { Button } from "@/components/ui/button";
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
  SettingsTextButton,
} from "@/components/settings/SettingsUI";
import { OUTLINE_BUTTON, PRIMARY_BUTTON, settingsInputClass } from "@/components/settings/settingsStyles";
import { useSettingsPage, useUnsavedChanges } from "@/components/settings/useSettingsPage";
import {
  HINH_THUC_CHUYEN_KHO,
  TAI_KHOAN,
  THUE_SUAT,
  dangApDung,
  formCauHinh,
  hienNgay,
  kiemTraCauHinh,
  kiemTraThueSuat,
  ngayIso,
  payloadCauHinh,
  payloadThueSuat,
  phangDanhMuc,
} from "@/components/ke-toan/tinhKeToan";
import { keToanService } from "@/services/keToanService";
import { danhMucQuanAoService } from "@/services/danhMucQuanAoService";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const SELECT_CLASS = "h-9 w-full rounded-md border border-[#8a96a6] bg-white px-2 text-sm text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-[3px] focus-visible:ring-bo-primary/15 focus-visible:outline-none";

const FORM_THUE_TRONG = { tyLe: "8", hieuLucTu: "", hieuLucDen: "", danhMucId: "", ghiChu: "" };

/**
 * Cấu hình › Xuất kế toán: thiết lập xuất dữ liệu sang AMIS Kế toán doanh nghiệp (ngày mốc, tài khoản mặc định, dòng phí vận
 * chuyển, hình thức chuyển kho) và bảng thuế suất GTGT có ngày hiệu lực. Chỉ quản trị viên.
 */
export default function AccountingSettingsPage() {
  const { canEdit } = useSettingsPage();
  const [cauHinh, setCauHinh] = useState(null);
  const [thueSuat, setThueSuat] = useState([]);
  const [dsDanhMuc, setDsDanhMuc] = useState([]);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(false);
  const [lanTai, setLanTai] = useState(0);

  const [dangSua, setDangSua] = useState(false);
  const [form, setForm] = useState(() => formCauHinh(null));
  const [loi, setLoi] = useState({});
  const [dangLuu, setDangLuu] = useState(false);

  // Thuế suất: null = không sửa; "moi" = đang thêm; số = id dòng đang sửa
  const [suaThue, setSuaThue] = useState(null);
  const [formThue, setFormThue] = useState(FORM_THUE_TRONG);
  // Giá trị lúc mở form (thêm mới đã điền sẵn ngày hôm nay): chỉ coi là "đang nhập dở" khi khác giá trị này
  const [formThueGoc, setFormThueGoc] = useState(FORM_THUE_TRONG);
  const [loiThue, setLoiThue] = useState("");
  const [dangLuuThue, setDangLuuThue] = useState(false);
  const [xoaThue, setXoaThue] = useState(null);
  const [dangXoaThue, setDangXoaThue] = useState(false);

  const homNay = ngayIso(new Date());

  useEffect(() => {
    const ctrl = new AbortController();
    Promise.all([
      keToanService.layCauHinh({ signal: ctrl.signal }),
      keToanService.danhSachThueSuat({ signal: ctrl.signal }),
      danhMucQuanAoService.getAll().then((r) => r?.data?.data ?? []).catch(() => []),
    ])
      .then(([ch, ts, dm]) => {
        setCauHinh(ch);
        setThueSuat(ts);
        setDsDanhMuc(dm);
        setLoiTai(false);
      })
      .catch(() => !ctrl.signal.aborted && setLoiTai(true))
      .finally(() => !ctrl.signal.aborted && setDangTai(false));
    return () => ctrl.abort();
  }, [lanTai]);

  const formGoc = useMemo(() => formCauHinh(cauHinh), [cauHinh]);
  // Danh mục cho ô Phạm vi: bỏ danh mục đã ngừng, trừ danh mục đang có dòng thuế suất
  const danhMuc = useMemo(
    () => phangDanhMuc(dsDanhMuc, thueSuat.map((t) => t.danhMucId).filter(Boolean)),
    [dsDanhMuc, thueSuat],
  );
  const coThayDoi = dangSua && JSON.stringify(form) !== JSON.stringify(formGoc);
  const thueDangNhap = suaThue !== null && JSON.stringify(formThue) !== JSON.stringify(formThueGoc);
  useUnsavedChanges(coThayDoi || thueDangNhap);

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

  const taiLaiThue = useCallback(async () => {
    try {
      setThueSuat(await keToanService.danhSachThueSuat());
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không tải lại được bảng thuế suất"));
    }
  }, []);

  const moFormThue = (id, giaTri) => {
    setFormThue(giaTri);
    setFormThueGoc(giaTri);
    setLoiThue("");
    setSuaThue(id);
  };

  const moThemThue = () => moFormThue("moi", { ...FORM_THUE_TRONG, hieuLucTu: homNay });

  const moSuaThue = (t) =>
    moFormThue(t.id, {
      tyLe: String(Number(t.tyLe)),
      hieuLucTu: t.hieuLucTu,
      hieuLucDen: t.hieuLucDen ?? "",
      danhMucId: t.danhMucId ? String(t.danhMucId) : "",
      ghiChu: t.ghiChu ?? "",
    });

  const luuThue = async (event) => {
    event.preventDefault();
    if (dangLuuThue) return;
    const cau = kiemTraThueSuat(formThue, thueSuat, suaThue === "moi" ? null : suaThue);
    setLoiThue(cau);
    if (cau) return;
    setDangLuuThue(true);
    try {
      if (suaThue === "moi") await keToanService.themThueSuat(payloadThueSuat(formThue));
      else await keToanService.suaThueSuat(suaThue, payloadThueSuat(formThue));
      setSuaThue(null);
      await taiLaiThue();
      toast.success("Đã lưu thuế suất.");
    } catch (e) {
      setLoiThue(getApiErrorMessage(e, "Không lưu được thuế suất"));
    } finally {
      setDangLuuThue(false);
    }
  };

  const xacNhanXoaThue = async () => {
    if (dangXoaThue || !xoaThue) return;
    setDangXoaThue(true);
    try {
      await keToanService.xoaThueSuat(xoaThue.id);
      setXoaThue(null);
      await taiLaiThue();
      toast.success("Đã xóa dòng thuế suất.");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Không xóa được thuế suất"));
    } finally {
      setDangXoaThue(false);
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
  const tenDanhMuc = (id) => danhMuc.find((d) => d.id === id)?.ten?.replace(/^(— )+/, "") ?? `Danh mục #${id}`;

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

      <SettingsCard aria-labelledby="ke-toan-thue-suat">
        <SettingsCardHeader
          titleId="ke-toan-thue-suat"
          title="Thuế suất GTGT"
          note="Giá bán đang gồm thuế; khi xuất, thuế tách theo dòng áp dụng ở ngày hạch toán. Dòng có danh mục ghi đè mức chung cho danh mục đó và danh mục con. Bảng này chỉ dùng khi xuất kế toán; thuế in trên hóa đơn bán hàng đặt ở Cấu hình › Thuế GTGT — đổi mức thuế thì sửa cả hai nơi."
          action={canEdit && suaThue === null ? (
            <SettingsTextButton onClick={moThemThue}><Plus className="size-[15px]" aria-hidden="true" />Thêm dòng</SettingsTextButton>
          ) : null}
        />
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#eef1f5] text-left text-xs text-bo-muted">
                <th className="py-2 pr-3 font-medium">Phạm vi</th>
                <th className="py-2 pr-3 font-medium">Thuế suất</th>
                <th className="py-2 pr-3 font-medium">Áp dụng</th>
                <th className="py-2 pr-3 font-medium">Ghi chú</th>
                <th className="py-2"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {thueSuat.map((t) => (
                <tr key={t.id} className="border-b border-[#eef1f5] last:border-0">
                  <td className="py-2.5 pr-3">{t.danhMucId ? (t.tenDanhMuc ?? tenDanhMuc(t.danhMucId)) : "Mức chung"}</td>
                  <td className="py-2.5 pr-3 font-semibold tabular-nums">{Number(t.tyLe)}%</td>
                  <td className="py-2.5 pr-3 tabular-nums">
                    {hienNgay(t.hieuLucTu)} – {t.hieuLucDen ? hienNgay(t.hieuLucDen) : "nay"}
                    {dangApDung(t, homNay) ? <span className="ml-2"><SettingsPill tone="ok">Đang áp dụng</SettingsPill></span> : null}
                  </td>
                  <td className="py-2.5 pr-3 text-[13px] text-[#5b6676]">{t.ghiChu}</td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    {canEdit && suaThue === null ? (
                      <>
                        <SettingsTextButton className="mr-0" onClick={() => moSuaThue(t)}>Sửa</SettingsTextButton>
                        <button type="button" aria-label="Xóa dòng thuế suất" onClick={() => setXoaThue(t)}
                          className="ml-1 inline-flex size-8 items-center justify-center rounded-md text-bo-muted hover:bg-bo-danger-soft hover:text-bo-danger">
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {thueSuat.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-bo-muted">Chưa có thuế suất nào: chưa xuất được chứng từ bán hàng.</td></tr>
              ) : null}
            </tbody>
          </table>

          {suaThue !== null ? (
            <form onSubmit={luuThue} noValidate className="mt-3 rounded-md border border-[#eef1f5] bg-bo-surface-subtle p-3.5">
              <p className="mb-2 text-sm font-medium text-bo-foreground">{suaThue === "moi" ? "Thêm dòng thuế suất" : "Sửa dòng thuế suất"}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="flex flex-col gap-1">
                  <label htmlFor="ts-pham-vi" className="text-xs font-medium text-bo-muted">Phạm vi</label>
                  <select id="ts-pham-vi" value={formThue.danhMucId} onChange={(e) => setFormThue((f) => ({ ...f, danhMucId: e.target.value }))} className={SELECT_CLASS}>
                    <option value="">Mức chung</option>
                    {danhMuc.map((d) => <option key={d.id} value={String(d.id)}>{d.ten}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ts-ty-le" className="text-xs font-medium text-bo-muted">Thuế suất</label>
                  <select id="ts-ty-le" value={formThue.tyLe} onChange={(e) => setFormThue((f) => ({ ...f, tyLe: e.target.value }))} className={SELECT_CLASS}>
                    {THUE_SUAT.map((t) => <option key={t} value={String(t)}>{t}%</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ts-tu" className="text-xs font-medium text-bo-muted">Từ ngày</label>
                  <Input id="ts-tu" type="date" value={formThue.hieuLucTu} onChange={(e) => setFormThue((f) => ({ ...f, hieuLucTu: e.target.value }))} className={settingsInputClass()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ts-den" className="text-xs font-medium text-bo-muted">Đến ngày (để trống = chưa hết)</label>
                  <Input id="ts-den" type="date" value={formThue.hieuLucDen} onChange={(e) => setFormThue((f) => ({ ...f, hieuLucDen: e.target.value }))} className={settingsInputClass()} />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ts-ghi-chu" className="text-xs font-medium text-bo-muted">Căn cứ / ghi chú</label>
                  <Input id="ts-ghi-chu" value={formThue.ghiChu} maxLength={255} placeholder="VD: NQ 204/2025/QH15" onChange={(e) => setFormThue((f) => ({ ...f, ghiChu: e.target.value }))} className={settingsInputClass()} />
                </div>
              </div>
              {loiThue ? <p role="alert" className="mt-2 text-xs text-bo-danger">{loiThue}</p> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={() => setSuaThue(null)} disabled={dangLuuThue}>Hủy</Button>
                <Button type="submit" className={cn(PRIMARY_BUTTON)} disabled={dangLuuThue}>{dangLuuThue ? "Đang lưu…" : "Lưu"}</Button>
              </div>
            </form>
          ) : null}
        </div>
      </SettingsCard>

      <ConfirmModal
        isOpen={Boolean(xoaThue)}
        onClose={() => !dangXoaThue && setXoaThue(null)}
        onConfirm={xacNhanXoaThue}
        isLoading={dangXoaThue}
        variant="danger"
        title="Xóa dòng thuế suất"
        description={xoaThue ? `Xóa dòng ${Number(xoaThue.tyLe)}% từ ${hienNgay(xoaThue.hieuLucTu)}? Chứng từ đã giao kế toán không đổi; lô sau dùng bảng mới.` : ""}
        confirmText="Xóa"
        cancelText="Giữ lại"
      />
    </div>
  );
}
