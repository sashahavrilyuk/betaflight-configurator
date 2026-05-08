#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ElrsFlashRequest {
    firmware_name: String,
    firmware_bytes: Vec<u8>,
    port: String,
    platform: String,
    baud: Option<u32>,
    erase: Option<bool>,
    force: Option<bool>,
    device_type: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ElrsFlashResult {
    command: String,
    exit_code: i32,
    stdout: String,
    stderr: String,
}

fn validate_platform(platform: &str) -> bool {
    matches!(
        platform,
        "stm32" | "esp32" | "esp32c3" | "esp32s2" | "esp32s3" | "esp8285"
    )
}

fn run_elrs_flash_blocking(request: ElrsFlashRequest) -> Result<ElrsFlashResult, String> {
    if !validate_platform(&request.platform) {
        return Err(format!("Unsupported platform '{}'", request.platform));
    }

    if request.firmware_bytes.is_empty() {
        return Err("Firmware file is empty.".to_string());
    }

    let sanitized_name: String = request
        .firmware_name
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let temp_filename = if sanitized_name.is_empty() {
        "firmware.bin".to_string()
    } else {
        sanitized_name
    };
    let temp_path = std::env::temp_dir().join(format!(
        "betaflight_elrs_{}_{}",
        std::process::id(),
        temp_filename
    ));
    std::fs::write(&temp_path, &request.firmware_bytes)
        .map_err(|error| format!("Failed to write temporary firmware file: {error}"))?;

    let current_dir = std::env::current_dir().map_err(|error| format!("Failed to get current dir: {error}"))?;
    let script_path = current_dir.join("elrs").join("main.py");
    if !script_path.exists() {
        return Err(format!(
            "ELRS flasher script not found: {}",
            script_path.display()
        ));
    }

    let baud = request.baud.unwrap_or(420000);
    let erase = request.erase.unwrap_or(false);
    let force = request.force.unwrap_or(false);
    let device_type = request.device_type.unwrap_or_else(|| "rx".to_string());

    let mut script_args: Vec<String> = vec![
        script_path.to_string_lossy().to_string(),
        "--flash".to_string(),
        "bf".to_string(),
        "--port".to_string(),
        request.port.clone(),
        "--baud".to_string(),
        baud.to_string(),
        "--platform".to_string(),
        request.platform.clone(),
        "--device_type".to_string(),
        device_type,
    ];

    if erase {
        script_args.push("--erase".to_string());
    }
    if force {
        script_args.push("--force".to_string());
    }

    script_args.push(temp_path.to_string_lossy().to_string());

    let executable_candidates: Vec<(&str, Vec<String>)> = if cfg!(target_os = "windows") {
        vec![
            ("py", vec!["-3".to_string()]),
            ("python", Vec::new()),
            ("python3", Vec::new()),
        ]
    } else {
        vec![("python3", Vec::new()), ("python", Vec::new())]
    };

    let mut last_error_message: Option<String> = None;

    for (executable, prefix_args) in executable_candidates {
        let mut all_args = prefix_args;
        all_args.extend(script_args.iter().cloned());

        let output = match Command::new(executable)
            .args(&all_args)
            .current_dir(&current_dir)
            .output()
        {
            Ok(output) => output,
            Err(error) => {
                if error.kind() == std::io::ErrorKind::NotFound {
                    continue;
                }
                last_error_message = Some(format!("Failed to start '{executable}': {error}"));
                continue;
            }
        };

        let exit_code = output.status.code().unwrap_or(-1);
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let command = format!("{executable} {}", all_args.join(" "));

        if output.status.success() {
            let _ = std::fs::remove_file(&temp_path);
            return Ok(ElrsFlashResult {
                command,
                exit_code,
                stdout,
                stderr,
            });
        }

        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "ELRS flasher failed with exit code {exit_code}.\nCommand: {command}\n\nSTDOUT:\n{stdout}\n\nSTDERR:\n{stderr}"
        ));
    }

    let _ = std::fs::remove_file(&temp_path);
    Err(last_error_message.unwrap_or_else(|| {
        "Python runtime not found. Please install Python and ensure it is in PATH.".to_string()
    }))
}

#[tauri::command]
async fn run_elrs_flash(request: ElrsFlashRequest) -> Result<ElrsFlashResult, String> {
    tauri::async_runtime::spawn_blocking(move || run_elrs_flash_blocking(request))
        .await
        .map_err(|error| format!("ELRS flasher task failed: {error}"))?
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_serialplugin::init())
        .invoke_handler(tauri::generate_handler![run_elrs_flash])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
