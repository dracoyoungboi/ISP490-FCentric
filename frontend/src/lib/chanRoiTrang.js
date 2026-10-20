/**
 * Chặn rời trang khi màn hình đang có thay đổi chưa lưu — cho các lối rời trang KHÔNG đi qua thẻ <a>
 * (ô tìm kiếm chung, nút Đăng xuất…). Link thường do chính trang chặn bằng cách bắt sự kiện click.
 *
 *   // Trang đang sửa (chỉ đăng ký khi có thay đổi chưa lưu):
 *   useEffect(() => (dirty ? datChanRoiTrang((tiepTuc) => moHopThoaiHoi(tiepTuc)) : undefined), [dirty]);
 *
 *   // Nơi rời trang:
 *   xinRoiTrang(() => navigate(duongDan));
 *
 * Không có trang nào chặn -> `tiepTuc` chạy ngay. Có -> trang đó tự hỏi người dùng và gọi `tiepTuc`
 * khi người dùng đồng ý rời (hoặc lưu xong). Mỗi lúc chỉ một trang chặn (trang đăng ký sau thay trang trước).
 *
 * Back / Forward của trình duyệt: dùng `chanQuayLaiTrinhDuyet` (cuối file).
 */

let chanHienTai = null;

/** Đăng ký hàm chặn; trả hàm hủy đăng ký (dùng làm cleanup của useEffect). */
export function datChanRoiTrang(chan) {
    chanHienTai = chan;
    return () => {
        if (chanHienTai === chan) chanHienTai = null;
    };
}

/** Rời trang qua lớp chặn (nếu có). */
export function xinRoiTrang(tiepTuc) {
    if (typeof tiepTuc !== "function") return;
    if (chanHienTai) {
        chanHienTai(tiepTuc);
        return;
    }
    tiepTuc();
}

/**
 * Trình duyệt có gọi trình nghe pha bắt (capture) TRƯỚC trình nghe thường khi sự kiện tới chính đích
 * không (chuẩn DOM hiện hành; trình duyệt cũ gọi theo thứ tự đăng ký). Thử trên một EventTarget riêng.
 */
function batTruocTaiDich(win) {
    try {
        const dich = new win.EventTarget();
        const thuTu = [];
        dich.addEventListener("thu-thu-tu", () => thuTu.push("thuong"));
        dich.addEventListener("thu-thu-tu", () => thuTu.push("bat"), true);
        dich.dispatchEvent(new win.Event("thu-thu-tu"));
        return thuTu[0] === "bat";
    } catch {
        return false;
    }
}

/** Đưa trình duyệt về lại trang tối đa chừng này lần trong KHOANG_DEM_BU_MS — quá thì thôi chặn (hành vi cũ). */
const GIOI_HAN_LAN_BU = 4;
const KHOANG_DEM_BU_MS = 2000;
/**
 * Chờ popstate "về lại trang" tối đa chừng này. Quá hạn (trình duyệt bỏ qua history.go, bước tính từ `idx`
 * vượt khỏi lịch sử…) thì thôi chặn và phát lại popstate để router đọc mục lịch sử hiện tại — giao diện
 * theo URL thay vì đứng ở trang cũ.
 */
const THOI_GIAN_CHO_VE_MS = 3000;

/**
 * Chặn Back / Forward của trình duyệt (cả Alt+←, giữ nút Back để lùi nhiều bước) khi trang có thay đổi
 * chưa lưu. Ứng dụng dùng BrowserRouter nên không có useBlocker / unstable_usePrompt (hai hook này chỉ
 * chạy với data router).
 *
 *   // Đăng ký MỘT lần cho mỗi mục lịch sử của trang (theo location.key, KHÔNG theo `dirty`), đọc `dirty` qua ref
 *   const { key } = useLocation();
 *   useEffect(
 *       () => chanQuayLaiTrinhDuyet((tiepTuc) => moHopThoaiHoi(tiepTuc), window, {
 *           dangChan: () => dirtyRef.current,
 *           khoaTrang: key,
 *       }),
 *       [key]
 *   );
 *
 * Cách làm: nghe `popstate` ở pha bắt trên window (chạy trước trình nghe thường của BrowserRouter), không
 * cho router thấy lần chuyển đó, đưa trình duyệt về lại mục lịch sử của trang (history.go); chỉ khi popstate
 * về ĐÚNG mục của trang — cả `idx` lẫn `key` mà React Router ghi vào history.state (xem lib/lichSuDieuHuong.js)
 * — mới gọi `hoi(tiepTuc)`; người dùng đồng ý rời thì `tiepTuc()` đi lại đúng số bước đã bấm, lần này router
 * xử lý như thường. Số bước tính từ `idx` của mục đích.
 *
 * Mọi trường hợp bất thường đều quay về hành vi cũ — gỡ lớp chặn, để router xử lý popstate đó như thường
 * (mất thay đổi chưa lưu như trước khi có lớp chặn), không gọi thêm history.go — để URL không bao giờ lệch
 * giao diện và lịch sử không bị lặp:
 * - đang chờ về lại trang mà có popstate khác (Back đúp, giữ Alt+←: lần bấm sau vào hàng đợi trước lệnh bù);
 * - mục đích không có `idx` (link #neo) hoặc trùng `idx` với trang (React Router đánh lại idx sau mục #neo);
 * - quá GIOI_HAN_LAN_BU lần bù trong KHOANG_DEM_BU_MS, hoặc quá THOI_GIAN_CHO_VE_MS chưa về lại trang;
 * - router đã xử lý một lần rời mục của trang (không còn thay đổi chưa lưu, người dùng đồng ý rời…): mục
 *   của trang không còn là mục router đang hiển thị.
 * Mục khởi tạo của tài liệu (mở thẳng bằng URL, thẻ mới, bookmark): React Router chỉ ghi `{ idx: 0 }`, không
 * có `key`, và location.key là "default" — chỉ khi `khoaTrang === "default"` thì mục không có key được nhận
 * diện bằng `idx` + không có key + URL của mục (F5 ở mục #neo cũng sinh một mục `{ idx: 0 }` không key khác
 * trong cùng tài liệu: so URL để lệnh bù dừng nhầm ở mục đó thì vẫn không coi là đã về trang; nếu trùng cả URL
 * thì giao diện vẫn khớp URL).
 * Không chặn từ đầu khi trình duyệt không gọi pha bắt trước ở đích, mục hiện tại không có `idx` (vd. sau link
 * #neo), không có `key` mà `khoaTrang` khác "default", hoặc mục hiện tại không phải mục router đang hiển thị
 * (`khoaTrang` khác history.state.key — vd. đăng ký lại đúng lúc trình duyệt chưa về lại trang).
 * Trả hàm hủy (dùng làm cleanup của useEffect); sau khi hủy, `tiepTuc` của lần hỏi cũ không làm gì.
 */
