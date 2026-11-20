import PosModal from './PosModal';
import { t } from "@/i18n";

const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-bo-border bg-bo-surface px-4 py-2 text-sm font-medium text-bo-foreground transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bo-primary disabled:cursor-not-allowed disabled:opacity-50';

/** Nắp phím: mỗi phím một nắp, viền đáy dày hơn cho giống phím thật. */
function Kbd({ children, small = false }) {
  return <kbd className={`inline-flex items-center justify-center rounded-[5px] border border-b-2 border-slate-200 border-b-slate-300 bg-white font-sans font-semibold leading-none text-slate-700 ${small ? 'h-5 min-w-5 px-1 text-[10px]' : 'h-6 min-w-6 px-1.5 text-[11px]'}`}>{children}</kbd>;
}

function ShortcutKeys({ keys, joiner }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((combo, index) => (
        <span className="flex items-center gap-1" key={combo.join('+')}>
          {index > 0 && joiner ? <span aria-hidden="true" className="px-0.5 text-[11px] text-bo-muted">{joiner}</span> : null}
          {combo.map((key, keyIndex) => (
            <span className="flex items-center gap-1" key={key}>
              {keyIndex > 0 ? <span aria-hidden="true" className="text-[11px] text-bo-muted">+</span> : null}
              <Kbd>{key}</Kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

function ShortcutGroup({ group }) {
  const Icon = group.icon;
  return (
    <section className="min-w-0">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-bo-muted"><Icon aria-hidden="true" size={14} strokeWidth={2} />{group.title}</h3>
      <ul className="mt-1 divide-y divide-bo-border">
        {group.rows.map((row) => (
          <li className="flex items-center justify-between gap-4 py-2.5" key={row.label}>
            <span className="min-w-0">
              <span className="block text-sm text-bo-foreground">{row.label}</span>
              {row.hint ? <span className="mt-0.5 block text-xs leading-5 text-bo-muted">{row.hint}</span> : null}
            </span>
            <ShortcutKeys joiner={row.joiner} keys={row.keys} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Hộp bảng phím tắt (F1 hoặc nút trợ giúp trên thanh trên), dùng chung cho màn Bán hàng và màn Trả hàng để cùng một
 * nút làm cùng một việc ở hai chế độ quầy.
 * Mỗi nhóm: { icon, title, rows }, mỗi dòng: keys là các lựa chọn, mỗi lựa chọn là các phím bấm cùng lúc
 * ([['Shift', 'F10']] = Shift + F10; [['←'], ['→']] = ← hoặc →); tên phím giữ nguyên như in trên bàn phím.
 * Một nhóm: hộp vừa, một cột. Nhiều nhóm: hộp rộng, nhóm đầu bên trái, các nhóm còn lại xếp bên phải.
 */
export default function BangPhimTat({ groups, description, onClose }) {
  const [dau, ...conLai] = groups;
  return (
    <PosModal
      description={description}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-bo-muted">{t("Mở lại bảng này:")} <Kbd small>F1</Kbd></p>
          <button className={secondaryButton} onClick={onClose} type="button">{t("Đóng")}</button>
        </div>
      )}
      onClose={onClose}
      size={conLai.length ? 'lg' : 'md'}
      title={t("Phím tắt")}
    >
      {conLai.length ? (
        <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
          <ShortcutGroup group={dau} />
          <div className="grid content-start gap-5">
            {conLai.map((group) => <ShortcutGroup group={group} key={group.title} />)}
          </div>
        </div>
      ) : <ShortcutGroup group={dau} />}
    </PosModal>
  );
}
