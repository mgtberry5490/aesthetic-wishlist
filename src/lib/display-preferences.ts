export const gridColumnsStorageKey = "wishful-grid-columns";
export const gridColumnsChangeEvent = "wishful-grid-columns-change";
export const gridColumnOptions = [2, 4, 6, 8] as const;
export type GridColumns = (typeof gridColumnOptions)[number];
const defaultGridColumns: GridColumns = 4;

export function getGridColumnsSnapshot(): string {
  try {
    const storedValue = Number(window.localStorage.getItem(gridColumnsStorageKey));
    return gridColumnOptions.includes(storedValue as GridColumns)
      ? String(storedValue)
      : String(defaultGridColumns);
  } catch {
    return String(defaultGridColumns);
  }
}

export function getServerGridColumnsSnapshot() {
  return String(defaultGridColumns);
}

export function subscribeToGridColumns(callback: () => void) {
  window.addEventListener(gridColumnsChangeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(gridColumnsChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

export function saveGridColumns(columns: GridColumns) {
  window.localStorage.setItem(gridColumnsStorageKey, String(columns));
  window.dispatchEvent(new Event(gridColumnsChangeEvent));
}
