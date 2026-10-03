"use client";

import { MapPin, MoreHorizontal } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import type { Spot } from "@/lib/types";

export type SpotValue = { spotIds: string[]; other: string | null };

export function filterSpots(spots: Spot[], campusId: string | null | undefined) {
  return spots.filter((s) => !s.campus_id || !campusId || s.campus_id === campusId);
}

export function SpotPicker({ spots, value, onChange }: { spots: Spot[]; value: SpotValue; onChange: (value: SpotValue) => void }) {
  const toggle = (id: string) =>
    onChange({ ...value, spotIds: value.spotIds.includes(id) ? value.spotIds.filter((s) => s !== id) : [...value.spotIds, id] });
  const otherOn = value.other !== null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {spots.map((spot) => (
          <Chip key={spot.id} selected={value.spotIds.includes(spot.id)} onClick={() => toggle(spot.id)} icon={<MapPin className="size-3.5" />} title={spot.description ?? undefined}>
            {spot.name}
          </Chip>
        ))}
        <Chip selected={otherOn} onClick={() => onChange({ ...value, other: otherOn ? null : "" })} icon={<MoreHorizontal className="size-3.5" />}>
          その他の場所
        </Chip>
      </div>
      {otherOn && (
        <Input
          value={value.other ?? ""}
          onChange={(e) => onChange({ ...value, other: e.target.value })}
          placeholder="例: 2号館1階ロビー（学内の人目がある場所）"
          maxLength={60}
          autoFocus
        />
      )}
    </div>
  );
}

export function spotValueValid(value: SpotValue) {
  return value.spotIds.length > 0 || Boolean(value.other?.trim());
}
