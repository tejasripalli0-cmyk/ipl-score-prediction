/**
 * REAL end-to-end test: React pages -> axios -> live FastAPI -> the actual saved models.
 * Run with the backend up:  VITE_E2E_API=1 VITE_API_URL=http://127.0.0.1:8000 npm test
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import App from "../App";
import { AppProvider } from "../hooks/AppContext";

const E2E = import.meta.env.VITE_E2E_API as string | undefined;
const d = E2E ? describe : describe.skip;
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><AppProvider><App /></AppProvider></MemoryRouter>);

d("frontend <-> backend integration", () => {
  it("first-innings prediction round trip", async () => {
    renderAt("/score-predictor");
    const btn = await screen.findByRole("button", { name: /Predict final score/ });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(await screen.findByText(/Random Forest Regressor/, {}, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByText("Predicted final score")).toBeInTheDocument();
    expect(screen.getAllByText(/Likely range/).length).toBeGreaterThan(0);
    expect(screen.getByText("What is driving this estimate")).toBeInTheDocument();
  });
  it("second-innings prediction round trip", async () => {
    renderAt("/score-predictor");
    fireEvent.click(await screen.findByRole("radio", { name: "Second innings" }));
    const btn = await screen.findByRole("button", { name: /Predict final score/ });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    expect(await screen.findByText(/Predicted to (reach|fall short)/, {}, { timeout: 20000 })).toBeInTheDocument();
    expect(screen.getByText(/Linear Regression/)).toBeInTheDocument();
  });
  it("win probability round trip, probabilities add to 100", async () => {
    renderAt("/win-probability");
    const btn = await screen.findByRole("button", { name: /Calculate win probability/ });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    const meter = await screen.findByRole("meter", {}, { timeout: 20000 });
    const bat = Number(meter.getAttribute("aria-valuenow"));
    expect(bat).toBeGreaterThan(0); expect(bat).toBeLessThan(100);
    const pcts = Array.from(document.querySelectorAll(".font-display.text-5xl")).map((e) => parseFloat(e.textContent ?? "0"));
    expect(pcts[0] + pcts[1]).toBeCloseTo(100, 1);
    expect(screen.getAllByText(/not a guarantee/).length).toBeGreaterThan(0);
  });
  it("client validation blocks impossible input", async () => {
    renderAt("/score-predictor");
    const wk = await screen.findByLabelText("Current wickets");
    fireEvent.change(wk, { target: { value: "12" } });
    expect(await screen.findByText(/Wickets must be 0 to 9|All out/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Predict final score/ })).toBeDisabled();
  });
  it("team analytics loads real analytics from the API", async () => {
    renderAt("/team-analytics");
    expect((await screen.findAllByText(/Win percentage/, {}, { timeout: 20000 })).length).toBeGreaterThan(0);
    expect(screen.getByText("Wins and losses by season")).toBeInTheDocument();
  });
  it("team comparison, venue, season and model pages load from the API", async () => {
    for (const [path, text] of [["/team-comparison", /Head-to-head/], ["/venue-analytics", /Batting-first wins/], ["/season-trends", /Most successful teams/], ["/model-insights", /Feature importance/]] as const) {
      const { unmount } = renderAt(path);
      expect(await screen.findByText(text, {}, { timeout: 20000 })).toBeInTheDocument();
      unmount();
    }
  });
});
