# Design brief

Who this app is for and how it should look, as the people building it answered. Read it before any UI work and follow it. A story that asks for something different wins, for that story.

## The app

- **Organisation:** Rasikh Bank
- **Product:** SME Credit Desk
- **Who it is for:** SME credit analysts and relationship managers working a queue of applications

## The look: Ledger, light

Ledger: institutional, dense and light. Ink on a cool off-white, a deep petrol accent, near-square corners. For banks and operations.

- Density is compact: table rows about 36px, two or three columns of fields on a desktop.
- Tables before cards. Figures right-aligned in tabular numerals (`font-variant-numeric: tabular-nums`), units and dates in one format, identifiers in the mono face (`--font-mono`).
- The petrol accent marks the primary action and where you are, nothing else. Status uses the status colours, never the accent.
- Borders and rules separate things; shadows only for menus and dialogs. Headings are short nouns in sentence case.

## Never, in any look

- no indigo, violet or pink accents, and no gradients, glows or glassmorphism;
- no cream background with a serif and a terracotta accent, and no near-black with an acid-green accent;
- no Inter, Roboto or Arial as the only typeface: the look's face comes first, the starter's behind it;
- no emoji as icons or decoration, and no hero banners, marketing copy, testimonials or invented figures inside the app;
- no card around everything, and no shadow where a border will do: shadows are for menus and dialogs.

## The tokens

These are already in the app's tokens (`packages/ui/src/tokens.css` on the web, `packages/ui-native/src/tokens.ts` on mobile). Use the tokens, never the values.

| Token | Value |
|---|---|
| brand | `#0f5b4b` |
| on brand | `#ffffff` |
| background | `#f2f4f6` |
| surface | `#ffffff` |
| text | `#0f1a24` |
| typeface | Segoe UI, then the starter's own |
| corners | xs 2px, sm 2px, md 3px, lg 4px, xl 4px |
