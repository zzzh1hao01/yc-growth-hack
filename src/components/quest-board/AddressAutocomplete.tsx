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
  className = "western-input mt-1",
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
