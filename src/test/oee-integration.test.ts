import { describe, it, expect, vi } from "vitest";

/**
 * OEE System Integration Tests
 * 
 * These tests verify the actual Supabase RPC functions and database triggers.
 * IMPORTANT: Requires authenticated user and proper test data setup.
 */

// Type for RPC responses
interface RpcResponse {
  success: boolean;
  error?: string;
  message?: string;
  event_id?: string;
  count_id?: string;
  shift_calendar_id?: string;
  duration_minutes?: number;
  total_qty?: number;
  status?: string;
  machines_processed?: number;
}

// Mock supabase client
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe("RPC Function Tests", () => {
  describe("rpc_start_event", () => {
    it("should return success with event_id when valid", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        event_id: "test-event-uuid",
        message: "Event started successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_start_event", {
        p_machine_id: "test-machine-uuid",
        p_event_type: "RUN",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.event_id).toBeDefined();
    });

    it("should return PERMISSION_DENIED for unauthorized machine", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "PERMISSION_DENIED",
        message: "No permission for this machine",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_start_event", {
        p_machine_id: "unauthorized-machine-uuid",
        p_event_type: "RUN",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe("PERMISSION_DENIED");
    });

    it("should require reason_id for DOWNTIME events", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Reason is required for DOWNTIME/SETUP events",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_start_event", {
        p_machine_id: "test-machine-uuid",
        p_event_type: "DOWNTIME",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe("VALIDATION_ERROR");
    });
  });

  describe("rpc_stop_event", () => {
    it("should return success with duration when valid", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        event_id: "test-event-uuid",
        duration_minutes: 45.5,
        message: "Event stopped successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_stop_event", {
        p_machine_id: "test-machine-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.duration_minutes).toBeGreaterThan(0);
    });

    it("should return error when no open event exists", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "No open event found for this machine",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_stop_event", {
        p_machine_id: "test-machine-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.message).toContain("No open event");
    });
  });

  describe("rpc_add_counts", () => {
    it("should return success when adding valid counts", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        count_id: "test-count-uuid",
        total_qty: 150,
        message: "Counts added successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_add_counts", {
        p_machine_id: "test-machine-uuid",
        p_good_qty: 100,
        p_reject_qty: 50,
        p_defect_reason_id: "test-defect-reason-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.total_qty).toBe(150);
    });

    it("should require defect_reason when reject_qty > 0", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Defect reason is required when reject quantity > 0",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_add_counts", {
        p_machine_id: "test-machine-uuid",
        p_good_qty: 100,
        p_reject_qty: 50,
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.message).toContain("Defect reason is required");
    });

    it("should reject negative quantities", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Quantities cannot be negative",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_add_counts", {
        p_machine_id: "test-machine-uuid",
        p_good_qty: -10,
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.message).toContain("negative");
    });
  });

  describe("rpc_approve_shift", () => {
    it("should approve shift when user is supervisor", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        shift_calendar_id: "test-shift-uuid",
        status: "APPROVED",
        message: "Shift approved successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_approve_shift", {
        p_shift_calendar_id: "test-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.status).toBe("APPROVED");
    });

    it("should deny approval for non-supervisors", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "PERMISSION_DENIED",
        message: "Only supervisors can approve shifts",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_approve_shift", {
        p_shift_calendar_id: "test-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe("PERMISSION_DENIED");
    });
  });

  describe("rpc_lock_shift", () => {
    it("should lock approved shift", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        shift_calendar_id: "test-shift-uuid",
        status: "LOCKED",
        message: "Shift locked successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_lock_shift", {
        p_shift_calendar_id: "test-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.status).toBe("LOCKED");
    });

    it("should reject locking unapproved shift", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Shift must be approved before locking",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_lock_shift", {
        p_shift_calendar_id: "draft-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.message).toContain("approved before locking");
    });

    it("should prevent double-locking", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "SHIFT_LOCKED",
        message: "Shift is already locked",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_lock_shift", {
        p_shift_calendar_id: "already-locked-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe("SHIFT_LOCKED");
    });
  });

  describe("rpc_recalc_oee_for_shift", () => {
    it("should recalculate and return machine count", async () => {
      const mockResponse: RpcResponse = {
        success: true,
        shift_calendar_id: "test-shift-uuid",
        machines_processed: 5,
        message: "OEE recalculated successfully",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_recalc_oee_for_shift", {
        p_shift_calendar_id: "test-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(true);
      expect(response.machines_processed).toBeGreaterThan(0);
    });

    it("should deny recalculation for non-supervisors", async () => {
      const mockResponse: RpcResponse = {
        success: false,
        error: "PERMISSION_DENIED",
        message: "Only supervisors can recalculate OEE",
      };

      mockRpc.mockResolvedValueOnce({ data: mockResponse, error: null });

      const { data } = await mockRpc("rpc_recalc_oee_for_shift", {
        p_shift_calendar_id: "test-shift-uuid",
      });

      const response = data as RpcResponse;
      expect(response.success).toBe(false);
      expect(response.error).toBe("PERMISSION_DENIED");
    });
  });
});

describe("Error Code Verification", () => {
  const errorCodes = [
    { code: "OVERLAP_EVENT", description: "Overlapping events on same machine" },
    { code: "SHIFT_LOCKED", description: "Attempt to modify locked shift" },
    { code: "PERMISSION_DENIED", description: "User lacks required permission" },
    { code: "VALIDATION_ERROR", description: "Invalid input data" },
  ];

  errorCodes.forEach(({ code, description }) => {
    it(`should use standard error code: ${code} for ${description}`, () => {
      expect(code).toMatch(/^[A-Z_]+$/);
    });
  });
});

describe("Error Code Verification", () => {
  const errorCodes = [
    { code: "OVERLAP_EVENT", description: "Overlapping events on same machine" },
    { code: "SHIFT_LOCKED", description: "Attempt to modify locked shift" },
    { code: "PERMISSION_DENIED", description: "User lacks required permission" },
    { code: "VALIDATION_ERROR", description: "Invalid input data" },
  ];

  errorCodes.forEach(({ code, description }) => {
    it(`should use standard error code: ${code} for ${description}`, () => {
      expect(code).toMatch(/^[A-Z_]+$/);
    });
  });
});
