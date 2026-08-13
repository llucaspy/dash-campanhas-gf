const fs = require("fs");

function parseEnvFile(path) {
  const text = fs.readFileSync(path, "utf8");
  const result = {};
  let index = 0;

  while (index < text.length) {
    while (text[index] === "\n" || text[index] === "\r") index += 1;
    if (text[index] === "#") {
      const next = text.indexOf("\n", index);
      index = next === -1 ? text.length : next + 1;
      continue;
    }

    const keyMatch = /^[A-Z0-9_]+/.exec(text.slice(index));
    if (!keyMatch) break;

    const key = keyMatch[0];
    index += key.length;
    if (text[index] !== "=") {
      const next = text.indexOf("\n", index);
      index = next === -1 ? text.length : next + 1;
      continue;
    }
    index += 1;

    let value = "";
    if (text[index] === '"') {
      index += 1;
      while (index < text.length) {
        const char = text[index];
        if (char === '"' && text[index - 1] !== "\\") {
          index += 1;
          break;
        }
        value += char;
        index += 1;
      }
    } else {
      const next = text.indexOf("\n", index);
      value = text.slice(index, next === -1 ? text.length : next).trim();
      index = next === -1 ? text.length : next + 1;
    }

    result[key] = value.replace(/\\r/g, "").replace(/\\n/g, "").trim();
  }

  return result;
}

module.exports = { parseEnvFile };
