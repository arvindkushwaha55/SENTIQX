//! Which desktop application is in front, using documented Win32 calls only
//! (`GetForegroundWindow`, `GetWindowTextW`, `QueryFullProcessImageNameW`).
//!
//! This is detection, not understanding: it reads the application's name and (only if the
//! user allows it) the window title. It never reads window contents, keystrokes or the screen.

use serde::Serialize;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Category {
    Coding,
    Browser,
    Terminal,
    Communication,
    Other,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ActiveApp {
    /// File name of the executable without ".exe", for example "Code".
    pub exe: String,
    /// Friendly name, for example "VS Code".
    pub name: String,
    pub category: Category,
    /// Only present when the user allowed window titles.
    pub title: Option<String>,
    pub pid: u32,
}

/// Maps an executable name (without ".exe") to a friendly name and a category.
/// Unknown programs keep their own name and are `Other`, never guessed.
pub fn classify(exe: &str) -> (String, Category) {
    use Category::*;
    let key = exe.to_lowercase();
    let known: Option<(&str, Category)> = match key.as_str() {
        "code" | "code - insiders" => Some(("VS Code", Coding)),
        "cursor" => Some(("Cursor", Coding)),
        "windsurf" => Some(("Windsurf", Coding)),
        "devenv" => Some(("Visual Studio", Coding)),
        "idea64" | "idea" => Some(("IntelliJ IDEA", Coding)),
        "pycharm64" | "pycharm" => Some(("PyCharm", Coding)),
        "webstorm64" | "webstorm" => Some(("WebStorm", Coding)),
        "studio64" => Some(("Android Studio", Coding)),
        "sublime_text" => Some(("Sublime Text", Coding)),
        "notepad++" => Some(("Notepad++", Coding)),
        "chrome" => Some(("Google Chrome", Browser)),
        "msedge" => Some(("Microsoft Edge", Browser)),
        "firefox" => Some(("Firefox", Browser)),
        "brave" => Some(("Brave", Browser)),
        "opera" => Some(("Opera", Browser)),
        "vivaldi" => Some(("Vivaldi", Browser)),
        "arc" => Some(("Arc", Browser)),
        "windowsterminal" => Some(("Windows Terminal", Terminal)),
        "powershell" => Some(("PowerShell", Terminal)),
        "pwsh" => Some(("PowerShell", Terminal)),
        "cmd" => Some(("Command Prompt", Terminal)),
        "conhost" => Some(("Console", Terminal)),
        "wezterm-gui" => Some(("WezTerm", Terminal)),
        "alacritty" => Some(("Alacritty", Terminal)),
        "mintty" => Some(("Git Bash", Terminal)),
        "whatsapp" | "whatsapp.root" => Some(("WhatsApp", Communication)),
        "telegram" => Some(("Telegram", Communication)),
        "discord" => Some(("Discord", Communication)),
        "slack" => Some(("Slack", Communication)),
        "ms-teams" | "teams" => Some(("Microsoft Teams", Communication)),
        "outlook" | "olk" => Some(("Outlook", Communication)),
        "thunderbird" => Some(("Thunderbird", Communication)),
        "signal" => Some(("Signal", Communication)),
        "zoom" => Some(("Zoom", Communication)),
        "explorer" => Some(("File Explorer", Other)),
        "notepad" => Some(("Notepad", Other)),
        _ => None,
    };
    match known {
        Some((name, cat)) => (name.to_string(), cat),
        None => (exe.to_string(), Other),
    }
}

/// Parts of Windows itself (Start, search, Alt-Tab, lock screen). Passing through one of
/// these is not "using an app", so the last real application stays shown.
pub fn is_shell_surface(exe: &str) -> bool {
    matches!(
        exe.to_lowercase().as_str(),
        "searchhost"
            | "searchapp"
            | "startmenuexperiencehost"
            | "shellexperiencehost"
            | "lockapp"
            | "textinputhost"
            | "applicationframehost"
    )
}

/// Window classes of the taskbar, the desktop and the Alt-Tab switcher.
pub fn is_shell_class(class: &str) -> bool {
    matches!(
        class,
        "Shell_TrayWnd" | "Shell_SecondaryTrayWnd" | "Progman" | "WorkerW" | "XamlExplorerHostIslandWindow" | "MultitaskingViewFrame" | "TaskListThumbnailWnd"
    )
}

/// "C:\\Program Files\\Microsoft VS Code\\Code.exe" -> "Code"
pub fn exe_stem(path: &str) -> String {
    let file = path.rsplit(['\\', '/']).next().unwrap_or(path);
    file.strip_suffix(".exe")
        .or_else(|| file.strip_suffix(".EXE"))
        .unwrap_or(file)
        .to_string()
}

pub fn build(exe: &str, title: Option<String>, pid: u32, show_title: bool) -> ActiveApp {
    let (name, category) = classify(exe);
    ActiveApp {
        exe: exe.to_string(),
        name,
        category,
        title: if show_title { title.filter(|t| !t.trim().is_empty()) } else { None },
        pid,
    }
}

#[cfg(windows)]
mod win {
    use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM};
    use windows_sys::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, EnumWindows, GWL_EXSTYLE, GetClassNameW, GetForegroundWindow, GetWindowLongW,
        GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible, WS_EX_TOOLWINDOW,
    };

    pub struct Raw {
        pub pid: u32,
        pub exe_path: String,
        pub title: String,
    }

    fn pid_of(hwnd: HWND) -> u32 {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(hwnd, &mut pid) };
        pid
    }

    fn title_of(hwnd: HWND) -> String {
        let mut buf = [0u16; 512];
        let n = unsafe { GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    fn image_path(pid: u32) -> Option<String> {
        unsafe {
            let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h.is_null() {
                return None;
            }
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut len);
            CloseHandle(h);
            (ok != 0).then(|| String::from_utf16_lossy(&buf[..len as usize]))
        }
    }

    unsafe extern "system" fn first_foreign_child(child: HWND, lparam: LPARAM) -> i32 {
        let out = unsafe { &mut *(lparam as *mut (u32, u32)) };
        let pid = pid_of(child);
        if pid != 0 && pid != out.0 {
            out.1 = pid;
            return 0; // stop
        }
        1
    }

    /// Packaged (UWP) apps are drawn inside ApplicationFrameHost.exe; the real app owns a child window.
    fn real_pid(hwnd: HWND, pid: u32, exe_path: &str) -> u32 {
        if !exe_path.to_lowercase().ends_with("applicationframehost.exe") {
            return pid;
        }
        let mut state: (u32, u32) = (pid, 0);
        unsafe { EnumChildWindows(hwnd, Some(first_foreign_child), &mut state as *mut _ as LPARAM) };
        if state.1 != 0 { state.1 } else { pid }
    }

    fn class_of(hwnd: HWND) -> String {
        let mut buf = [0u16; 128];
        let n = unsafe { GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32) };
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    pub fn foreground() -> Option<Raw> {
        read(unsafe { GetForegroundWindow() })
    }

    /// A window a person can actually see and switch to: not hidden, minimised, cloaked
    /// (suspended packaged apps) or a tool window, and with a title.
    fn is_real_app_window(hwnd: HWND) -> bool {
        unsafe {
            if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
                return false;
            }
            if (GetWindowLongW(hwnd, GWL_EXSTYLE) as u32) & WS_EX_TOOLWINDOW != 0 {
                return false;
            }
            let mut cloaked = 0u32;
            let ok = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED as u32, &mut cloaked as *mut u32 as *mut _, 4);
            if ok == 0 && cloaked != 0 {
                return false;
            }
        }
        !title_of(hwnd).trim().is_empty()
    }

    unsafe extern "system" fn find_top(hwnd: HWND, lparam: LPARAM) -> i32 {
        let out = unsafe { &mut *(lparam as *mut (u32, HWND)) };
        if pid_of(hwnd) != out.0 && is_real_app_window(hwnd) && !super::is_shell_class(&class_of(hwnd)) {
            out.1 = hwnd;
            return 0; // windows are enumerated from the top, so the first match is it
        }
        1
    }

    /// The application just below SENTIQX, used when SENTIQX itself is in front.
    pub fn top_other(own_pid: u32) -> Option<Raw> {
        let mut state: (u32, HWND) = (own_pid, std::ptr::null_mut());
        unsafe { EnumWindows(Some(find_top), &mut state as *mut _ as LPARAM) };
        read(state.1)
    }

    fn read(hwnd: HWND) -> Option<Raw> {
        if hwnd.is_null() || super::is_shell_class(&class_of(hwnd)) {
            return None;
        }
        let pid = pid_of(hwnd);
        let exe_path = image_path(pid)?;
        let title = title_of(hwnd);
        let real = real_pid(hwnd, pid, &exe_path);
        let exe_path = if real != pid { image_path(real).unwrap_or(exe_path) } else { exe_path };
        Some(Raw { pid: real, exe_path, title })
    }
}

