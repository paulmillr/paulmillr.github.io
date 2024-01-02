import { writable } from "svelte/store";

export const privKey = writable('');
export const message = writable('');
export const currCurveN = writable(0n);
export const customCurveErrorDemo1 = writable('');
export const customCurveErrorDemo2 = writable('');