import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AiTasksController } from '../../src/modules/jobs/ai-tasks.controller';
import { AiTasksService } from '../../src/modules/jobs/ai-tasks.service';

describe('Platform HTTP route wiring', () => {
  let app: INestApplication;
  const auth = { register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn(), logoutAll: jest.fn(), me: jest.fn(), requestPasswordReset: jest.fn(), resetPassword: jest.fn(), verifyEmail: jest.fn(), resendVerification: jest.fn() };
  const tasks = { create: jest.fn(), list: jest.fn(), get: jest.fn(), cancel: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [AuthController, AiTasksController], providers: [{ provide: AuthService, useValue: auth }, { provide: AiTasksService, useValue: tasks }] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: any, _res: any, next: () => void) => { req.user = { id: 'user-1' }; next(); });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it('wires registration through the versioned HTTP API', async () => {
    auth.register.mockResolvedValue({ accessToken: 'access', organization: { id: 'org-1' } });
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: 'user@example.com', password: 'a-secure-password' }).expect(201).expect(({ body }) => expect(body.organization.id).toBe('org-1'));
  });

  it('validates and creates a workspace AI task through HTTP', async () => {
    tasks.create.mockResolvedValue({ id: 'task-1', status: 'queued' });
    await request(app.getHttpServer()).post('/api/v1/workspaces/workspace-1/ai/tasks').send({ taskType: 'brief.generate', payload: { prompt: 'Create a brief' }, idempotencyKey: 'request-1' }).expect(201).expect(({ body }) => expect(body.status).toBe('queued'));
    expect(tasks.create).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ taskType: 'brief.generate' }), 'user-1');
  });

  it('rejects unsupported AI task types before service execution', async () => {
    await request(app.getHttpServer()).post('/api/v1/workspaces/workspace-1/ai/tasks').send({ taskType: 'unsafe.task', payload: {} }).expect(400);
  });
});
