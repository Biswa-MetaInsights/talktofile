import { useState } from 'react'
import { ChapterPicker } from 'talktofile'

const chapters = [
  { id: 'ch1', index: 0, title: 'Introduction' },
  { id: 'ch2', index: 1, title: 'Methodology' },
  { id: 'ch3', index: 2, title: 'Results and discussion' },
  { id: 'ch4', index: 3, title: 'Limitations' },
  { id: 'ch5', index: 4, title: 'Conclusion' },
]

export const AllChapters = () => {
  const [selected, setSelected] = useState<string[]>([])
  return <ChapterPicker chapters={chapters} selected={selected} onChange={setSelected} />
}

export const SomeSelected = () => {
  const [selected, setSelected] = useState<string[]>(['ch2', 'ch3'])
  return <ChapterPicker chapters={chapters} selected={selected} onChange={setSelected} />
}
