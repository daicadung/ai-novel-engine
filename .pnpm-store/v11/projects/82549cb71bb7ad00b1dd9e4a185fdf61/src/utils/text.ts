export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.normalize('NFC');
}
