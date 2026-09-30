import { afterEach, expect, it, vi } from 'vitest';
import { prepareBackground } from './prepareBackground';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('rejects unsupported formats and oversized uploads before decoding', async () => {
  await expect(prepareBackground(new File(['<svg/>'], 'test.svg', {type:'image/svg+xml'}))).rejects.toThrow('JPG, PNG or WebP');
  await expect(prepareBackground(new File([new ArrayBuffer(10 * 1024 * 1024 + 1)], 'large.jpg', {type:'image/jpeg'}))).rejects.toThrow('10 MB');
});
it('crops, re-encodes and releases the temporary image URL', async () => {
  const revoke = vi.fn();
  vi.stubGlobal('URL', {createObjectURL: () => 'blob:test', revokeObjectURL: revoke});
  vi.stubGlobal('Image', class {
    width = 2000; height = 1000; onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({drawImage:draw} as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/webp;base64,UklGRg==');
  const result = await prepareBackground(new File(['image'], 'banner.jpg', {type:'image/jpeg'}));
  expect(result).toMatch(/^data:image\/webp/);
  expect(draw).toHaveBeenCalledWith(expect.anything(), 0, -100, 1200, 600);
  expect(revoke).toHaveBeenCalledWith('blob:test');
});
