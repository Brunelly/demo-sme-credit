// CSS Modules: `import styles from "./Button.module.css"` gives the class names.
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}

declare module "*.css";
