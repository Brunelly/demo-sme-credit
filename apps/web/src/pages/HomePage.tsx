import { brand } from "../brand.ts";

/**
 * "/": deliberately empty. The app starts blank so that its first stories build the screens the people using it
 * asked for. This page is not a default to extend: replace it with the app's real home when a story says what it is.
 */
export function HomePage() {
  return <h1 className="visually-hidden">{brand.product ? `${brand.name} ${brand.product}` : brand.name}</h1>;
}
