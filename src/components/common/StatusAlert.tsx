export type StatusTone = 'warning' | 'success' | 'info';

type StatusAlertProps = {
  message: string;
  tone: StatusTone;
};

export default function StatusAlert({ message, tone }: StatusAlertProps) {
  return <p className={`settings-alert settings-alert-${tone}`}>{message}</p>;
}
