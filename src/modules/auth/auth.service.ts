import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../database/enums';
import { OrganizationMember, OrganizationRole } from '../organizations/entities/organization-member.entity';
import { Organization } from './entities/organization.entity';
import { LoginHistory } from './entities/login-history.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordService } from './password.service';

type ClientMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(LoginHistory) private readonly loginHistory: Repository<LoginHistory>,
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.exist({ where: { email } })) throw new ConflictException('Email is already registered');
    const passwordHash = await this.passwords.hash(dto.password);
    const result = await this.dataSource.transaction(async (manager) => {
      const organization = await manager.save(manager.create(Organization, {
        name: `${email.split('@')[0]}'s workspace ${randomUUID().slice(0, 8)}`,
      }));
      const user = await manager.save(manager.create(User, {
        email, passwordHash, orgId: organization.id, role: UserRole.ADMIN, isVerified: false, isActive: true,
      }));
      await manager.save(manager.create(OrganizationMember, {
        organizationId: organization.id, userId: user.id, role: OrganizationRole.OWNER, active: true,
      }));
      return { user, organization };
    });
    await this.recordLogin(result.user.id, true, meta);
    return { ...(await this.issueTokenPair(result.user, randomUUID())), organization: result.organization };
  }

  async login(dto: LoginDto, meta: ClientMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users.findOne({ where: { email } });
    const valid = !!user && user.isActive && await this.passwords.verify(user.passwordHash, dto.password);
    await this.recordLogin(user?.id ?? null, valid, meta);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokenPair(user, randomUUID());
  }

  async refresh(rawToken: string) {
    let payload: { sub: string; tokenId: string; familyId: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(rawToken, { secret: this.config.getOrThrow('jwt.refreshSecret') });
    } catch { throw new UnauthorizedException('Invalid refresh token'); }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');
    return this.dataSource.transaction(async (manager) => {
      const token = await manager.findOne(RefreshToken, { where: { id: payload.tokenId } });
      if (!token || token.tokenHash !== this.sha256(rawToken) || token.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (token.revoked) {
        await manager.update(RefreshToken, { familyId: token.familyId }, { revoked: true, revokedAt: new Date() });
        throw new UnauthorizedException('Refresh token reuse detected');
      }
      token.revoked = true;
      token.revokedAt = new Date();
      const user = await manager.findOneByOrFail(User, { id: payload.sub, isActive: true });
      const pair = await this.issueTokenPair(user, token.familyId, manager.getRepository(RefreshToken));
      token.replacedByTokenId = pair.refreshTokenId;
      await manager.save(token);
      return { accessToken: pair.accessToken, refreshToken: pair.refreshToken };
    });
  }

  async logout(rawToken: string): Promise<void> {
    await this.refreshTokens.update({ tokenHash: this.sha256(rawToken) }, { revoked: true, revokedAt: new Date() });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.update({ userId }, { revoked: true, revokedAt: new Date() });
  }

  async me(userId: string) {
    const user = await this.users.findOneByOrFail({ id: userId });
    return { id: user.id, email: user.email, isVerified: user.isVerified, createdAt: user.createdAt };
  }

  async requestPasswordReset(emailInput: string) {
    const user = await this.users.findOne({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user) return { accepted: true };
    const token = randomBytes(32).toString('base64url');
    user.passwordResetTokenHash = this.sha256(token);
    user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60_000);
    await this.users.save(user);
    return { accepted: true, ...(this.config.get('nodeEnv') === 'production' ? {} : { token }) };
  }

  async resetPassword(token: string, password: string) {
    const user = await this.users.findOne({ where: { passwordResetTokenHash: this.sha256(token) } });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
    user.passwordHash = await this.passwords.hash(password);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(user);
      await manager.update(RefreshToken, { userId: user.id }, { revoked: true, revokedAt: new Date() });
    });
    return { reset: true };
  }

  async verifyEmail(token: string) {
    const user = await this.users.findOne({ where: { emailVerificationTokenHash: this.sha256(token) } });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }
    user.isVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await this.users.save(user);
    return { verified: true };
  }

  async resendVerification(emailInput: string) {
    const user = await this.users.findOne({ where: { email: emailInput.trim().toLowerCase() } });
    if (!user || user.isVerified) return { accepted: true };
    const token = randomBytes(32).toString('base64url');
    user.emailVerificationTokenHash = this.sha256(token);
    user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    await this.users.save(user);
    return { accepted: true, ...(this.config.get('nodeEnv') === 'production' ? {} : { token }) };
  }

  private async issueTokenPair(user: User, familyId: string, repository = this.refreshTokens) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, orgId: user.orgId, role: user.role, type: 'access' },
      { secret: this.config.getOrThrow('jwt.accessSecret'), expiresIn: this.config.get('jwt.accessTtl', '15m') },
    );
    const refreshTokenId = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, tokenId: refreshTokenId, familyId, type: 'refresh' },
      { secret: this.config.getOrThrow('jwt.refreshSecret'), expiresIn: this.config.get('jwt.refreshTtl', '7d') },
    );
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await repository.save(repository.create({
      id: refreshTokenId, userId: user.id, familyId, tokenHash: this.sha256(refreshToken),
      expiresAt: new Date(decoded.exp * 1000), revoked: false, revokedAt: null, replacedByTokenId: null,
    }));
    return { accessToken, refreshToken, refreshTokenId };
  }

  private recordLogin(userId: string | null, success: boolean, meta: ClientMeta) {
    return this.loginHistory.save(this.loginHistory.create({ userId, success, ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent ?? null }));
  }

  private sha256(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
