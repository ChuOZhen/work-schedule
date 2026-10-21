export interface Slot {
  startMin: number
  endMin: number
}

export interface Placement {
  col: number
  cols: number
}

/**
 * 同一天内重叠事件的分栏布局：
 * 1. 按开始时间排序，划出互相重叠的"簇"
 * 2. 簇内贪心分配列槽
 * 3. 均分宽度
 */
export function layoutDay(items: Slot[]): Placement[] {
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)
  const result: Placement[] = items.map(() => ({ col: 0, cols: 1 }))

  let cluster: Array<{ i: number; startMin: number; endMin: number }> = []
  let clusterEnd = -1

  const flush = (): void => {
    if (cluster.length === 0) return
    const colEnds: number[] = []
    const assign = new Map<number, number>()
    for (const it of cluster) {
      let placed = false
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= it.startMin + 0.001) {
          colEnds[c] = it.endMin
          assign.set(it.i, c)
          placed = true
          break
        }
      }
      if (!placed) {
        colEnds.push(it.endMin)
        assign.set(it.i, colEnds.length - 1)
      }
    }
    const total = Math.max(1, colEnds.length)
    for (const it of cluster) result[it.i] = { col: assign.get(it.i) ?? 0, cols: total }
    cluster = []
    clusterEnd = -1
  }

  for (const it of order) {
    if (cluster.length > 0 && it.startMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()
  return result
}
