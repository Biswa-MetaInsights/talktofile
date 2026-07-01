import { useRef } from 'react'
import { Camera, User } from 'lucide-react'

/**
 * Avatar picker, laid out as a premium "settings row": a circular avatar on the
 * left with a hover overlay, and a labelled action button + helper text on the
 * right. Frontend only — the picked image is read into a data URL and handed back
 * via `onChange`; nothing is uploaded to a server yet. Shows the image when set,
 * otherwise the user's initials (from `name`) or a fallback icon.
 */
export default function AvatarUpload({
  value,
  onChange,
  name,
  size = 72,
}: {
  /** Current avatar as a data URL (or empty for none). */
  value: string
  onChange: (dataUrl: string) => void
  /** Used to derive fallback initials when there's no image. */
  name?: string
  /** Diameter in px. */
  size?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pick = () => inputRef.current?.click()

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === 'string' ? reader.result : ''
      if (!src) return
      // Downscale to a small square thumbnail so the stored avatar is tiny
      // (it's sent in every profile/me payload). Fall back to the raw image if
      // canvas processing fails for any reason.
      const img = new Image()
      img.onload = () => {
        try {
          const SIZE = 256
          const canvas = document.createElement('canvas')
          canvas.width = SIZE
          canvas.height = SIZE
          const ctx = canvas.getContext('2d')
          if (!ctx) { onChange(src); return }
          const side = Math.min(img.width, img.height)
          const sx = (img.width - side) / 2
          const sy = (img.height - side) / 2
          ctx.fillStyle = '#ffffff' // flatten any transparency (we export JPEG)
          ctx.fillRect(0, 0, SIZE, SIZE)
          ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)
          onChange(canvas.toDataURL('image/jpeg', 0.85))
        } catch {
          onChange(src)
        }
      }
      img.onerror = () => onChange(src)
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-picking the same file
  }

  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-4">
      {/* Avatar — click anywhere on it to open the picker; a soft overlay invites the action on hover/focus. */}
      <button
        type="button"
        onClick={pick}
        aria-label={value ? 'Change photo' : 'Upload a photo'}
        className="group relative flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#E2611B]/40 focus-visible:ring-offset-2"
        style={{ width: size, height: size }}
      >
        <span className="block w-full h-full rounded-full overflow-hidden bg-[#E2611B]/10 ring-1 ring-[#E2611B]/15 flex items-center justify-center">
          {value ? (
            <img src={value} alt="Avatar" className="w-full h-full object-cover" />
          ) : initials ? (
            <span className="font-semibold text-[#E2611B] leading-none" style={{ fontSize: size * 0.34 }}>
              {initials}
            </span>
          ) : (
            <User className="text-[#E2611B]" style={{ width: size * 0.4, height: size * 0.4 }} />
          )}
        </span>

        {/* Hover/focus overlay — appears only on interaction, so the resting state stays clean. */}
        <span className="absolute inset-0 rounded-full bg-slate-900/45 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="text-white" style={{ width: size * 0.28, height: size * 0.28 }} />
        </span>
      </button>

      {/* Actions + helper text */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pick}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#E2611B] bg-[#E2611B]/10 hover:bg-[#E2611B]/15 transition-colors"
          >
            {value ? 'Change photo' : 'Upload photo'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors dark:text-slate-400 dark:hover:bg-red-500/10"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">JPG, PNG or GIF. Max 5 MB.</p>
      </div>

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}
