export function parseMarkdownLines(content) {
  const value = String(content ?? "");
  const lines = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\n") continue;
    const crlf = index > start && value[index - 1] === "\r";
    lines.push({
      text: value.slice(start, crlf ? index - 1 : index),
      ending: crlf ? "\r\n" : "\n",
    });
    start = index + 1;
  }
  if (start < value.length || value.length === 0) lines.push({ text: value.slice(start), ending: "" });
  return lines;
}

export function renderMarkdownLines(lines) {
  return lines.map(({ text, ending }) => `${text}${ending}`).join("");
}

export function preferredLineEnding(content) {
  return parseMarkdownLines(content).find(({ ending }) => ending)?.ending || "\n";
}
