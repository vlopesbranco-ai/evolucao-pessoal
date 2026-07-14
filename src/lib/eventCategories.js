export const EVENT_CATEGORIES = [
  { value: 'ferias', label: 'Férias', emoji: '🏖️', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  { value: 'viagem', label: 'Viagem', emoji: '✈️', dot: 'bg-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-700' },
  { value: 'encontro', label: 'Encontro', emoji: '💑', dot: 'bg-pink-500', bg: 'bg-pink-50', text: 'text-pink-700' },
  { value: 'festa', label: 'Festa', emoji: '🎉', dot: 'bg-fuchsia-500', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  { value: 'aniversario', label: 'Aniversário', emoji: '🎂', dot: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  { value: 'filha', label: 'Filha', emoji: '👶', dot: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
  { value: 'outro', label: 'Outro', emoji: '📌', dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' },
]

export function categoryInfo(value) {
  return EVENT_CATEGORIES.find((c) => c.value === value) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1]
}
