import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteOnboardingProfileDto } from '../dto/complete-onboarding-profile.dto';

/** Roda o mesmo pipeline do ValidationPipe do controller. */
async function check(payload: Record<string, unknown>) {
  const dto = plainToInstance(CompleteOnboardingProfileDto, payload);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((e) => e.property) };
}

const base = {
  profileType: 'SELLER',
  niche: 'BEAUTY',
  phone: '+5511912345678',
};

describe('CompleteOnboardingProfileDto', () => {
  it('accepts a list answer without any free text', async () => {
    const { fields } = await check(base);
    expect(fields).toEqual([]);
  });

  it('requires profileTypeOther when profileType is OTHER', async () => {
    const { fields } = await check({ ...base, profileType: 'OTHER' });
    expect(fields).toContain('profileTypeOther');
  });

  it('requires nicheOther when niche is OTHER', async () => {
    const { fields } = await check({ ...base, niche: 'OTHER' });
    expect(fields).toContain('nicheOther');
  });

  it('rejects a blank free text for OTHER', async () => {
    const { fields } = await check({
      ...base,
      profileType: 'OTHER',
      profileTypeOther: '   ',
    });
    expect(fields).toContain('profileTypeOther');
  });

  it('accepts OTHER with a filled free text, trimming and collapsing spaces', async () => {
    const { dto, fields } = await check({
      ...base,
      profileType: 'OTHER',
      profileTypeOther: '  Dropshipping   internacional  ',
    });
    expect(fields).toEqual([]);
    expect(dto.profileTypeOther).toBe('Dropshipping internacional');
  });

  it('ignores a free text sent alongside a list answer', async () => {
    const { fields } = await check({ ...base, profileTypeOther: 'qualquer coisa' });
    expect(fields).toEqual([]);
  });

  it('caps the free text at 60 characters', async () => {
    const { dto, fields } = await check({
      ...base,
      niche: 'OTHER',
      nicheOther: 'x'.repeat(120),
    });
    expect(fields).toEqual([]);
    expect(dto.nicheOther).toHaveLength(60);
  });

  it('normalizes the phone to E.164 and rejects an invalid one', async () => {
    const ok = await check({ ...base, phone: '(11) 91234-5678' });
    expect(ok.dto.phone).toBe('+11912345678');

    const bad = await check({ ...base, phone: '123' });
    expect(bad.fields).toContain('phone');
  });
});
