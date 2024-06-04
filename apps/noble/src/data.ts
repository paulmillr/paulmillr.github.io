export const KEY_32 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export const KEY_48 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
export const KEY_57 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01'
export const KEY_65 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01'

export const curves = [
  { type: 'ECDSA', list: ['secp256k1', 'P256', 'P384', 'P521'] },
  { type: 'Schnorr', list: ['secp256k1'] },
  { type: 'EdDSA', list: ['ed25519', 'ed448'] },
  { type: 'BLS', list: ['bls12-381'], options: ['G1', 'G2'] },
  // { type: 'ECDH', list: ['x25519', 'x448', 'secp256k1'] },
];

export const err = {
  'NO_MESSAGE': 'Provide a message to sign to see the results.',
  'POSITIVE_INT': 'must be positive and non-floating point integer.',
  'INT': 'must be non-floating point integer.',
};

// default values (taken from P256 and converted with BigInt(value))
export const defaultCustomCurveParams = {
  a: -3n,
  b: 41058363725152142129326129780047268409114441015993725554835256314039467401291n,
  p: 115792089210356248762697446949407573530086143415290314195533631308867097853951n,
  n: 115792089210356248762697446949407573529996955224135760342422259061068512044369n,
  h: 1n,
  Gx: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
  Gy: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
};
