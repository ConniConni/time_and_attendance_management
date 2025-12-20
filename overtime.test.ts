import { describe, test, expect } from '@jest/globals';
import { calculateMonthlyOvertime, WorkRecord, OvertimeResult } from './overtime';

describe('残業時間計算 - 正常系', () => {
  test('18:00前退勤の場合、残業時間は0', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '17:30' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0);
    expect(result.premiumOvertime).toBe(0);
    expect(result.totalOvertime).toBe(0);
  });

  test('18:01退勤の場合、1分を15分に切り上げて0.25時間の残業', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:01' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25); // 15分 = 0.25時間
  });

  test('複数日の残業を合計', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '19:00' }, // 1時間
      { date: '2025-01-16', start: '09:00', end: '20:00' }, // 2時間
      { date: '2025-01-17', start: '09:00', end: '19:30' }, // 1.5時間
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(4.5);
    expect(result.premiumOvertime).toBe(0);
  });

  test('60時間以内の残業は通常残業のみ', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 20営業日分のデータを作成（土日を除く）
    while (businessDays < 20) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '20:00', // 2時間残業
        });
        businessDays++;
      }
      day++;
    }

    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(40); // 20営業日 × 2時間
    expect(result.premiumOvertime).toBe(0);
    expect(result.totalOvertime).toBe(40);
  });

  test('60時間超過の残業は割増計算（70時間の場合）', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 20営業日 × 3.5時間 = 70時間（土日を除く）
    while (businessDays < 20 && day <= 31) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '21:30', // 3.5時間残業
        });
        businessDays++;
      }
      day++;
    }

    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(60); // 最初の60時間
    expect(result.premiumOvertime).toBe(10); // 60時間超過分
    expect(result.totalOvertime).toBe(70); // 20営業日 × 3.5時間
  });
});

describe('残業時間計算 - 境界値テスト', () => {
  test('18:00ちょうどの退勤は残業に含まない', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:00' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0);
  });

  test('18:01の退勤は残業に含む（15分切り上げ）', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:01' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25);
  });

  test('60時間ちょうどは割増なし', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 20営業日 × 3時間 = 60時間（土日を除く）
    while (businessDays < 20 && day <= 31) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '21:00', // 3時間残業
        });
        businessDays++;
      }
      day++;
    }

    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(60); // 20営業日 × 3時間
    expect(result.premiumOvertime).toBe(0);
  });

  test('60時間を1分超過すると割増発生（15分切り上げ）', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 20営業日 × 3時間 = 60時間（土日を除く）
    while (businessDays < 20 && day <= 31) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '21:00', // 3時間残業
        });
        businessDays++;
      }
      day++;
    }

    // さらに次の営業日に1分超過（15分切り上げで0.25時間）
    while (day <= 31) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '18:01',
        });
        break;
      }
      day++;
    }

    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(60);
    expect(result.premiumOvertime).toBe(0.25);
    expect(result.totalOvertime).toBe(60.25);
  });

  test('15分単位の切り上げ - 1分', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:01' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25); // 15分に切り上げ
  });

  test('15分単位の切り上げ - 7分', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:07' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25); // 15分に切り上げ
  });

  test('15分単位の切り上げ - 14分', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:14' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25); // 15分に切り上げ
  });

  test('15分単位の切り上げ - 15分ちょうど', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:15' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.25);
  });

  test('15分単位の切り上げ - 16分', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:16' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.5); // 30分に切り上げ
  });

  test('15分単位の切り上げ - 23分', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '18:23' },
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0.5); // 30分に切り上げ
  });
});

describe('残業時間計算 - 異常系', () => {
  test('空配列の場合、すべて0を返す', () => {
    const records: WorkRecord[] = [];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(0);
    expect(result.premiumOvertime).toBe(0);
    expect(result.holidayWork).toBe(0);
    expect(result.totalOvertime).toBe(0);
    expect(result.totalHours).toBe(0);
  });

  test('nullが渡された場合、エラーまたは空結果を返す', () => {
    expect(() => {
      calculateMonthlyOvertime(null as any);
    }).toThrow();
  });

  test('undefinedが渡された場合、エラーまたは空結果を返す', () => {
    expect(() => {
      calculateMonthlyOvertime(undefined as any);
    }).toThrow();
  });

  test('不正な日付形式の場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: 'invalid-date', start: '09:00', end: '18:00' },
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('不正な時刻形式の場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: 'invalid', end: '18:00' },
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('出勤時刻のみで退勤時刻がない場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '' },
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('退勤時刻のみで出勤時刻がない場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '', end: '18:00' },
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('退勤が出勤より早い時刻の場合（日付跨ぎでない）、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '18:00', end: '09:00' },
    ];
    // これは日付跨ぎと解釈されるべきか、エラーとするかは仕様次第
    // ここではエラーとして扱う想定
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('負の時刻の場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '-01:00', end: '18:00' },
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });

  test('24時を超える時刻（日付跨ぎ表記）が不正な場合、エラーを返す', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '30:00' }, // 30:00は不正
    ];
    expect(() => {
      calculateMonthlyOvertime(records);
    }).toThrow();
  });
});

