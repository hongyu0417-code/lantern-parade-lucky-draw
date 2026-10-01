import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the Lantern Parade draw screen", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /lucky draw/i })).toBeInTheDocument();
  });
});
