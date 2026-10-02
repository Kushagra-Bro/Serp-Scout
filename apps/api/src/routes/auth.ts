import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users, workspaces } from '../db/index.js';
import { hashPassword, comparePassword, signUserToken, verifyUserToken } from '../lib/auth.js';
import { requireAuthenticatedUser, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  workspaceName: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

// POST /api/auth/sign-up
router.post('/sign-up', async (req: Request, res: Response): Promise<void> => {
  const parse = signUpSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parse.error.issues[0]?.message || 'Invalid input' },
    });
    return;
  }

  const { name, email, password, workspaceName } = parse.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
      });
      return;
    }

    // 1. Create Workspace
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: workspaceName || `${name.split(' ')[0]}'s Workspace`,
        ownerId: userId,
        monthlyQuota: 500,
        usedQuota: 0,
        refreshCadence: 'weekly',
      })
      .returning();

    // 2. Hash password & create user
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        id: userId,
        workspaceId: workspace.id,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: 'owner',
      })
      .returning();

    // 3. Issue Token
    const token = await signUserToken({
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      workspaceId: workspace.id,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
      },
    });
  } catch (err: any) {
    console.error('Sign-up error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Could not register user' },
    });
  }
});

// POST /api/auth/sign-in
router.post('/sign-in', async (req: Request, res: Response): Promise<void> => {
  const parse = signInSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parse.error.issues[0]?.message || 'Invalid credentials' },
    });
    return;
  }

  const { email, password } = parse.data;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user || !user.passwordHash) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const token = await signUserToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceId: user.workspaceId,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        workspaceId: user.workspaceId,
      },
    });
  } catch (err: any) {
    console.error('Sign-in error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Could not authenticate user' },
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req._parsedAuth?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
        },
        workspaceId: user.workspaceId,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Error fetching user' },
    });
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name cannot be empty').max(255).optional(),
  avatarUrl: z.string().nullable().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').optional(),
});

// PATCH /api/auth/profile - Update user profile & password
router.patch('/profile', requireAuthenticatedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req._parsedAuth?.userId;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
    return;
  }

  const parseResult = updateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data', details: parseResult.error.format() },
    });
    return;
  }

  const { name, avatarUrl, currentPassword, newPassword } = parseResult.data;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    const updates: Record<string, any> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl && avatarUrl.trim().length > 0 ? avatarUrl.trim() : null;
    }

    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_REQUIRED', message: 'Current password is required to set a new password' },
        });
        return;
      }

      if (!user.passwordHash) {
        res.status(400).json({
          success: false,
          error: { code: 'PASSWORD_NOT_SET', message: 'No existing password on file' },
        });
        return;
      }

      const isMatch = await comparePassword(currentPassword, user.passwordHash);
      if (!isMatch) {
        res.status(400).json({
          success: false,
          error: { code: 'INCORRECT_PASSWORD', message: 'Current password does not match' },
        });
        return;
      }

      updates.passwordHash = await hashPassword(newPassword);
    }

    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    res.json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          avatarUrl: updatedUser.avatarUrl,
        },
      },
    });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to update profile' },
    });
  }
});

export default router;
