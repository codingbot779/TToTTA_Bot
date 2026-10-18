export const DOCUMENTS_BUCKET = "documents";
export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".json"];

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}
