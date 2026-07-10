import registry = require('../../../contracts/nats-subjects.json');
import { SUBJECTS_V2, SUBJECT_COMPATIBILITY } from './subjects';

describe('canonical NATS subject registry', () => {
  it('matches the TypeScript canonical subjects exactly', () => {
    expect(new Set(registry.subjects)).toEqual(new Set(Object.values(SUBJECTS_V2)));
  });
  it('matches every legacy compatibility mapping', () => {
    expect(registry.compatibility).toEqual(SUBJECT_COMPATIBILITY);
  });
});
