import { useState } from 'react'
import { AvatarUpload } from 'talktofile'

export const WithInitials = () => {
  const [value, setValue] = useState('')
  return <AvatarUpload value={value} onChange={setValue} name="Priya Raman" />
}

export const Large = () => {
  const [value, setValue] = useState('')
  return <AvatarUpload value={value} onChange={setValue} name="Alex Chen" size={96} />
}
