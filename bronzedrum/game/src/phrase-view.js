/** Keep unfinished ghost strokes aligned with the instruction, not a guessed command. */
export function guidedPhrase(reader, shown, expected) {
  if (shown?.done) return shown;
  if (!reader.phrase.length) {
    return expected.length ? { pattern: expected[0], filled: 0, done: false } : shown;
  }
  const candidates = reader.candidates();
  for (const pattern of expected) {
    const match = candidates.find((c) => c.pattern.text === pattern.text);
    if (match) return { pattern: match.pattern, filled: reader.phrase.length, done: false };
  }
  // A different rhythm can still be played. Show its entered strokes, but
  // don't suggest a continuation that contradicts the current instruction.
  return shown && {
    ...shown,
    pattern: { ...shown.pattern, strokes: shown.pattern.strokes.slice(0, shown.filled) },
  };
}
