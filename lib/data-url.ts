import { z } from 'zod'

const MAX_DATA_URL_LENGTH = 4_000_000

export const imageDataUrlSchema = z
  .string()
  .max(MAX_DATA_URL_LENGTH, 'Image is too large')
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Invalid image')

export function dataUrlToBytes(dataUrl: string) {
  const [header, base64] = dataUrl.split(',')
  const mediaType = header.slice(5, header.indexOf(';'))
  return { mediaType, data: Buffer.from(base64, 'base64') }
}