describe('残業時間計算 - エッジケース（日付跨ぎ）', () => {
  test('日付跨ぎ（23:00-翌2:00）は終了日の残業とする', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '23:00', end: '26:00' }, // 26:00 = 翌2:00
    ];
    const result = calculateMonthlyOvertime(records);
    // 23:00-26:00 = 3時間の勤務、全て18:00以降なので全て残業
    expect(result.normalOvertime).toBe(3);
  });

  test('日付跨ぎ（19:00-翌1:00）の残業計算', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '19:00', end: '25:00' }, // 25:00 = 翌1:00
    ];
    const result = calculateMonthlyOvertime(records);
    // 19:00-25:00 = 6時間、うち18:00以降は19:00-25:00 = 6時間
    expect(result.normalOvertime).toBe(6);
  });

  test('日付跨ぎ（17:00-翌2:00）で18:00以降のみカウント', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '17:00', end: '26:00' }, // 26:00 = 翌2:00
    ];
    const result = calculateMonthlyOvertime(records);
    // 18:00-26:00 = 8時間の残業
    expect(result.normalOvertime).toBe(8);
  });

  test('月末の日付跨ぎ（1/31 23:00 - 2/1 2:00）', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-31', start: '23:00', end: '26:00' },
    ];
    const result = calculateMonthlyOvertime(records);
    // 23:00-26:00 = 3時間の勤務
    // 終了日（2/1）は土曜日なので休日出勤として扱う
    expect(result.normalOvertime).toBe(0);
    expect(result.holidayWork).toBe(3);
  });

  test('日付跨ぎで18:00以前に終了（17:00-翌1:00）', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '17:00', end: '25:00' },
    ];
    const result = calculateMonthlyOvertime(records);
    // 17:00-25:00 = 8時間勤務、うち18:00-25:00 = 7時間が残業
    expect(result.normalOvertime).toBe(7);
  });
});

describe('残業時間計算 - 休日出勤（土日）', () => {
  test('土曜出勤は休日出勤としてカウント', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-18', start: '09:00', end: '17:00' }, // 土曜日、8時間
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.holidayWork).toBe(8);
    expect(result.normalOvertime).toBe(0); // 休日出勤は通常残業にカウントしない
  });

  test('日曜出勤は休日出勤としてカウント', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-19', start: '09:00', end: '17:00' }, // 日曜日、8時間
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.holidayWork).toBe(8);
    expect(result.normalOvertime).toBe(0);
  });

  test('土日の残業時間も休日出勤時間に含む', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-18', start: '09:00', end: '20:00' }, // 土曜日、11時間
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.holidayWork).toBe(11); // 全時間を休日出勤としてカウント
    expect(result.normalOvertime).toBe(0);
  });

  test('平日と休日が混在する場合', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00', end: '20:00' }, // 平日（水）、2時間残業
      { date: '2025-01-18', start: '09:00', end: '17:00' }, // 土曜、8時間休日出勤
      { date: '2025-01-20', start: '09:00', end: '19:00' }, // 平日（月）、1時間残業
    ];
    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(3);
    expect(result.holidayWork).toBe(8);
  });
});

describe('残業時間計算 - 祝日出勤', () => {
  test('祝日出勤は休日出勤としてカウント', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-13', start: '09:00', end: '17:00' }, // 成人の日（祝日）
    ];
    const holidays = ['2025-01-13'];
    const result = calculateMonthlyOvertime(records, holidays);
    expect(result.holidayWork).toBe(8);
    expect(result.normalOvertime).toBe(0);
  });

  test('複数の祝日がある月', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-01', start: '09:00', end: '17:00' }, // 元日
      { date: '2025-01-13', start: '09:00', end: '17:00' }, // 成人の日
      { date: '2025-01-15', start: '09:00', end: '20:00' }, // 平日、2時間残業
    ];
    const holidays = ['2025-01-01', '2025-01-13'];
    const result = calculateMonthlyOvertime(records, holidays);
    expect(result.holidayWork).toBe(16); // 8時間 × 2日
    expect(result.normalOvertime).toBe(2);
  });

  test('祝日が土日と重なる場合', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-11', start: '09:00', end: '17:00' }, // 土曜日で祝日
    ];
    const holidays = ['2025-01-11'];
    const result = calculateMonthlyOvertime(records, holidays);
    // 土日かつ祝日の場合、休日出勤として1回だけカウント
    expect(result.holidayWork).toBe(8);
  });
});

