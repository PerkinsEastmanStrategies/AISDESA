import { surveyPhotoLocalBackupFilename } from "@/lib/photo-storage"

/** Resize and compress an image file for local draft storage. */
export async function compressImageFile(file: File, maxWidth = 960, quality = 0.72): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file)
  return resizeDataUrl(dataUrl, maxWidth, quality)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

function resizeDataUrl(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("Canvas unavailable"))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Could not load image"))
    img.src = dataUrl
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",")
  const header = comma >= 0 ? dataUrl.slice(0, comma) : ""
  const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;]+)/.exec(header)?.[1] || "image/jpeg"
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** Save a JPEG on the device using the same path that lands in Supabase Storage. */
export function downloadSurveyPhotoLocalBackup(imageDataUrl: string, storagePath: string): string | null {
  if (typeof document === "undefined" || !imageDataUrl.startsWith("data:image/")) return null
  const filename = surveyPhotoLocalBackupFilename(storagePath)
  const blob = dataUrlToBlob(imageDataUrl)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  return filename
}
