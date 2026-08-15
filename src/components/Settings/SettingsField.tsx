type SettingsFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
};

export default function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: SettingsFieldProps) {
  return (
    <div className="settings-field">
      <label>{label}</label>
      <input
        type={type}
        className="settings-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
