type FontSizeControlProps = {
  fontSize: number;
  min: number;
  max: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function FontSizeControl({
  fontSize,
  min,
  max,
  onDecrease,
  onIncrease,
}: FontSizeControlProps) {
  return (
    <div className="readerControlGroup" aria-label="글자 크기 조절">
      <button onClick={onDecrease} disabled={fontSize <= min}>A-</button>
      <span>{fontSize}px</span>
      <button onClick={onIncrease} disabled={fontSize >= max}>A+</button>
    </div>
  );
}
