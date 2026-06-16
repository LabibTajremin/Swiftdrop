import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const SampleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().positive('Age must be a positive integer'),
  email: z.string().email('Invalid email address').optional(),
});

type SampleDto = z.infer<typeof SampleSchema>;

const META: ArgumentMetadata = { type: 'body', metatype: undefined, data: '' };

function makePipe() {
  return new ZodValidationPipe(SampleSchema);
}

describe('ZodValidationPipe', () => {
  describe('valid input', () => {
    it('passes through a fully valid payload unchanged', () => {
      const input = { name: 'Alice', age: 30, email: 'alice@example.com' };
      const result = makePipe().transform(input, META) as SampleDto;
      expect(result).toEqual(input);
    });

    it('passes through a valid payload with optional field omitted', () => {
      const input = { name: 'Bob', age: 25 };
      const result = makePipe().transform(input, META) as SampleDto;
      expect(result).toEqual(input);
    });

    it('strips unknown fields (Zod default strip behaviour)', () => {
      const input = { name: 'Carol', age: 40, unknown: 'extra' };
      const result = makePipe().transform(input, META) as Record<string, unknown>;
      expect(result).not.toHaveProperty('unknown');
    });
  });

  describe('invalid input → BadRequestException', () => {
    it('throws BadRequestException when required field is missing', () => {
      expect(() => makePipe().transform({ age: 25 }, META)).toThrow(BadRequestException);
    });

    it('throws BadRequestException when a field has the wrong type', () => {
      expect(() => makePipe().transform({ name: 'Alice', age: 'not-a-number' }, META)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when optional field is present but invalid', () => {
      expect(() =>
        makePipe().transform({ name: 'Alice', age: 25, email: 'not-an-email' }, META),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException for completely empty input', () => {
      expect(() => makePipe().transform({}, META)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for null input', () => {
      expect(() => makePipe().transform(null, META)).toThrow(BadRequestException);
    });
  });

  describe('error shape', () => {
    function catchError(value: unknown) {
      try {
        makePipe().transform(value, META);
        throw new Error('Expected pipe to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        return (err as BadRequestException).getResponse() as {
          message: string;
          errors: { path: string; message: string }[];
        };
      }
    }

    it('response has a string message field', () => {
      const response = catchError({ age: 25 });
      expect(typeof response.message).toBe('string');
      expect(response.message.length).toBeGreaterThan(0);
    });

    it('response has an errors array', () => {
      const response = catchError({ age: 25 });
      expect(Array.isArray(response.errors)).toBe(true);
      expect(response.errors.length).toBeGreaterThan(0);
    });

    it('each error entry has path and message', () => {
      const response = catchError({ age: 25 });
      for (const err of response.errors) {
        expect(err).toHaveProperty('path');
        expect(err).toHaveProperty('message');
        expect(typeof err.message).toBe('string');
      }
    });

    it('error message includes the field path', () => {
      const response = catchError({ age: 25 });
      // name is missing → should report 'name' in the message string
      expect(response.message).toMatch(/name/);
    });

    it('reports all failing fields, not just the first', () => {
      const response = catchError({});
      // both name and age are missing
      expect(response.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('uses custom Zod error messages', () => {
      const response = catchError({ name: 'Alice', age: -5 });
      const ageError = response.errors.find((e) => e.path === 'age');
      expect(ageError?.message).toContain('positive');
    });

    it('includes path for nested violations', () => {
      const NestedSchema = z.object({ user: z.object({ email: z.string().email() }) });
      const pipe = new ZodValidationPipe(NestedSchema);
      try {
        pipe.transform({ user: { email: 'bad' } }, META);
      } catch (err) {
        const response = (err as BadRequestException).getResponse() as {
          errors: { path: string }[];
        };
        expect(response.errors[0].path).toBe('user.email');
      }
    });
  });

  describe('schema coercion and defaults', () => {
    it('applies Zod default values in the returned data', () => {
      const SchemaWithDefault = z.object({
        page: z.coerce.number().default(1),
        label: z.string().default('draft'),
      });
      const pipe = new ZodValidationPipe(SchemaWithDefault);
      const result = pipe.transform({}, META) as { page: number; label: string };
      expect(result.page).toBe(1);
      expect(result.label).toBe('draft');
    });

    it('coerces string numbers when schema uses z.coerce', () => {
      const SchemaWithCoerce = z.object({ page: z.coerce.number().int().positive() });
      const pipe = new ZodValidationPipe(SchemaWithCoerce);
      const result = pipe.transform({ page: '3' }, META) as { page: number };
      expect(result.page).toBe(3);
    });
  });
});
