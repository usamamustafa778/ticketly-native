declare module 'tinycolor2' {
  interface TinyColor {
    isLight(): boolean;
    isDark(): boolean;
    isValid(): boolean;
    toHexString(): string;
    mix(color: string | TinyColor, amount?: number): TinyColor;
  }
  interface TinyColorStatic {
    (color: string | { r: number; g: number; b: number }): TinyColor;
    isReadable(
      color1: string | TinyColor,
      color2: string | TinyColor,
      opts?: { level?: 'AA' | 'AAA'; size?: 'small' | 'large' | 'normal' }
    ): boolean;
  }
  const tinycolor: TinyColorStatic;
  export default tinycolor;
}
