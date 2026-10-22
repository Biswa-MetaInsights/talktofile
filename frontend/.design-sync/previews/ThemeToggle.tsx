import { ThemeToggle } from 'talktofile'

export const Default = () => (
  <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#F8FAFC] w-max">
    <span className="text-sm text-slate-600">Appearance</span>
    <ThemeToggle />
  </div>
)