export function chanQuayLaiTrinhDuyet(hoi, win = window, { dangChan = () => true, khoaTrang } = {}) {
    const mucTrang = win.history.state;
    const idxTrang = mucTrang?.idx;
    const keyTrang = mucTrang?.key;
    // Mục khởi tạo không có key, router đang hiển thị đúng mục không key (location.key "default")
    const mucKhongKey = keyTrang === undefined && khoaTrang === "default";
    const urlTrang = win.location?.href;
    if (
        typeof hoi !== "function" ||
        !Number.isInteger(idxTrang) ||
        (!mucKhongKey &&
            (typeof keyTrang !== "string" ||
                keyTrang === "" ||
                (khoaTrang !== undefined && khoaTrang !== keyTrang))) ||
        !batTruocTaiDich(win)
    ) {
        return () => {};
    }
    const laMucTrang = (state) =>
        state?.idx === idxTrang &&
        state?.key === keyTrang &&
        (!mucKhongKey || win.location?.href === urlTrang);
    let daGo = false;
    // Đã gọi history.go để về lại trang, đang chờ popstate về đúng mục của trang: { buoc, henGio }
    let choVe = null;
    // Người dùng đã đồng ý rời (đã gọi history.go(bước)): popstate kế tiếp để router xử lý
    let choQua = false;
    // Lần hỏi gần nhất: chỉ `tiepTuc` của lần đó dùng được, và chỉ một lần
    let lanHoi = 0;
    // Thời điểm các lần đưa trình duyệt về lại trang gần đây
    let lanBu = [];

    const goLopChan = () => {
        if (daGo) return;
        daGo = true;
        if (choVe) win.clearTimeout(choVe.henGio);
        choVe = null;
        win.removeEventListener("popstate", xuLy, true);
    };

    const hetGioChoVe = () => {
        if (daGo || !choVe) return;
        goLopChan();
        // Lớp chặn đã gỡ: router nhận popstate này, đọc mục lịch sử hiện tại và hiển thị đúng trang của URL
        const SuKien = win.PopStateEvent ?? win.Event;
        win.dispatchEvent(new SuKien("popstate", { state: win.history.state }));
    };

    const hoiNguoiDung = (buoc) => {
        const lan = ++lanHoi;
        hoi(() => {
            if (daGo || lan !== lanHoi) return;
            lanHoi += 1;
            choQua = true;
            win.history.go(buoc);
        });
    };

    function xuLy(event) {
        const state = win.history.state;
        if (choVe) {
            if (laMucTrang(state)) {
                // Về lại đúng mục của trang: router chưa thấy lần chuyển đi nên cũng không cần thấy lần này
                event.stopImmediatePropagation();
                const { buoc, henGio } = choVe;
                win.clearTimeout(henGio);
                choVe = null;
                hoiNguoiDung(buoc);
                return;
            }
            // Lần chuyển khác chen vào trước lệnh bù: thôi chặn — router xử lý lần này và mọi lần sau (kể cả
            // lệnh bù còn trong hàng đợi), giao diện luôn theo URL
            goLopChan();
            return;
        }
        if (laMucTrang(state)) return;
        const idx = state?.idx;
        const bayGio = Date.now();
        lanBu = lanBu.filter((luc) => bayGio - luc < KHOANG_DEM_BU_MS);
        if (
            choQua ||
            !dangChan() ||
            !Number.isInteger(idx) ||
            idx === idxTrang ||
            lanBu.length >= GIOI_HAN_LAN_BU
        ) {
            // Router xử lý lần rời mục của trang này như thường; lớp chặn hết hiệu lực
            goLopChan();
            return;
        }
        event.stopImmediatePropagation();
        lanBu.push(bayGio);
        const buoc = idx - idxTrang;
        choVe = { buoc, henGio: win.setTimeout(hetGioChoVe, THOI_GIAN_CHO_VE_MS) };
        win.history.go(-buoc);
    }

    win.addEventListener("popstate", xuLy, true);
    return goLopChan;
}
