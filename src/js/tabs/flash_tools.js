import $ from "jquery";
import GUI, { TABS } from "../gui";
import { i18n } from "../localization";
import CONFIGURATOR from "../data_storage";
import FileSystem from "../FileSystem";
import CliEngine from "../../tabs/presets/CliEngine";
import { gui_log } from "../gui_log";
import read_hex_file from "../workers/hex_parser.js";
import PortHandler from "../port_handler";
import STM32 from "../protocols/webstm32";
import DFU from "../protocols/webusbdfu";
import { get as getConfig, set as setConfig } from "../ConfigStorage";
import { serial } from "../serial";
import { ESPFlasher } from "../../../web-flasher/src/js/espflasher.js";
import { MismatchError, WrongMCU } from "../../../web-flasher/src/js/error.js";

const flash_tools = {
    hexFile: null,
    hexParsed: null,
    dumpFile: null,
    dumpText: "",
    elrsFile: null,
    cliEngine: null,
    originalFirmwareFlasherTab: null,
    dumpDirectSerialActive: false,
    dumpDirectSerialOpenedByTool: false,
    dumpDirectSerialReceiveHandler: null,
};

const FLASH_TOOLS_PRESET_STORAGE_KEY = "flash_tools_file_presets";
const FLASH_TOOLS_PRESET_HANDLES_DB_NAME = "flash_tools_preset_handles";
const FLASH_TOOLS_PRESET_HANDLES_DB_VERSION = 1;
const FLASH_TOOLS_PRESET_HANDLES_STORE = "handles";

flash_tools.initialize = function (callback) {
    if (GUI.active_tab !== "flash_tools") {
        GUI.active_tab = "flash_tools";
    }

    this.hexFile = null;
    this.hexParsed = null;
    this.dumpFile = null;
    this.dumpText = "";
    this.elrsFile = null;
    this.cliEngine = new CliEngine(this);
    this.originalFirmwareFlasherTab = TABS.firmware_flasher;
    this.dumpDirectSerialActive = false;
    this.dumpDirectSerialOpenedByTool = false;
    this.dumpDirectSerialReceiveHandler = null;

    $("#content").load("./tabs/flash_tools.html", () => this.onHtmlLoad(callback));
};

