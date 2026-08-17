type SettingsFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'select';
  options?: { value: string; label: string }[];
};

export default function SettingsField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  options,
}: SettingsFieldProps) {
  return (
    <div className="settings-field">
      <label>{label}</label>
      {type === 'select' ? (
        <select
          className="settings-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className="settings-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
