use std::{
    fs,
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_sql::{Migration, MigrationKind};

const MIGRATION_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#7c8aa5'
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 1,
  due_at TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (todo_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_todos_completed_due ON todos(completed, due_at);
"#;

// ---------------------------------------------------------------------------
// 定时提醒
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Reminder {
    id: i64,
    title: String,
    #[serde(default)]
    body: String,
    interval_minutes: i64,
    #[serde(default = "default_true")]
    enabled: bool,
    last_fired_at: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

fn default_true() -> bool {
    true
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct ReminderFile {
    reminders: Vec<Reminder>,
    next_id: i64,
}

struct ReminderStore {
    path: PathBuf,
    data: ReminderFile,
}

impl ReminderStore {
    fn load(path: PathBuf) -> Self {
        let data = fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<ReminderFile>(&content).ok())
            .unwrap_or_default();

        let mut store = Self { path, data };
        let max_id = store.data.reminders.iter().map(|item| item.id).max().unwrap_or(0);
        if store.data.next_id <= max_id {
            store.data.next_id = max_id + 1;
        }
        store
    }

    fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|error| error.to_string())?;
        let temp_path = self.path.with_extension("json.tmp");
        fs::write(&temp_path, json).map_err(|error| error.to_string())?;
        fs::rename(&temp_path, &self.path).map_err(|error| error.to_string())
    }

    /// 更新到期的提醒时间戳并返回本轮需要触发的提醒。
    fn collect_due(&mut self, now: i64) -> Vec<Reminder> {
        let mut due = Vec::new();

        for reminder in &mut self.data.reminders {
            if !reminder.enabled {
                continue;
            }
            let base = reminder.last_fired_at.unwrap_or(reminder.created_at);
            let next = base + reminder.interval_minutes * 60_000;
            if now >= next {
                reminder.last_fired_at = Some(now);
                due.push(reminder.clone());
            }
        }

        if !due.is_empty() {
            let _ = self.save();
        }
        due
    }
}

struct ReminderState {
    store: Mutex<ReminderStore>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReminderInput {
    title: String,
    #[serde(default)]
    body: String,
    interval_minutes: i64,
}

fn validate_input(input: &ReminderInput) -> Result<(String, String, i64), String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("提醒内容不能为空".into());
    }
    if !(1..=1440).contains(&input.interval_minutes) {
        return Err("提醒间隔需在 1 到 1440 分钟之间".into());
    }
    Ok((title, input.body.trim().to_string(), input.interval_minutes))
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
fn list_reminders(state: State<'_, ReminderState>) -> Vec<Reminder> {
    let store = state.store.lock().unwrap();
    let mut reminders = store.data.reminders.clone();
    reminders.sort_by_key(|item| item.created_at);
    reminders
}

#[tauri::command]
fn create_reminder(
    state: State<'_, ReminderState>,
    input: ReminderInput,
) -> Result<Reminder, String> {
    let (title, body, interval_minutes) = validate_input(&input)?;
    let now = now_ms();

    let mut store = state.store.lock().unwrap();
    let id = store.data.next_id.max(1);
    store.data.next_id = id + 1;

    let reminder = Reminder {
        id,
        title,
        body,
        interval_minutes,
        enabled: true,
        last_fired_at: None,
        created_at: now,
        updated_at: now,
    };
    store.data.reminders.push(reminder.clone());
    store.save()?;
    Ok(reminder)
}

#[tauri::command]
fn update_reminder(
    state: State<'_, ReminderState>,
    id: i64,
    input: ReminderInput,
) -> Result<Reminder, String> {
    let (title, body, interval_minutes) = validate_input(&input)?;
    let now = now_ms();

    let mut store = state.store.lock().unwrap();
    let updated = {
        let reminder = store
            .data
            .reminders
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "提醒不存在".to_string())?;

        reminder.title = title;
        reminder.body = body;
        reminder.interval_minutes = interval_minutes;
        reminder.updated_at = now;
        if reminder.enabled {
            // 修改后重新开始计时，避免立即触发
            reminder.last_fired_at = Some(now);
        }
        reminder.clone()
    };
    store.save()?;
    Ok(updated)
}

#[tauri::command]
fn set_reminder_enabled(
    state: State<'_, ReminderState>,
    id: i64,
    enabled: bool,
) -> Result<Reminder, String> {
    let now = now_ms();

    let mut store = state.store.lock().unwrap();
    let updated = {
        let reminder = store
            .data
            .reminders
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "提醒不存在".to_string())?;

        reminder.enabled = enabled;
        reminder.updated_at = now;
        if enabled {
            // 重新启用时从当前时刻开始计时
            reminder.last_fired_at = Some(now);
        }
        reminder.clone()
    };
    store.save()?;
    Ok(updated)
}

#[tauri::command]
fn delete_reminder(state: State<'_, ReminderState>, id: i64) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    let before = store.data.reminders.len();
    store.data.reminders.retain(|item| item.id != id);
    if store.data.reminders.len() == before {
        return Err("提醒不存在".into());
    }
    store.save()
}

fn reminder_loop(app: tauri::AppHandle) {
    loop {
        std::thread::sleep(Duration::from_secs(10));

        let due = {
            let state = app.state::<ReminderState>();
            let mut store = state.store.lock().unwrap_or_else(|error| error.into_inner());
            store.collect_due(now_ms())
        };

        for reminder in due {
            let title = if reminder.title.is_empty() {
                "定时提醒".to_string()
            } else {
                reminder.title.clone()
            };

            if let Err(error) = app
                .notification()
                .builder()
                .title(title)
                .body(reminder.body.clone())
                .sound("Reminder")
                .show()
            {
                eprintln!("发送系统通知失败: {error}");
            }

            let _ = app.emit("reminder-fired", reminder);
        }
    }
}

// ---------------------------------------------------------------------------
// 托盘与窗口
// ---------------------------------------------------------------------------

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &mut tauri::App) -> tauri::Result<()> {
    let open_item = MenuItem::with_id(app, "open", "打开工作助理", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("工作助理")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create tags, todos and todo_tags tables",
        sql: MIGRATION_SQL,
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:jaca.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_reminders,
            create_reminder,
            update_reminder,
            set_reminder_enabled,
            delete_reminder
        ])
        .setup(|app| {
            setup_tray(app)?;

            let dir = app.path().app_config_dir()?;
            fs::create_dir_all(&dir)?;
            let store = ReminderStore::load(dir.join("reminders.json"));
            app.manage(ReminderState {
                store: Mutex::new(store),
            });

            let handle = app.handle().clone();
            std::thread::spawn(move || reminder_loop(handle));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // 关闭按钮不退出应用，而是隐藏窗口到系统托盘
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
