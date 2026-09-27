// 輕量的 AI 呼叫次數紀錄工具。
// 只是為了讓老師在後台大致掌握「這個月呼叫了多少次 AI」，
// 不是精確的費用計算，所以刻意做成「失敗就算了、不影響主功能」。
export async function logAiUsage(supabase, endpoint) {
  try {
    await supabase.from('ai_usage_logs').insert({ endpoint })
  } catch (err) {
    // 記錄失敗不應該影響主要功能，安靜忽略即可。
  }
}
