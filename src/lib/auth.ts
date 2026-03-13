import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { prisma } from './prisma';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
}
const JWT_SECRET: string = jwtSecret;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

export interface JwtPayload {
    id: string;
    email: string;
    role: string;
    name: string;
    sessionVersion: number;
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: string;
    name: string;
    avatar?: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    sessionVersion: number;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(password, hashed);
}

export function validatePassword(password: string): string | null {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
    }

    return null;
}

export function calculateLockoutExpiry(from = new Date()): Date {
    return new Date(from.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
}

export function getLockoutMessage(lockedUntil: Date, now = new Date()): string {
    const remainingMs = Math.max(lockedUntil.getTime() - now.getTime(), 0);
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
    return `Too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`;
}

export function createToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
        return null;
    }
}

async function resolveAuthenticatedUser(token: string): Promise<AuthenticatedUser | null> {
    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: {
            id: true,
            email: true,
            role: true,
            name: true,
            avatar: true,
            isActive: true,
            mustChangePassword: true,
            sessionVersion: true,
        },
    });

    if (!user || !user.isActive) return null;
    if (user.sessionVersion !== payload.sessionVersion) return null;

    return user;
}

export async function getRequestUser(req: NextRequest): Promise<AuthenticatedUser | null> {
    const token = req.cookies.get('rms-token')?.value;
    if (!token) return null;
    return resolveAuthenticatedUser(token);
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('rms-token')?.value;
    if (!token) return null;
    return resolveAuthenticatedUser(token);
}
