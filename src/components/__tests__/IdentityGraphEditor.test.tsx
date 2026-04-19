import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import IdentityGraphEditor from "../IdentityGraphEditor";
import { dnaRegistry } from "@/services/neural-dna/Registry";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { identity_chronicle: { nodes: [], edges: [] } }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock Sonner (toast)
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("IdentityGraphEditor", () => {
  const brainId = "test-brain-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the cognitive mapping state initially", async () => {
    render(<IdentityGraphEditor brainId={brainId} />);
    expect(screen.getByText(/Mapeando rede semântica/i)).toBeInTheDocument();
  });

  it("should allow adding a new axiom using the Neural DNA Engine", async () => {
    const engine = dnaRegistry.getEngine();
    const createNodeSpy = vi.spyOn(engine, "createNode");

    render(<IdentityGraphEditor brainId={brainId} />);
    
    // Wait for loader to disappear (mocked promise resolves)
    const axiomButton = await screen.findByText(/Injetar Axioma/i);
    fireEvent.click(axiomButton);

    expect(createNodeSpy).toHaveBeenCalledWith("Novo Axioma", "axiom");
  });

  it("should trigger synchronization (save) and call validation", async () => {
    const engine = dnaRegistry.getEngine();
    const validateSpy = vi.spyOn(engine, "validate");

    render(<IdentityGraphEditor brainId={brainId} />);
    
    const syncButton = await screen.findByText(/Sincronizar DNA/i);
    fireEvent.click(syncButton);

    // Initial graph with 0 nodes should fail validation based on our SnaEngine rules
    // (Our SnaEngine.ts:36 requires at least one node)
    expect(validateSpy).toHaveBeenCalled();
  });
});
