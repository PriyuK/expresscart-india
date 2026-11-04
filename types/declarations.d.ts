declare module 'react-native-qrcode-svg' {
  import * as React from 'react';

  export interface QRCodeProps {
    value?: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    ecl?: 'L' | 'M' | 'Q' | 'H';
    quietZone?: number;
  }

  export default class QRCode extends React.Component<QRCodeProps> {}
}

declare module 'crypto' {
  export function createHmac(
    algorithm: string,
    key: string
  ): {
    update(data: string): {
      digest(encoding: 'hex' | 'base64'): string;
    };
  };
}

declare module 'fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string, encoding?: string): void;
}

declare module 'path' {
  export function join(...paths: string[]): string;
}

declare module 'os' {
  export function tmpdir(): string;
}

declare var process: {
  env: Record<string, string | undefined>;
};
