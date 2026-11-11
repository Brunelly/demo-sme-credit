// The app's component kit. Build every screen from these; add a component here (with its tests and a demo on the
// /kit page) before writing a one-off. Styles come only from tokens.css. Icons: lucide-react.

export { cx } from "./cx.ts";

// Primitives
export { Alert, type AlertProps, type AlertTone } from "./primitives/Alert.tsx";
export { Avatar, initials, type AvatarProps } from "./primitives/Avatar.tsx";
export { Badge, type BadgeProps, type Tone } from "./primitives/Badge.tsx";
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./primitives/Button.tsx";
export { Card, type CardProps } from "./primitives/Card.tsx";
export { Dialog, type DialogProps } from "./primitives/Dialog.tsx";
export { Field, Input, Select, Textarea, type FieldProps, type SelectOption, type SelectProps } from "./primitives/Field.tsx";
export { FilterChips, type FilterChipOption, type FilterChipsProps } from "./primitives/FilterChips.tsx";
export { Skeleton, type SkeletonProps } from "./primitives/Skeleton.tsx";
export { Spinner, type SpinnerProps } from "./primitives/Spinner.tsx";

// Patterns
export { AppShell, topBarLinkClass, type AppBrand, type AppShellProps } from "./patterns/AppShell.tsx";
export {
  AssistantPanel,
  ChatComposer,
  ChatThread,
  SuggestionChips,
  type AssistantPanelProps,
  type ChatMessage,
  type ChatRole,
} from "./patterns/Chat.tsx";
export { CellStack, DataTable, type Column, type DataTableProps } from "./patterns/DataTable.tsx";
export {
  DocumentDropzone,
  DocumentList,
  DocumentPreview,
  formatBytes,
  type DocumentItem,
  type DocumentStatus,
  type RejectedFile,
} from "./patterns/Documents.tsx";
export { KpiGrid, KpiTile, type KpiDelta, type KpiTileProps } from "./patterns/Kpi.tsx";
export { Grid, Stack, type GridProps, type Space, type StackProps } from "./patterns/Layout.tsx";
export { PageHeader, type PageHeaderProps } from "./patterns/PageHeader.tsx";
export { RunTimeline, type RunStep, type RunStepStatus, type RunTimelineProps } from "./patterns/RunTimeline.tsx";
export { EmptyState, ErrorState, LoadingState } from "./patterns/States.tsx";
