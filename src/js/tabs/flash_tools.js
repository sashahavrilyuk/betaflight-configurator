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

const flash_tools = {
    hexFile: null,
    hexParsed: null,
    dumpText: "",
    elrsFile: null,
    cliEngine: null,
    originalFirmwareFlasherTab: null,
    dumpDirectSerialActive: false,
    dumpDirectSerialOpenedByTool: false,
    dumpDirectSerialReceiveHandler: null,
};

flash_tools.initialize = function (callback) {
    if (GUI.active_tab !== "flash_tools") {
        GUI.active_tab = "flash_tools";
    }

    this.hexFile = null;
    this.hexParsed = null;
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

        const selectedPort = PortHandler.portPicker.selectedPort;
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
        } catch (error) {
            console.error("Failed to pick HEX file:", error);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexLoadFailed"));
        }
    }

    async function flashHex() {
        if (!self.hexParsed) {
            return;
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
                await DFU.connect(selectedPort, self.hexParsed, options);
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

                STM32.connect(selectedPort, baud, self.hexParsed, options);
            } else {
                const usbDevice = await DFU.requestPermission();
                if (!usbDevice?.path) {
                    throw new Error("No DFU device permission granted");
                }
                await DFU.connect(usbDevice.path, self.hexParsed, options);
            }
        } catch (error) {
            console.error("HEX flashing failed:", error);
            setStatus(".hex-status", i18n.getMessage("flashToolsHexFlashFailed"));
            setButtonState("a.flash_hex", true);
            GUI.connect_lock = false;
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
            setFileName(".dump-file-name", file);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpReady"));
            setButtonState("a.apply_dump", true);
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
            return;
        }

        const saveAfterApply = $("input.save_after_dump").is(":checked");
        const commands = normalizeDumpCommands(self.dumpText);

        if (commands.length === 0) {
            gui_log(i18n.getMessage("flashToolsDumpEmpty"));
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpEmpty"));
            return;
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
        } catch (error) {
            console.error("Failed to apply dump:", error);
            setStatus(".dump-status", i18n.getMessage("flashToolsDumpApplyFailed"));
            gui_log(i18n.getMessage("flashToolsDumpApplyFailed"));
            await leaveCli();
            await closeDirectDumpSerial();
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
        } catch (error) {
            console.error("Failed to pick ELRS BIN file:", error);
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsLoadFailed"));
        }
    }

    async function runElrsViaLocalPython() {
        const nodeRequire = typeof window !== "undefined" && window.require ? window.require.bind(window) : null;
        if (!nodeRequire) {
            throw new Error("Node integration is not available");
        }

        const fs = nodeRequire("fs");
        const os = nodeRequire("os");
        const path = nodeRequire("path");
        const childProcess = nodeRequire("child_process");
        const processModule = nodeRequire("process");

        const cwd = processModule.cwd();
        const pythonEmbedded = path.join(cwd, "elrs", "python", "python.exe");
        const pythonExecutable = fs.existsSync(pythonEmbedded) ? pythonEmbedded : "python";
        const scriptPath = path.join(cwd, "elrs", "main.py");
        const tempFile = path.join(os.tmpdir(), `elrs-rx-${Date.now()}.bin`);

        const binBlob = await FileSystem.readFileAsBlob(self.elrsFile);
        const bytes = Buffer.from(await binBlob.arrayBuffer());
        fs.writeFileSync(tempFile, bytes);

        const args = [
            scriptPath,
            "--flash",
            "bf",
            "--baud",
            "420000",
            "--platform",
            "esp8285",
            "--device_type",
            "rx",
            tempFile,
        ];

        return await new Promise((resolve, reject) => {
            const proc = childProcess.spawn(pythonExecutable, args, {
                cwd: path.join(cwd, "elrs"),
                windowsHide: true,
            });

            let output = "";
            proc.stdout?.on("data", (data) => {
                output += data.toString();
                setStatus(".elrs-status", output.slice(-220));
            });
            proc.stderr?.on("data", (data) => {
                output += data.toString();
                setStatus(".elrs-status", output.slice(-220));
            });

            proc.on("error", (error) => {
                try {
                    fs.unlinkSync(tempFile);
                } catch {
                    // ignore cleanup errors
                }
                reject(error);
            });

            proc.on("close", (code) => {
                try {
                    fs.unlinkSync(tempFile);
                } catch {
                    // ignore cleanup errors
                }

                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(output || `ELRS process exited with code ${code}`));
                }
            });
        });
    }

    async function flashElrs() {
        if (!self.elrsFile) {
            return;
        }

        setButtonState("a.flash_elrs", false);
        setStatus(".elrs-status", i18n.getMessage("flashToolsElrsFlashingStarted"));

        try {
            await runElrsViaLocalPython();
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsFlashingDone"));
        } catch (error) {
            console.error("ELRS flashing failed:", error);
            setStatus(".elrs-status", i18n.getMessage("flashToolsElrsNotAvailable"));
        } finally {
            setButtonState("a.flash_elrs", true);
        }
    }

    $("a.load_hex").on("click", async (event) => {
        event.preventDefault();
        await pickHex();
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
