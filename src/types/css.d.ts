import "react";

// Lets `style` carry CSS custom properties without casting.
declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
