import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LOI_KHONG_KHOP_MA, LOI_NHIEU_COT, phanTichNoiDungDan } from './nhomBaoGia';

/**
 * Mô tả kết quả phân tích để người dùng biết sẽ điền thế nào trước khi bấm Áp dụng.
 * `soDongHien`: số dòng đang hiện trong bảng (dán một cột chỉ điền vào các dòng này); `dangLoc`: bảng đang lọc/tìm.
 */
function moTaPhanTich(van, phanTich, soDongHien, dangLoc) {
    if (!van.trim()) return { soGia: 0, cau: 'Chép cột Đơn giá (hoặc hai cột Mã SKU và Đơn giá) trong Excel rồi dán vào ô trên.' };
    if (phanTich.cheDo === 'nhieu-cot') return { soGia: 0, cau: LOI_NHIEU_COT };
    const theoMa = phanTich.cheDo === 'theo-sku';
    const soGia = phanTich.muc.filter((m) => m.gia !== null && (!theoMa || m.sku)).length;
    const boQua = phanTich.muc.length - soGia;
    if (!soGia) return { soGia: 0, cau: phanTich.coMaLa ? LOI_KHONG_KHOP_MA : 'Chưa đọc được đơn giá nào. Kiểm tra lại nội dung vừa dán.' };
    if (!theoMa && !soDongHien) {
        return { soGia: 0, cau: 'Bảng đang không hiện dòng nào (đang lọc hoặc tìm kiếm). Bỏ lọc rồi dán lại, hoặc chép kèm cột Mã SKU.' };
    }
    let cau = theoMa
        ? `Nhận ra ${soGia} đơn giá, ghép theo mã SKU.`
        : `Nhận ra ${soGia} đơn giá, điền lần lượt từ dòng đầu tiên trong bảng (theo thứ tự đang hiện).`;
    if (!theoMa && dangLoc) cau += ` Bảng đang lọc nên chỉ điền vào ${soDongHien} dòng đang hiện.`;
    if (boQua) cau += ` ${boQua} dòng không đọc được hoặc không khớp mã sẽ bỏ qua.`;
    return { soGia, cau };
}

/**
 * Hộp "Dán giá từ Excel": dán một cột giá (điền theo thứ tự dòng đang hiện) hoặc hai cột Mã SKU + Đơn giá
 * (ghép đúng theo mã). Không đọc clipboard tự động: người dùng tự dán (Ctrl+V) vào ô.
 */
export default function HopDanGia({ mo, dong, soDongHien, dangLoc, onDong, onApDung }) {
    const [van, setVan] = useState('');
    const phanTich = phanTichNoiDungDan(van, dong);
    // Ví dụ dùng đúng mã SKU của đơn đang báo giá để nhà cung cấp biết cần chép gì
    const maVd = dong.map((d) => d.maSku).filter(Boolean).slice(0, 2);
    const viDu = `VD:\n${(maVd.length ? maVd : ['MÃ-SKU-1', 'MÃ-SKU-2']).map((ma) => `${ma}   185.000`).join('\n')}`;
    const { soGia, cau } = moTaPhanTich(van, phanTich, soDongHien, dangLoc);

    const dong_ = () => {
        setVan('');
        onDong();
    };

    return (
        <Dialog open={mo} onOpenChange={(m) => { if (!m) dong_(); }}>
            <DialogContent className="max-w-[calc(100%-2rem)] gap-4 rounded-lg border-bo-border p-5 font-backoffice text-bo-foreground sm:max-w-[520px] sm:p-6">
                <div className="flex flex-col gap-1 pr-6">
                    <DialogTitle className="text-lg leading-7 font-semibold text-bo-heading">Dán giá từ Excel</DialogTitle>
                    <DialogDescription className="text-sm leading-[22px] text-bo-muted">
                        Chép cột Đơn giá theo đúng thứ tự dòng trong bảng, hoặc chép hai cột Mã SKU và Đơn giá để ghép theo mã.
                        Mã và giá cách nhau bằng Tab (chép từ Excel) hoặc dấu cách đều được.
                    </DialogDescription>
                </div>
                <label htmlFor="hop-dan-gia" className="sr-only">Nội dung dán từ Excel</label>
                <textarea
                    id="hop-dan-gia"
                    rows={7}
                    value={van}
                    onChange={(e) => setVan(e.target.value)}
                    placeholder={viDu}
                    className="block w-full resize-y rounded-md border border-bo-border bg-bo-surface px-3 py-2.5 font-mono text-[13px] leading-5 text-bo-foreground placeholder:text-bo-muted/70 focus-visible:border-bo-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bo-primary/15"
                />
                <p role="status" className="m-0 text-sm leading-5 text-slate-600">{cau}</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={dong_} className="h-11 border-bo-border bg-bo-surface text-bo-foreground hover:bg-bo-surface-subtle sm:h-9">
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        disabled={!soGia}
                        onClick={() => {
                            if (onApDung(phanTich)) dong_();
                        }}
                        className="h-11 bg-bo-primary text-white hover:bg-bo-primary-hover sm:h-9"
                    >
                        Áp dụng {soGia ? `${soGia} giá` : ''}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
