import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantPanel,
  ChatComposer,
  DataTable,
  DocumentDropzone,
  DocumentList,
  ErrorState,
  KpiTile,
  RunTimeline,
  formatBytes,
  type Column,
} from "../src/index.ts";

describe("ErrorState", () => {
  it("supports a localized retry label", () => {
    render(<ErrorState message="تعذر تحميل البيانات" onRetry={() => {}} retryLabel="أعد المحاولة" />);
    expect(screen.getByRole("button", { name: "أعد المحاولة" })).toBeInTheDocument();
  });
});

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name" },
  { key: "amount", header: "Amount", align: "end", render: (row) => `£${row.amount}` },
];

describe("DataTable", () => {
  it("renders rows and opens one on click or Enter", async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Invoices"
        columns={columns}
        rows={[
          { id: "1", name: "First", amount: 10 },
          { id: "2", name: "Second", amount: 20 },
        ]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );
    const table = screen.getByRole("table", { name: "Invoices" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("£20")).toBeInTheDocument();

    await userEvent.click(screen.getByText("First"));
    expect(onRowClick).toHaveBeenLastCalledWith({ id: "1", name: "First", amount: 10 });

    screen.getByText("Second").closest("tr")!.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenLastCalledWith({ id: "2", name: "Second", amount: 20 });
  });

  it("leaves Enter on a button inside a row to the button", async () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    const withAction: Column<Row>[] = [...columns, { key: "act", header: "", render: () => <button onClick={(e) => { e.stopPropagation(); onAction(); }}>Act</button> }];
    render(<DataTable caption="Invoices" columns={withAction} rows={[{ id: "1", name: "First", amount: 10 }]} rowKey={(r) => r.id} onRowClick={onRowClick} />);

    screen.getByRole("button", { name: "Act" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows the empty state, the error state with a retry, and a loading state", async () => {
    const { rerender } = render(<DataTable caption="Invoices" columns={columns} rows={[]} rowKey={(r) => r.id} empty="No invoices yet" />);
    expect(screen.getByText("No invoices yet")).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<DataTable caption="Invoices" columns={columns} rows={[]} rowKey={(r) => r.id} error="The server is down" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The server is down");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();

    rerender(<DataTable caption="Invoices" columns={columns} rows={[]} rowKey={(r) => r.id} loading />);
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });
});

describe("KpiTile", () => {
  it("shows the value and its change", () => {
    render(<KpiTile label="Open" value={12} delta={{ label: "+3 today", direction: "up", good: false }} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("+3 today")).toBeInTheDocument();
  });
});

describe("ChatComposer", () => {
  it("sends on Enter, keeps Shift+Enter for a new line, and clears", async () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    const box = screen.getByRole("textbox", { name: "Message" });

    await userEvent.type(box, "Line one{Shift>}{Enter}{/Shift}line two");
    expect(onSend).not.toHaveBeenCalled();
    await userEvent.type(box, "{Enter}");

    expect(onSend).toHaveBeenCalledWith("Line one\nline two");
    expect(box).toHaveValue("");
  });

  it("won't send while a reply is pending, or an empty message", async () => {
    const onSend = vi.fn();
    const { rerender } = render(<ChatComposer onSend={onSend} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    rerender(<ChatComposer onSend={onSend} pending />);
    await userEvent.type(screen.getByRole("textbox"), "Hello{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("AssistantPanel", () => {
  it("shows the conversation, marks AI answers, and sends a suggestion", async () => {
    const onSend = vi.fn();
    render(
      <AssistantPanel
        messages={[
          { id: "1", role: "user", content: "What's urgent?" },
          { id: "2", role: "assistant", content: "T-1001." },
        ]}
        suggestions={["Who raised it?"]}
        onSend={onSend}
      />,
    );
    const log = screen.getByRole("log");
    expect(log).toHaveTextContent("What's urgent?");
    expect(log).toHaveTextContent("AIT-1001.");

    await userEvent.click(screen.getByRole("button", { name: "Who raised it?" }));
    expect(onSend).toHaveBeenCalledWith("Who raised it?");
  });

  it("says when it is thinking", () => {
    render(<AssistantPanel messages={[]} pending onSend={() => {}} />);
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
  });
});

describe("RunTimeline", () => {
  it("lists each step with its status for screen readers", () => {
    render(
      <RunTimeline
        label="Assistant run"
        steps={[
          { id: "a", label: "Read the ticket", status: "done" },
          { id: "b", label: "Draft the answer", status: "running" },
          { id: "c", label: "Send it", status: "pending" },
        ]}
      />,
    );
    const items = within(screen.getByRole("list", { name: "Assistant run" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Read the ticket: Done", "Draft the answer: Running", "Send it: Waiting"]);
  });
});

describe("DocumentDropzone", () => {
  it("passes on accepted files and rejects the wrong type or size", () => {
    const onFiles = vi.fn();
    const onReject = vi.fn();
    render(<DocumentDropzone onFiles={onFiles} onReject={onReject} accept=".pdf,image/*" maxSizeBytes={1024} />);

    const pdf = new File(["%PDF"], "rfp.pdf", { type: "application/pdf" });
    const big = new File(["x".repeat(2048)], "photo.png", { type: "image/png" });
    const exe = new File(["MZ"], "setup.exe", { type: "application/octet-stream" });
    fireEvent.change(screen.getByTestId("document-input"), { target: { files: [pdf, big, exe] } });

    expect(onFiles).toHaveBeenCalledWith([pdf]);
    expect(onReject.mock.calls[0]![0].map((r: { file: File }) => r.file.name)).toEqual(["photo.png", "setup.exe"]);
  });

  it("is a keyboard-reachable button", () => {
    render(<DocumentDropzone onFiles={() => {}} />);
    expect(screen.getByRole("button", { name: /Drop documents here/ })).toHaveAttribute("tabindex", "0");
  });
});

describe("DocumentList", () => {
  it("shows each document's size and status", () => {
    render(<DocumentList documents={[{ id: "1", name: "rfp.pdf", size: 2_400_000, type: "application/pdf", status: "reading" }]} />);
    expect(screen.getByText("rfp.pdf")).toBeInTheDocument();
    expect(screen.getByText("2.3 MB")).toBeInTheDocument();
    expect(screen.getByText("Reading")).toBeInTheDocument();
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});
