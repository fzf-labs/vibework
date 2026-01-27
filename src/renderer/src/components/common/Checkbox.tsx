interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  onClick?: (e: React.MouseEvent) => void
  disabled?: boolean
}

export function Checkbox({ checked, onChange, onClick, disabled }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={onClick}
      disabled={disabled}
      className="w-4 h-4 cursor-pointer"
    />
  )
}
