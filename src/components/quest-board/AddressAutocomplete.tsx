"use client";

type AddressAutocompleteProps = {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  className?: string;
};

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Start typing your address…",
  className = "mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500",
}: AddressAutocompleteProps) {
  return (
    <div className="address-autocomplete-host relative z-50">
      <input
        type="text"
        name="businessAddress"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={(event) => onChange(event.currentTarget.value.trim())}
        placeholder={placeholder}
        autoComplete="street-address"
        className={className}
      />
    </div>
  );
}
