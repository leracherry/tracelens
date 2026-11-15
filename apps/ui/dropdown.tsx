import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

interface DropdownProps {
  id?: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function Dropdown({
  id,
  label,
  value,
  options,
  onChange,
}: DropdownProps) {
  const listId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const open = active !== null;
  const selected = options.findIndex((option) => option.value === value);
  const index = Math.min(active ?? Math.max(0, selected), options.length - 1);
  const optionId = (index: number) => `${listId}-${index}`;

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setActive(null);
    }
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [open]);

  useEffect(() => {
    if (!open || index < 0) return;
    const option = document.getElementById(`${listId}-${index}`);
    const list = option?.parentElement;
    if (!option || !list) return;
    const bounds = option.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    if (bounds.top < viewport.top) list.scrollTop -= viewport.top - bounds.top;
    if (bounds.bottom > viewport.bottom)
      list.scrollTop += bounds.bottom - viewport.bottom;
  }, [open, index, listId]);

  function choose(index: number) {
    const option = options[index];
    setActive(null);
    if (option && option.value !== value) onChange(option.value);
  }

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive(
          open
            ? Math.max(0, Math.min(options.length - 1, index + step))
            : Math.max(0, selected),
        );
        break;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        setActive(event.key === 'Home' ? 0 : options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (open) choose(index);
        else setActive(Math.max(0, selected));
        break;
      case 'Tab':
        setActive(null);
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          setActive(null);
        }
        break;
      default:
        if (
          event.key.length === 1 &&
          !event.altKey &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          const key = event.key.toLocaleLowerCase();
          for (let offset = 1; offset <= options.length; offset++) {
            const next = (index + offset) % options.length;
            if (options[next]?.label.toLocaleLowerCase().startsWith(key)) {
              event.preventDefault();
              setActive(next);
              break;
            }
          }
        }
    }
  }

  return (
    <div className="select-control" ref={container}>
      <button
        id={id}
        ref={trigger}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && index >= 0 ? optionId(index) : undefined}
        onBlur={(event) => {
          if (event.relatedTarget) setActive(null);
        }}
        onClick={() => {
          trigger.current?.focus({ preventScroll: true });
          setActive(open ? null : Math.max(0, selected));
        }}
        onKeyDown={handleKey}
      >
        <span className="select-value">{options[selected]?.label}</span>
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        className="select-options"
        hidden={!open}
      >
        {open &&
          options.map((option, position) => (
            <li
              key={option.value}
              id={optionId(position)}
              role="option"
              aria-selected={option.value === value}
              data-active={index === position || undefined}
              onPointerDown={(event) => {
                if (event.pointerType === 'mouse') event.preventDefault();
              }}
              onClick={() => {
                trigger.current?.focus({ preventScroll: true });
                choose(position);
              }}
            >
              {option.label}
            </li>
          ))}
      </ul>
    </div>
  );
}
