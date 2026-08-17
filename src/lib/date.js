// Sempre usar data LOCAL (não UTC) — toISOString() usa UTC e causa bugs de
// virada de dia perto da meia-noite em fusos negativos (ex: Brasil).
export function localDateStr(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayStr() {
  return localDateStr(new Date())
}

// Tarefas não concluídas "migram" automaticamente pro dia atual até serem
// marcadas como feitas — sem precisar de job/cron: a data efetiva é sempre
// max(due_date, hoje) enquanto done=false. Isso repete todo dia sozinho,
// porque "hoje" muda a cada acesso.
export function effectiveDueDate(task) {
  if (!task?.due_date || task.done) return task?.due_date ?? null
  const today = todayStr()
  return task.due_date < today ? today : task.due_date
}

// Quantos dias uma tarefa está atrasada (0 se não estiver atrasada ou já concluída).
export function daysLate(task) {
  if (!task?.due_date || task.done) return 0
  const today = todayStr()
  if (task.due_date >= today) return 0
  const diff = Math.round((new Date(today + 'T00:00:00') - new Date(task.due_date + 'T00:00:00')) / 86400000)
  return diff
}
