const MOCK = new URL("./mocks.mjs", import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("npm:")) return { url: MOCK, shortCircuit: true };
  return next(spec, ctx);
}
