type SettingsFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'number' | 'date' | 'select' | 'textarea';
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
      ) : type === 'textarea' ? (
        <textarea
          className="settings-input settings-input--textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
        />
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
