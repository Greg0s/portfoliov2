/**
 * Whether this browser shows AVIF pictures, transparent ones included: the office's layers and the wall's pictures
 * come in AVIF, lighter than their WebP at the same fidelity, and in WebP for a browser that does not (main spec
 * §9.4). Tried once per page, on a one-pixel, half-transparent AVIF.
 */
const PIXEL =
  'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAAXBtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAADRpbG9jAAAAAERAAAIAAQAAAAABlAABAAAAAAAAAB4AAgAAAAABsgABAAAAAAAAABAAAAA4aWluZgAAAAAAAgAAABVpbmZlAgAAAAABAABhdjAxAAAAABVpbmZlAgAAAAACAABhdjAxAAAAAA5waXRtAAAAAAABAAAAr2lwcnAAAACKaXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAcAAAAAA5waXhpAAAAAAEIAAAAOGF1eEMAAAAAdXJuOm1wZWc6bXBlZ0I6Y2ljcDpzeXN0ZW1zOmF1eGlsaWFyeTphbHBoYQAAAAAdaXBtYQAAAAAAAAACAAEDgQIDAAIEhAIFhgAAABppcmVmAAAAAAAAAA5hdXhsAAIAAQABAAAANm1kYXQSAAoHOAAG0BDQaTIRGUJjBMAANAAAAJBAyRxhQr4SAAoEGAAOVTIGGAAAARAP';

let shown: Promise<boolean> | null = null;

export function avifShown(): Promise<boolean> {
  shown ??= (async () => {
    const image = new Image();
    image.src = PIXEL;
    try {
      await image.decode();
      return image.naturalWidth === 1;
    } catch {
      return false;
    }
  })();
  return shown;
}
