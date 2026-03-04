#!/usr/bin/env python3
"""
朝のルーティン計算ツール
明日のカレンダーの最初のイベントから逆算して、余裕を持って起きる時刻を提案します。
"""

from datetime import datetime, timedelta


# デフォルトのルーティン所要時間（分）
DEFAULT_ROUTINE = {
    "シャワー": 15,
    "朝ご飯": 25,
    "準備（着替え・歯磨きなど）": 15,
    "余裕バッファ": 15,
}


def calculate_wakeup_time(first_event_time: datetime, routine: dict = None) -> dict:
    """
    最初のイベント時刻から逆算して起床時刻を計算する。

    Args:
        first_event_time: 明日の最初のイベントの開始時刻
        routine: 各ルーティン項目の所要時間（分）の辞書

    Returns:
        計算結果の辞書
    """
    if routine is None:
        routine = DEFAULT_ROUTINE

    total_minutes = sum(routine.values())
    wakeup_time = first_event_time - timedelta(minutes=total_minutes)

    schedule = []
    current_time = wakeup_time
    schedule.append(("起床", current_time))

    for task, duration in routine.items():
        current_time += timedelta(minutes=duration)
        schedule.append((task + "完了", current_time))

    return {
        "wakeup_time": wakeup_time,
        "first_event_time": first_event_time,
        "total_prep_minutes": total_minutes,
        "schedule": schedule,
        "routine": routine,
    }


def format_result(result: dict) -> str:
    """計算結果を見やすい文字列にフォーマットする。"""
    lines = []
    lines.append("=" * 45)
    lines.append("  朝のルーティン計算結果")
    lines.append("=" * 45)
    lines.append(f"  最初のイベント: {result['first_event_time'].strftime('%H:%M')}")
    lines.append(f"  準備合計時間 : {result['total_prep_minutes']} 分")
    lines.append("")
    lines.append(f"  ▶ 推奨起床時刻: {result['wakeup_time'].strftime('%H:%M')}")
    lines.append("")
    lines.append("  タイムライン:")
    for task, t in result["schedule"]:
        lines.append(f"    {t.strftime('%H:%M')}  {task}")
    lines.append("=" * 45)
    return "\n".join(lines)


def get_time_input(prompt: str) -> datetime:
    """HH:MM 形式で時刻を入力してもらい datetime オブジェクトを返す。"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    while True:
        raw = input(prompt).strip()
        try:
            t = datetime.strptime(raw, "%H:%M")
            return datetime.combine(tomorrow, t.time())
        except ValueError:
            print("  ※ HH:MM 形式で入力してください（例: 09:00）")


def get_int_input(prompt: str, default: int) -> int:
    """整数を入力してもらう。空のままEnterでデフォルト値を使用。"""
    raw = input(prompt).strip()
    if raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"  ※ 数値が無効です。デフォルト値 {default} 分を使用します。")
        return default


def main():
    print()
    print("  朝のルーティン計算ツール")
    print("  明日の最初のイベント時刻を入力してください。")
    print()

    first_event = get_time_input("  明日の最初のイベント開始時刻 (HH:MM): ")

    print()
    print("  各ルーティンの所要時間をカスタマイズできます。")
    print("  Enterキーでデフォルト値を使用します。")
    print()

    routine = {}
    for task, default_min in DEFAULT_ROUTINE.items():
        mins = get_int_input(f"  {task} [{default_min}分]: ", default_min)
        routine[task] = mins

    result = calculate_wakeup_time(first_event, routine)
    print()
    print(format_result(result))
    print()


if __name__ == "__main__":
    main()