#[cfg(windows)]
fn from_raw(raw: win::Raw, show_title: bool) -> Option<ActiveApp> {
    let exe = exe_stem(&raw.exe_path);
    (!is_shell_surface(&exe)).then(|| build(&exe, Some(raw.title), raw.pid, show_title))
}

/// Reads the window in front right now. `None` when nothing readable is in front,
/// or when it is part of the Windows shell rather than an application.
pub fn current(show_title: bool) -> Option<ActiveApp> {
    #[cfg(windows)]
    {
        from_raw(win::foreground()?, show_title)
    }
    #[cfg(not(windows))]
    {
        let _ = show_title;
        None
    }
}

/// The application directly beneath `own_pid`'s windows in the stacking order.
pub fn top_other(own_pid: u32, show_title: bool) -> Option<ActiveApp> {
    #[cfg(windows)]
    {
        from_raw(win::top_other(own_pid)?, show_title)
    }
    #[cfg(not(windows))]
    {
        let _ = (own_pid, show_title);
        None
    }
}

/// Shared switches and the latest reading. The poll loop does nothing while `enabled` is false.
pub struct Awareness {
    pub enabled: AtomicBool,
    pub show_titles: AtomicBool,
    pub latest: Mutex<Option<ActiveApp>>,
}

impl Awareness {
    pub fn new(enabled: bool, show_titles: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
            show_titles: AtomicBool::new(show_titles),
            latest: Mutex::new(None),
        }
    }
}

