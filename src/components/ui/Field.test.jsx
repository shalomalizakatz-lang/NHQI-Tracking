import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Field from "./Field.jsx";

describe("Field", () => {
  it("associates the label with the input via htmlFor/id, not a placeholder", () => {
    render(<Field label="Contract/agency staff" unit="%" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Contract/agency staff");
    expect(input).toBeInTheDocument();
  });

  it("wires an error through aria-describedby and aria-invalid", () => {
    render(<Field label="Falls" error="Enter a value from 0 to 100" value="150" onChange={() => {}} />);
    const input = screen.getByLabelText("Falls");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a value from 0 to 100");
    expect(input.getAttribute("aria-describedby")).toContain(screen.getByRole("alert").id);
  });

  it("wires a hint (not an error) through aria-describedby when there's no error", () => {
    render(<Field label="HPRD" hint="Hours per resident day" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("HPRD");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).toHaveAttribute("aria-describedby");
  });
});
