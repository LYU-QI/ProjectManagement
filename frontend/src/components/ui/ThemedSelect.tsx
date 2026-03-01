import { Children, isValidElement, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type OptionItem = {
  value: string;
  label: string;
  disabled: boolean;
  hidden: boolean;
};

type Props = {
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
};

function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((item) => toText(item)).join('');
  if (isValidElement<any>(node)) return toText(node.props?.children);
  return '';
}

function parseOptions(children: ReactNode): OptionItem[] {
  const options: OptionItem[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<any>(child)) return;
    if (child.type === 'option') {
      const value = child.props.value === undefined ? '' : String(child.props.value);
      const label = toText(child.props.children).trim() || value;
      options.push({
        value,
        label,
        disabled: Boolean(child.props.disabled),
        hidden: Boolean(child.props.hidden)
      });
      return;
    }
    if (child.type === 'optgroup' && child.props?.children) {
      Children.forEach(child.props.children, (inner) => {
        if (!isValidElement<any>(inner) || inner.type !== 'option') return;
        const value = inner.props.value === undefined ? '' : String(inner.props.value);
        const label = toText(inner.props.children).trim() || value;
        options.push({
          value,
          label,
          disabled: Boolean(inner.props.disabled),
          hidden: Boolean(inner.props.hidden)
        });
      });
    }
  });
  return options;
}

export default function ThemedSelect({
  value,
  defaultValue,
  onChange,
  children,
  disabled,
  className,
  name,
  required
}: Props) {
  const options = useMemo(() => parseOptions(children), [children]);
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const currentValue = isControlled ? String(value ?? '') : innerValue;
  const selected = options.find((item) => item.value === currentValue) || options.find((item) => item.value === '') || options[0];
  const triggerLabel = selected?.label || '请选择';

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 10,
        left: rect.left,
        width: rect.width,
        zIndex: 99999
      });
    };
    updateMenuPosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const inRoot = rootRef.current?.contains(target ?? null);
      const inMenu = menuRef.current?.contains(target ?? null);
      if (!inRoot && !inMenu) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onWindowChange = () => updateMenuPosition();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [open]);

  const commitValue = (nextValue: string) => {
    if (!isControlled) setInnerValue(nextValue);
    setOpen(false);
    if (onChange) {
      const syntheticEvent = {
        target: { value: nextValue, name: name ?? '' },
        currentTarget: { value: nextValue, name: name ?? '' }
      } as unknown as ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div ref={rootRef} className={`themed-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}>
      <input type="hidden" name={name} value={currentValue} required={required} />
      <button
        ref={triggerRef}
        type="button"
        className="themed-select-trigger"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        data-open={open ? '1' : '0'}
      >
        {triggerLabel}
      </button>
      {open && createPortal(
        <div ref={menuRef} className="themed-select-menu themed-select-menu-portal" style={menuStyle}>
          {options.filter((item) => !item.hidden).map((item) => (
            <button
              key={`${name || 'select'}-${item.value}-${item.label}`}
              type="button"
              disabled={item.disabled}
              className={`themed-select-option${item.value === currentValue ? ' is-selected' : ''}${item.value.toLowerCase() === 'delete' ? ' is-danger' : ''}`}
              onClick={() => commitValue(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
