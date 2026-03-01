import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DrivePage } from "../pages/DrivePage";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    listDocuments: vi.fn().mockResolvedValue([]),
    listTrash: vi.fn().mockResolvedValue([]),
    createDocument: vi.fn().mockResolvedValue({}),
    updateDocument: vi.fn().mockResolvedValue({}),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    cloneDocument: vi.fn().mockResolvedValue({}),
    restoreDocument: vi.fn().mockResolvedValue({}),
    emptyTrash: vi.fn().mockResolvedValue({ deletedCount: 0 })
  }
}));

vi.mock("../api/client", () => ({
  api: apiMock
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "1", displayName: "Tester" },
    logout: vi.fn().mockResolvedValue(undefined)
  })
}));

describe("DrivePage", () => {
  it("calls create document action", async () => {
    render(
      <MemoryRouter>
        <DrivePage />
      </MemoryRouter>
    );

    await waitFor(() => expect(apiMock.listDocuments).toHaveBeenCalled());
    await waitFor(() => expect(apiMock.listTrash).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Document title"), { target: { value: "My doc" } });
    fireEvent.click(screen.getByRole("button", { name: "Create document" }));

    await waitFor(() => {
      expect(apiMock.createDocument).toHaveBeenCalledWith({ title: "My doc", content: "" });
    });
  });
});
