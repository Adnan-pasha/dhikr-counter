/** Last-resort copy for older WebViews and insecure contexts that have no async clipboard. */
const legacyCopy = (text: string): boolean => {
  const field = document.createElement('textarea');
  try {
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
};

/** Copies text to the clipboard. Resolves to whether it worked; never throws. */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (permissions, focus): fall through to the older method.
  }
  return legacyCopy(text);
};
