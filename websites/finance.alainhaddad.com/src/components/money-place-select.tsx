import { formatMoney } from "@/lib/money";

export type MoneyPlaceOption = {
  id: string;
  name: string;
  balance: number;
  memberId?: string | null;
};

export function MoneyPlaceSelect({
  name = "moneyPlaceId",
  places,
  defaultPlaceId,
  currency,
  label = "From",
  className = "",
}: {
  name?: string;
  places: MoneyPlaceOption[];
  defaultPlaceId?: string;
  currency: string;
  label?: string;
  className?: string;
}) {
  const preferred =
    defaultPlaceId && places.some((place) => place.id === defaultPlaceId)
      ? defaultPlaceId
      : places[0]?.id;

  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        name={name}
        defaultValue={preferred}
        className="h-11 w-full rounded-xl border border-line bg-card px-3 text-ink"
        required={places.length > 0}
      >
        {places.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name} · {formatMoney(place.balance, currency)}
          </option>
        ))}
      </select>
    </label>
  );
}
