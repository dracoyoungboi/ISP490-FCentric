import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, Download, Link2, Loader2, Save, Wand2,
} from "lucide-react";
import { toast } from "sonner";

import PageContainer from "@/components/backoffice/PageContainer";
import FormSection from "@/components/shared/FormSection";
import SetupStep from "@/components/shared/SetupStep";
import InlineResult from "@/components/shared/InlineResult";
import ErrorState from "@/components/shared/ErrorState";
import LoadingState from "@/components/shared/LoadingState";
import MockModeNotice from "@/components/shared/MockModeNotice";
import ChannelLogo from "@/components/channel/ChannelLogo";
import ConnectionStatusBadge from "@/components/channel/ConnectionStatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { kenhBanHangService, isChannelSyncMock } from "@/services/kenhBanHangService";
import { getApiErrorMessage } from "@/utils/apiError";
import { cn } from "@/lib/utils";

const STEPS = ["Kho đồng bộ", "Quy tắc tồn", "Nhận đơn", "Liên kết & bật đồng bộ"];

const inputClass =
    "h-10 w-full rounded-lg border border-bo-border bg-white px-3 text-sm text-bo-foreground outline-none placeholder:text-slate-500 focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15 disabled:cursor-not-allowed disabled:bg-bo-surface-subtle";
const selectTriggerClass =
    "h-10 w-full border-bo-border bg-white text-bo-foreground focus-visible:border-bo-primary focus-visible:ring-bo-primary/20";
const selectContentClass = "z-50 rounded-lg border border-bo-border bg-white p-1 shadow-lg";
const selectItemClass = "rounded-md text-sm text-slate-700 focus:bg-slate-100 focus:text-slate-900";
const labelClass = "mb-1.5 block text-sm font-medium text-bo-foreground";
const switchClass = "data-[state=checked]:bg-bo-primary data-[state=unchecked]:bg-slate-300 [&>span]:bg-white";

/** BR-OC-10 — chỉ để xem trước; số thật do backend tính. */
function tinhSoDay(kd, tyLe, tonDem, nguongVe0) {
    const khaDung = Math.max(0, Number(kd) || 0);
    if (khaDung < (Number(nguongVe0) || 0)) return 0;
    return Math.max(0, Math.floor((khaDung * (Number(tyLe) || 0)) / 100) - (Number(tonDem) || 0));
}

const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

function formFromKetNoi(kn) {
    return {
        khoId: kn?.khoId ? String(kn.khoId) : "",
        maKhoSan: kn?.maKhoSan ?? "",
        khachHangMacDinhId: kn?.khachHangMacDinhId ? String(kn.khachHangMacDinhId) : "",
        tyLeDayTon: String(kn?.tyLeDayTon ?? 100),
        tonDem: String(kn?.tonDem ?? 0),
        nguongVe0: String(kn?.nguongVe0 ?? 0),
        layDonTu: toDateInput(kn?.layDonTu),
    };
}

function validateStep(step, form) {
    const errors = {};
    if (step === 0) {
        if (!form.khoId) errors.khoId = "Chọn kho FCentric dùng để đồng bộ tồn và xuất đơn.";
        if (!form.maKhoSan) errors.maKhoSan = "Chọn vị trí kho trên Shopify.";
    }
    if (step === 1) {
        const tyLe = Number(form.tyLeDayTon);
        if (!Number.isInteger(tyLe) || tyLe < 1 || tyLe > 100) errors.tyLeDayTon = "Tỷ lệ là số nguyên từ 1 đến 100.";
        if (!/^\d+$/.test(form.tonDem)) errors.tonDem = "Tồn đệm là số nguyên ≥ 0.";
        if (!/^\d+$/.test(form.nguongVe0)) errors.nguongVe0 = "Ngưỡng về 0 là số nguyên ≥ 0.";
    }
    if (step === 2) {
        if (!form.khachHangMacDinhId) errors.khachHangMacDinhId = "Chọn khách hàng mặc định cho đơn từ sàn.";
        if (!form.layDonTu) errors.layDonTu = "Chọn ngày bắt đầu lấy đơn.";
    }
    return errors;
}

