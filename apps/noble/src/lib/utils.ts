import { createCurve } from '@noble/curves/_shortw_utils';
import { Field } from '@noble/curves/abstract/modular';
import { sha256 } from '@noble/hashes/sha256';

export const createCustomCurve = (a: bigint, b: bigint, p: bigint, n: bigint, h: bigint, Gx: bigint, Gy: bigint) => {
  const Fp = Field(p);
  const CURVE_A = Fp.create(a);
  const CURVE_B = b;

  return createCurve(
    {
      // Params: a, b
      a: CURVE_A,
      b: CURVE_B,
      Fp,
      // Curve order, total count of valid points in the field
      n: n,
      // Base point (x, y) aka generator point
      Gx: Gx,
      Gy: Gy,
      h: h,
      lowS: false,
    },
    sha256
  );
}

export const pad = (n: bigint) => {
  return n.toString();
}

export const isPositiveBigInt = (str) => {
  return !/[^0-9]/.test(str);
}

export const isBigInt = (str) => {
  try {
    return typeof BigInt(str) === "bigint";
  } catch (e) {
    return false;
  }
}

export const isNonHexStr = (str) => {
  return /[^0-9A-F]/gi.test(str);
}

export const getErrMsg = (e) => {
  return e.message.split(/\r?\n/);
}