declare module "html5-qrcode/third_party/zxing-js.umd.js" {
  export const BrowserQRCodeSvgWriter: new () => {
    write(contents: string, width: number, height: number): SVGElement;
  };
}
