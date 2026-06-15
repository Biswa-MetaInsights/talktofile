import { motion } from 'framer-motion'

export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-slide-in-left">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white shadow-sm shadow-indigo-200">
        S
      </div>
      <div className="glass-card rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1.5 h-5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400/60"
              animate={{ scaleY: [1, 2, 1] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: 'bottom' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
