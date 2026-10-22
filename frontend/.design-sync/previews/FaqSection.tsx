import { FaqSection } from 'talktofile'

export const Students = () => (
  <FaqSection
    faqs={[
      { q: 'Will the flashcards stay within my syllabus?', a: "Yes. Flashcards and questions are built only from the files you upload, so you revise exactly what's in your material." },
      { q: 'Can I use lecture videos?', a: 'Yes. Paste a video link and Talktofile works with it just like a document.' },
      { q: 'Which files can I upload?', a: 'PDF, Word, PowerPoint, and 50+ other formats, plus web and video links.' },
      { q: 'Is it free?', a: 'Yes. Talktofile is currently free to use, and you can start without signing up.' },
    ]}
  />
)
