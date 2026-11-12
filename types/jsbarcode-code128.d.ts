declare module "jsbarcode/src/barcodes/CODE128/CODE128_AUTO" {
  class Code128Auto {
    constructor(value: string, options?: Record<string, unknown>);
    valid(): boolean;
    encode(): { data: string; text?: string };
  }
  export default Code128Auto;
}