describe('残業時間計算 - 複合シナリオ', () => {
  test('通常残業 + 割増残業 + 休日出勤の混在', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 20営業日 × 3.5時間 = 70時間（土日を除く）
    while (businessDays < 20 && day <= 31) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '21:30', // 3.5時間残業
        });
        businessDays++;
      }
      day++;
    }

    // 土日の休日出勤を追加
    records.push(
      { date: '2025-01-25', start: '09:00', end: '17:00' }, // 土曜、8時間
      { date: '2025-01-26', start: '09:00', end: '17:00' }  // 日曜、8時間
    );

    const result = calculateMonthlyOvertime(records);
    expect(result.normalOvertime).toBe(60); // 最初の60時間
    expect(result.premiumOvertime).toBe(10); // 60時間超過分
    expect(result.holidayWork).toBe(16); // 土日 8時間 × 2日
    expect(result.totalOvertime).toBe(70); // 20営業日 × 3.5時間
    expect(result.totalHours).toBe(86); // 70 + 16
  });

  test('日付跨ぎ + 休日出勤', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-17', start: '23:00', end: '26:00' }, // 金曜深夜→土曜早朝
    ];
    const result = calculateMonthlyOvertime(records);
    // 終了日（土曜）の残業とするため、休日出勤としてカウント
    expect(result.holidayWork).toBe(3); // 23:00-26:00 = 3時間
  });

  test('15分切り上げ + 60時間境界', () => {
    const records: WorkRecord[] = [];
    let businessDays = 0;
    let day = 1;

    // 15営業日分のデータを作成（土日を除く）
    while (businessDays < 15) {
      const dateStr = `2025-01-${String(day).padStart(2, '0')}`;
      const [year, month, dayNum] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, dayNum);
      const dayOfWeek = date.getDay();

      // 土日でなければ追加
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        records.push({
          date: dateStr,
          start: '09:00',
          end: '21:59', // 3時間59分の残業 → 4時間に切り上げ
        });
        businessDays++;
      }
      day++;
    }

    const result = calculateMonthlyOvertime(records);
    // 15営業日 × 4時間 = 60時間
    expect(result.normalOvertime).toBe(60);
    expect(result.premiumOvertime).toBe(0);
  });

  test('1ヶ月の実際のシナリオ（2025年1月）', () => {
    const records: WorkRecord[] = [
      // 1/1 (水) 元日 - 祝日
      { date: '2025-01-01', start: '10:00', end: '15:00' },
      // 1/2 (木) - 平日
      { date: '2025-01-02', start: '09:00', end: '19:00' },
      // 1/3 (金) - 平日
      { date: '2025-01-03', start: '09:00', end: '20:30' },
      // 1/4 (土) - 休日
      // 休み
      // 1/5 (日) - 休日
      // 休み
      // 1/6 (月) - 平日
      { date: '2025-01-06', start: '09:00', end: '18:30' },
      // 1/7 (火) - 平日
      { date: '2025-01-07', start: '09:00', end: '21:00' },
      // ... 以降の営業日
    ];
    const holidays = ['2025-01-01', '2025-01-13'];
    const result = calculateMonthlyOvertime(records, holidays);

    // 1/1: 5時間（祝日出勤）
    // 1/2: 19:00退勤 → 1時間残業
    // 1/3: 20:30退勤 → 2.5時間残業
    // 1/6: 18:30退勤 → 0.5時間残業
    // 1/7: 21:00退勤 → 3時間残業
    expect(result.holidayWork).toBe(5);
    expect(result.normalOvertime).toBe(7); // 1 + 2.5 + 0.5 + 3
  });

  test('打刻時刻の秒数が含まれる場合も正しく処理', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '09:00:00', end: '18:01:30' } as any,
    ];
    const result = calculateMonthlyOvertime(records);
    // 18:01:30 → 18:15に切り上げ → 0.25時間
    expect(result.normalOvertime).toBe(0.25);
  });
});

describe('残業時間計算 - ストレステスト', () => {
  test('大量のレコード（1年分）を処理できる', () => {
    const records: WorkRecord[] = [];
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 28; day++) {
        records.push({
          date: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          start: '09:00',
          end: '19:00',
        });
      }
    }

    expect(() => {
      const result = calculateMonthlyOvertime(records);
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  test('連続した日付跨ぎ勤務', () => {
    const records: WorkRecord[] = [
      { date: '2025-01-15', start: '20:00', end: '28:00' }, // 翌1/16 4:00まで（木曜）
      { date: '2025-01-16', start: '20:00', end: '28:00' }, // 翌1/17 4:00まで（金曜）
      { date: '2025-01-17', start: '20:00', end: '28:00' }, // 翌1/18 4:00まで（土曜）
    ];
    const result = calculateMonthlyOvertime(records);
    // 1-2つ目: 各8時間の残業（終了日が平日）
    // 3つ目: 8時間の休日出勤（終了日が土曜）
    expect(result.normalOvertime).toBe(16); // 8時間 × 2日
    expect(result.holidayWork).toBe(8); // 土曜分
  });
});
