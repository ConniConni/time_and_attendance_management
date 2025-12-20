/**
 * 勤務記録の型定義
 */
export interface WorkRecord {
  date: string; // 'YYYY-MM-DD'
  start: string; // 'HH:mm' or 'HH:mm' (24+ hour format for date-crossing)
  end: string; // 'HH:mm' or 'HH:mm' (24+ hour format for date-crossing)
}

/**
 * 残業計算結果の型定義
 */
export interface OvertimeResult {
  normalOvertime: number; // 通常残業時間（60時間まで）
  premiumOvertime: number; // 割増残業時間（60時間超過分）
  holidayWork: number; // 休日出勤時間
  totalOvertime: number; // 通常残業 + 割増残業
  totalHours: number; // 全体の合計
}

/**
 * 時間文字列（HH:mm または HH:mm:ss）を分単位に変換
 * @param timeStr - 時間文字列 (例: '18:30' or '25:00' or '18:30:45')
 * @returns 分単位の数値
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  // 秒数は無視（parts[2]があっても使わない）

  if (isNaN(hours) || isNaN(minutes)) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  if (hours < 0 || minutes < 0 || minutes >= 60) {
    throw new Error(`Invalid time values: ${timeStr}`);
  }

  // 30時間以上の時刻は不正とする（日付跨ぎでも現実的でない）
  if (hours >= 30) {
    throw new Error(`Invalid hour value: ${timeStr}`);
  }

  return hours * 60 + minutes;
}

/**
 * 分を15分単位で切り上げ
 * @param minutes - 分数
 * @returns 15分単位に切り上げた分数
 */