flash_tools.onHtmlLoad = function (callback) {
    const self = this;

    i18n.localizePage();

    function setFileName(selector, file) {
        $(selector).text(file?.name || i18n.getMessage("flashToolsNoFileSelected"));
    }

    function setButtonState(selector, enabled) {
        $(selector).toggleClass("disabled", !enabled);
    }

    function setStatus(selector, text) {
        $(selector).text(text || "");
    }

    function setHexProgress(progress, label) {
        const clamped = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
        $(".hex-progress").val(clamped);
        $(".hex-progress-label").text(label || `${clamped}%`);
    }

    let presetHandlesDbPromise = null;

    function createFileFromHandle(fileHandle) {
        return {
            name: fileHandle?.name || i18n.getMessage("flashToolsNoFileSelected"),
            _fileHandle: fileHandle,
        };
    }

    function getStoredPresets() {
        const stored = getConfig(FLASH_TOOLS_PRESET_STORAGE_KEY)[FLASH_TOOLS_PRESET_STORAGE_KEY];
        if (!Array.isArray(stored)) {
            return [];
        }
        return stored.filter(
            (preset) =>
                preset?.id &&
                preset?.name &&
                preset?.files?.hex?.handleKey &&
                preset?.files?.dump?.handleKey &&
                preset?.files?.bin?.handleKey,
        );
    }

    function saveStoredPresets(presets) {
        setConfig({ [FLASH_TOOLS_PRESET_STORAGE_KEY]: presets });
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
        });
    }

    function transactionToPromise(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
            transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
        });
    }

    async function openPresetHandlesDb() {
        if (presetHandlesDbPromise) {
            return presetHandlesDbPromise;
        }

        if (!window.indexedDB) {
            throw new Error("IndexedDB is not supported");
        }

        presetHandlesDbPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(
                FLASH_TOOLS_PRESET_HANDLES_DB_NAME,
                FLASH_TOOLS_PRESET_HANDLES_DB_VERSION,
            );
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(FLASH_TOOLS_PRESET_HANDLES_STORE)) {
                    db.createObjectStore(FLASH_TOOLS_PRESET_HANDLES_STORE);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
        });

        return presetHandlesDbPromise;
    }

    async function setPresetHandle(key, handle) {
        const db = await openPresetHandlesDb();
        const tx = db.transaction(FLASH_TOOLS_PRESET_HANDLES_STORE, "readwrite");
        tx.objectStore(FLASH_TOOLS_PRESET_HANDLES_STORE).put(handle, key);
        await transactionToPromise(tx);
    }

    async function getPresetHandle(key) {
        const db = await openPresetHandlesDb();
        const tx = db.transaction(FLASH_TOOLS_PRESET_HANDLES_STORE, "readonly");
        const request = tx.objectStore(FLASH_TOOLS_PRESET_HANDLES_STORE).get(key);
        const result = await requestToPromise(request);
        await transactionToPromise(tx);
        return result || null;
    }

    async function deletePresetHandles(keys) {
        if (!keys.length) {
            return;
        }
        const db = await openPresetHandlesDb();
        const tx = db.transaction(FLASH_TOOLS_PRESET_HANDLES_STORE, "readwrite");
        keys.forEach((key) => tx.objectStore(FLASH_TOOLS_PRESET_HANDLES_STORE).delete(key));
        await transactionToPromise(tx);
    }

    function filePresetSelectionId() {
        return $(".flash-tools-preset-list").val() || "";
    }

    function hasAllFilesLoaded() {
        return !!(self.hexFile && self.hexParsed && self.dumpFile && self.dumpText && self.elrsFile);
    }

    function refreshPresetButtonsState() {
        setButtonState("a.save_preset", hasAllFilesLoaded());
        const hasSelection = !!filePresetSelectionId();
        setButtonState("a.load_preset", hasSelection);
        setButtonState("a.delete_preset", hasSelection);
    }

    function setPresetStatus(text) {
        setStatus(".preset-status", text);
    }

    function renderPresetList(selectedId = "") {
        const presets = getStoredPresets();
        const select = $(".flash-tools-preset-list");
        select.empty();
        select.append($("<option />").attr("value", "").text("Select saved preset"));
        presets
            .sort((a, b) => a.name.localeCompare(b.name, window.navigator.language, { sensitivity: "base" }))
            .forEach((preset) => {
                select.append($("<option />").attr("value", preset.id).text(preset.name));
            });

        if (selectedId && presets.some((preset) => preset.id === selectedId)) {
            select.val(selectedId);
        } else if (presets.length > 0) {
            select.val(presets[0].id); // select first preset after sorting
        } else {
            select.val("");
        }

        refreshPresetButtonsState();
    }

    async function validateFileHandleExists(fileHandle) {
        if (!fileHandle?.getFile) {
            throw new Error("Invalid file handle");
        }
        await fileHandle.getFile();
    }

    async function loadFilesFromPreset(preset) {
        const requiredTypes = ["hex", "dump", "bin"];
        const handles = {};

        for (const fileType of requiredTypes) {
            const handleKey = preset.files[fileType]?.handleKey;
            const fileHandle = await getPresetHandle(handleKey);
            if (!fileHandle) {
                throw new Error(`Missing saved ${fileType.toUpperCase()} file`);
            }
            await validateFileHandleExists(fileHandle);
            handles[fileType] = fileHandle;
        }

        const hexFile = createFileFromHandle(handles.hex);
        const dumpFile = createFileFromHandle(handles.dump);
        const elrsFile = createFileFromHandle(handles.bin);

        const hexText = await FileSystem.readFile(hexFile);
        const parsedHex = await read_hex_file(hexText);
        if (!parsedHex) {
            throw new Error("HEX file is invalid");
        }

        const dumpText = await FileSystem.readFile(dumpFile);
        if (!dumpText || !dumpText.trim()) {
            throw new Error("Dump file is empty");
        }

        return {
            hexFile,
            parsedHex,
            dumpFile,
            dumpText,
            elrsFile,
        };
    }

    async function saveCurrentAsPreset() {
        if (!hasAllFilesLoaded()) {
            setPresetStatus("Load HEX, dump, and BIN files first.");
            return;
        }

        const presetName = ($(".flash-tools-preset-name").val() || "").trim();
        if (!presetName) {
            setPresetStatus("Enter a preset name first.");
            return;
        }

        setButtonState("a.save_preset", false);

        try {
            await validateFileHandleExists(self.hexFile._fileHandle);
            await validateFileHandleExists(self.dumpFile._fileHandle);
            await validateFileHandleExists(self.elrsFile._fileHandle);

            const presets = getStoredPresets();
            const existingPreset = presets.find((preset) => preset.name.toLowerCase() === presetName.toLowerCase());
            const presetId = existingPreset?.id || `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const now = Date.now();
            const files = {
                hex: { name: self.hexFile.name, handleKey: `${presetId}:hex` },
                dump: { name: self.dumpFile.name, handleKey: `${presetId}:dump` },
                bin: { name: self.elrsFile.name, handleKey: `${presetId}:bin` },
            };

            await setPresetHandle(files.hex.handleKey, self.hexFile._fileHandle);
            await setPresetHandle(files.dump.handleKey, self.dumpFile._fileHandle);
            await setPresetHandle(files.bin.handleKey, self.elrsFile._fileHandle);

            const presetRecord = {
                id: presetId,
                name: presetName,
                files,
                createdAt: existingPreset?.createdAt || now,
                updatedAt: now,
            };

            const nextPresets = existingPreset
                ? presets.map((preset) => (preset.id === presetId ? presetRecord : preset))
                : [...presets, presetRecord];
            saveStoredPresets(nextPresets);
            renderPresetList(presetId);
            setPresetStatus(`Preset "${presetName}" saved.`);
        } catch (error) {
            console.error("Failed to save flash tools preset:", error);
            setPresetStatus("Could not save preset. Check file permissions and try again.");
        } finally {
            refreshPresetButtonsState();
        }
    }

    async function loadSelectedPreset() {
        const selectedId = filePresetSelectionId();
        if (!selectedId) {
            return;
        }

        const preset = getStoredPresets().find((item) => item.id === selectedId);
        if (!preset) {
            setPresetStatus("Selected preset was not found.");
            renderPresetList();
            return;
        }

        setButtonState("a.load_preset", false);
        setPresetStatus(`Loading preset "${preset.name}"...`);

        try {
            const loaded = await loadFilesFromPreset(preset);

            self.hexFile = loaded.hexFile;
            self.hexParsed = loaded.parsedHex;
            self.dumpFile = loaded.dumpFile;
            self.dumpText = loaded.dumpText;
            self.elrsFile = loaded.elrsFile;

            setFileName(".hex-file-name", self.hexFile);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexReady", { bytes: self.hexParsed.bytes_total }));
            setHexProgress(0);
            setButtonState("a.flash_hex", true);

            setFileName(".dump-file-name", self.dumpFile);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpReady"));
            setButtonState("a.apply_dump", true);

            setFileName(".elrs-file-name", self.elrsFile);
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsReady"));
            setButtonState("a.flash_elrs", true);

            setButtonState("a.flash_all", true);

            setPresetStatus(`Preset "${preset.name}" loaded.`);
        } catch (error) {
            console.error("Failed to load flash tools preset:", error);
            setPresetStatus(`Preset "${preset.name}" could not be loaded. Missing or invalid file.`);
        } finally {
            refreshPresetButtonsState();
        }
    }

    async function deleteSelectedPreset() {
        const selectedId = filePresetSelectionId();
        if (!selectedId) {
            return;
        }

        const presets = getStoredPresets();
        const preset = presets.find((item) => item.id === selectedId);
        if (!preset) {
            renderPresetList();
            setPresetStatus("Selected preset was not found.");
            return;
        }

        setButtonState("a.delete_preset", false);

        try {
            await deletePresetHandles([
                preset.files.hex.handleKey,
                preset.files.dump.handleKey,
                preset.files.bin.handleKey,
            ]);
            saveStoredPresets(presets.filter((item) => item.id !== selectedId));
            renderPresetList();
            setPresetStatus(`Preset "${preset.name}" deleted.`);
        } catch (error) {
            console.error("Failed to delete flash tools preset:", error);
            setPresetStatus("Failed to delete preset.");
        } finally {
            refreshPresetButtonsState();
        }
    }

    function waitForCondition(checkFn, timeoutMs = 10000, intervalMs = 100) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const timer = setInterval(() => {
                if (checkFn()) {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    clearInterval(timer);
                    reject(new Error("Timeout"));
                }
            }, intervalMs);
        });
    }

    function hasCliPromptInOutput() {
        const outputText = ($("#flash_tools_cli_window_wrapper").text() || "").trim();
        if (!outputText) {
            return false;
        }

        if (outputText.includes("CLI")) {
            return true;
        }

        if (outputText.endsWith("#") || outputText.endsWith("# ")) {
            return true;
        }

        return outputText === "#";
    }

    function createFirmwareFlasherShim() {
        const flashMessageTypes = self.originalFirmwareFlasherTab?.FLASH_MESSAGE_TYPES || {
            NEUTRAL: 0,
            ACTION: 1,
            VALID: 2,
            INVALID: 3,
        };

        const shim = {
            FLASH_MESSAGE_TYPES: flashMessageTypes,
            parsed_hex: self.hexParsed,
            localFirmwareLoaded: true,
            selectedBoard: "0",
            bareBoard: "UNKNOWN",
            flashingMessage(message, type) {
                if (message) {
                    setStatus(
                        ".hex-status",
                        typeof message === "string" ? message.replace(/<[^>]*>/g, "") : `${message}`,
                    );
                }

                if (type === flashMessageTypes.VALID || type === flashMessageTypes.INVALID) {
                    setButtonState("a.flash_hex", true);
                    GUI.connect_lock = false;
                }
                return this;
            },
            flashProgress(value) {
                setHexProgress(value);
                return this;
            },
            resetFlashingState() {
                setButtonState("a.flash_hex", true);
                GUI.connect_lock = false;
            },
            refresh(cb) {
                if (typeof cb === "function") {
                    cb();
                }
            },
            showDialogVerifyBoard(_selected, _verified, onAccept) {
                if (typeof onAccept === "function") {
                    onAccept();
                }
            },
        };

        return shim;
    }

    async function closeDirectDumpSerial() {
        if (self.dumpDirectSerialReceiveHandler) {
            serial.removeEventListener("receive", self.dumpDirectSerialReceiveHandler);
            self.dumpDirectSerialReceiveHandler = null;
        }

        if (self.dumpDirectSerialOpenedByTool && serial.connected) {
            try {
                await serial.disconnect();
            } catch (error) {
                console.error("Failed to close direct dump serial link:", error);
            }
        }

        self.dumpDirectSerialActive = false;
        self.dumpDirectSerialOpenedByTool = false;
    }

    async function ensureDumpSerialLink() {
        if (CONFIGURATOR.connectionValid) {
            return;
        }

        if (self.dumpDirectSerialActive && serial.connected) {
            return;
        }

        let selectedPort = PortHandler.portPicker.selectedPort;

        // After DFU flashing the device reboots and re-enumerates as a serial port.
        // We must wait for two distinct transitions before connecting:
        //   Phase 1 – DFU device disappears  → picker reaches 'noselection'
        //   Phase 2 – Rebooted device appears → picker leaves  'noselection'
        //
        // Connecting after only phase 1 (or not waiting at all) picks up a port
        // that the DFU teardown event will close moments later, causing
        // "serial port not open" errors in activateCli.
        if (selectedPort && selectedPort.startsWith("usb_")) {
            // Phase 1: wait for the DFU device to fully disconnect.
            try {
                await waitForCondition(
                    () => {
                        const port = PortHandler.portPicker.selectedPort;
                        return !port || port === "noselection";
                    },
                    15000,
                    200,
                );
            } catch {
                // DFU may have already disappeared before we checked — continue.
            }

            // Phase 2: wait for the rebooted FC to enumerate as a serial port.
            try {
                await waitForCondition(
                    () => {
                        const port = PortHandler.portPicker.selectedPort;
                        return port && port !== "noselection" && !port.startsWith("usb_");
                    },
                    15000,
                    200,
                );
                selectedPort = PortHandler.portPicker.selectedPort;
            } catch {
                throw new Error(i18n.getMessage("portsSelectNoSelection"));
            }
        }

        const hasPortSelection = selectedPort && selectedPort !== "noselection";
        if (!hasPortSelection) {
            throw new Error(i18n.getMessage("portsSelectNoSelection"));
        }

        const portName = selectedPort === "manual" ? PortHandler.portPicker.portOverride : selectedPort;
        const baudRate = PortHandler.portPicker.selectedBauds || 115200;
        const connected = await serial.connect(portName, { baudRate });
        if (!connected) {
            throw new Error("Direct serial connect failed");
        }

        self.dumpDirectSerialOpenedByTool = true;
        self.dumpDirectSerialActive = true;

        self.dumpDirectSerialReceiveHandler = (event) => {
            if (CONFIGURATOR.cliEngineActive) {
                self.read({ data: event.detail.data });
            }
        };
        serial.addEventListener("receive", self.dumpDirectSerialReceiveHandler);
    }

    async function pickHex() {
        try {
            const file = await FileSystem.pickOpenFile(i18n.getMessage("fileSystemPickerFirmwareFiles"), [".hex"]);
            if (!file) {
                return;
            }

            setStatus(".hex-status", i18n.getMessage("firmwareFlasherOptionLoading"));
            setHexProgress(0);

            const hexText = await FileSystem.readFile(file);
            const parsed = await read_hex_file(hexText);

            if (!parsed) {
                setStatus(".hex-status", i18n.getMessage("firmwareFlasherHexCorrupted"));
                setButtonState("a.flash_hex", false);
                return;
            }

            self.hexFile = file;
            self.hexParsed = parsed;
            setFileName(".hex-file-name", file);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexReady", { bytes: parsed.bytes_total }));
            setHexProgress(0);
            setButtonState("a.flash_hex", true);
            refreshPresetButtonsState();
        } catch (error) {
            console.error("Failed to pick HEX file:", error);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexLoadFailed"));
        }
    }

    async function flashHex() {
        if (!self.hexParsed) {
            return false;
        }

        setButtonState("a.flash_hex", false);
        setStatus(".hex-status", i18n.getMessage("flashToolsHexFlashingStarted"));
        setHexProgress(0);

        const flasherShim = createFirmwareFlasherShim();
        TABS.firmware_flasher = flasherShim;

        try {
            const options = {};
            const eraseChip = !!getConfig("erase_chip").erase_chip;
            if (eraseChip) {
                options.erase_chip = true;
            }

            const selectedPort = PortHandler.portPicker.selectedPort || "";
            const isSerial = selectedPort.startsWith("serial") || selectedPort.startsWith("capacitor-");
            const isDFU = selectedPort.startsWith("usb_");

            if (isDFU) {
                await new Promise((resolve) => {
                    DFU.connect(selectedPort, self.hexParsed, options, resolve);
                });
            } else if (isSerial) {
                const noReboot = !!getConfig("no_reboot_sequence").no_reboot_sequence;
                if (noReboot) {
                    options.no_reboot = true;
                } else {
                    options.reboot_baud = PortHandler.portPicker.selectedBauds;
                }

                let baud = 115200;
                const manualBaud = !!getConfig("flash_manual_baud").flash_manual_baud;
                if (manualBaud) {
                    baud = parseInt(getConfig("flash_manual_baud_rate").flash_manual_baud_rate) || 115200;
                }

                await new Promise((resolve) => {
                    STM32.connect(selectedPort, baud, self.hexParsed, options, resolve);
                });
            } else {
                const usbDevice = await DFU.requestPermission();
                if (!usbDevice?.path) {
                    throw new Error("No DFU device permission granted");
                }
                await new Promise((resolve) => {
                    DFU.connect(usbDevice.path, self.hexParsed, options, resolve);
                });
            }

            return true;
        } catch (error) {
            console.error("HEX flashing failed:", error);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexFlashFailed"));
            setButtonState("a.flash_hex", true);
            GUI.connect_lock = false;
            return false;
        }
    }

    async function pickDump() {
        try {
            const file = await FileSystem.pickOpenFile(i18n.getMessage("fileSystemPickerFiles", { typeof: "TXT" }), [
                ".txt",
                ".diff",
                ".cfg",
            ]);
            if (!file) {
                return;
            }
            const text = await FileSystem.readFile(file);
            if (!text || !text.trim()) {
                gui_log(i18n.getMessage("flashToolsDumpEmpty"));
                setStatus(".dump-status", i18n.getMessage("flashToolsDumpEmpty"));
                return;
            }

            self.dumpText = text;
            self.dumpFile = file;
            setFileName(".dump-file-name", file);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpReady"));
            setButtonState("a.apply_dump", true);
            refreshPresetButtonsState();
        } catch (error) {
            console.error("Failed to pick dump file:", error);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpLoadFailed"));
            gui_log(i18n.getMessage("flashToolsDumpLoadFailed"));
        }
    }

    function normalizeDumpCommands(text) {
        return text
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .filter((line) => !line.startsWith("#"))
            .filter((line) => !line.startsWith(";"));
    }

    async function activateCli() {
        CONFIGURATOR.cliEngineActive = true;
        self.cliEngine.setUi(
            $("#flash_tools_cli_window"),
            $("#flash_tools_cli_window_wrapper"),
            $("#flash_tools_cli_command"),
        );

        const startedAt = Date.now();
        const timeoutMs = 12000;

        while (Date.now() - startedAt < timeoutMs) {
            self.cliEngine.enterCliMode();

            try {
                await waitForCondition(() => CONFIGURATOR.cliEngineValid || hasCliPromptInOutput(), 700, 100);

                if (!CONFIGURATOR.cliEngineValid && hasCliPromptInOutput()) {
                    CONFIGURATOR.cliEngineValid = true;
                    self.cliEngine.cliBuffer = "";
                }

                return;
            } catch {
                // retry sending '#' until prompt/banner appears
            }
        }

        throw new Error("Timeout");
    }

    async function leaveCli() {
        if (!CONFIGURATOR.cliEngineActive) {
            return;
        }

        await new Promise((resolve) => {
            self.cliEngine.sendLine(CliEngine.s_commandExit, () => resolve());
        });
        CONFIGURATOR.cliEngineActive = false;
        CONFIGURATOR.cliEngineValid = false;
        self.cliEngine.cliBuffer = "";
    }

    async function applyDump() {
        if (!self.dumpText) {
            return false;
        }

        const saveAfterApply = $("input.save_after_dump").is(":checked");
        const commands = normalizeDumpCommands(self.dumpText);

        if (commands.length === 0) {
            gui_log(i18n.getMessage("flashToolsDumpEmpty"));
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpEmpty"));
            return false;
        }

        setButtonState("a.apply_dump", false);
        setStatus(".dump-status", i18n.getMessage("flashToolsDumpApplying"));

        try {
            await ensureDumpSerialLink();
            await activateCli();
            await self.cliEngine.executeCommandsArray(commands);

            if (saveAfterApply) {
                setConfig({ lastTab: "tab_flash_tools" });
                self.cliEngine.sendLine(CliEngine.s_commandSave);
                setStatus(".dump-status", i18n.getMessage("flashToolsDumpSaved"));
                GUI.timeout_add(
                    "flash_tools_cli_reset_after_save",
                    () => {
                        CONFIGURATOR.cliEngineActive = false;
                        CONFIGURATOR.cliEngineValid = false;
                        closeDirectDumpSerial();
                    },
                    1000,
                );
            } else {
                await leaveCli();
                await closeDirectDumpSerial();
                setStatus(".dump-status", i18n.getMessage("flashToolsDumpApplied"));
            }

            return true;
        } catch (error) {
            console.error("Failed to apply dump:", error);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpApplyFailed"));
            gui_log(i18n.getMessage("flashToolsDumpApplyFailed"));
            await leaveCli();
            await closeDirectDumpSerial();
            return false;
        } finally {
            setButtonState("a.apply_dump", true);
        }
    }

    async function pickElrsBin() {
        try {
            const file = await FileSystem.pickOpenFile(i18n.getMessage("fileSystemPickerFiles", { typeof: "BIN" }), [
                ".bin",
            ]);
            if (!file) {
                return;
            }
            self.elrsFile = file;
            setFileName(".elrs-file-name", file);
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsReady"));
            setButtonState("a.flash_elrs", true);
            refreshPresetButtonsState();
        } catch (error) {
            console.error("Failed to pick ELRS BIN file:", error);
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsLoadFailed"));
        }
    }

    async function runElrsViaLocalPython() {
        if (!(typeof navigator !== "undefined" && navigator.serial?.requestPort)) {
            throw new Error("Web Serial API is not supported in this browser");
        }

        if (serial.connected) {
            try {
                await serial.disconnect();
            } catch (error) {
                console.warn("Failed to disconnect active serial link before ELRS flash:", error);
            }
        }

        const blob = await FileSystem.readFileAsBlob(self.elrsFile);
        const firmware = new Uint8Array(await blob.arrayBuffer());
        const files = [{ data: firmware, address: 0x0 }];

        let latestStatus = "";
        const updateStatusFromLog = (raw) => {
            const text = `${raw ?? ""}`.replace(/\s+/g, " ").trim();
            if (!text || text === latestStatus) {
                return;
            }
            latestStatus = text;
            setStatus(".elrs-status", text.slice(-220));
        };

        const terminal = {
            write(line) {
                updateStatusFromLog(line);
            },
            writeln(line) {
                updateStatusFromLog(line);
            },
        };

        const selectedPort = await navigator.serial.requestPort();
        const flasherConfig = {
            platform: "auto",
            firmware: "FORCE",
        };
        const flasher = new ESPFlasher(selectedPort, "RX", "betaflight", flasherConfig, {}, "", terminal);

        try {
            const chip = await flasher.connect();
            setStatus(".elrs-status", `Connected to ${chip}.`);
            await flasher.flash(files, false, (_fileIndex, written, total) => {
                if (!total) {
                    return;
                }
                const progress = Math.max(0, Math.min(100, Math.round((written / total) * 100)));
                setStatus(".elrs-status", `${i18n.getMessage("flashToolsElrsFlashingStarted")} ${progress}%`);
            });
        } finally {
            try {
                await flasher.close();
            } catch (error) {
                console.warn("Failed to close ELRS flasher transport:", error);
            }
        }
    }

    async function flashElrs() {
        if (!self.elrsFile) {
            return false;
        }

        setButtonState("a.flash_elrs", false);
        setStatus(".elrs-status", i18n.getMessage("flashToolsElrsFlashingStarted"));

        try {
            await runElrsViaLocalPython();
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsFlashingDone"));
            return true;
        } catch (error) {
            console.error("ELRS flashing failed:", error);
            if (error?.name === "NotFoundError" || error?.name === "AbortError") {
                setStatus(".elrs-status", i18n.getMessage("portsSelectNoSelection"));
            } else if (error instanceof WrongMCU || error instanceof MismatchError) {
                setStatus(".elrs-status", error.message || i18n.getMessage("flashToolsElrsNotAvailable"));
            } else if (error?.message) {
                setStatus(".elrs-status", error.message);
            } else {
                setStatus(".elrs-status", i18n.getMessage("flashToolsElrsNotAvailable"));
            }
            return false;
        } finally {
            setButtonState("a.flash_elrs", true);
        }
    }

    $("a.load_hex").on("click", async (event) => {
        event.preventDefault();
        await pickHex();
    });

    $("a.save_preset").on("click", async (event) => {
        event.preventDefault();
        if ($("a.save_preset").hasClass("disabled")) {
            return;
        }
        await saveCurrentAsPreset();
    });

    $("a.load_preset").on("click", async (event) => {
        event.preventDefault();
        if ($("a.load_preset").hasClass("disabled")) {
            return;
        }
        await loadSelectedPreset();
    });

    $("a.delete_preset").on("click", async (event) => {
        event.preventDefault();
        if ($("a.delete_preset").hasClass("disabled")) {
            return;
        }
        await deleteSelectedPreset();
    });

    $(".flash-tools-preset-list").on("change", () => {
        refreshPresetButtonsState();
        setPresetStatus("");
    });

    $("a.flash_hex").on("click", async (event) => {
        event.preventDefault();
        if ($("a.flash_hex").hasClass("disabled")) {
            return;
        }
        await flashHex();
    });

    $("a.load_dump").on("click", async (event) => {
        event.preventDefault();
        await pickDump();
    });

    $("a.apply_dump").on("click", async (event) => {
        event.preventDefault();
        if ($("a.apply_dump").hasClass("disabled")) {
            return;
        }
        await applyDump();
    });

    $("a.load_elrs").on("click", async (event) => {
        event.preventDefault();
        await pickElrsBin();
    });

    $("a.flash_elrs").on("click", async (event) => {
        event.preventDefault();
        if ($("a.flash_elrs").hasClass("disabled")) {
            return;
        }
        await flashElrs();
    });

    $("a.flash_all").on("click", async (event) => {
        event.preventDefault();
        if ($("a.flash_all").hasClass("disabled")) {
            return;
        }

        if (!(await flashHex())) {
            return;
        }

        if (!(await applyDump())) {
            return;
        }

        await flashElrs();
    });

    renderPresetList();
    refreshPresetButtonsState();

    GUI.content_ready(callback);
};

flash_tools.read = function (readInfo) {
    const engine = flash_tools.cliEngine;
    if (engine) {
        engine.readSerial(readInfo);
    }
};

flash_tools.cleanup = function (callback) {
    if (this.dumpDirectSerialReceiveHandler) {
        serial.removeEventListener("receive", this.dumpDirectSerialReceiveHandler);
        this.dumpDirectSerialReceiveHandler = null;
    }

    if (this.dumpDirectSerialOpenedByTool && serial.connected) {
        serial.disconnect();
    }
    this.dumpDirectSerialActive = false;
    this.dumpDirectSerialOpenedByTool = false;

    if (!(CONFIGURATOR.connectionValid && CONFIGURATOR.cliEngineActive && CONFIGURATOR.cliEngineValid)) {
        CONFIGURATOR.cliEngineActive = false;
        CONFIGURATOR.cliEngineValid = false;
        if (callback) {
            callback();
        }
        return;
    }

    this.cliEngine.close(() => {
        CONFIGURATOR.cliEngineActive = false;
        CONFIGURATOR.cliEngineValid = false;
        if (callback) {
            callback();
        }
    });
};

TABS.flash_tools = flash_tools;
export { flash_tools };
