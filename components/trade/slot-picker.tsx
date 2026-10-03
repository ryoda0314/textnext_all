"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { LIMITS } from "@/lib/constants";
import { dateLabel, isWeekend, relativeDayLabel, todayJst } from "@/lib/format";
import type { MeetupSlot, SlotChoice } from "@/lib/types";

const key = (c: SlotChoice) => `${c.date}|${c.slot}`;

/** Date × time-band grid. Tap cells to toggle candidate slots. */
export function SlotPicker({
  slots,
  value,
  onChange,
  days = LIMITS.slotDaysAhead,
}: {
  slots: MeetupSlot[];
  value: SlotChoice[];
  onChange: (value: SlotChoice[]) => void;
  days?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => todayJst(i)), [days]);
  const visible = expanded ? dates : dates.slice(0, 7);
  const selected = new Set(value.map(key));

  const toggle = (choice: SlotChoice) => {
    if (selected.has(key(choice))) onChange(value.filter((v) => key(v) !== key(choice)));
    else if (value.length < LIMITS.maxSlots) onChange([...value, choice]);
  };

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border">
        <div className="grid bg-surface-2 text-center" style={{ gridTemplateColumns: `4.75rem repeat(${slots.length}, minmax(0, 1fr))` }}>
          <div />
          {slots.map((s) => (
            <div key={s.id} className="px-1 py-2">
              <p className="text-xs font-bold leading-tight">{s.label}</p>
              {s.hint && <p className="mt-0.5 text-[10px] leading-tight text-subtle">{s.hint}</p>}
            </div>
          ))}
        </div>
        {visible.map((date) => {
          const rel = relativeDayLabel(date);
          return (
            <div
              key={date}
              className={cn("grid border-t border-border", isWeekend(date) ? "bg-surface-2/60" : "bg-surface")}
              style={{ gridTemplateColumns: `4.75rem repeat(${slots.length}, minmax(0, 1fr))` }}
            >
              <div className="flex flex-col justify-center px-2.5 py-1.5">
                <span className="tabular text-[13px] font-bold leading-tight">{dateLabel(date)}</span>
                {rel && <span className="text-[10px] font-bold leading-tight text-primary">{rel}</span>}
              </div>
              {slots.map((s) => {
                const choice = { date, slot: s.id };
                const on = selected.has(key(choice));
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={`${dateLabel(date)} ${s.label}`}
                    onClick={() => toggle(choice)}
                    className="grid h-12 place-items-center border-l border-border p-1"
                  >
                    <span
                      className={cn(
                        "grid size-full place-items-center rounded-lg transition-colors",
                        on ? "bg-primary text-primary-fg" : "hover:bg-surface-3",
                      )}
                    >
                      {on && <Check className="size-5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {!expanded && days > 7 && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-2 w-full rounded-xl py-2 text-sm font-bold text-primary hover:bg-primary-soft">
          もっと先の日付を表示
        </button>
      )}
    </div>
  );
}

export function sortSlots(value: SlotChoice[], slots: MeetupSlot[]) {
  const order = new Map(slots.map((s, i) => [s.id, i]));
  return [...value].sort((a, b) => a.date.localeCompare(b.date) || (order.get(a.slot) ?? 0) - (order.get(b.slot) ?? 0));
}
