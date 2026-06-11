import type { CharacterView, InventoryItemView } from "../../foundry/actor/types";

function ItemRow({ item, onEquipTap, onInvestToggle, onShowDetail }: {
  item: InventoryItemView;
  onEquipTap: (id: string) => void;
  onInvestToggle: (id: string, next: boolean) => void;
  onShowDetail: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <button onClick={() => onShowDetail(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {item.img && <img src={item.img} alt="" className="h-8 w-8 rounded object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {item.name}{item.quantity > 1 ? <span className="text-zinc-400"> ×{item.quantity}</span> : null}
            {item.isContainer ? <i className="fas fa-box-archive ml-1 text-[10px] text-zinc-500" aria-hidden="true" /> : null}
          </div>
          <div className="text-[11px] text-zinc-500">Bulk {item.bulkLabel} · {item.priceLabel}</div>
        </div>
      </button>
      {item.invested !== null && (
        <button onClick={() => onInvestToggle(item.id, !item.invested)}
          aria-label="Toggle invested"
          className={`min-h-9 rounded px-2 text-xs font-semibold ${item.invested ? "bg-amber-700 text-amber-100" : "bg-zinc-800 text-zinc-400"}`}>
          {item.invested ? "Invested" : "Invest"}
        </button>
      )}
      <button onClick={() => onEquipTap(item.id)}
        className={`min-h-9 rounded px-2 text-xs font-semibold ${item.equipped ? "bg-emerald-800 text-emerald-100" : "bg-zinc-800 text-zinc-300"}`}>
        {item.carryType}{item.carryType === "held" && item.handsHeld ? ` ${item.handsHeld}h` : ""}
      </button>
    </div>
  );
}

export function ItemsPanel({ view, onEquipTap, onInvestToggle, onShowDetail }: {
  view: CharacterView;
  onEquipTap: (id: string) => void;
  onInvestToggle: (id: string, next: boolean) => void;
  onShowDetail: (id: string) => void;
}) {
  const inv = view.inventory;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-sm">
        <span className="text-zinc-400">Coins</span>
        <span className="font-semibold tabular-nums">{inv.currency.pp}pp {inv.currency.gp}gp {inv.currency.sp}sp {inv.currency.cp}cp</span>
      </div>
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 text-sm">
        <span className="text-zinc-400">Bulk</span>
        <span className={`font-semibold ${inv.encumbered ? "text-orange-300" : ""}`}>{inv.bulkLabel}{inv.encumbered ? " · encumbered" : ""}</span>
      </div>
      {inv.categories.map((cat) => (
        <section key={cat.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{cat.label}</h3>
          <div className="divide-y divide-zinc-800">
            {cat.items.map((it) => <ItemRow key={it.id} item={it} onEquipTap={onEquipTap} onInvestToggle={onInvestToggle} onShowDetail={onShowDetail} />)}
          </div>
        </section>
      ))}
      {inv.categories.length === 0 && <div className="p-4 text-sm text-zinc-500">No items.</div>}
    </div>
  );
}