function roundUpTo15Minutes(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

/**
 * 分を時間単位に変換（小数第2位まで）
 * @param minutes - 分数
 * @returns 時間数
 */
function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 指定された日付が週末（土曜または日曜）かどうかを判定
 * @param dateStr - 日付文字列 'YYYY-MM-DD'
 * @returns 週末の場合true
 */
function isWeekend(dateStr: string): boolean {
  // タイムゾーンの問題を避けるため、年月日を個別に解析
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // monthは0-indexedなので-1
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0: Sunday, 6: Saturday
}

/**
 * 指定された日付が祝日かどうかを判定
 * @param dateStr - 日付文字列 'YYYY-MM-DD'
 * @param holidays - 祝日の配列
 * @returns 祝日の場合true
 */
function isHoliday(dateStr: string, holidays: string[] = []): boolean {
  return holidays.includes(dateStr);
}

/**
 * 日付文字列の妥当性をチェック
 * @param dateStr - 日付文字列 'YYYY-MM-DD'
 */
function validateDate(dateStr: string): void {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  if (year < 1900 || year > 2100) {
    throw new Error(`Invalid year: ${dateStr}`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${dateStr}`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${dateStr}`);
  }

  // 実際の日付として妥当かチェック
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
}

/**
 * 1日の勤務記録から残業時間を計算
 * @param record - 勤務記録
 * @returns 残業時間（分単位）、休日フラグ
 */
function calculateDailyOvertime(
  record: WorkRecord,
  holidays: string[] = []
): { overtimeMinutes: number; isHolidayWork: boolean; totalWorkMinutes: number } {
  // 日付の妥当性チェック
  validateDate(record.date);

  const startMinutes = parseTimeToMinutes(record.start);
  const endMinutes = parseTimeToMinutes(record.end);

  // 総勤務時間を計算
  const totalWorkMinutes = endMinutes - startMinutes;

  // 退勤時刻が出勤時刻より早い場合（日付跨ぎでない場合）はエラー
  if (totalWorkMinutes < 0 && endMinutes < 24 * 60) {
    throw new Error(`End time is before start time: ${record.start} - ${record.end}`);
  }

  // 日付跨ぎの場合は終了日を計算
  let workDate = record.date;
  if (endMinutes >= 24 * 60) {
    // 24時を超えている場合は翌日として扱う
    const [year, month, day] = record.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1); // 翌日
    workDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // 休日判定（週末または祝日）- 日付跨ぎの場合は終了日で判定
  const isHolidayWork = isWeekend(workDate) || isHoliday(workDate, holidays);

  // 休日出勤の場合は、全時間を休日出勤として扱う
  if (isHolidayWork) {
    return {
      overtimeMinutes: 0,
      isHolidayWork: true,
      totalWorkMinutes: roundUpTo15Minutes(totalWorkMinutes)
    };
  }

  // 18:00（1080分）を基準として残業時間を計算
  const overtimeThreshold = 18 * 60; // 18:00 = 1080分

  // 18:00以降の勤務時間を計算
  // 勤務開始が18:00より後なら、終了時刻から開始時刻を引いた時間が残業
  // 勤務開始が18:00以前なら、終了時刻から18:00を引いた時間が残業
  // 18:00ちょうどは残業に含まない（18:01から）
  const overtimeStartMinutes = Math.max(startMinutes, overtimeThreshold);
  const overtimeMinutes = Math.max(0, endMinutes - overtimeStartMinutes);

  // 15分単位で切り上げ
  const roundedOvertimeMinutes = overtimeMinutes > 0 ? roundUpTo15Minutes(overtimeMinutes) : 0;

  return {
    overtimeMinutes: roundedOvertimeMinutes,
    isHolidayWork: false,
    totalWorkMinutes: roundUpTo15Minutes(totalWorkMinutes)
  };
}

/**
 * 月次の残業時間を計算
 * @param records - 勤務記録の配列
 * @param holidays - 祝日の配列（オプション）
 * @returns 残業計算結果
 */
export function calculateMonthlyOvertime(
  records: WorkRecord[],
  holidays: string[] = []
): OvertimeResult {
  // 入力バリデーション
  if (!records || !Array.isArray(records)) {
    throw new Error('Invalid input: records must be an array');
  }

  // 空配列の場合は全て0を返す
  if (records.length === 0) {
    return {
      normalOvertime: 0,
      premiumOvertime: 0,
      holidayWork: 0,
      totalOvertime: 0,
      totalHours: 0
    };
  }

  let totalOvertimeMinutes = 0;
  let totalHolidayWorkMinutes = 0;
  let totalWorkMinutes = 0;

  // 各日の勤務記録を処理
  for (const record of records) {
    // レコードのバリデーション
    if (!record || typeof record !== 'object') {
      throw new Error('Invalid record: each record must be an object');
    }

    if (!record.date || !record.start || !record.end) {
      throw new Error('Invalid record: date, start, and end are required');
    }

    const { overtimeMinutes, isHolidayWork, totalWorkMinutes: dailyWorkMinutes } =
      calculateDailyOvertime(record, holidays);

    if (isHolidayWork) {
      totalHolidayWorkMinutes += dailyWorkMinutes;
    } else {
      totalOvertimeMinutes += overtimeMinutes;
    }

    totalWorkMinutes += dailyWorkMinutes;
  }

  // 時間単位に変換
  const totalOvertimeHours = minutesToHours(totalOvertimeMinutes);
  const holidayWorkHours = minutesToHours(totalHolidayWorkMinutes);

  // 60時間を境に通常残業と割増残業を分ける
  const premiumThreshold = 60;
  let normalOvertime = 0;
  let premiumOvertime = 0;

  if (totalOvertimeHours <= premiumThreshold) {
    normalOvertime = totalOvertimeHours;
    premiumOvertime = 0;
  } else {
    normalOvertime = premiumThreshold;
    premiumOvertime = totalOvertimeHours - premiumThreshold;
  }

  // 小数点第2位で丸める
  normalOvertime = Math.round(normalOvertime * 100) / 100;
  premiumOvertime = Math.round(premiumOvertime * 100) / 100;
  const holidayWork = Math.round(holidayWorkHours * 100) / 100;
  const totalOvertime = Math.round((normalOvertime + premiumOvertime) * 100) / 100;
  const totalHours = Math.round((totalOvertime + holidayWork) * 100) / 100;

  return {
    normalOvertime,
    premiumOvertime,
    holidayWork,
    totalOvertime,
    totalHours
  };
}
