import { Response, NextFunction } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db, users, workspaces } from '../db/index.js';
import { AuthenticatedRequest } from './auth.js';

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspace?: {
    id: string;
    name: string;
    ownerId: string;
    monthlyQuota: number;
    usedQuota: number;
    timezone: string;
  };
  userRole?: string;
}

export async function requireWorkspace(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any)._parsedAuth?.userId;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not authenticated' },
    });
    return;
  }

  // Check if workspace is already resolved from earlier middleware on this request
  const headerWsId = (req.headers['x-workspace-id'] as string) || (req.query.workspaceId as string);
  const existingWs = (req as WorkspaceRequest).workspace;
  if (existingWs && (!headerWsId || existingWs.id === headerWsId)) {
    return next();
  }

  try {
    if (headerWsId) {
      // Verify user membership in this explicit workspace
      const userRecord = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), eq(users.workspaceId, headerWsId)))
        .limit(1);

      if (userRecord.length === 0) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this workspace',
          },
        });
        return;
      }

      const ws = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, headerWsId))
        .limit(1);

      if (ws.length === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Workspace not found' },
        });
        return;
      }

      const wsReq = req as WorkspaceRequest;
      wsReq.workspace = ws[0];
      wsReq.userRole = userRecord[0].role;
      return next();
    }

    // Default: find the user's first/primary workspace
    let userRecords = await db
      .select({
        userRole: users.role,
        workspace: workspaces,
      })
      .from(users)
      .innerJoin(workspaces, eq(users.workspaceId, workspaces.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecords.length === 0) {
      // Fallback 1: check if the user is ownerId on any workspace directly
      const ownedWs = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerId, userId))
        .limit(1);

      const userEmail = (req as any)._parsedAuth?.userEmail || `${userId}@user.local`;
      if (ownedWs.length > 0) {
        await db
          .insert(users)
          .values({
            id: userId,
            workspaceId: ownedWs[0].id,
            name: 'Workspace Owner',
            email: userEmail,
            role: 'owner',
          })
          .onConflictDoUpdate({
            target: users.id,
            set: { workspaceId: ownedWs[0].id, role: 'owner' },
          });

        const wsReq = req as WorkspaceRequest;
        wsReq.workspace = ownedWs[0];
        wsReq.userRole = 'owner';
        return next();
      }

      res.status(404).json({
        success: false,
        error: {
          code: 'WORKSPACE_NOT_FOUND',
          message: 'No workspace found for this user. Please create one.',
        },
      });
      return;
    }

    const wsReq = req as WorkspaceRequest;
    wsReq.workspace = userRecords[0].workspace;
    wsReq.userRole = userRecords[0].userRole;
    next();
  } catch (error) {
    console.error('Error verifying workspace access:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to verify workspace' },
    });
  }
}
