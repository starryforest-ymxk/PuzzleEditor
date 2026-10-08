/** fatal 解码拦截错误字节；额外拦截已经落盘的替换字符和文件中部 BOM。 */
export function validateUtf8(bytes) {
  const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (content.includes('\uFFFD')) throw new Error('Contains the Unicode replacement character');
  if (content.includes('\uFEFF')) throw new Error('Contains a BOM inside file content');
  return content;
}
