import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SharedPage } from "../pages/SharedPage";

const { readShared } = vi.hoisted(() => ({
  readShared: vi.fn().mockResolvedValue({
    id: "1",
    title: "Shared Doc",
    content: "Read only text",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
}));

vi.mock("../api/client", () => ({
  api: {
    readShared
  }
}));

describe("SharedPage", () => {
  it("renders shared content in read-only mode", async () => {
    render(
      <MemoryRouter initialEntries={["/shared/token123"]}>
        <Routes>
          <Route path="/shared/:token" element={<SharedPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(readShared).toHaveBeenCalledWith("token123"));

    expect(screen.getByText("Shared Doc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Read only text")).toHaveAttribute("readOnly");
  });
});
