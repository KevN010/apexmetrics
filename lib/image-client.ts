const MAX_DIMENSION = 2000

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        reject(new Error('Loaded image has no dimensions'))
        return
      }
      resolve(img)
    }
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

export function isImageDataUrl(value: string | undefined): value is string {
  return Boolean(value && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not prepare uploaded image for analysis')
    context.drawImage(img, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    if (!isImageDataUrl(dataUrl)) throw new Error('Could not encode uploaded image')
    return dataUrl
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function cropFromBox(
  dataUrl: string,
  box: number[],
): Promise<string | null> {
  if (box.length !== 4 || !box.every(Number.isFinite)) return null
  const [rawYmin, rawXmin, rawYmax, rawXmax] = box
  const ymin = Math.min(1000, Math.max(0, rawYmin)) / 1000
  const xmin = Math.min(1000, Math.max(0, rawXmin)) / 1000
  const ymax = Math.min(1000, Math.max(0, rawYmax)) / 1000
  const xmax = Math.min(1000, Math.max(0, rawXmax)) / 1000
  if (xmax <= xmin || ymax <= ymin) return null

  const img = await loadImage(dataUrl)
  const sx = Math.round(xmin * img.naturalWidth)
  const sy = Math.round(ymin * img.naturalHeight)
  const ex = Math.round(xmax * img.naturalWidth)
  const ey = Math.round(ymax * img.naturalHeight)
  const sw = ex - sx
  const sh = ey - sy
  if (sw < 1 || sh < 1) return null

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare thumbnail crop')
  context.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const cropDataUrl = canvas.toDataURL('image/jpeg', 0.92)
  return isImageDataUrl(cropDataUrl) ? cropDataUrl : null
}
