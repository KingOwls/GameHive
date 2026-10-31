import { useId, useState } from "react";
export function SpoilerReveal({ text }: { text: string }) {
  const [open, setOpen] = useState(false),
    id = useId();
  return (
    <div className="spoiler">
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ocultar spoilers" : "Mostrar spoilers"}
      </button>
      {open && <p id={id}>{text}</p>}
    </div>
  );
}
