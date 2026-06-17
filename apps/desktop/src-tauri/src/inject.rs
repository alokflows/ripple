//! Text injection at the OS cursor, plus the clipboard and undo.
//!
//! "Type at cursor" is done by putting the text on the clipboard and synthes
//! ising the paste shortcut (Cmd/Ctrl+V), NOT by typing each character. That is
//! near-instant regardless of length and handles emoji/long dictation cleanly —
//! char-by-char typing was the slow path. We save and restore the clipboard so
//! the user's clipboard is untouched, unless they asked us to keep the message
//! on it (Auto-copy).
//!
//! It all runs on one dedicated thread that owns the `Enigo` handle, so we never
//! juggle a non-Send keyboard handle across async tasks.

use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::sync::mpsc::{Receiver, Sender};
use std::time::{Duration, Instant};

pub enum InjectCmd {
    /// Paste this text at the cursor. `keep_clipboard` = leave it on the
    /// clipboard afterwards (Auto-copy on); otherwise restore what was there.
    Paste { text: String, keep_clipboard: bool },
    /// Just put this text on the clipboard (Auto-copy, no typing).
    Copy(String),
    /// Delete the last pasted run, if we're still inside the safe window.
    Undo,
}

// Undo only fires shortly after a paste — a rough stand-in for "nothing was
// typed after it" until we add a real keystroke monitor. Better to refuse a
// stale undo than to eat text the user typed later.
const UNDO_WINDOW: Duration = Duration::from_secs(20);

// macOS pastes with Cmd, everyone else with Ctrl.
#[cfg(target_os = "macos")]
const PASTE_MOD: Key = Key::Meta;
#[cfg(not(target_os = "macos"))]
const PASTE_MOD: Key = Key::Control;

pub fn spawn() -> Sender<InjectCmd> {
    let (tx, rx) = std::sync::mpsc::channel::<InjectCmd>();
    std::thread::spawn(move || run(rx));
    tx
}

fn run(rx: Receiver<InjectCmd>) {
    let mut enigo = match Enigo::new(&Settings::default()) {
        Ok(e) => Some(e),
        Err(e) => {
            eprintln!("[inject] could not init keyboard: {e}");
            None
        }
    };
    let mut clipboard = arboard::Clipboard::new().ok();
    let mut last_run: Option<(usize, Instant)> = None;

    while let Ok(cmd) = rx.recv() {
        match cmd {
            InjectCmd::Paste { text, keep_clipboard } => {
                let (Some(en), Some(cb)) = (enigo.as_mut(), clipboard.as_mut()) else { continue };
                let prev = if keep_clipboard { None } else { cb.get_text().ok() };
                if cb.set_text(text.clone()).is_err() {
                    continue;
                }
                // Let the clipboard settle, then fire the paste shortcut.
                std::thread::sleep(Duration::from_millis(30));
                let _ = en.key(PASTE_MOD, Direction::Press);
                let _ = en.key(Key::Unicode('v'), Direction::Click);
                let _ = en.key(PASTE_MOD, Direction::Release);
                last_run = Some((text.chars().count(), Instant::now()));
                // Restore the user's previous clipboard once the paste landed.
                if let Some(prev_text) = prev {
                    std::thread::sleep(Duration::from_millis(120));
                    let _ = cb.set_text(prev_text);
                }
            }
            InjectCmd::Copy(text) => {
                if let Some(cb) = clipboard.as_mut() {
                    let _ = cb.set_text(text);
                }
            }
            InjectCmd::Undo => {
                if let Some((n, when)) = last_run.take() {
                    if when.elapsed() <= UNDO_WINDOW {
                        if let Some(en) = enigo.as_mut() {
                            for _ in 0..n {
                                let _ = en.key(Key::Backspace, Direction::Click);
                            }
                        }
                    }
                }
            }
        }
    }
}