/// Polls the foreground window and calls `on_change` only when it actually changed.
/// SENTIQX's own window (`own_pid`) is ignored, so the last real application stays shown.
pub fn spawn_watcher(
    state: std::sync::Arc<Awareness>,
    own_pid: u32,
    on_change: impl Fn(Option<ActiveApp>) + Send + 'static,
) -> std::io::Result<()> {
    std::thread::Builder::new().name("sentiqx-active-window".into()).spawn(move || {
        let mut last: Option<ActiveApp> = None;
        let mut was_enabled = false;
        loop {
            std::thread::sleep(Duration::from_millis(700));
            let enabled = state.enabled.load(Ordering::SeqCst);
            if !enabled {
                if was_enabled {
                    was_enabled = false;
                    last = None;
                    if let Ok(mut l) = state.latest.lock() {
                        *l = None;
                    }
                    on_change(None);
                }
                continue;
            }
            was_enabled = true;
            let titles = state.show_titles.load(Ordering::SeqCst);
            let Some(mut now) = current(titles) else { continue };
            if now.pid == own_pid {
                // SENTIQX is in front. Keep the last real app; if there is none yet (the user
                // just allowed detection from this window), use the app right beneath us.
                if last.is_some() {
                    continue;
                }
                let Some(below) = top_other(own_pid, titles) else { continue };
                now = below;
            }
            if last.as_ref() != Some(&now) {
                if let Ok(mut l) = state.latest.lock() {
                    *l = Some(now.clone());
                }
                on_change(Some(now.clone()));
                last = Some(now);
            }
        }
    })?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_the_applications_named_in_the_brief() {
        let c = |e: &str| {
            let (n, k) = classify(e);
            (n, k)
        };
        assert_eq!(c("Code"), ("VS Code".into(), Category::Coding));
        assert_eq!(c("devenv"), ("Visual Studio".into(), Category::Coding));
        assert_eq!(c("chrome"), ("Google Chrome".into(), Category::Browser));
        assert_eq!(c("msedge"), ("Microsoft Edge".into(), Category::Browser));
        assert_eq!(c("WindowsTerminal"), ("Windows Terminal".into(), Category::Terminal));
        assert_eq!(c("powershell"), ("PowerShell".into(), Category::Terminal));
        assert_eq!(c("WhatsApp"), ("WhatsApp".into(), Category::Communication));
        assert_eq!(c("OUTLOOK"), ("Outlook".into(), Category::Communication));
    }

    #[test]
    fn unknown_programs_stay_unknown() {
        assert_eq!(classify("MyWeirdTool"), ("MyWeirdTool".into(), Category::Other));
        assert_eq!(classify("explorer"), ("File Explorer".into(), Category::Other));
    }

    #[test]
    fn windows_shell_is_not_treated_as_an_app() {
        for exe in ["SearchHost", "StartMenuExperienceHost", "ShellExperienceHost", "LockApp"] {
            assert!(is_shell_surface(exe), "{exe}");
        }
        assert!(!is_shell_surface("Code") && !is_shell_surface("explorer"));
        assert!(is_shell_class("Shell_TrayWnd") && is_shell_class("XamlExplorerHostIslandWindow"));
        assert!(!is_shell_class("Chrome_WidgetWin_1"));
    }

    #[test]
    fn extracts_the_executable_name() {
        assert_eq!(exe_stem(r"C:\Program Files\Microsoft VS Code\Code.exe"), "Code");
        assert_eq!(exe_stem("C:/x/chrome.exe"), "chrome");
        assert_eq!(exe_stem("plain"), "plain");
    }

    #[test]
    fn titles_are_dropped_unless_allowed() {
        let off = build("Code", Some("secret.ts - App - Visual Studio Code".into()), 1, false);
        assert_eq!(off.title, None);
        let on = build("Code", Some("secret.ts - App".into()), 1, true);
        assert_eq!(on.title.as_deref(), Some("secret.ts - App"));
        assert_eq!(build("Code", Some("   ".into()), 1, true).title, None);
    }

    #[test]
    fn serialises_for_the_frontend() {
        let v = serde_json::to_value(build("chrome", None, 7, false)).unwrap();
        assert_eq!(v["category"], "browser");
        assert_eq!(v["name"], "Google Chrome");
        assert_eq!(v["pid"], 7);
    }

    #[cfg(windows)]
    #[test]
    fn can_read_the_foreground_window_without_crashing() {
        // In a headless session there may be no foreground window; either answer is valid.
        let _ = current(false);
    }
}
