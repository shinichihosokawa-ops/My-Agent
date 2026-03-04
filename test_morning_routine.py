#!/usr/bin/env python3
"""朝のルーティン計算ツールのテスト"""

from datetime import datetime, timedelta
from morning_routine_calculator import calculate_wakeup_time, format_result, DEFAULT_ROUTINE


def test_default_routine():
    """デフォルトルーティンで正しく計算されるか確認"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    first_event = datetime.combine(tomorrow, datetime.strptime("09:00", "%H:%M").time())

    result = calculate_wakeup_time(first_event)

    total = sum(DEFAULT_ROUTINE.values())  # 70分
    expected_wakeup = first_event - timedelta(minutes=total)

    assert result["wakeup_time"] == expected_wakeup, (
        f"起床時刻が正しくありません: {result['wakeup_time']} != {expected_wakeup}"
    )
    assert result["total_prep_minutes"] == total
    print(f"  ✓ 9:00 イベント → 起床時刻: {result['wakeup_time'].strftime('%H:%M')} (準備 {total} 分)")


def test_custom_routine():
    """カスタムルーティンで計算できるか確認"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    first_event = datetime.combine(tomorrow, datetime.strptime("10:30", "%H:%M").time())

    custom = {"シャワー": 20, "朝ご飯": 30, "バッファ": 10}
    result = calculate_wakeup_time(first_event, custom)

    expected_wakeup = first_event - timedelta(minutes=60)
    assert result["wakeup_time"] == expected_wakeup
    print(f"  ✓ 10:30 イベント (カスタム60分) → 起床時刻: {result['wakeup_time'].strftime('%H:%M')}")


def test_schedule_order():
    """タイムラインが時系列順になっているか確認"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    first_event = datetime.combine(tomorrow, datetime.strptime("08:00", "%H:%M").time())

    result = calculate_wakeup_time(first_event)
    times = [t for _, t in result["schedule"]]

    for i in range(1, len(times)):
        assert times[i] > times[i - 1], "タイムラインが時系列順になっていません"

    print(f"  ✓ タイムライン順序が正しい ({len(times)} 項目)")


def test_format_output():
    """フォーマット出力が起床時刻を含むか確認"""
    tomorrow = datetime.now().date() + timedelta(days=1)
    first_event = datetime.combine(tomorrow, datetime.strptime("09:30", "%H:%M").time())

    result = calculate_wakeup_time(first_event)
    output = format_result(result)

    assert result["wakeup_time"].strftime("%H:%M") in output
    assert "推奨起床時刻" in output
    print(f"  ✓ フォーマット出力に起床時刻が含まれる")


if __name__ == "__main__":
    print()
    print("テスト実行中...")
    print()
    test_default_routine()
    test_custom_routine()
    test_schedule_order()
    test_format_output()
    print()
    print("  全テスト通過!")
    print()
