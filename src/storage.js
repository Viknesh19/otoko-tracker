const PREFIX = "otoko-tracker";

const clone = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

export function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(`${PREFIX}:${key}`);
    return value ? JSON.parse(value) : clone(fallback);
  } catch (error) {
    console.warn("Failed to read storage", key, error);
    return clone(fallback);
  }
}

export function writeStore(key, value) {
  try {
    localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to persist storage", key, error);
  }
}