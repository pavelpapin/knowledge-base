# Workflow: daily-review

## Purpose
Утренний/вечерний обзор: что сделано, что запланировано, что требует внимания.

## Trigger
- Scheduled: 9:00 (morning), 18:00 (evening)
- Manual: "daily review"

## Prerequisites
- Настроены все интеграции
- GTD система активна
- Логи ведутся

## Steps

### 1. Morning Review

#### 1.1 Calendar Overview
- **Action**: Загрузить события на сегодня
- **Display**:
  ```
  📅 Today: {date}

  09:00 - Team standup (30m)
  11:00 - Call with Client X (1h) ⚡ prep needed
  14:00 - Focus time (blocked)
  16:00 - Interview candidate (45m) ⚡ prep needed
  ```
- **Auto-trigger**: meeting-prep для событий с ⚡

#### 1.2 Task Review
- **Action**: Загрузить задачи из GTD
- **Display**:
  ```
  📋 Tasks for Today:

  Must do (due today):
  - [ ] Send proposal to Client Y
  - [ ] Review PR #123

  Should do (high priority):
  - [ ] Finish blog post draft
  - [ ] Update sales deck

  Could do (if time):
  - [ ] Research competitor Z
  ```

#### 1.3 Inbox Status
- **Check**: Email, Telegram, Slack
- **Display**:
  ```
  📬 Inbox Status:
  - Email: 5 unread (2 VIP)
  - Telegram: 12 messages (3 chats)
  - Slack: 8 mentions

  [Process inboxes now?]
  ```

#### 1.4 Focus Suggestion
- **Based on**: calendar gaps, task priorities, energy
- **Suggest**:
  ```
  💡 Suggested Focus:

  10:00-11:00: Deep work - finish blog post
  (Calendar clear, high priority task, morning energy)
  ```

### 2. Evening Review

#### 2.1 Day Summary
- **Compile from logs**:
  ```
  📊 Day Summary:

  Completed:
  ✓ Team standup
  ✓ Call with Client X - notes saved
  ✓ Sent 5 emails
  ✓ Completed 3 tasks

  Moved to tomorrow:
  → Update sales deck (ran out of time)

  New items added:
  + Follow up with Client X (deadline: Friday)
  + Review contract draft
  ```

#### 2.2 Metrics
- **Calculate**:
  ```
  📈 Metrics:
  - Tasks completed: 3/5 (60%)
  - Emails processed: 15
  - Meetings: 3 (2.5h)
  - Focus time: 2h
  ```

#### 2.3 Tomorrow Preview
- **Display**:
  ```
  🔮 Tomorrow:

  Key events:
  - 10:00 Board meeting (2h) - HIGH PRIORITY

  Due tasks:
  - Contract review (deadline)
  - Client Y proposal (deadline)

  Suggested prep:
  - Review board deck tonight
  - Prepare questions
  ```

### 3. Weekly Patterns (Sunday evening)
- **Analyze**: week's data
- **Show**:
  ```
  📅 Week Analysis:

  Most productive day: Tuesday (5 tasks)
  Most meetings: Wednesday (4h)
  Focus time: 8h total

  Patterns:
  - Mornings more productive
  - Client calls cluster on Thu

  Next week priorities:
  1. {auto-detected from tasks}
  2. {auto-detected from calendar}
  ```

## Output
- Morning: prioritized day plan
- Evening: summary + tomorrow prep
- Weekly: patterns + planning

## Logging
```
/logs/daily/{date}/review.md
/logs/daily/{date}/metrics.json
```

## Configuration
```json
{
  "morning_time": "09:00",
  "evening_time": "18:00",
  "timezone": "Asia/Tbilisi",
  "include_metrics": true,
  "weekly_review_day": "Sunday"
}
```
