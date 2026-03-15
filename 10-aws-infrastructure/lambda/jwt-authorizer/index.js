/**
 * AWS Lambda JWT Authorizer for API Gateway
 * Validates Auth0 JWT tokens and returns IAM policy.
 */
const https = require('https');
const { promisify } = require('util');
const crypto = require('crypto');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUDIENCE = process.env.AUTH0_AUDIENCE;

let jwksCache = null;

async function getJWKS() {
  if (jwksCache) return jwksCache;

  return new Promise((resolve, reject) => {
    https.get(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        jwksCache = JSON.parse(data);
        resolve(jwksCache);
      });
    }).on('error', reject);
  });
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function decodeJWT(token) {
  const parts = token.split('.');
  return {
    header: JSON.parse(base64urlDecode(parts[0]).toString()),
    payload: JSON.parse(base64urlDecode(parts[1]).toString()),
  };
}

function generatePolicy(principalId, effect, resource, context = {}) {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      }],
    },
    context,
  };
}

exports.handler = async (event) => {
  try {
    const token = event.authorizationToken?.replace('Bearer ', '');
    if (!token) return generatePolicy('anonymous', 'Deny', event.methodArn);

    const { header, payload } = decodeJWT(token);
    const now = Math.floor(Date.now() / 1000);

    // Validate claims
    if (payload.exp < now) throw new Error('Token expired');
    if (payload.iss !== `https://${AUTH0_DOMAIN}/`) throw new Error('Invalid issuer');

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(AUDIENCE)) throw new Error('Invalid audience');

    // Return allow policy with user context
    return generatePolicy(payload.sub, 'Allow', event.methodArn, {
      userId: payload.sub,
      email: payload.email || '',
      permissions: JSON.stringify(payload.permissions || []),
    });
  } catch (error) {
    console.log('Auth error:', error.message);
    return generatePolicy('anonymous', 'Deny', event.methodArn);
  }
};
