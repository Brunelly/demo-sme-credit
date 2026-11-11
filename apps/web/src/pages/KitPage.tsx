import {
  Alert,
  AssistantPanel,
  Avatar,
  Badge,
  Button,
  Card,
  CellStack,
  DataTable,
  Dialog,
  DocumentDropzone,
  DocumentList,
  DocumentPreview,
  EmptyState,
  ErrorState,
  Field,
  FilterChips,
  Grid,
  Input,
  KpiGrid,
  KpiTile,
  LoadingState,
  PageHeader,
  RunTimeline,
  Select,
  Skeleton,
  Stack,
  Textarea,
  type ChatMessage,
  type Column,
  type DocumentItem,
} from "@app/ui";
import { Download, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import styles from "./KitPage.module.css";

// "/kit": every component in packages/ui, with sample data, so you can see what exists before building anything.
// The figures here are samples for the gallery only: never put made-up numbers on a real page.

interface SampleRow {
  id: string;
  name: string;
  team: string;
  state: "active" | "paused" | "failed";
  runs: number;
}

const rows: SampleRow[] = [
  { id: "1", name: "Invoice matcher", team: "Finance", state: "active", runs: 1284 },
  { id: "2", name: "Contract reviewer", team: "Legal", state: "paused", runs: 312 },
  { id: "3", name: "Onboarding checker", team: "Operations", state: "failed", runs: 57 },
];

const stateBadge = {
  active: <Badge tone="success" dot>Active</Badge>,
  paused: <Badge tone="neutral" dot>Paused</Badge>,
  failed: <Badge tone="danger" dot>Failed</Badge>,
};

const columns: Column<SampleRow>[] = [
  { key: "name", header: "Agent", render: (row) => <CellStack primary={row.name} secondary={row.team} /> },
  { key: "state", header: "State", render: (row) => stateBadge[row.state] },
  { key: "runs", header: "Runs", align: "end", render: (row) => row.runs.toLocaleString() },
];

const messages: ChatMessage[] = [
  { id: "1", role: "user", content: "Which contracts renew this month?" },
  { id: "2", role: "assistant", content: "Three: the two logistics framework agreements and the cleaning services contract.", meta: "ask-assistant · 2.1s" },
  { id: "3", role: "notice", content: "This is a sample conversation." },
];

const sampleDocuments: DocumentItem[] = [
  { id: "a", name: "Tender-brief.pdf", size: 2_400_000, type: "application/pdf", status: "ready" },
  { id: "b", name: "Pricing-schedule.xlsx", size: 184_000, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", status: "reading" },
  { id: "c", name: "Site-photos.zip", size: 48_000_000, type: "application/zip", status: "failed", error: "Too large" },
];

export function KitPage() {
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<File | null>(null);
  const [rejections, setRejections] = useState<string[]>([]);

  const picked: DocumentItem[] = files.map((file, index) => ({ id: `${index}-${file.name}`, name: file.name, size: file.size, type: file.type, status: "ready" }));

  return (
    <>
      <PageHeader
        title="UI kit"
        description="Every component the app is built from. Themed only by packages/ui/src/tokens.css: change the tokens and all of this follows."
        actions={
          <>
            <Button icon={<Download size={15} />}>Secondary</Button>
            <Button variant="primary" icon={<Plus size={15} />}>
              Primary
            </Button>
          </>
        }
      />

      <Section title="Buttons and badges">
        <Stack direction="row" gap={2} wrap align="center">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button size="sm" icon={<Search size={14} />}>
            Small
          </Button>
          <Button icon={<Plus size={16} />} aria-label="Add" />
        </Stack>
        <Stack direction="row" gap={2} wrap align="center">
          <Badge>Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="info" dot>Info</Badge>
          <Badge tone="success" dot>Success</Badge>
          <Badge tone="warning" dot>Warning</Badge>
          <Badge tone="danger" dot>Danger</Badge>
          <Badge tone="ai">AI</Badge>
          <Avatar name="Maya Lindqvist" />
          <Avatar name="Tomás Okafor" size="sm" />
        </Stack>
        <FilterChips
          label="Sample filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: 3 },
            { value: "mine", label: "Mine", count: 1 },
          ]}
        />
      </Section>

      <Section title="KPI tiles">
        <KpiGrid label="Sample KPIs">
          <KpiTile label="Runs today" value="1,284" delta={{ label: "+12% on last week", direction: "up", good: true }} />
          <KpiTile label="Failure rate" value="0.8%" delta={{ label: "+0.3 pts", direction: "up", good: false }} />
          <KpiTile label="Needs review" value="7" tone="attention" hint="Oldest is 2 days" />
          <KpiTile label="Loading" value="" loading />
        </KpiGrid>
      </Section>

      <Grid columns={2}>
        <Card title="Data table" subtitle="Click a row" padded={false}>
          <DataTable caption="Sample agents" columns={columns} rows={rows} rowKey={(row) => row.id} onRowClick={() => setDialogOpen(true)} />
        </Card>
        <Card title="Form" subtitle="Field, Input, Select, Textarea">
          <Stack gap={4}>
            <Field label="Name" hint="As it appears on the invoice">
              <Input placeholder="Example Ltd" />
            </Field>
            <Field label="Region" error="Choose a region">
              <Select options={[{ value: "", label: "Choose…" }, { value: "emea", label: "EMEA" }]} />
            </Field>
            <Field label="Notes" optional>
              <Textarea rows={3} />
            </Field>
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              Open a dialog
            </Button>
          </Stack>
        </Card>
      </Grid>

      <Grid columns={2}>
        <AssistantPanel title="Assistant" messages={messages} onSend={() => {}} suggestions={["Show the cleaning contract", "Who owns renewals?"]} />
        <Card title="Agent run timeline">
          <RunTimeline
            label="Sample run"
            steps={[
              { id: "1", label: "Read the tender brief", status: "done", meta: "1.2s", detail: "38 pages" },
              { id: "2", label: "Search the policy library", status: "done", meta: "0.8s", detail: "4 matches" },
              { id: "3", label: "Draft the compliance matrix", status: "running", detail: "Section 3 of 7" },
              { id: "4", label: "Ask a reviewer to approve", status: "pending" },
              { id: "5", label: "Send to the bid team", status: "pending" },
            ]}
          />
          <div className={styles.spacer} />
          <RunTimeline
            label="Failed sample run"
            steps={[
              { id: "1", label: "Fetch the order", status: "done", meta: "0.3s" },
              { id: "2", label: "Issue the refund", status: "failed", detail: "The payment service refused the request." },
              { id: "3", label: "Email the customer", status: "skipped" },
            ]}
          />
        </Card>
      </Grid>

      <Grid columns={2}>
        <Card title="Document upload" subtitle="Files stay in your browser on this page">
          <Stack gap={3}>
            <DocumentDropzone
              accept=".pdf,.txt,.md,.csv,.json,image/*"
              maxSizeBytes={10 * 1024 * 1024}
              onFiles={(added) => {
                setFiles((current) => [...current, ...added]);
                setSelected(added[0] ?? null);
                setRejections([]);
              }}
              onReject={(rejected) => setRejections(rejected.map((r) => r.reason))}
              description="PDF, text or images, or click to choose"
            />
            {rejections.length > 0 && <Alert tone="warning" title="Some files were skipped">{rejections.join(" ")}</Alert>}
            <DocumentList
              documents={picked.length ? picked : sampleDocuments}
              selectedId={selected ? picked.find((item) => item.name === selected.name)?.id : null}
              onSelect={(item) => setSelected(files.find((file, index) => `${index}-${file.name}` === item.id) ?? null)}
            />
          </Stack>
        </Card>
        <Card title="Document preview" padded={false}>
          <div className={styles.preview}>
            <DocumentPreview source={selected} />
          </div>
        </Card>
      </Grid>

      <Section title="Empty, loading and error states">
        <Grid columns={3}>
          <Card>
            <EmptyState title="No contracts yet" description="Upload one to get started." action={<Button size="sm">Upload</Button>} compact />
          </Card>
          <Card>
            <LoadingState label="Loading contracts" compact />
            <Stack gap={2}>
              <Skeleton width="80%" />
              <Skeleton width="55%" />
            </Stack>
          </Card>
          <Card>
            <ErrorState message="The server didn't answer. Check your connection." onRetry={() => {}} compact />
          </Card>
        </Grid>
        <Stack gap={2}>
          <Alert tone="info" title="Info">Something worth knowing.</Alert>
          <Alert tone="success" title="Saved">Your changes are live.</Alert>
          <Alert tone="warning" title="AI not connected">Set MAITENTO_API_KEY and MAITENTO_NAMESPACE.</Alert>
          <Alert tone="danger" title="Couldn't save">The record was changed by someone else.</Alert>
          <Alert tone="ai" title="Written by AI">Check it before you send it.</Alert>
          <Card title="Inside a card">
            <Alert tone="warning" flush>
              On a card's own surface an alert is flush: no box inside the box.
            </Alert>
          </Card>
        </Stack>
      </Section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="A dialog"
        description="Escape, the backdrop and the close button all close it."
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setDialogOpen(false)}>
              Confirm
            </Button>
          </>
        }
      >
        <p>Put a form or a confirmation here.</p>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card title={title}>
      <Stack gap={4}>{children}</Stack>
    </Card>
  );
}
