import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "../use-auth";
import * as actions from "@/actions";
import * as anonWorkTracker from "@/lib/anon-work-tracker";
import * as getProjectsAction from "@/actions/get-projects";
import * as createProjectAction from "@/actions/create-project";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("initial state", () => {
    test("returns isLoading as false initially", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
    });

    test("returns signIn and signUp functions", () => {
      const { result } = renderHook(() => useAuth());

      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn", () => {
    test("calls signIn action with email and password", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("test@example.com", "password123");
      });

      expect(actions.signIn).toHaveBeenCalledWith(
        "test@example.com",
        "password123"
      );
    });

    test("sets isLoading to true during sign in", async () => {
      let resolveSignIn: (value: any) => void;
      const signInPromise = new Promise((resolve) => {
        resolveSignIn = resolve;
      });

      vi.mocked(actions.signIn).mockReturnValue(signInPromise as any);

      const { result } = renderHook(() => useAuth());

      let signInPromiseResult: Promise<any>;
      act(() => {
        signInPromiseResult = result.current.signIn(
          "test@example.com",
          "password123"
        );
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn!({ success: false });
        await signInPromiseResult;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signIn action", async () => {
      const expectedResult = { success: true };
      vi.mocked(actions.signIn).mockResolvedValue(expectedResult);
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjectsAction.getProjects).mockResolvedValue([]);
      vi.mocked(createProjectAction.createProject).mockResolvedValue({
        id: "new-project",
        name: "Test",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
      });

      const { result } = renderHook(() => useAuth());

      let returnedResult: any;
      await act(async () => {
        returnedResult = await result.current.signIn(
          "test@example.com",
          "password123"
        );
      });

      expect(returnedResult).toEqual(expectedResult);
    });

    test("sets isLoading to false even when signIn fails", async () => {
      vi.mocked(actions.signIn).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signIn("test@example.com", "password123");
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("post sign in behavior", () => {
      test("redirects to new project with anonymous work data when available", async () => {
        vi.mocked(actions.signIn).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue({
          messages: [{ id: "1", role: "user", content: "Hello" }],
          fileSystemData: { "/App.tsx": "content" },
        });
        vi.mocked(createProjectAction.createProject).mockResolvedValue({
          id: "anon-project-id",
          name: "Design from time",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProjectAction.createProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: [{ id: "1", role: "user", content: "Hello" }],
          data: { "/App.tsx": "content" },
        });
        expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
      });

      test("redirects to most recent project when no anonymous work", async () => {
        vi.mocked(actions.signIn).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjectsAction.getProjects).mockResolvedValue([
          {
            id: "existing-project-1",
            name: "Existing Project",
            messages: "[]",
            data: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: "user-1",
          },
          {
            id: "existing-project-2",
            name: "Older Project",
            messages: "[]",
            data: "{}",
            createdAt: new Date(),
            updatedAt: new Date(),
            userId: "user-1",
          },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockPush).toHaveBeenCalledWith("/existing-project-1");
        expect(createProjectAction.createProject).not.toHaveBeenCalled();
      });

      test("creates new project when no anonymous work and no existing projects", async () => {
        vi.mocked(actions.signIn).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjectsAction.getProjects).mockResolvedValue([]);
        vi.mocked(createProjectAction.createProject).mockResolvedValue({
          id: "brand-new-project",
          name: "New Design",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(createProjectAction.createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
      });

      test("does not redirect when sign in fails", async () => {
        vi.mocked(actions.signIn).mockResolvedValue({
          success: false,
          error: "Invalid credentials",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "wrongpassword");
        });

        expect(mockPush).not.toHaveBeenCalled();
        expect(anonWorkTracker.getAnonWorkData).not.toHaveBeenCalled();
      });

      test("ignores empty anonymous work messages", async () => {
        vi.mocked(actions.signIn).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        vi.mocked(getProjectsAction.getProjects).mockResolvedValue([]);
        vi.mocked(createProjectAction.createProject).mockResolvedValue({
          id: "new-project",
          name: "New Design",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        // Should not use anon work data when messages are empty
        expect(anonWorkTracker.clearAnonWork).not.toHaveBeenCalled();
        // Should fall through to creating new project
        expect(createProjectAction.createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
      });
    });
  });

  describe("signUp", () => {
    test("calls signUp action with email and password", async () => {
      vi.mocked(actions.signUp).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "newpassword123");
      });

      expect(actions.signUp).toHaveBeenCalledWith(
        "new@example.com",
        "newpassword123"
      );
    });

    test("sets isLoading to true during sign up", async () => {
      let resolveSignUp: (value: any) => void;
      const signUpPromise = new Promise((resolve) => {
        resolveSignUp = resolve;
      });

      vi.mocked(actions.signUp).mockReturnValue(signUpPromise as any);

      const { result } = renderHook(() => useAuth());

      let signUpPromiseResult: Promise<any>;
      act(() => {
        signUpPromiseResult = result.current.signUp(
          "new@example.com",
          "newpassword123"
        );
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignUp!({ success: false });
        await signUpPromiseResult;
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("returns the result from signUp action", async () => {
      const expectedResult = { success: true };
      vi.mocked(actions.signUp).mockResolvedValue(expectedResult);
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjectsAction.getProjects).mockResolvedValue([]);
      vi.mocked(createProjectAction.createProject).mockResolvedValue({
        id: "new-project",
        name: "Test",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: null,
      });

      const { result } = renderHook(() => useAuth());

      let returnedResult: any;
      await act(async () => {
        returnedResult = await result.current.signUp(
          "new@example.com",
          "newpassword123"
        );
      });

      expect(returnedResult).toEqual(expectedResult);
    });

    test("sets isLoading to false even when signUp fails", async () => {
      vi.mocked(actions.signUp).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        try {
          await result.current.signUp("new@example.com", "newpassword123");
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.isLoading).toBe(false);
    });

    describe("post sign up behavior", () => {
      test("redirects to new project with anonymous work data when available", async () => {
        vi.mocked(actions.signUp).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue({
          messages: [{ id: "1", role: "user", content: "Create a button" }],
          fileSystemData: { "/Button.tsx": "export const Button = () => {}" },
        });
        vi.mocked(createProjectAction.createProject).mockResolvedValue({
          id: "signup-anon-project",
          name: "Design from time",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "new-user-1",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "newpassword123");
        });

        expect(createProjectAction.createProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: [{ id: "1", role: "user", content: "Create a button" }],
          data: { "/Button.tsx": "export const Button = () => {}" },
        });
        expect(anonWorkTracker.clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/signup-anon-project");
      });

      test("creates new project for new user with no anonymous work", async () => {
        vi.mocked(actions.signUp).mockResolvedValue({ success: true });
        vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
        vi.mocked(getProjectsAction.getProjects).mockResolvedValue([]);
        vi.mocked(createProjectAction.createProject).mockResolvedValue({
          id: "new-user-project",
          name: "New Design",
          messages: "[]",
          data: "{}",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "new-user-1",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "newpassword123");
        });

        expect(createProjectAction.createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/new-user-project");
      });

      test("does not redirect when sign up fails", async () => {
        vi.mocked(actions.signUp).mockResolvedValue({
          success: false,
          error: "Email already registered",
        });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("existing@example.com", "password123");
        });

        expect(mockPush).not.toHaveBeenCalled();
        expect(anonWorkTracker.getAnonWorkData).not.toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    test("signIn propagates errors from action", async () => {
      const error = new Error("Server error");
      vi.mocked(actions.signIn).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Server error");
    });

    test("signUp propagates errors from action", async () => {
      const error = new Error("Server error");
      vi.mocked(actions.signUp).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@example.com", "newpassword123");
        })
      ).rejects.toThrow("Server error");
    });

    test("handles createProject error during post sign in", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "Hello" }],
        fileSystemData: {},
      });
      vi.mocked(createProjectAction.createProject).mockRejectedValue(
        new Error("Failed to create project")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Failed to create project");

      expect(result.current.isLoading).toBe(false);
    });

    test("handles getProjects error during post sign in", async () => {
      vi.mocked(actions.signIn).mockResolvedValue({ success: true });
      vi.mocked(anonWorkTracker.getAnonWorkData).mockReturnValue(null);
      vi.mocked(getProjectsAction.getProjects).mockRejectedValue(
        new Error("Failed to fetch projects")
      );

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("test@example.com", "password123");
        })
      ).rejects.toThrow("Failed to fetch projects");

      expect(result.current.isLoading).toBe(false);
    });
  });
});