export default function ChannelSetupWizard() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [ketNoi, setKetNoi] = useState(null);
    const [khoOptions, setKhoOptions] = useState([]);
    const [khoSanOptions, setKhoSanOptions] = useState([]);
    const [khachOptions, setKhachOptions] = useState([]);
    const [form, setForm] = useState(formFromKetNoi(null));
    const [errors, setErrors] = useState({});
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState(null);
    const [savedOnce, setSavedOnce] = useState(false);
    const [exampleKd, setExampleKd] = useState("15");
    const [linkAction, setLinkAction] = useState(null); // "tai" | "ghep" | "dong-bo"
    const [linkResult, setLinkResult] = useState(null);
    const busyRef = useRef(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const [kn, khoList, khoSanList, khachList] = await Promise.all([
                kenhBanHangService.getKetNoi(id),
                kenhBanHangService.getKhoOptions().catch(() => []),
                kenhBanHangService.getKhoSan(id).catch(() => []),
                kenhBanHangService.getKhachHangOptions().catch(() => []),
            ]);
            setKetNoi(kn);
            setForm(formFromKetNoi(kn));
            setSavedOnce(Boolean(kn?.khoId && kn?.maKhoSan));
            setKhoOptions(khoList ?? []);
            setKhoSanOptions(khoSanList ?? []);
            setKhachOptions(khachList ?? []);
        } catch (error) {
            setLoadError(true);
            toast.error(getApiErrorMessage(error, "Không tải được kết nối"));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        queueMicrotask(() => fetchAll());
    }, [fetchAll]);

    const change = (name, value) => {
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: undefined }));
        setSaveResult(null);
    };

    const soDayVidu = useMemo(
        () => tinhSoDay(exampleKd, form.tyLeDayTon, form.tonDem, form.nguongVe0),
        [exampleKd, form.tyLeDayTon, form.tonDem, form.nguongVe0],
    );

    const goTo = (target) => {
        if (target > step) {
            for (let s = step; s < target; s += 1) {
                const stepErrors = validateStep(s, form);
                if (Object.keys(stepErrors).length) {
                    setErrors(stepErrors);
                    setStep(s);
                    return;
                }
            }
        }
        if (target === 3 && !savedOnce) {
            setStep(2);
            setSaveResult({ ok: false, title: "Chưa lưu cấu hình", message: "Bấm Lưu cấu hình ở bước 3 trước khi sang bước liên kết." });
            return;
        }
        setErrors({});
        setStep(target);
    };

    // Lưu cả bước 1–3 một lần (PUT /cau-hinh). Lưu cấu hình không bật / tắt đồng bộ (BR-OC-02).
    const saveConfig = async () => {
        const allErrors = { ...validateStep(0, form), ...validateStep(1, form), ...validateStep(2, form) };
        if (Object.keys(allErrors).length) {
            setErrors(allErrors);
            const firstStep = [0, 1, 2].find((s) => Object.keys(validateStep(s, form)).length);
            setStep(firstStep ?? 0);
            return;
        }
        if (busyRef.current) return;
        busyRef.current = true;
        setSaving(true);
        setSaveResult(null);
        try {
            const khoSan = khoSanOptions.find((k) => k.maKhoSan === form.maKhoSan);
            const dto = await kenhBanHangService.luuCauHinh(id, {
                khoId: Number(form.khoId),
                maKhoSan: form.maKhoSan,
                tenKhoSan: khoSan?.tenKhoSan ?? ketNoi?.tenKhoSan,
                khachHangMacDinhId: Number(form.khachHangMacDinhId),
                tyLeDayTon: Number(form.tyLeDayTon),
                tonDem: Number(form.tonDem),
                nguongVe0: Number(form.nguongVe0),
                layDonTu: new Date(`${form.layDonTu}T00:00:00`).toISOString(),
            });
            setKetNoi(dto);
            setSavedOnce(true);
            toast.success("Đã lưu cấu hình kết nối");
            setStep(3);
        } catch (error) {
            setSaveResult({
                ok: false,
                title: "Lưu cấu hình thất bại",
                message: `${getApiErrorMessage(error, "Không lưu được cấu hình")} Cấu hình hợp lệ trước đó vẫn được giữ.`,
            });
        } finally {
            busyRef.current = false;
            setSaving(false);
        }
    };

    const runLinkAction = async (name) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setLinkAction(name);
        setLinkResult(null);
        try {
            if (name === "tai") {
                const res = await kenhBanHangService.taiSanPham(id);
                setLinkResult({ ok: true, title: `Đã tải ${res?.soSku ?? 0} SKU từ ${res?.soSanPham ?? 0} sản phẩm`, message: `${res?.soMoi ?? 0} mới · ${res?.soCapNhat ?? 0} cập nhật` });
            } else {
                const res = await kenhBanHangService.tuDongLienKet(id);
                setLinkResult({ ok: true, title: `Đã tự động ghép ${res?.soDaGhep ?? 0} SKU`, message: `${res?.soKhongKhop ?? 0} không khớp · ${res?.soNhieuKhop ?? 0} khớp nhiều biến thể — ghép tay ở trang Liên kết sản phẩm` });
            }
            const kn = await kenhBanHangService.getKetNoi(id);
            setKetNoi(kn);
        } catch (error) {
            setLinkResult({ ok: false, title: "Thao tác thất bại", message: getApiErrorMessage(error, "Không thực hiện được") });
        } finally {
            busyRef.current = false;
            setLinkAction(null);
        }
    };

    const toggleSync = async (field, value) => {
        if (busyRef.current || !ketNoi) return;
        busyRef.current = true;
        setLinkAction("dong-bo");
        try {
            const dto = await kenhBanHangService.batTatDongBo(id, {
                tuDongDayTon: field === "tuDongDayTon" ? value : ketNoi.tuDongDayTon,
                tuDongLayDon: field === "tuDongLayDon" ? value : ketNoi.tuDongLayDon,
            });
            setKetNoi(dto);
            toast.success(value ? "Đã bật đồng bộ" : "Đã tắt đồng bộ");
        } catch (error) {
            toast.error(getApiErrorMessage(error, "Không đổi được trạng thái đồng bộ"));
        } finally {
            busyRef.current = false;
            setLinkAction(null);
        }
    };

    if (loading && !ketNoi) {
        return (
            <PageContainer>
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <LoadingState label="Đang tải cấu hình kết nối" />
                </div>
            </PageContainer>
        );
    }

    if (!ketNoi) {
        return (
            <PageContainer className="space-y-5">
                <BackLink onClick={() => navigate("/channels")} />
                <div className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                    <ErrorState description={loadError ? "Không tải được kết nối. Vui lòng thử lại." : undefined} onRetry={fetchAll} />
                </div>
            </PageContainer>
        );
    }

    const stepDone = (index) => {
        if (index < 3) return savedOnce && Object.keys(validateStep(index, form)).length === 0 && index !== step;
        return Boolean(ketNoi.tuDongDayTon || ketNoi.tuDongLayDon);
    };

    return (
        <PageContainer className="space-y-5">
            <MockModeNotice show={isChannelSyncMock} reason="backend chưa có API thiết lập đồng bộ" />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <BackLink onClick={() => navigate("/channels")} />
                <Button
                    variant="outline"
                    onClick={() => navigate(`/channels/${id}/mappings`)}
                    className="h-9 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                >
                    <Link2 className="size-4" />
                    Liên kết sản phẩm
                </Button>
            </div>

            {/* ── Thanh thông tin + các bước ── */}
            <section className="overflow-hidden rounded-lg border border-bo-border bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
                    <ChannelLogo maKenh={ketNoi.maKenh} />
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-bo-foreground">
                            {ketNoi.tenHienThi}
                            <ConnectionStatusBadge trangThai={ketNoi.trangThai} />
                        </p>
                        <p className="mt-0.5 truncate font-mono text-xs text-bo-muted">{ketNoi.tenMienShop || ketNoi.shopIdSan}</p>
                    </div>
                </div>
                <div className="border-t border-bo-border bg-bo-surface-subtle px-4 py-3 sm:px-6">
                    <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                        {STEPS.map((label, index) => (
                            <SetupStep key={label} index={index + 1} active={step === index} done={stepDone(index)} onClick={() => goTo(index)}>
                                {label}
                            </SetupStep>
                        ))}
                    </ol>
                </div>
            </section>

            {/* ── Bước 1: Kho ── */}
            {step === 0 ? (
                <FormSection
                    title="Bước 1 · Kho đồng bộ"
                    description="Kho FCentric vừa là nguồn tồn đẩy lên Shopify vừa là kho giữ chỗ và xuất đơn của gian hàng. Đổi kho chỉ được khi không còn đơn đang xử lý."
                >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className={labelClass}>Kho FCentric</label>
                            <Select value={form.khoId} onValueChange={(value) => change("khoId", value)}>
                                <SelectTrigger className={cn(selectTriggerClass, errors.khoId && "border-bo-danger")}>
                                    <SelectValue placeholder="Chọn kho" />
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={4} className={selectContentClass}>
                                    {khoOptions.map((kho) => (
                                        <SelectItem key={kho.id} value={String(kho.id)} className={selectItemClass}>
                                            {kho.tenKho}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldMessage error={errors.khoId} hint="Kho Trung Chuyển không được dùng để đồng bộ." />
                        </div>
                        <div>
                            <label className={labelClass}>Vị trí kho trên Shopify</label>
                            <Select value={form.maKhoSan} onValueChange={(value) => change("maKhoSan", value)}>
                                <SelectTrigger className={cn(selectTriggerClass, errors.maKhoSan && "border-bo-danger")}>
                                    <SelectValue placeholder={khoSanOptions.length ? "Chọn location" : "Chưa lấy được location"} />
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={4} className={selectContentClass}>
                                    {khoSanOptions.map((kho) => (
                                        <SelectItem key={kho.maKhoSan} value={kho.maKhoSan} className={selectItemClass}>
                                            {kho.tenKhoSan}{kho.macDinh ? " (mặc định)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldMessage error={errors.maKhoSan} hint="Chỉ đẩy tồn vào location này; tồn ở location khác trên Shopify giữ nguyên." />
                        </div>
                    </div>
                </FormSection>
            ) : null}

            {/* ── Bước 2: Quy tắc tồn ── */}
            {step === 1 ? (
                <FormSection
                    title="Bước 2 · Quy tắc đẩy tồn"
                    description="Số đẩy lên sàn = (khả dụng < ngưỡng về 0) ? 0 : khả dụng × tỷ lệ − tồn đệm, làm tròn xuống."
                >
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                            <NumberField label="Tỷ lệ đẩy (%)" value={form.tyLeDayTon} error={errors.tyLeDayTon} hint="100% = đẩy toàn bộ khả dụng" onChange={(v) => change("tyLeDayTon", v)} />
                            <NumberField label="Tồn đệm" value={form.tonDem} error={errors.tonDem} hint="Giữ lại để tránh bán vượt" onChange={(v) => change("tonDem", v)} />
                            <NumberField label="Ngưỡng về 0" value={form.nguongVe0} error={errors.nguongVe0} hint="Khả dụng thấp hơn thì đẩy 0" onChange={(v) => change("nguongVe0", v)} />
                        </div>
                        <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-4">
                            <p className="flex items-center gap-2 text-sm font-semibold text-bo-foreground">
                                <Calculator className="size-4 text-bo-primary" />
                                Ví dụ
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                                <label htmlFor="example-kd" className="text-sm text-slate-700">Khả dụng</label>
                                <input
                                    id="example-kd"
                                    inputMode="numeric"
                                    value={exampleKd}
                                    onChange={(event) => setExampleKd(event.target.value.replace(/[^\d]/g, ""))}
                                    className="h-9 w-20 rounded-md border border-bo-border bg-white text-center text-sm font-semibold text-bo-foreground outline-none focus:border-bo-primary focus:ring-2 focus:ring-bo-primary/15"
                                />
                                <ArrowRight className="size-4 text-bo-muted" />
                                <span className="text-sm text-slate-700">
                                    đẩy lên Shopify <strong className="text-lg font-bold text-bo-primary">{soDayVidu}</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </FormSection>
            ) : null}

            {/* ── Bước 3: Nhận đơn ── */}
            {step === 2 ? (
                <FormSection
                    title="Bước 3 · Nhận đơn"
                    description="Đơn từ sàn ghi vào khách hàng mặc định của gian hàng; người nhận và địa chỉ lưu trên đơn. Lưu cấu hình không tự bật đồng bộ."
                >
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className={labelClass}>Khách hàng mặc định</label>
                            <Select value={form.khachHangMacDinhId} onValueChange={(value) => change("khachHangMacDinhId", value)}>
                                <SelectTrigger className={cn(selectTriggerClass, errors.khachHangMacDinhId && "border-bo-danger")}>
                                    <SelectValue placeholder="Chọn khách hàng" />
                                </SelectTrigger>
                                <SelectContent position="popper" sideOffset={4} className={cn(selectContentClass, "max-h-72")}>
                                    {khachOptions.map((khach) => (
                                        <SelectItem key={khach.id} value={String(khach.id)} className={selectItemClass}>
                                            {khach.tenKhachHang}{khach.maKhachHang ? ` · ${khach.maKhachHang}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldMessage error={errors.khachHangMacDinhId} hint="Mặc định KH-SHOPIFY." />
                        </div>
                        <div>
                            <label htmlFor="lay-don-tu" className={labelClass}>Lấy đơn từ ngày</label>
                            <input
                                id="lay-don-tu"
                                type="date"
                                value={form.layDonTu}
                                onChange={(event) => change("layDonTu", event.target.value)}
                                className={cn(inputClass, errors.layDonTu && "border-bo-danger")}
                            />
                            <FieldMessage error={errors.layDonTu} hint="Đơn tạo trước ngày này không nhập. Shopify chỉ cho xem đơn 60 ngày gần nhất." />
                        </div>
                    </div>
                    <InlineResult result={saveResult} className="mt-5" />
                </FormSection>
            ) : null}

            {/* ── Bước 4: Liên kết & bật đồng bộ ── */}
            {step === 3 ? (
                <FormSection
                    title="Bước 4 · Liên kết sản phẩm và bật đồng bộ"
                    description="Tải SKU từ Shopify, ghép tự động theo SKU, rồi bật đồng bộ khi đủ điều kiện."
                >
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Metric label="SKU trên Shopify" value={ketNoi.soLienKet ?? 0} />
                            <Metric label="Đang đồng bộ" value={ketNoi.soLienKetDangBat ?? 0} tone="success" />
                            <Metric label="Chưa liên kết" value={ketNoi.soChuaLienKet ?? 0} tone={ketNoi.soChuaLienKet ? "warning" : "neutral"} />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                disabled={Boolean(linkAction)}
                                onClick={() => runLinkAction("tai")}
                                className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                {linkAction === "tai" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                                Tải sản phẩm từ Shopify
                            </Button>
                            <Button
                                variant="outline"
                                disabled={Boolean(linkAction) || !ketNoi.soLienKet}
                                onClick={() => runLinkAction("ghep")}
                                className="gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle"
                            >
                                {linkAction === "ghep" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                                Tự động liên kết
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => navigate(`/channels/${id}/mappings`)}
                                className="gap-2 border-bo-primary/30 bg-bo-primary-soft text-bo-primary hover:bg-bo-primary-soft/70 hover:text-bo-primary"
                            >
                                <Link2 className="size-4" />
                                Mở trang Liên kết sản phẩm
                            </Button>
                        </div>
                        <InlineResult result={linkResult} />

                        <div className="divide-y divide-bo-border rounded-lg border border-bo-border">
                            <SyncToggle
                                id="tu-dong-day-ton"
                                label="Tự động đẩy tồn"
                                description="Đẩy định kỳ và đẩy ngay khi khả dụng xuống dưới ngưỡng cảnh báo."
                                checked={Boolean(ketNoi.tuDongDayTon)}
                                disabled={Boolean(linkAction) || (!ketNoi.coTheBatDongBo && !ketNoi.tuDongDayTon)}
                                onChange={(value) => toggleSync("tuDongDayTon", value)}
                            />
                            <SyncToggle
                                id="tu-dong-lay-don"
                                label="Tự động lấy đơn"
                                description="Nhận đơn qua webhook và quét bù định kỳ; đơn mới được giữ chỗ ngay."
                                checked={Boolean(ketNoi.tuDongLayDon)}
                                disabled={Boolean(linkAction) || (!ketNoi.coTheBatDongBo && !ketNoi.tuDongLayDon)}
                                onChange={(value) => toggleSync("tuDongLayDon", value)}
                            />
                        </div>
                        {!ketNoi.coTheBatDongBo && ketNoi.lyDoKhongTheBat ? (
                            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                <p>Chưa bật được đồng bộ: {ketNoi.lyDoKhongTheBat}.</p>
                            </div>
                        ) : null}
                    </div>
                </FormSection>
            ) : null}

            {/* ── Điều hướng bước ── */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                    variant="outline"
                    disabled={step === 0 || saving}
                    onClick={() => goTo(step - 1)}
                    className="h-10 gap-2 border-bo-border bg-white text-bo-foreground hover:bg-bo-surface-subtle disabled:opacity-50"
                >
                    <ArrowLeft className="size-4" />
                    Bước trước
                </Button>
                {step < 2 ? (
                    <Button onClick={() => goTo(step + 1)} className="h-10 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                        Tiếp tục
                        <ArrowRight className="size-4" />
                    </Button>
                ) : step === 2 ? (
                    <Button onClick={saveConfig} disabled={saving} className="h-10 min-w-[160px] gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover disabled:opacity-50">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        {saving ? "Đang lưu…" : "Lưu cấu hình"}
                    </Button>
                ) : (
                    <Button onClick={() => navigate("/channels")} className="h-10 gap-2 bg-bo-primary text-white hover:bg-bo-primary-hover">
                        <Check className="size-4" />
                        Hoàn tất
                    </Button>
                )}
            </div>
        </PageContainer>
    );
}

function BackLink({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-bo-muted transition-colors hover:text-bo-primary"
        >
            <ArrowLeft className="size-4" />
            Quay lại Kết nối gian hàng
        </button>
    );
}

function FieldMessage({ error, hint }) {
    if (error) return <p className="mt-1 text-xs text-bo-danger">{error}</p>;
    if (hint) return <p className="mt-1 text-xs text-bo-muted">{hint}</p>;
    return null;
}

function NumberField({ label, value, error, hint, onChange }) {
    return (
        <div>
            <label className={labelClass}>{label}</label>
            <input
                inputMode="numeric"
                value={value}
                onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ""))}
                className={cn(inputClass, "font-semibold", error && "border-bo-danger focus:border-bo-danger focus:ring-bo-danger/15")}
            />
            <FieldMessage error={error} hint={hint} />
        </div>
    );
}

const METRIC_TONE = {
    neutral: "text-bo-foreground",
    success: "text-bo-success",
    warning: "text-bo-warning",
};

function Metric({ label, value, tone = "neutral" }) {
    return (
        <div className="rounded-lg border border-bo-border bg-bo-surface-subtle p-3">
            <p className="text-xs font-medium text-bo-muted">{label}</p>
            <p className={`mt-1 text-xl font-bold tracking-tight ${METRIC_TONE[tone]}`}>{value}</p>
        </div>
    );
}

function SyncToggle({ id, label, description, checked, disabled, onChange }) {
    return (
        <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
                <label htmlFor={id} className="text-sm font-semibold text-bo-foreground">{label}</label>
                <p className="mt-0.5 text-xs leading-5 text-bo-muted">{description}</p>
            </div>
            <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} className={switchClass} />
        </div>
    );
}
