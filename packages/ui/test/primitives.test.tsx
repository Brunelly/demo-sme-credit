import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Alert, Avatar, Button, Card, Dialog, Field, FilterChips, Input, initials } from "../src/index.ts";

describe("Button", () => {
  it("is disabled and busy while loading, so a second click can't fire", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("defaults to type=button, so it never submits a form by accident", () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("Alert", () => {
  it("announces itself as a status, or an alert for danger, boxed or flush", () => {
    render(
      <>
        <Alert tone="warning" flush>
          AI not connected.
        </Alert>
        <Alert tone="danger" title="Couldn't save" />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("AI not connected.");
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save");
  });
});

describe("Field", () => {
  it("labels its control and announces the error", () => {
    render(
      <Field label="Title" hint="Short and specific" error="Give it a title">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Give it a title");
    expect(screen.getByRole("alert")).toHaveTextContent("Give it a title");
  });

  it("shows the hint when there is no error", () => {
    render(
      <Field label="Title" hint="Short and specific">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText("Title")).toHaveAccessibleDescription("Short and specific");
  });
});

describe("Card", () => {
  it("is a region named by its title", () => {
    render(<Card title="Open tickets">rows</Card>);
    expect(screen.getByRole("region", { name: "Open tickets" })).toHaveTextContent("rows");
  });
});

describe("FilterChips", () => {
  it("marks the selected chip and reports a change", async () => {
    const onChange = vi.fn();
    render(
      <FilterChips
        label="Filter by status"
        value="all"
        onChange={onChange}
        options={[
          { value: "all", label: "All", count: 3 },
          { value: "open", label: "Open", count: 1 },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "All 3" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Open 1" }));
    expect(onChange).toHaveBeenCalledWith("open");
  });
});

describe("Dialog", () => {
  it("renders its content only while open, and closes from the close button", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Dialog open={false} onClose={onClose} title="New ticket">
        form
      </Dialog>,
    );
    expect(screen.queryByText("form")).not.toBeInTheDocument();

    rerender(
      <Dialog open onClose={onClose} title="New ticket">
        form
      </Dialog>,
    );
    expect(screen.getByText("form")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Avatar", () => {
  it("shows initials", () => {
    expect(initials("Maya Lindqvist")).toBe("ML");
    expect(initials("Cher")).toBe("CH");
    render(<Avatar name="Tomás Okafor" />);
    expect(screen.getByRole("img", { name: "Tomás Okafor" })).toHaveTextContent("TO");
  });
});
