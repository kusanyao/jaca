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
    Emitter, LogicalPosition, Manager, State, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
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
    /// 提醒方式："notification"（系统通知）或 "monster"（安静探头）
    #[serde(default = "default_style")]
    style: String,
    /// 关联的待办 id（任务内提醒）
    #[serde(default)]
    todo_id: Option<i64>,
    /// 指定时段的开始时间（毫秒时间戳）；为空表示长期循环
    #[serde(default)]
    start_at: Option<i64>,
    /// 指定时段的结束时间（毫秒时间戳）；到期后自动停用
    #[serde(default)]
    end_at: Option<i64>,
    last_fired_at: Option<i64>,
    created_at: i64,
    updated_at: i64,
}

fn default_true() -> bool {
    true
}

fn default_style() -> String {
    "notification".to_string()
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
        let mut changed = false;

        for reminder in &mut self.data.reminders {
            if !reminder.enabled {
                continue;
            }

            // 指定时段结束：自动停用，不再触发
            if let Some(end_at) = reminder.end_at {
                if now >= end_at {
                    reminder.enabled = false;
                    reminder.updated_at = now;
                    changed = true;
                    continue;
                }
            }

            // 还没到开始时间
            if let Some(start_at) = reminder.start_at {
                if now < start_at {
                    continue;
                }
            }

            let next = match reminder.last_fired_at {
                Some(last) => last + reminder.interval_minutes * 60_000,
                // 指定时段的提醒在开始时刻先触发一次
                None => match reminder.start_at {
                    Some(start) => start,
                    None => reminder.created_at + reminder.interval_minutes * 60_000,
                },
            };

            if now >= next {
                reminder.last_fired_at = Some(now);
                due.push(reminder.clone());
                changed = true;
            }
        }

        if changed {
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
    #[serde(default = "default_style")]
    style: String,
    #[serde(default)]
    todo_id: Option<i64>,
    #[serde(default)]
    start_at: Option<i64>,
    #[serde(default)]
    end_at: Option<i64>,
}

struct ValidReminder {
    title: String,
    body: String,
    interval_minutes: i64,
    style: String,
    todo_id: Option<i64>,
    start_at: Option<i64>,
    end_at: Option<i64>,
}

fn validate_input(input: &ReminderInput) -> Result<ValidReminder, String> {
    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err("提醒内容不能为空".into());
    }
    if !(1..=1440).contains(&input.interval_minutes) {
        return Err("提醒间隔需在 1 到 1440 分钟之间".into());
    }

    match (input.start_at, input.end_at) {
        (Some(start), Some(end)) => {
            if end <= start {
                return Err("结束时间必须晚于开始时间".into());
            }
        }
        (None, None) => {}
        _ => return Err("开始时间和结束时间需要同时设置".into()),
    }

    let style = if input.style == "monster" {
        "monster"
    } else {
        "notification"
    }
    .to_string();

    Ok(ValidReminder {
        title,
        body: input.body.trim().to_string(),
        interval_minutes: input.interval_minutes,
        style,
        todo_id: input.todo_id,
        start_at: input.start_at,
        end_at: input.end_at,
    })
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
    let input = validate_input(&input)?;
    let now = now_ms();

    let mut store = state.store.lock().unwrap();
    let id = store.data.next_id.max(1);
    store.data.next_id = id + 1;

    let reminder = Reminder {
        id,
        title: input.title,
        body: input.body,
        interval_minutes: input.interval_minutes,
        enabled: true,
        style: input.style,
        todo_id: input.todo_id,
        start_at: input.start_at,
        end_at: input.end_at,
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
    let input = validate_input(&input)?;
    let now = now_ms();

    let mut store = state.store.lock().unwrap();
    let updated = {
        let reminder = store
            .data
            .reminders
            .iter_mut()
            .find(|item| item.id == id)
            .ok_or_else(|| "提醒不存在".to_string())?;

        reminder.title = input.title;
        reminder.body = input.body;
        reminder.interval_minutes = input.interval_minutes;
        reminder.style = input.style;
        reminder.todo_id = input.todo_id;
        reminder.start_at = input.start_at;
        reminder.end_at = input.end_at;
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

        if enabled && reminder.end_at.is_some_and(|end| now >= end) {
            return Err("提醒时段已结束".into());
        }
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

/// 完成/重新打开待办时，批量启用或停用关联提醒。
#[tauri::command]
fn set_reminders_enabled_for_todo(
    state: State<'_, ReminderState>,
    todo_id: i64,
    enabled: bool,
) -> Result<(), String> {
    let now = now_ms();
    let mut store = state.store.lock().unwrap();
    let mut changed = false;

    for reminder in &mut store.data.reminders {
        if reminder.todo_id != Some(todo_id) || reminder.enabled == enabled {
            continue;
        }
        // 重新打开待办时，时段已结束的提醒保持停用
        if enabled && reminder.end_at.is_some_and(|end| now >= end) {
            continue;
        }
        reminder.enabled = enabled;
        reminder.updated_at = now;
        if enabled {
            reminder.last_fired_at = Some(now);
        }
        changed = true;
    }

    if changed {
        store.save()?;
    }
    Ok(())
}

/// 删除待办时，一并删除它关联的提醒。
#[tauri::command]
fn delete_reminders_for_todo(state: State<'_, ReminderState>, todo_id: i64) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    let before = store.data.reminders.len();
    store.data.reminders.retain(|item| item.todo_id != Some(todo_id));
    if store.data.reminders.len() != before {
        store.save()?;
    }
    Ok(())
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
            if reminder.style == "monster" {
                // 安静模式：小怪兽从桌面右下角出现，不弹系统通知、不发声
                show_pet(&app, &reminder);
            } else {
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
            }

            let _ = app.emit("reminder-fired", reminder);
        }
    }
}

// ---------------------------------------------------------------------------
// 小怪兽桌面宠物窗口
// ---------------------------------------------------------------------------

const PET_WINDOW_WIDTH: f64 = 380.0;
const PET_WINDOW_HEIGHT: f64 = 320.0;

fn monitor_bounds(app: &tauri::AppHandle) -> (f64, f64, f64, f64) {
    match app.primary_monitor().ok().flatten() {
        Some(monitor) => {
            let scale = monitor.scale_factor();
            let size = monitor.size();
            let position = monitor.position();
            (
                position.x as f64 / scale,
                position.y as f64 / scale,
                size.width as f64 / scale,
                size.height as f64 / scale,
            )
        }
        None => (0.0, 0.0, 1920.0, 1080.0),
    }
}

fn pet_onscreen_position(app: &tauri::AppHandle) -> (f64, f64) {
    let (origin_x, origin_y, width, height) = monitor_bounds(app);
    (
        origin_x + width - PET_WINDOW_WIDTH - 8.0,
        origin_y + height - PET_WINDOW_HEIGHT - 60.0,
    )
}

fn pet_offscreen_position(app: &tauri::AppHandle) -> (f64, f64) {
    let (origin_x, origin_y, width, height) = monitor_bounds(app);
    (
        origin_x + width + 24.0,
        origin_y + height - PET_WINDOW_HEIGHT - 60.0,
    )
}

fn setup_pet_window(app: &mut tauri::App) -> tauri::Result<()> {
    // 平时停在屏幕外，不打扰桌面；只有提醒时才移动进来
    let (x, y) = pet_offscreen_position(app.handle());
    let mut builder = WebviewWindowBuilder::new(app, "pet", WebviewUrl::App("index.html?pet=1".into()))
        .title("Jaca Pet")
        .inner_size(PET_WINDOW_WIDTH, PET_WINDOW_HEIGHT)
        .position(x, y)
        .transparent(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .resizable(false)
        .shadow(false)
        .visible(true);

    // WebView2 要求同一进程内的窗口使用一致的浏览器参数
    if let Some(args) = app
        .config()
        .app
        .windows
        .first()
        .and_then(|window| window.additional_browser_args.as_deref())
    {
        builder = builder.additional_browser_args(args);
    }

    let pet = builder.build()?;
    // 创建时传入的坐标在部分环境会被系统忽略（窗口落到默认位置），这里再校正一次
    let (x, y) = pet_offscreen_position(app.handle());
    let _ = pet.set_position(LogicalPosition::new(x, y));
    // 空闲时点击穿透，即使窗口被系统挪到屏幕内也不会挡住操作
    let _ = pet.set_ignore_cursor_events(true);
    Ok(())
}

fn show_pet(app: &tauri::AppHandle, reminder: &Reminder) {
    let (x, y) = pet_onscreen_position(app);
    if let Some(pet) = app.get_webview_window("pet") {
        // 出现时恢复点击，支持关闭 / 查看详情
        let _ = pet.set_ignore_cursor_events(false);
        // 移动窗口不会抢焦点，适合安静提醒
        let _ = pet.set_position(LogicalPosition::new(x, y));
    }
    let _ = app.emit_to(
        "pet",
        "pet-remind",
        serde_json::json!({
            "title": reminder.title,
            "body": reminder.body,
            "reminderId": reminder.id,
            "todoId": reminder.todo_id,
        }),
    );
}

fn hide_pet_window(app: &tauri::AppHandle) {
    let (x, y) = pet_offscreen_position(app);
    if let Some(pet) = app.get_webview_window("pet") {
        // 收起后恢复点击穿透，避免空窗口挡鼠标
        let _ = pet.set_ignore_cursor_events(true);
        let _ = pet.set_position(LogicalPosition::new(x, y));
    }
}

#[tauri::command]
fn hide_pet(app: tauri::AppHandle) {
    hide_pet_window(&app);
}

#[tauri::command]
fn open_reminder_detail(app: tauri::AppHandle, reminder_id: i64, todo_id: Option<i64>) {
    show_main_window(&app);
    let _ = app.emit_to(
        "main",
        "open-reminder-detail",
        serde_json::json!({ "reminderId": reminder_id, "todoId": todo_id }),
    );
    hide_pet_window(&app);
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
        // 开机自启时带上 --hidden，启动后只留在托盘，不弹主窗口
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
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
            delete_reminder,
            set_reminders_enabled_for_todo,
            delete_reminders_for_todo,
            hide_pet,
            open_reminder_detail
        ])
        .setup(|app| {
            setup_tray(app)?;
            if let Err(error) = setup_pet_window(app) {
                eprintln!("创建小怪兽窗口失败: {error}");
            }

            let dir = app.path().app_config_dir()?;
            fs::create_dir_all(&dir)?;
            let store = ReminderStore::load(dir.join("reminders.json"));
            app.manage(ReminderState {
                store: Mutex::new(store),
            });

            // 主窗口在配置里默认隐藏，正常启动时在这里显示；
            // 开机自启带 --hidden 参数，只留在托盘后台运行
            let launched_hidden = std::env::args().any(|arg| arg == "--hidden");
            if !launched_hidden {
                show_main_window(app.handle());
            }

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
