import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { config } from '../config/index.js';
import { UserSessionPayload, LoginResponse } from '../types/auth.js';

export class AuthService {
  static async login(email: string, password: string): Promise<LoginResponse> {
    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      include: {
        role: true,
        organisation: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const payload: UserSessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      organisationId: user.organisationId,
    };

    const accessToken = jwt.sign(payload, config.jwtAccessSecret, {
      expiresIn: config.jwtAccessExpiry as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
      expiresIn: config.jwtRefreshExpiry as jwt.SignOptions['expiresIn'],
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  static verifyAccessToken(token: string): UserSessionPayload {
    try {
      return jwt.verify(token, config.jwtAccessSecret) as UserSessionPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  static async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as UserSessionPayload;

      // Verify user is still active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user || !user.isActive) {
        throw new Error('User inactive or not found');
      }

      const newPayload: UserSessionPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        organisationId: user.organisationId,
      };

      const newAccessToken = jwt.sign(newPayload, config.jwtAccessSecret, {
        expiresIn: config.jwtAccessExpiry as jwt.SignOptions['expiresIn'],
      });

      const newRefreshToken = jwt.sign(newPayload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiry as jwt.SignOptions['expiresIn'],
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }
}
