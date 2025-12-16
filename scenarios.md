# 将来シナリオ対応難易度評価

## 目次
- [シナリオ1: シフト管理機能の追加](#シナリオ1-シフト管理機能の追加早番遅番など)
- [シナリオ2: 従業員数が10倍（1000人）に増加](#シナリオ2-従業員数が10倍1000人に増加)
- [シナリオ3: 拠点ごとの祝日設定への対応](#シナリオ3-拠点ごとの祝日設定への対応)
- [総合比較表](#総合比較表)

---

## シナリオ1: シフト管理機能の追加（早番・遅番など）

### 案A: シンプル型

**対応難易度: ★★★★☆（高）**

#### 現状の問題点
- `users`テーブルで固定の勤務形態のみを想定
- `attendance_records`の残業計算が標準勤務時間（9:00-18:00）に固定
- シフトパターンを管理する仕組みが存在しない

#### 必要な修正内容

**1. テーブル追加（3個）**
```yaml
shift_patterns:
  description: シフトパターン定義（早番、遅番、夜勤など）
  columns:
    - name: id (UUID, PK)
    - name: name (VARCHAR) # 例: "早番", "遅番"
    - name: start_time (TIME) # 例: "06:00"
    - name: end_time (TIME) # 例: "15:00"
    - name: break_minutes (INTEGER)
    - name: work_minutes (INTEGER)

shift_assignments:
  description: ユーザーへのシフト割り当て
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK)
    - name: shift_pattern_id (UUID, FK)
    - name: work_date (DATE)
    - name: is_confirmed (BOOLEAN)

# または既存テーブルにJSONBで追加
# attendance_records.shift_info (JSONB)
```

**2. 既存テーブルの修正**
- `attendance_records`の`overtime_minutes`計算ロジックを変更
- シフトパターンに応じた残業時間計算が必要

**3. アプリケーション層の修正**
- 残業時間計算ロジックの大幅な変更
- シフト管理画面の追加
- 承認フローにシフト情報を含める

#### 評価
- **メリット**: JSONB活用で柔軟に対応できる余地はある
- **デメリット**:
  - テーブル追加が必要
  - 既存の計算ロジックの大幅な変更が必要
  - データ整合性の維持が困難（アプリケーション層に依存）
- **移行コスト**: 既存データのマイグレーション必要（過去のシフト情報は復元不可）

---

### 案B: バランス型

**対応難易度: ★★★☆☆（中）**

#### 現状の問題点
- `employment_types`で標準労働時間を定義しているが、固定
- 日ごとのシフト変動に対応していない

#### 必要な修正内容

**1. テーブル追加（3個）**
```yaml
shift_patterns:
  description: シフトパターン定義
  columns:
    - name: id (UUID, PK)
    - name: code (VARCHAR, UK)
    - name: name (VARCHAR) # 早番、遅番、夜勤
    - name: start_time (TIME)
    - name: end_time (TIME)
    - name: break_minutes (INTEGER)
    - name: is_active (BOOLEAN)

user_shift_assignments:
  description: ユーザーシフト割り当て
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK to users.id)
    - name: shift_pattern_id (UUID, FK to shift_patterns.id)
    - name: work_date (DATE)
    - name: assigned_by (UUID, FK to users.id)
    - name: is_confirmed (BOOLEAN)
  indexes:
    - columns: [user_id, work_date]

shift_change_requests:
  description: シフト変更申請（オプション）
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK)
    - name: original_shift_id (UUID, FK)
    - name: requested_shift_id (UUID, FK)
    - name: work_date (DATE)
    - name: reason (TEXT)
```

**2. 既存テーブルの修正**
- `work_summaries`テーブルに`shift_pattern_id`カラムを追加
- `time_clocks`テーブルに`shift_pattern_id`カラムを追加（オプション）

**3. 承認フローの拡張**
- `approvals`テーブルの`request_type`ENUMに'shift_change'を追加
- 既存の承認フローをそのまま利用可能

**4. 集計ロジックの更新**
- `work_summaries`の計算ロジックをシフトパターンに対応
- `regular_work_minutes`の計算にシフト情報を反映

#### 評価
- **メリット**:
  - 既存の設計思想（テーブル分割、承認フロー）に沿って拡張可能
  - 集計テーブルの構造を活かせる
  - データ整合性を維持しやすい
- **デメリット**:
  - テーブル追加が必要
  - バッチ処理の更新が必要
- **移行コスト**: 中程度（過去データは標準シフトとして扱う）

---

### 案C: 高拡張性型

**対応難易度: ★★☆☆☆（低）**

#### 現状の問題点
- `employment_types`で標準労働時間を定義しているが、シフト変動に未対応
- ただし、設計思想的には拡張を想定済み

#### 必要な修正内容

**1. テーブル追加（5個）**
```yaml
# 勤怠記録ドメインに追加
shift_patterns:
  description: シフトパターンマスタ
  columns:
    - name: id (UUID, PK)
    - name: code (VARCHAR, UK)
    - name: name (VARCHAR)
    - name: start_time (TIME)
    - name: end_time (TIME)
    - name: required_break_minutes (INTEGER)
    - name: is_active (BOOLEAN)
    - name: created_at (TIMESTAMP)

shift_assignment_rules:
  description: シフト割り当てルール（部署別など）
  columns:
    - name: id (UUID, PK)
    - name: department_id (UUID, FK)
    - name: shift_pattern_id (UUID, FK)
    - name: day_of_week (INTEGER) # 1-7
    - name: effective_from (DATE)
    - name: effective_to (DATE)

user_shift_assignments:
  description: ユーザー個別のシフト割り当て
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK)
    - name: shift_pattern_id (UUID, FK)
    - name: work_date (DATE)
    - name: assignment_type (ENUM: 'rule_based', 'manual', 'requested')
    - name: assigned_by (UUID, FK)
    - name: assigned_at (TIMESTAMP)
  indexes:
    - columns: [user_id, work_date]

shift_change_requests:
  description: シフト変更申請
  columns:
    - name: id (UUID, PK)
    - name: request_number (VARCHAR, UK)
    - name: user_id (UUID, FK)
    - name: work_date (DATE)
    - name: original_shift_id (UUID, FK)
    - name: requested_shift_id (UUID, FK)
    - name: reason (TEXT)
    - name: current_status (ENUM)
    - name: submitted_at (TIMESTAMP)

shift_actuals:
  description: シフト実績（計画との差異管理）
  columns:
    - name: id (UUID, PK)
    - name: work_session_id (UUID, FK)
    - name: planned_shift_id (UUID, FK)
    - name: actual_shift_id (UUID, FK) # 実際の勤務形態
    - name: variance_minutes (INTEGER)
```

**2. 既存テーブルの修正**
- `work_sessions`テーブルに`shift_pattern_id`カラムを追加
- `work_time_calculations`の`calculation_version`を更新（計算ロジック変更）

**3. 承認フローの拡張**
- `request_types`マスタに新しいレコード追加（'shift_change'）
- 既存の`approval_flow_templates`を再利用可能
- `approval_instances`で既存の承認フローを活用

**4. 集計ロジックの更新**
- `work_time_calculations`の計算ロジックを拡張（`calculation_version`で管理）
- イベントソーシングのため、過去データも再計算可能

#### 評価
- **メリット**:
  - ドメイン分離設計により、影響範囲が限定的
  - イベントソーシングで過去データの再計算が可能
  - 承認フローのテンプレート化により、新しい申請タイプの追加が容易
  - `calculation_version`により、計算ロジックの変更履歴を管理可能
- **デメリット**:
  - テーブル数が増える（ただし設計思想に沿っている）
- **移行コスト**: 低（イベント再生で過去データも再計算可能）

---

## シナリオ2: 従業員数が10倍（1000人）に増加

### 案A: シンプル型

**対応難易度: ★★★★★（非常に高・実質的に再設計が必要）**

#### 現状の問題点
- 50名以下を想定した設計
- `attendance_records`が単一テーブルで肥大化
- 集計処理がリアルタイムで実行（事前集計なし）
- JSONB検索が重い

#### 発生する性能問題

**1. データ量の試算**
- 従業員数: 1000名
- 年間営業日: 250日
- 5年保存: 1000 × 250 × 5 = 1,250,000レコード（attendance_records）
- JSONB カラムを含むため、1レコードあたり平均2-3KB
- 合計: 約2.5-3.75GB（インデックス除く）

**2. 性能劣化ポイント**
- `attendance_records`のフルスキャンが頻発
- JSONB カラム（`location_info`, `breaks`）の検索が極端に遅い
- 月次集計がリアルタイム計算のため、数分〜数十分かかる
- 承認待ちリスト取得が遅い（複数JOINと大量レコードスキャン）

#### 必要な修正内容

**1. パーティショニングの導入**
```sql
-- attendance_recordsを月次パーティショニング
ALTER TABLE attendance_records PARTITION BY RANGE (work_date);
CREATE TABLE attendance_records_2025_01 PARTITION OF attendance_records
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- 以下、月ごとに作成...
```

**2. 集計テーブルの追加**
```yaml
daily_summaries:
  # 案Bのwork_summariesと同等

monthly_summaries:
  # 案Bのmonthly_summariesと同等
```

**3. インデックスの大幅な見直し**
```sql
-- JSONB GINインデックスの追加
CREATE INDEX idx_attendance_location ON attendance_records
  USING GIN (location_info);

-- 複合インデックスの追加
CREATE INDEX idx_attendance_status_date ON attendance_records
  (status, work_date) WHERE status != 'normal';
```

**4. キャッシング戦略の導入**
- Redis等のキャッシュサーバー導入
- 集計結果のキャッシュ
- 承認待ちリストのキャッシュ

**5. データアーカイブ戦略**
- 1年以上前のデータを別テーブルに移動
- 参照頻度の低いデータの分離

#### 評価
- **実質的な対応**: 案Bへの移行が現実的
- **移行コスト**: 非常に高い（テーブル構造の大幅変更、データマイグレーション、アプリケーション全面改修）
- **ダウンタイム**: 長時間のメンテナンスウィンドウが必要
- **結論**: 案Aは1000名規模に対応できない。最初から案Bを選ぶべき

---

### 案B: バランス型

**対応難易度: ★★★☆☆（中・チューニングとインフラ強化で対応可能）**

#### 現状の問題点
- 50-500名を想定（1000名は想定範囲を超える）
- ただし、構造的には対応可能

#### 発生する可能性のある問題

**1. データ量の試算**
- `time_clocks`: 1000 × 250 × 5 = 1,250,000レコード
- `work_summaries`: 1,250,000レコード（1:1関係）
- `monthly_summaries`: 1000 × 12 × 5 = 60,000レコード
- `breaks`: 約2,500,000レコード（1日2回平均）
- 合計: 約5,000,000レコード

**2. 性能への影響**
- 集計テーブルがあるため、参照性能は維持できる
- バッチ処理の実行時間が増加
- 複雑なJOINクエリで若干の遅延

#### 必要な修正内容

**1. パーティショニングの導入（推奨）**
```sql
-- time_clocksを年次パーティショニング
ALTER TABLE time_clocks PARTITION BY RANGE (work_date);

-- audit_logsを月次パーティショニング
ALTER TABLE audit_logs PARTITION BY RANGE (created_at);
```

**2. インデックスの最適化**
```sql
-- 部分インデックスの活用
CREATE INDEX idx_time_clocks_pending ON time_clocks (user_id, work_date)
  WHERE status = 'pending_correction';

-- カバリングインデックス
CREATE INDEX idx_work_summaries_monthly ON work_summaries
  (user_id, work_date) INCLUDE (overtime_minutes, night_work_minutes);
```

**3. バッチ処理の並列化**
```python
# 月次集計を並列実行
from concurrent.futures import ThreadPoolExecutor

def calculate_monthly_summary(user_id, year, month):
    # 集計処理
    pass

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = [executor.submit(calculate_monthly_summary, user_id, year, month)
               for user_id in user_ids]
```

**4. キャッシング戦略**
- Redis で承認待ちリストをキャッシュ
- マテリアライズドビューの活用（オプション）

**5. データベースサーバーのスケールアップ**
- メモリ増強（32GB → 64GB）
- CPU増強（4コア → 8コア）
- SSD化（IOPS向上）

**6. 読み取りレプリカの導入**
- マスター: 書き込み専用
- レプリカ: 集計・レポート用の読み取り専用

#### 評価
- **メリット**:
  - テーブル構造の変更は最小限
  - 集計テーブルの設計が活きる
  - 段階的なチューニングで対応可能
- **デメリット**:
  - インフラコストの増加
  - バッチ処理の最適化が必要
- **移行コスト**: 低〜中（主にインフラ強化とチューニング）
- **ダウンタイム**: 最小限（パーティショニング導入時のみ）

---

### 案C: 高拡張性型

**対応難易度: ★☆☆☆☆（非常に低・設計思想通りに対応可能）**

#### 現状の問題点
- ほぼなし（500名以上を想定して設計済み）

#### 既存の対応済み機能

**1. パーティショニング対応済み**
```yaml
audit_logs:
  partitioning:
    type: range
    column: created_at
    description: 月次パーティショニング

change_history:
  partitioning:
    type: range
    column: changed_at
    description: 月次パーティショニング
```

**2. イベントソーシングによる効率的な集計**
- `clock_events`から`work_sessions`を生成
- `work_sessions`から`work_time_calculations`を計算
- 階層的な集計テーブル（日次→月次→年次）

**3. ドメイン分離によるマイクロサービス化の準備**
- 勤怠記録ドメイン
- 承認ドメイン
- 集計・分析ドメイン
- アラート・通知ドメイン

#### 必要な修正内容

**1. パーティション数の調整**
```sql
-- 主要テーブルへのパーティショニング拡張
ALTER TABLE clock_events PARTITION BY RANGE (event_timestamp);
ALTER TABLE work_sessions PARTITION BY RANGE (work_date);
```

**2. インデックスの微調整**
```sql
-- 部分インデックスの追加
CREATE INDEX idx_clock_events_recent ON clock_events (user_id, event_timestamp)
  WHERE event_timestamp >= CURRENT_DATE - INTERVAL '30 days';
```

**3. 水平スケーリング（レプリケーション）**
- マスター-レプリカ構成
- ドメインごとにレプリカを分離（オプション）
  - 勤怠記録ドメイン用レプリカ
  - 集計・分析ドメイン用レプリカ

**4. マテリアライズドビューの活用**
```sql
CREATE MATERIALIZED VIEW mv_user_current_overtime AS
SELECT
  u.id,
  ma.total_overtime_minutes,
  mma.avg_2months_overtime
FROM users u
JOIN monthly_aggregations ma ON ...
JOIN multi_month_averages mma ON ...
WHERE ma.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ma.month = EXTRACT(MONTH FROM CURRENT_DATE);

-- 日次リフレッシュ
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_current_overtime;
```

**5. キャッシング戦略**
- Redis でホットデータをキャッシュ
- CDN でレポート画像をキャッシュ

#### 評価
- **メリット**:
  - 最小限の修正で対応可能
  - 設計思想通りにスケール
  - マイクロサービス化により、さらなる拡張が容易
- **デメリット**:
  - 複雑性による運用コストは継続
- **移行コスト**: 非常に低（インフラ強化とパーティション追加のみ）
- **ダウンタイム**: ほぼゼロ

---

## シナリオ3: 拠点ごとの祝日設定への対応

### 案A: シンプル型

**対応難易度: ★★★★☆（高）**

#### 現状の問題点
- `calendar`テーブルが全社共通の祝日のみを管理
- `users`テーブルに拠点情報が存在しない

#### 必要な修正内容

**1. テーブル追加（2個）**
```yaml
locations:
  description: 拠点マスタ
  columns:
    - name: id (UUID, PK)
    - name: code (VARCHAR, UK)
    - name: name (VARCHAR) # 例: "東京本社", "大阪支社"
    - name: timezone (VARCHAR) # 例: "Asia/Tokyo"
    - name: is_active (BOOLEAN)

location_calendars:
  description: 拠点ごとのカレンダー
  columns:
    - name: id (UUID, PK)
    - name: location_id (UUID, FK to locations.id)
    - name: calendar_date (DATE)
    - name: day_type (ENUM)
    - name: holiday_name (VARCHAR)
    - name: is_business_day (BOOLEAN)
  indexes:
    - columns: [location_id, calendar_date]
      unique: true
```

**2. 既存テーブルの修正**
```yaml
users:
  # カラム追加
  - name: location_id
    type: UUID
    foreign_key: locations.id
```

**3. 既存データのマイグレーション**
```sql
-- 既存のcalendarデータを全拠点にコピー
INSERT INTO location_calendars (location_id, calendar_date, day_type, holiday_name, is_business_day)
SELECT l.id, c.calendar_date, c.day_type, c.holiday_name, c.is_business_day
FROM calendar c
CROSS JOIN locations l;

-- 既存のusersに仮の拠点を設定
UPDATE users SET location_id = (SELECT id FROM locations WHERE code = 'HQ' LIMIT 1);
```

**4. アプリケーションロジックの修正**
- 残業時間計算で拠点のカレンダーを参照
- 勤務日判定ロジックの変更
- レポート機能で拠点フィルタを追加

#### 評価
- **メリット**: テーブル追加で対応可能
- **デメリット**:
  - 既存の`calendar`テーブルが不要になる（データ重複）
  - 拠点異動の履歴管理ができない
  - アプリケーション層の広範囲な修正が必要
- **移行コスト**: 中〜高（データマイグレーション、アプリケーション修正）

---

### 案B: バランス型

**対応難易度: ★★★☆☆（中）**

#### 現状の問題点
- `calendar`テーブルが全社共通
- 部署はあるが、拠点の概念が不在

#### 必要な修正内容

**1. テーブル追加（3個）**
```yaml
locations:
  description: 拠点マスタ
  columns:
    - name: id (UUID, PK)
    - name: code (VARCHAR, UK)
    - name: name (VARCHAR)
    - name: timezone (VARCHAR)
    - name: country_code (VARCHAR) # ISO 3166-1
    - name: is_active (BOOLEAN)
    - name: created_at (TIMESTAMP)
    - name: updated_at (TIMESTAMP)

user_locations:
  description: ユーザーの拠点履歴
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK to users.id)
    - name: location_id (UUID, FK to locations.id)
    - name: effective_from (DATE)
    - name: effective_to (DATE) # NULL = 現在
    - name: assigned_by (UUID, FK to users.id)
    - name: created_at (TIMESTAMP)
  indexes:
    - columns: [user_id, effective_from]

calendar_locations:
  description: 拠点ごとのカレンダー（多対多）
  columns:
    - name: id (UUID, PK)
    - name: calendar_id (UUID, FK to calendar.id)
    - name: location_id (UUID, FK to locations.id)
    - name: created_at (TIMESTAMP)
  indexes:
    - columns: [location_id, calendar_id]
      unique: true
```

**2. 既存テーブルの修正**
```yaml
departments:
  # カラム追加
  - name: location_id
    type: UUID
    foreign_key: locations.id
    description: 部署の所在拠点
```

**3. 集計ロジックの更新**
- `work_summaries`の計算で拠点カレンダーを参照
- `monthly_summaries`で拠点情報を含める（オプション）

**4. ビューの作成**
```sql
-- ユーザーの現在拠点を取得するビュー
CREATE VIEW v_user_current_locations AS
SELECT
  ul.user_id,
  ul.location_id,
  l.name as location_name,
  l.timezone
FROM user_locations ul
JOIN locations l ON ul.location_id = l.id
WHERE ul.effective_to IS NULL;
```

#### 評価
- **メリット**:
  - 履歴管理が可能（`user_locations`で拠点異動を追跡）
  - 既存の`calendar`テーブルを再利用
  - 設計思想に沿った拡張
- **デメリット**:
  - テーブル間の関係が増える
  - バッチ処理の更新が必要
- **移行コスト**: 中（データマイグレーション、集計ロジック修正）

---

### 案C: 高拡張性型

**対応難易度: ★★☆☆☆（低）**

#### 現状の問題点
- `calendar_dates`テーブルが全社共通
- 拠点の概念が不在（ただし拡張を想定した設計）

#### 必要な修正内容

**1. テーブル追加（5個）**
```yaml
# ユーザー・組織ドメインに追加
locations:
  description: 拠点マスタ
  columns:
    - name: id (UUID, PK)
    - name: code (VARCHAR, UK)
    - name: name (VARCHAR)
    - name: address (TEXT)
    - name: timezone (VARCHAR)
    - name: country_code (VARCHAR)
    - name: region_code (VARCHAR)
    - name: is_active (BOOLEAN)
    - name: created_at (TIMESTAMP)
    - name: updated_at (TIMESTAMP)

user_location_history:
  description: ユーザーの拠点履歴（既存パターンに沿う）
  columns:
    - name: id (UUID, PK)
    - name: user_id (UUID, FK to users.id)
    - name: location_id (UUID, FK to locations.id)
    - name: effective_from (DATE)
    - name: effective_to (DATE)
    - name: assignment_reason (VARCHAR)
    - name: assigned_by (UUID, FK to users.id)
    - name: created_at (TIMESTAMP)
  indexes:
    - columns: [user_id, effective_from]

location_calendar_dates:
  description: 拠点ごとのカレンダー
  columns:
    - name: id (UUID, PK)
    - name: location_id (UUID, FK to locations.id)
    - name: calendar_date (DATE)
    - name: day_type (ENUM)
    - name: holiday_name (VARCHAR)
    - name: is_business_day (BOOLEAN)
    - name: is_special_working_day (BOOLEAN) # 振替出勤日
    - name: created_at (TIMESTAMP)
  indexes:
    - columns: [location_id, calendar_date]
      unique: true
    - columns: [calendar_date, is_business_day]

department_locations:
  description: 部署の拠点履歴
  columns:
    - name: id (UUID, PK)
    - name: department_id (UUID, FK)
    - name: location_id (UUID, FK)
    - name: effective_from (DATE)
    - name: effective_to (DATE)
    - name: created_at (TIMESTAMP)

location_working_hours:
  description: 拠点ごとの標準労働時間
  columns:
    - name: id (UUID, PK)
    - name: location_id (UUID, FK)
    - name: employment_type_id (UUID, FK)
    - name: start_time (TIME)
    - name: end_time (TIME)
    - name: required_break_minutes (INTEGER)
    - name: effective_from (DATE)
    - name: effective_to (DATE)
```

**2. 既存テーブルの修正**
- 修正不要（拡張のみ）

**3. 計算ロジックの更新**
```yaml
work_time_calculations:
  # calculation_versionを更新して拠点カレンダーに対応
  # 既存データも再計算可能（イベントソーシングのメリット）
```

**4. ビューの作成**
```sql
-- ユーザーの現在拠点とカレンダーを取得
CREATE MATERIALIZED VIEW mv_user_location_calendar AS
SELECT
  u.id as user_id,
  ulh.location_id,
  l.name as location_name,
  lcd.calendar_date,
  lcd.is_business_day,
  lcd.holiday_name
FROM users u
JOIN user_location_history ulh ON u.id = ulh.user_id
JOIN locations l ON ulh.location_id = l.id
JOIN location_calendar_dates lcd ON l.id = lcd.location_id
WHERE ulh.effective_to IS NULL;

CREATE INDEX idx_mv_ulc_user_date ON mv_user_location_calendar (user_id, calendar_date);
```

#### 評価
- **メリット**:
  - 既存パターン（履歴テーブル）に沿って自然に拡張
  - イベントソーシングで過去データも拠点カレンダーで再計算可能
  - 拠点異動、部署の拠点変更など、複雑な履歴管理が可能
  - マイクロサービス化時に「拠点管理ドメイン」として分離可能
- **デメリット**:
  - テーブル数が増える（ただし設計思想に沿っている）
- **移行コスト**: 低（拡張のみで既存構造の変更なし、イベント再生で過去データも対応）

---

## 総合比較表

### シナリオ別対応難易度

| シナリオ | 案A: シンプル型 | 案B: バランス型 | 案C: 高拡張性型 |
|---------|----------------|----------------|-----------------|
| **シフト管理追加** | ★★★★☆（高） | ★★★☆☆（中） | ★★☆☆☆（低） |
| **1000人規模化** | ★★★★★（再設計） | ★★★☆☆（中） | ★☆☆☆☆（非常に低） |
| **拠点別祝日対応** | ★★★★☆（高） | ★★★☆☆（中） | ★★☆☆☆（低） |
| **平均難易度** | **★★★★☆** | **★★★☆☆** | **★★☆☆☆** |

### 修正内容の比較

| 修正項目 | 案A | 案B | 案C |
|---------|-----|-----|-----|
| **新規テーブル追加** | 多い | 中程度 | 多いが設計思想に沿う |
| **既存テーブル変更** | 多い | 少ない | ほぼなし |
| **計算ロジック変更** | 大幅 | 中程度 | 最小限 |
| **データマイグレーション** | 複雑 | 中程度 | シンプル |
| **ダウンタイム** | 長い | 短い | 最小限 |
| **後方互換性** | 低い | 中程度 | 高い |

### コスト比較

| コスト項目 | 案A | 案B | 案C |
|-----------|-----|-----|-----|
| **開発コスト** | 高い | 中程度 | 低い |
| **テスト工数** | 高い | 中程度 | 低い |
| **移行リスク** | 高い | 中程度 | 低い |
| **運用影響** | 大きい | 中程度 | 小さい |

---

## 総合評価

### 案A: シンプル型
**将来対応力: ★☆☆☆☆**

- **向いているケース**:
  - 要件が固定的で変更が少ない
  - 小規模のまま（50名以下）維持される確信がある
  - 短期間（1-2年）の運用を想定

- **リスク**:
  - どのシナリオも高難易度で対応
  - 規模拡大時は実質的に再構築が必要
  - 技術的負債が蓄積しやすい

---

### 案B: バランス型
**将来対応力: ★★★★☆**

- **向いているケース**:
  - 段階的な成長を想定
  - 中程度の拡張性が必要
  - バランスの取れた対応を重視

- **強み**:
  - すべてのシナリオで「中程度」の難易度で対応可能
  - テーブル構造の大幅変更なしで拡張できる
  - 実用的な妥協点

---

### 案C: 高拡張性型
**将来対応力: ★★★★★**

- **向いているケース**:
  - 将来の要件が不確定
  - 大規模化や複雑化が予想される
  - 長期運用（10年以上）を想定

- **強み**:
  - すべてのシナリオで低難易度で対応
  - 設計思想に沿った拡張が可能
  - イベントソーシングで過去データも再計算可能
  - マイクロサービス化の準備が整っている

---

## 推奨事項

### 初期選択の指針

1. **案Aを選ぶ場合**:
   - 将来のシナリオ1, 2, 3のいずれも発生しない確信がある場合のみ
   - または、2-3年後に完全リプレイスを計画している場合

2. **案Bを選ぶ場合**:
   - 中規模で安定的に運用する見込み
   - 段階的な拡張で対応可能
   - **最も現実的な選択肢**

3. **案Cを選ぶ場合**:
   - 大規模化や複雑化が確実
   - 初期投資を許容できる
   - 長期的なTCO（総所有コスト）を重視

### 移行戦略

**段階的アプローチ（推奨）**:
1. **フェーズ1**: 案Bでスタート（4-6ヶ月）
2. **フェーズ2**: 運用しながら要件を見極める（6-12ヶ月）
3. **フェーズ3**: 必要に応じて案Cへ進化（8-12ヶ月）

この戦略により、初期投資を抑えつつ、将来の拡張性も確保できます。

---

**作成日**: 2025-12-15
**データソース**: datamodels.md
