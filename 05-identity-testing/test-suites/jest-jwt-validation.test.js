/**
 * JWT Validation Test Suite
 *
 * Comprehensive test suite covering 20+ edge cases for JWT token validation.
 * Tests cover: valid tokens, expired tokens, wrong audience, wrong issuer,
 * tampered signatures, missing claims, algorithm attacks, and malformed tokens.
 */

const jwt = require('jsonwebtoken');

// ─── Test Configuration ─────────────────────────────────────

const TEST_SECRET = 'test-secret-key-that-is-long-enough-for-hs256-signing';
const WRONG_SECRET = 'wrong-secret-key-that-is-completely-different-from-test';
const TEST_ISSUER = 'https://auth.example.com/';
const TEST_AUDIENCE = 'https://api.example.com';

// ─── Token Validator Under Test ─────────────────────────────

class TokenValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'TokenValidationError';
    this.code = code;
  }
}

function validateToken(token, secret, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new TokenValidationError('Token is required', 'TOKEN_MISSING');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new TokenValidationError('Token must have 3 parts', 'TOKEN_MALFORMED');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      audience: options.audience,
      issuer: options.issuer,
      algorithms: options.algorithms || ['HS256'],
      complete: false,
    });

    if (options.requiredClaims) {
      for (const claim of options.requiredClaims) {
        if (decoded[claim] === undefined) {
          throw new TokenValidationError(
            `Missing required claim: ${claim}`,
            'CLAIM_MISSING'
          );
        }
      }
    }

    return decoded;
  } catch (error) {
    if (error instanceof TokenValidationError) {
      throw error;
    }

    const errorMap = {
      TokenExpiredError: { message: 'Token has expired', code: 'TOKEN_EXPIRED' },
      JsonWebTokenError: { message: error.message, code: 'TOKEN_INVALID' },
      NotBeforeError: { message: 'Token not yet valid', code: 'TOKEN_NOT_ACTIVE' },
    };

    const mapped = errorMap[error.name] || {
      message: 'Token validation failed',
      code: 'VALIDATION_ERROR',
    };

    throw new TokenValidationError(mapped.message, mapped.code);
  }
}

// ─── Helper Functions ───────────────────────────────────────

function generateValidToken(overrides = {}, secretOverride = null) {
  const payload = {
    sub: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['user'],
    permissions: ['read:data'],
    ...overrides,
  };

  return jwt.sign(payload, secretOverride || TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
  });
}

function generateExpiredToken() {
  const payload = {
    sub: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
  };

  return jwt.sign(payload, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '-1h', // Already expired
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
  });
}

function generateFutureToken() {
  const payload = {
    sub: 'user-123',
    email: 'test@example.com',
    roles: ['user'],
    nbf: Math.floor(Date.now() / 1000) + 3600, // Not valid for 1 hour
  };

  return jwt.sign(payload, TEST_SECRET, {
    algorithm: 'HS256',
    expiresIn: '2h',
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
  });
}

function tamperWithToken(token) {
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  payload.roles = ['admin']; // Attempt privilege escalation
  payload.email = 'admin@example.com';
  parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return parts.join('.');
}

// ─── Test Suite ─────────────────────────────────────────────

