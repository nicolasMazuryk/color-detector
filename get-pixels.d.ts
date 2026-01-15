declare module 'get-pixels' {
  interface NdArray {
    data: Uint8Array | Uint8ClampedArray;
    shape: number[];
    stride: number[];
    offset: number;
  }

  function getPixels(
    src: string,
    callback: (err: Error | null, pixels: NdArray) => void
  ): void;

  export = getPixels;
}
