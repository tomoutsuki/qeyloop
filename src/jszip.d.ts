// Type declarations for jszip module

declare module 'jszip' {
  interface JSZipObject {
    name: string;
    dir: boolean;
    async(type: 'arraybuffer'): Promise<ArrayBuffer>;
    async(type: 'text'): Promise<string>;
    async(type: 'blob'): Promise<Blob>;
  }

  interface JSZipGenerateOptions {
    type: 'blob';
    compression?: string;
    compressionOptions?: object;
  }

  interface JSZip {
    file(name: string): JSZipObject | null;
    file(name: string, data: string | ArrayBuffer | Blob | Uint8Array): JSZip;
    folder(name: string): JSZip | null;
    forEach(callback: (relativePath: string, file: JSZipObject) => void): void;
    loadAsync(data: ArrayBuffer | Blob | File): Promise<JSZip>;
    generateAsync(options: JSZipGenerateOptions): Promise<Blob>;
  }

  interface JSZipConstructor {
    new(): JSZip;
    loadAsync(data: ArrayBuffer | Blob | File): Promise<JSZip>;
  }

  const JSZip: JSZipConstructor;
  export default JSZip;
}
