import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table, Th, TableRow } from "./Table.jsx";

describe("Th sortable header", () => {
  it("is a real, keyboard-activatable button with aria-sort reflecting state", async () => {
    const onSort = vi.fn();
    render(
      <Table>
        <thead>
          <TableRow>
            <Th sortKey="name" sort={{ key: "name", dir: "asc" }} onSort={onSort}>
              Facility
            </Th>
          </TableRow>
        </thead>
      </Table>
    );
    const header = screen.getByRole("columnheader", { name: /facility/i });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    const button = screen.getByRole("button", { name: /facility/i });
    await userEvent.tab();
    expect(button).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("reports aria-sort=none for a sortable column that isn't the active sort", () => {
    render(
      <Table>
        <thead>
          <TableRow>
            <Th sortKey="coverage" sort={{ key: "name", dir: "asc" }} onSort={() => {}}>
              Coverage
            </Th>
          </TableRow>
        </thead>
      </Table>
    );
    expect(screen.getByRole("columnheader", { name: /coverage/i })).toHaveAttribute("aria-sort", "none");
  });

  it("renders a plain, non-interactive header when no sortKey is given", () => {
    render(
      <Table>
        <thead>
          <TableRow>
            <Th>Remove</Th>
          </TableRow>
        </thead>
      </Table>
    );
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /remove/i })).not.toHaveAttribute("aria-sort");
  });
});
