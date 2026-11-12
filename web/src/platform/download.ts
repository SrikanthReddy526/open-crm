import { isNativeApp } from '.'

/**
 * Saves a file the user asked for (e.g. CSV export).
 * - Browser / Electron: normal download.
 * - Android / iOS app: WebViews can't download blobs, so write it to the app cache
 *   and open the system share sheet (save to Files, Drive, WhatsApp, email…).
 */
export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  if (isNativeApp) {
    await shareNative(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function shareNative(blob: Blob, filename: string): Promise<void> {
  // Loaded only inside the app, so the website bundle doesn't pay for them up front.
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  })
  try {
    await Share.share({ title: filename, files: [uri] })
  } catch (err) {
    // The user closing the share sheet is not an error.
    if (!String(err).toLowerCase().includes('cancel')) throw err
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
