type ChipOption = { value: string; label: string };

type ChipListProps = {
  options: ChipOption[];
  onSelect: (value: string) => void;
};

// Wrapping row of pill buttons for one-tap quick picks (templates, presets).
export default function ChipList({ options, onSelect }: ChipListProps) {
  return (
    <div className="chip-list">
      {options.map((option) => (
        <button key={option.value} type="button" className="chip-list__chip" onClick={() => onSelect(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