describe('JWT Token Validation', () => {
  const defaultOptions = {
    audience: TEST_AUDIENCE,
    issuer: TEST_ISSUER,
    algorithms: ['HS256'],
  };

  // ── Valid Token Tests ──────────────────────────────────

  describe('Valid Tokens', () => {
    test('should accept a valid token with correct signature', () => {
      const token = generateValidToken();
      const result = validateToken(token, TEST_SECRET, defaultOptions);

      expect(result).toBeDefined();
      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    test('should extract all standard claims', () => {
      const token = generateValidToken();
      const result = validateToken(token, TEST_SECRET, defaultOptions);

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.roles).toEqual(['user']);
      expect(result.permissions).toEqual(['read:data']);
      expect(result.iss).toBe(TEST_ISSUER);
      expect(result.aud).toBe(TEST_AUDIENCE);
      expect(result.iat).toBeDefined();
      expect(result.exp).toBeDefined();
    });

    test('should accept a token with custom claims', () => {
      const token = generateValidToken({
        orgId: 'org-456',
        tenantId: 'tenant-789',
        customField: 'custom-value',
      });
      const result = validateToken(token, TEST_SECRET, defaultOptions);

      expect(result.orgId).toBe('org-456');
      expect(result.tenantId).toBe('tenant-789');
      expect(result.customField).toBe('custom-value');
    });

    test('should accept a token with multiple audiences when one matches', () => {
      const token = jwt.sign(
        { sub: 'user-123', email: 'test@example.com' },
        TEST_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: TEST_ISSUER,
          audience: [TEST_AUDIENCE, 'https://other-api.example.com'],
        }
      );

      const result = validateToken(token, TEST_SECRET, defaultOptions);
      expect(result.sub).toBe('user-123');
    });

    test('should accept a token with array roles', () => {
      const token = generateValidToken({
        roles: ['user', 'editor', 'viewer'],
      });
      const result = validateToken(token, TEST_SECRET, defaultOptions);

      expect(result.roles).toEqual(['user', 'editor', 'viewer']);
      expect(result.roles).toHaveLength(3);
    });
  });

  // ── Expired Token Tests ────────────────────────────────

  describe('Expired Tokens', () => {
    test('should reject an expired token', () => {
      const token = generateExpiredToken();

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should return TOKEN_EXPIRED error code for expired token', () => {
      const token = generateExpiredToken();

      try {
        validateToken(token, TEST_SECRET, defaultOptions);
        fail('Expected TokenValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenValidationError);
        expect(error.code).toBe('TOKEN_EXPIRED');
        expect(error.message).toBe('Token has expired');
      }
    });

    test('should reject a token that expired 1 second ago', () => {
      const payload = {
        sub: 'user-123',
        exp: Math.floor(Date.now() / 1000) - 1,
      };
      const token = jwt.sign(payload, TEST_SECRET, {
        algorithm: 'HS256',
        issuer: TEST_ISSUER,
        audience: TEST_AUDIENCE,
      });

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow('Token has expired');
    });
  });

  // ── Not Before (nbf) Tests ────────────────────────────

  describe('Not Before (nbf) Validation', () => {
    test('should reject a token that is not yet valid', () => {
      const token = generateFutureToken();

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should return TOKEN_NOT_ACTIVE error code', () => {
      const token = generateFutureToken();

      try {
        validateToken(token, TEST_SECRET, defaultOptions);
        fail('Expected TokenValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenValidationError);
        expect(error.code).toBe('TOKEN_NOT_ACTIVE');
      }
    });
  });

  // ── Audience Validation Tests ──────────────────────────

  describe('Audience Validation', () => {
    test('should reject token with wrong audience', () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        TEST_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: TEST_ISSUER,
          audience: 'https://wrong-api.example.com',
        }
      );

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject token with no audience when audience is expected', () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        TEST_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: TEST_ISSUER,
          // No audience set
        }
      );

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });
  });

  // ── Issuer Validation Tests ────────────────────────────

  describe('Issuer Validation', () => {
    test('should reject token with wrong issuer', () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        TEST_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          issuer: 'https://evil-issuer.com/',
          audience: TEST_AUDIENCE,
        }
      );

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject token with no issuer when issuer is expected', () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        TEST_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '1h',
          audience: TEST_AUDIENCE,
          // No issuer set
        }
      );

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });
  });

  // ── Signature Tampering Tests ──────────────────────────

  describe('Signature Tampering', () => {
    test('should reject a token with tampered payload', () => {
      const token = generateValidToken();
      const tampered = tamperWithToken(token);

      expect(() => {
        validateToken(tampered, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject a token signed with the wrong secret', () => {
      const token = generateValidToken({}, WRONG_SECRET);

      expect(() => {
        validateToken(token, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject a token with truncated signature', () => {
      const token = generateValidToken();
      const parts = token.split('.');
      parts[2] = parts[2].substring(0, 10); // Truncate signature
      const truncated = parts.join('.');

      expect(() => {
        validateToken(truncated, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject a token with empty signature', () => {
      const token = generateValidToken();
      const parts = token.split('.');
      parts[2] = ''; // Empty signature (but still 3 parts with trailing dot)
      const noSig = parts.join('.');

      expect(() => {
        validateToken(noSig, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });
  });

  // ── Algorithm Attack Tests ─────────────────────────────

  describe('Algorithm Attacks', () => {
    test('should reject a token with "none" algorithm', () => {
      // Manually construct a "none" algorithm token
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' }))
        .toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        sub: 'admin',
        roles: ['admin'],
        iss: TEST_ISSUER,
        aud: TEST_AUDIENCE,
        exp: Math.floor(Date.now() / 1000) + 3600,
      })).toString('base64url');

      const noneToken = `${header}.${payload}.`;

      expect(() => {
        validateToken(noneToken, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject HS384 token when only HS256 is allowed', () => {
      const token = jwt.sign(
        { sub: 'user-123' },
        TEST_SECRET,
        {
          algorithm: 'HS384',
          expiresIn: '1h',
          issuer: TEST_ISSUER,
          audience: TEST_AUDIENCE,
        }
      );

      expect(() => {
        validateToken(token, TEST_SECRET, {
          ...defaultOptions,
          algorithms: ['HS256'], // Only allow HS256
        });
      }).toThrow(TokenValidationError);
    });

    test('should accept HS256 when multiple algorithms are allowed', () => {
      const token = generateValidToken();
      const result = validateToken(token, TEST_SECRET, {
        ...defaultOptions,
        algorithms: ['HS256', 'HS384'],
      });

      expect(result.sub).toBe('user-123');
    });
  });

  // ── Missing Claims Tests ───────────────────────────────

  describe('Missing Required Claims', () => {
    test('should reject token missing a required claim', () => {
      const token = generateValidToken(); // Has sub, email, name, roles

      expect(() => {
        validateToken(token, TEST_SECRET, {
          ...defaultOptions,
          requiredClaims: ['organizationId'], // This claim doesn't exist
        });
      }).toThrow(TokenValidationError);
    });

    test('should return CLAIM_MISSING error code', () => {
      const token = generateValidToken();

      try {
        validateToken(token, TEST_SECRET, {
          ...defaultOptions,
          requiredClaims: ['tenantId'],
        });
        fail('Expected TokenValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenValidationError);
        expect(error.code).toBe('CLAIM_MISSING');
        expect(error.message).toContain('tenantId');
      }
    });

    test('should accept token with all required claims present', () => {
      const token = generateValidToken();
      const result = validateToken(token, TEST_SECRET, {
        ...defaultOptions,
        requiredClaims: ['sub', 'email', 'roles'],
      });

      expect(result.sub).toBe('user-123');
      expect(result.email).toBe('test@example.com');
    });

    test('should fail when one of multiple required claims is missing', () => {
      const token = generateValidToken();

      expect(() => {
        validateToken(token, TEST_SECRET, {
          ...defaultOptions,
          requiredClaims: ['sub', 'email', 'nonExistentClaim'],
        });
      }).toThrow('nonExistentClaim');
    });
  });

  // ── Malformed Token Tests ──────────────────────────────

  describe('Malformed Tokens', () => {
    test('should reject null token', () => {
      expect(() => {
        validateToken(null, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);

      try {
        validateToken(null, TEST_SECRET, defaultOptions);
      } catch (error) {
        expect(error.code).toBe('TOKEN_MISSING');
      }
    });

    test('should reject undefined token', () => {
      expect(() => {
        validateToken(undefined, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject empty string token', () => {
      expect(() => {
        validateToken('', TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject non-string token (number)', () => {
      expect(() => {
        validateToken(12345, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject non-string token (object)', () => {
      expect(() => {
        validateToken({ token: 'value' }, TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject token with only 1 part', () => {
      expect(() => {
        validateToken('just-one-part', TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);

      try {
        validateToken('just-one-part', TEST_SECRET, defaultOptions);
      } catch (error) {
        expect(error.code).toBe('TOKEN_MALFORMED');
      }
    });

    test('should reject token with only 2 parts', () => {
      expect(() => {
        validateToken('part1.part2', TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject token with 4 parts', () => {
      expect(() => {
        validateToken('part1.part2.part3.part4', TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });

    test('should reject random garbage string with 3 dots', () => {
      expect(() => {
        validateToken('not.a.jwt', TEST_SECRET, defaultOptions);
      }).toThrow(TokenValidationError);
    });
  });

  // ── Error Type Tests ───────────────────────────────────

  describe('Error Types and Codes', () => {
    test('all errors should be instances of TokenValidationError', () => {
      const testCases = [
        () => validateToken(null, TEST_SECRET, defaultOptions),
        () => validateToken('a.b', TEST_SECRET, defaultOptions),
        () => validateToken(generateExpiredToken(), TEST_SECRET, defaultOptions),
        () => validateToken('not.valid.token', TEST_SECRET, defaultOptions),
      ];

      for (const testCase of testCases) {
        try {
          testCase();
          fail('Expected error');
        } catch (error) {
          expect(error).toBeInstanceOf(TokenValidationError);
          expect(error.code).toBeDefined();
          expect(typeof error.code).toBe('string');
        }
      }
    });

    test('error codes should be one of the defined set', () => {
      const validCodes = [
        'TOKEN_MISSING',
        'TOKEN_MALFORMED',
        'TOKEN_EXPIRED',
        'TOKEN_INVALID',
        'TOKEN_NOT_ACTIVE',
        'CLAIM_MISSING',
        'VALIDATION_ERROR',
      ];

      try {
        validateToken(null, TEST_SECRET, defaultOptions);
      } catch (error) {
        expect(validCodes).toContain(error.code);
      }

      try {
        validateToken(generateExpiredToken(), TEST_SECRET, defaultOptions);
      } catch (error) {
        expect(validCodes).toContain(error.code);
      }
    });
  });
});
