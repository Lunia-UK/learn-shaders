/** Shows text where parts written between backticks are code, e.g. "`foo` is not defined". */
export function CodeText({ text }: { text: string }) {
  return (
    <>{text.split('`').map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part))}</>
  );
}
