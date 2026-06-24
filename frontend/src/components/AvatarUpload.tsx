import { useRef } from 'react'
import { Camera, User, X } from 'lucide-react'
import Tooltip from './Tooltip'

/**
 * Circular avatar with an upload control. Frontend only — the picked image is read
 * into a data URL and handed back via `onChange`; nothing is uploaded to a server yet.
 * Shows the image when set, otherwise the user's initials (from `name`) or a fallback
 * icon. A small camera button opens the file picker; a remove button clears it.
 */
export default function AvatarUpload({
  value,
  onChange,
  name,
  size = 80,
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange(typeof reader.result === 'string' ? reader.result : '')
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
    <div className="inline-flex">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <Tooltip label="Upload a photo. JPG, PNG or GIF.">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={value ? 'Change avatar' : 'Upload a photo. JPG, PNG or GIF.'}
            className="w-full h-full rounded-full overflow-hidden bg-[#E2611B]/10 border-2 border-[#E2611B]/20 flex items-center justify-center"
          >
            {value ? (
              <img src={value} alt="Avatar" className="w-full h-full object-cover" />
            ) : initials ? (
              <span className="font-semibold text-[#E2611B]" style={{ fontSize: size * 0.34 }}>{initials}</span>
            ) : (
              <User className="text-[#E2611B]" style={{ width: size * 0.4, height: size * 0.4 }} />
            )}
          </button>
        </Tooltip>

        {/* Camera button to open the picker */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={value ? 'Change avatar' : 'Upload avatar'}
          className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-[#E2611B] text-white flex items-center justify-center shadow-sm border-2 border-white hover:bg-[#E2611B]/90 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" />
        </button>

        {/* Remove button (only when an image is set) */}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove avatar"
            className="absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full bg-white text-slate-500 flex items-center justify-center shadow-sm border border-slate-200 hover:text-red-500 hover:border-red-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
