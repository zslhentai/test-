import { useEffect, useRef, useState } from "react";

export default function PriceInput({
  value,
  label,
  allowEmpty = false,
  onChange,
}: {
  value: string;
  label: string;
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const normalized = (text: string) =>
    !text || text === "."
      ? allowEmpty
        ? ""
        : "0"
      : text.startsWith(".")
        ? `0${text}`
        : text;
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={draft}
      placeholder={allowEmpty ? "不显示" : undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        const next = normalized(draft);
        setDraft(next);
        onChange(next);
      }}
      onChange={(event) => {
        const text = event.target.value;
        if (!/^\d{0,7}(\.\d{0,2})?$/.test(text)) return;
        setDraft(text);
        onChange(normalized(text));
      }}
    />
  );
}
