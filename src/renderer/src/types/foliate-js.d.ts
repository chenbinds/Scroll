declare module 'foliate-js/mobi.js' {
  export function isMOBI(file: Blob): Promise<boolean>

  export class MOBI {
    constructor(options: { unzlib: (data: Uint8Array) => Uint8Array | Promise<Uint8Array> })
    open(file: Blob): Promise<unknown>
  }
}
