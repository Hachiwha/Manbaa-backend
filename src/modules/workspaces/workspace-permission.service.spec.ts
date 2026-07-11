import { ForbiddenException } from "@nestjs/common";
import { WorkspaceRole } from "./entities/workspace-member.entity";
import { WorkspacePermissionService } from "./workspace-permission.service";

describe("WorkspacePermissionService", () => {
  it.each([
    [WorkspaceRole.OWNER, true, true, true],
    [WorkspaceRole.ADMIN, true, true, true],
    [WorkspaceRole.EDITOR, true, true, false],
    [WorkspaceRole.COMMENTER, true, false, false],
    [WorkspaceRole.VIEWER, true, false, false],
  ])("enforces the %s permission matrix", async (role, read, edit, manage) => {
    const repo = {
      exist: jest.fn(({ where }) =>
        Promise.resolve(where.role._value.includes(role)),
      ),
      findOne: jest.fn(),
    };
    const service = new WorkspacePermissionService(repo as never, {} as never);
    await expect(service.canRead("u", "w")).resolves.toBe(read);
    await expect(service.canEdit("u", "w")).resolves.toBe(edit);
    await expect(service.canManageMembers("u", "w")).resolves.toBe(manage);
  });
  it("fails closed for missing membership", async () => {
    const service = new WorkspacePermissionService(
      { findOne: jest.fn().mockResolvedValue(null) } as never,
      {} as never,
    );
    await expect(service.requireMember("u", "w")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("requires an editor role in the authenticated organization", async () => {
    const member = {
      userId: "u",
      workspaceId: "w",
      organizationId: "org-a",
      role: WorkspaceRole.EDITOR,
    };
    const findOne = jest.fn(({ where }) =>
      Promise.resolve(
        where.organizationId === member.organizationId ? member : null,
      ),
    );
    const organizationMembers = {
      findOne: jest.fn().mockResolvedValue({ active: true }),
    };
    const service = new WorkspacePermissionService(
      { findOne } as never,
      organizationMembers as never,
    );

    await expect(service.requireEditor("u", "w", "org-a")).resolves.toBe(
      member,
    );
    await expect(
      service.requireEditor("u", "w", "org-b"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "u",
        workspaceId: "w",
        organizationId: "org-a",
      }),
    });
    expect(organizationMembers.findOne).toHaveBeenCalledWith({
      where: { userId: "u", organizationId: "org-a", active: true },
    });
  });

  it("rejects an inactive organization member even with an editor workspace role", async () => {
    const service = new WorkspacePermissionService(
      {
        findOne: jest.fn().mockResolvedValue({ role: WorkspaceRole.EDITOR }),
      } as never,
      { findOne: jest.fn().mockResolvedValue(null) } as never,
    );

    await expect(service.requireEditor("u", "w", "org")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    [WorkspaceRole.OWNER, true],
    [WorkspaceRole.ADMIN, true],
    [WorkspaceRole.EDITOR, true],
    [WorkspaceRole.COMMENTER, false],
    [WorkspaceRole.VIEWER, false],
  ])("source upload authorization for %s is %s", async (role, allowed) => {
    const member = {
      userId: "u",
      workspaceId: "w",
      organizationId: "org",
      role,
    };
    const findOne = jest.fn(({ where }) =>
      Promise.resolve(where.role._value.includes(role) ? member : null),
    );
    const service = new WorkspacePermissionService(
      { findOne } as never,
      { findOne: jest.fn().mockResolvedValue({ active: true }) } as never,
    );
    const result = service.requireEditor("u", "w", "org");
    if (allowed) await expect(result).resolves.toBe(member);
    else await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  });
});
