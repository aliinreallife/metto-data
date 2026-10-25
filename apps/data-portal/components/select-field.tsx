"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

type Option = { value: string; label: string; search?: string };
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی")
    .replace(/\u200c/g, " ")
    .trim();

/** A shared, keyboard-accessible select; long station lists can be searched. */
export function SelectField({
  label,
  name,
  value,
  defaultValue = "",
  onChange,
  options,
  searchLabel,
  emptyLabel,
  hideLabel = false,
}: {
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: Option[];
  searchLabel?: string;
  emptyLabel?: string;
  hideLabel?: boolean;
}) {
  const [local, setLocal] = useState(defaultValue),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const selected = value ?? local;
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null);
  const filtered = options.filter((option) =>
    normalize(`${option.label} ${option.search ?? ""}`).includes(
      normalize(query),
    ),
  );
  const activeId = filtered[active] ? `${id}-option-${active}` : undefined;
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (option: Option) => {
    setLocal(option.value);
    onChange?.(option.value);
    close();
  };
  const show = () => {
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === selected),
      ),
    );
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    if (open && activeId)
      document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId, open]);
  const keys = (event: React.KeyboardEvent) => {
    if (event.key === "Tab") return; // Native focus movement; onBlur closes the popup.
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      if (!open && ["Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (!open) {
        show();
        return;
      }
      setActive((index) =>
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? filtered.length - 1
            : Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              ),
      );
    }
    if (
      open &&
      (event.key === "Enter" || (!searchLabel && event.key === " "))
    ) {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    }
    if (open && !searchLabel && event.key.length === 1 && event.key !== " ") {
      const index = options.findIndex(
        (option, i) =>
          i > active &&
          normalize(option.label).startsWith(normalize(event.key)),
      );
      const wrapped = options.findIndex((option) =>
        normalize(option.label).startsWith(normalize(event.key)),
      );
      if (index >= 0 || wrapped >= 0) {
        event.preventDefault();
        setActive(index >= 0 ? index : wrapped);
      }
    }
  };
  return (
    <div
      ref={root}
      className="relative min-w-0"
      onKeyDown={keys}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span
        id={`${id}-label`}
        className={hideLabel ? "sr-only" : "mb-2 block text-sm font-semibold"}
      >
        {label}
      </span>
      {name && <input type="hidden" name={name} value={selected} />}
      <button
        ref={trigger}
        type="button"
        role={searchLabel ? undefined : "combobox"}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={!searchLabel && open ? activeId : undefined}
        onClick={() => (open ? close() : show())}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-3 text-start text-sm transition-colors hover:border-primary/50 focus-visible:outline-none ${open ? "border-primary ring-2 ring-primary/10" : "border-input"}`}
      >
        <span id={`${id}-value`} className="truncate">
          {options.find((option) => option.value === selected)?.label ??
            options[0]?.label}
        </span>
        <ChevronDown
          aria-hidden
          className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute start-0 top-full z-30 mt-2 w-full min-w-0 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {searchLabel && (
            <div className="relative border-b border-border p-2">
              <Search
                aria-hidden
                className="pointer-events-none absolute start-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={search}
                role="combobox"
                aria-label={searchLabel}
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls={`${id}-list`}
                aria-activedescendant={activeId}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder={searchLabel}
                className="min-h-11 w-full rounded-lg bg-muted py-2 pe-3 ps-10 text-base outline-none focus-visible:outline-none"
              />
            </div>
          )}
          <ul
            tabIndex={-1}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="max-h-60 overflow-y-auto overscroll-contain p-1.5"
          >
            {filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={selected === option.value}
                onPointerMove={() => setActive(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${active === index ? "bg-accent text-accent-foreground" : ""} ${selected === option.value ? "font-semibold" : ""}`}
              >
                <span>{option.label}</span>
                {selected === option.value && (
                  <Check aria-hidden className="size-4 shrink-0 text-primary" />
                )}
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p role="status" className="p-4 text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
