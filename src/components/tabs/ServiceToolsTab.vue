<template>
    <BaseTab tab-name="service_tools">
        <div class="content_wrapper grid-box col1 gap-4">
            <div class="tab_title">{{ $t("tabServiceTools") }}</div>

            <UiBox v-if="!isAnyDeviceConnected" type="warning">
                {{ $t("serviceToolsConnectRequired") }}
            </UiBox>
            <UiBox v-else-if="isDfuConnected && !isFcConnected" type="neutral">
                {{ $t("serviceToolsDfuModeNotice") }}
            </UiBox>

            <UiBox :title="$t('serviceToolsFcHexTitle')">
                <p class="text-sm text-dimmed">{{ $t("serviceToolsFcHexHint") }}</p>
                <div class="flex flex-wrap gap-2 mt-3">
                    <UButton
                        size="sm"
                        icon="i-lucide-folder-open"
                        :disabled="!isAnyDeviceConnected || fcFlashInProgress"
                        @click="loadFcHexFile"
                    >
                        {{ $t("serviceToolsLoadHex") }}
                    </UButton>
                    <UButton
                        size="sm"
                        color="success"
                        icon="i-lucide-zap"
                        :disabled="!canFlashFcHex"
                        @click="flashFcHexFile"
                    >
                        {{ $t("serviceToolsFlashHex") }}
                    </UButton>
                </div>
                <div v-if="fcHexFilename" class="text-xs text-dimmed mt-2">
                    {{ $t("serviceToolsSelectedFile") }}: {{ fcHexFilename }}
                </div>
                <UProgress
                    v-if="fcFlashInProgress || fcFlashProgress > 0"
                    :model-value="fcFlashProgress"
                    :max="100"
                    class="mt-3"
                />
                <div v-if="fcFlashMessage" class="service-tools-message mt-3" :class="fcFlashMessageClass">
                    {{ fcFlashMessage }}
                </div>
            </UiBox>

            <UiBox :title="$t('serviceToolsDumpTitle')">
                <p class="text-sm text-dimmed">{{ $t("serviceToolsDumpHint") }}</p>
                <div class="flex flex-wrap gap-2 mt-3">
                    <UButton
                        size="sm"
                        icon="i-lucide-folder-open"
                        :disabled="!isFcConnected || dumpRestoreBusy"
                        @click="loadDumpFile"
                    >
                        {{ $t("serviceToolsLoadDump") }}
                    </UButton>
                    <UButton
                        size="sm"
                        color="success"
                        icon="i-lucide-upload"
                        :disabled="!canRestoreDump"
                        @click="restoreDumpFile"
                    >
                        {{ $t("serviceToolsRestoreDump") }}
                    </UButton>
                </div>
                <div v-if="dumpFilename" class="text-xs text-dimmed mt-2">
                    {{ $t("serviceToolsSelectedFile") }}: {{ dumpFilename }}
                </div>
                <UProgress v-if="dumpRestoreBusy" :model-value="dumpRestoreProgress" :max="100" class="mt-3" />
                <div v-if="dumpRestoreErrors.length" class="service-tools-console mt-3">
                    <template v-for="(failure, idx) in dumpRestoreErrors" :key="idx">
                        <div>{{ failure.command }}</div>
                        <div
                            v-for="(line, lineIdx) in failure.response"
                            :key="`${idx}-${lineIdx}`"
                            :class="{ 'service-tools-error': line.startsWith('###ERROR') }"
                        >
                            {{ line }}
                        </div>
                    </template>
                </div>
                <div v-if="dumpRestoreErrors.length" class="flex flex-wrap gap-2 mt-3">
                    <UButton size="sm" variant="outline" @click="abortDumpRestore">
                        {{ $t("serviceToolsDiscardRestore") }}
                    </UButton>
                    <UButton size="sm" color="success" @click="saveDumpRestore">
                        {{ $t("serviceToolsSaveRestore") }}
                    </UButton>
                </div>
            </UiBox>

            <UiBox :title="$t('serviceToolsRxTitle')">
                <p class="text-sm text-dimmed">{{ $t("serviceToolsRxHint") }}</p>

                <div v-if="!isTauriRuntime" class="service-tools-message invalid mt-3">
                    {{ $t("serviceToolsRxTauriOnly") }}
                </div>

                <div class="grid-box col2 mt-3">
                    <div>
                        <div class="text-xs text-dimmed mb-1">{{ $t("serviceToolsRxPlatform") }}</div>
                        <USelect
                            v-model="rxPlatform"
                            :items="rxPlatformOptions"
                            value-key="value"
                            class="min-w-52"
                            :disabled="!isFcConnected || !isTauriRuntime || rxFlashBusy"
                        />
                    </div>
                    <div>
                        <div class="text-xs text-dimmed mb-1">{{ $t("serviceToolsRxBaud") }}</div>
                        <UInput
                            v-model="rxBaud"
                            type="number"
                            class="min-w-52"
                            :disabled="!isFcConnected || !isTauriRuntime || rxFlashBusy"
                        />
                    </div>
                </div>

                <div class="flex flex-wrap gap-5 mt-3">
                    <label class="flex items-center gap-2 text-sm">
                        <USwitch v-model="rxErase" :disabled="!isFcConnected || !isTauriRuntime || rxFlashBusy" />
                        <span>{{ $t("serviceToolsRxErase") }}</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                        <USwitch v-model="rxForce" :disabled="!isFcConnected || !isTauriRuntime || rxFlashBusy" />
                        <span>{{ $t("serviceToolsRxForce") }}</span>
                    </label>
                </div>

                <div class="flex flex-wrap gap-2 mt-3">
                    <UButton
                        size="sm"
                        icon="i-lucide-folder-open"
                        :disabled="!isFcConnected || !isTauriRuntime || rxFlashBusy"
                        @click="loadRxFirmwareFile"
                    >
                        {{ $t("serviceToolsLoadRx") }}
                    </UButton>
                    <UButton
                        size="sm"
                        color="success"
                        icon="i-lucide-radio"
                        :disabled="!canFlashRx"
                        @click="flashRxFirmware"
                    >
                        {{ $t("serviceToolsFlashRx") }}
                    </UButton>
                </div>

                <div v-if="rxFirmwareFilename" class="text-xs text-dimmed mt-2">
                    {{ $t("serviceToolsSelectedFile") }}: {{ rxFirmwareFilename }}
                </div>

                <div v-if="rxFlashOutput" class="service-tools-console mt-3">{{ rxFlashOutput }}</div>
            </UiBox>
        </div>
    </BaseTab>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useTranslation } from "i18next-vue";
import { invoke } from "@tauri-apps/api/core";
import BaseTab from "./BaseTab.vue";
import UiBox from "../elements/UiBox.vue";
import GUI, { TABS } from "../../js/gui";
import FC from "../../js/fc";
import PortHandler from "../../js/port_handler";
import FileSystem from "../../js/FileSystem";
import { gui_log } from "../../js/gui_log";
import { useConnectionStore } from "@/stores/connection";
import { isTauri } from "@/js/utils/checkCompatibility";
import { useDialog } from "@/composables/useDialog";
import { useFirmwareFlashing } from "@/composables/useFirmwareFlashing";
import {
    MIN_FC_VERSION_FOR_MSP_CLI,
    cancelScheduledReconnect,
    isMspCliSupported,
    saveAndReconnect,
    scheduleReconnect,
    useMspCliSession,
} from "@/composables/useMspCliSession";

const { t } = useTranslation();
const dialog = useDialog();
const connectionStore = useConnectionStore();
const cliSession = useMspCliSession();

const isFcConnected = computed(() => {
    return Boolean(connectionStore.connectionValid || connectionStore.connectedTo);
});
const isDfuConnected = computed(() => {
    const selectedPort = PortHandler.portPicker.selectedPort;
    return Boolean(PortHandler.dfuAvailable || (typeof selectedPort === "string" && selectedPort.startsWith("usb")));
});
const isAnyDeviceConnected = computed(() => isFcConnected.value || isDfuConnected.value);
const isTauriRuntime = isTauri();

const FLASH_MESSAGE_TYPES = {
    NEUTRAL: "NEUTRAL",
    VALID: "VALID",
    INVALID: "INVALID",
    ACTION: "ACTION",
    ERASING: "ERASING",
    FLASHING: "FLASHING",
    VERIFYING: "VERIFYING",
};

const fcHexFilename = ref("");
const fcHexLoaded = ref(false);
const fcFlashInProgress = ref(false);
const fcFlashProgress = ref(0);
const fcFlashMessage = ref("");
const fcFlashMessageKind = ref("neutral");

const dumpFilename = ref("");
const dumpContents = ref("");
const dumpRestoreBusy = ref(false);
const dumpRestoreProgress = ref(0);
const dumpRestoreErrors = ref([]);

const rxPlatformOptions = [
    { value: "esp8285", label: "ESP8285" },
    { value: "esp32", label: "ESP32" },
    { value: "esp32c3", label: "ESP32-C3" },
    { value: "esp32s2", label: "ESP32-S2" },
    { value: "esp32s3", label: "ESP32-S3" },
    { value: "stm32", label: "STM32" },
];
const rxPlatform = ref("esp8285");
const rxBaud = ref("420000");
const rxErase = ref(false);
const rxForce = ref(false);
const rxFlashBusy = ref(false);
const rxFirmwareFilename = ref("");
const rxFirmwareBytes = ref([]);
const rxFlashOutput = ref("");

let previousFirmwareTabAdapter = null;
let dfuDetectionTimeoutId = null;
const DFU_DETECTION_TIMEOUT_MS = 8000;
let flashStateWatchIntervalId = null;

const fcFlashMessageClass = computed(() => {
    return {
        valid: fcFlashMessageKind.value === "valid",
        invalid: fcFlashMessageKind.value === "invalid",
        neutral: fcFlashMessageKind.value === "neutral",
    };
});

const canFlashFcHex = computed(() => isAnyDeviceConnected.value && fcHexLoaded.value && !fcFlashInProgress.value);
const canRestoreDump = computed(() => isFcConnected.value && !!dumpContents.value && !dumpRestoreBusy.value);
const canFlashRx = computed(() => {
    return (
        isFcConnected.value &&
        isTauriRuntime &&
        rxFirmwareBytes.value.length > 0 &&
        !rxFlashBusy.value &&
        Number.isFinite(Number(rxBaud.value))
    );
});

function setFcFlashMessage(message, type) {
    fcFlashMessage.value = message || "";
    switch (type) {
        case FLASH_MESSAGE_TYPES.VALID:
            fcFlashMessageKind.value = "valid";
            break;
        case FLASH_MESSAGE_TYPES.INVALID:
            fcFlashMessageKind.value = "invalid";
            break;
        default:
            fcFlashMessageKind.value = "neutral";
            break;
    }
}

function flashingMessage(message, type) {
    setFcFlashMessage(message, type);
    return TABS.firmware_flasher;
}

function flashProgress(value) {
    const progress = Number(value);
    if (Number.isFinite(progress)) {
        fcFlashProgress.value = Math.max(0, Math.min(100, progress));
        if (fcFlashProgress.value > 0) {
            clearDfuDetectionTimer();
        }
    }

    if (fcFlashProgress.value >= 100) {
        fcFlashInProgress.value = false;
        GUI.flashingInProgress = false;
    }
    return TABS.firmware_flasher;
}

function resetFcFlashingState() {
    clearDfuDetectionTimer();
    fcFlashInProgress.value = false;
    GUI.flashingInProgress = false;
}

function clearDfuDetectionTimer() {
    if (dfuDetectionTimeoutId) {
        clearTimeout(dfuDetectionTimeoutId);
        dfuDetectionTimeoutId = null;
    }
}

function startDfuDetectionWatchdog() {
    clearDfuDetectionTimer();

    const selectedPort = PortHandler.portPicker.selectedPort;
    const alreadyInDfu = typeof selectedPort === "string" && selectedPort.startsWith("usb");
    if (alreadyInDfu) {
        return;
    }

    dfuDetectionTimeoutId = setTimeout(() => {
        dfuDetectionTimeoutId = null;
        if (!fcFlashInProgress.value) {
            return;
        }
        if (fcFlashProgress.value > 0) {
            return;
        }
        if (PortHandler.dfuAvailable) {
            return;
        }

        const message = t("serviceToolsDfuNotDetected");
        setFcFlashMessage(message, FLASH_MESSAGE_TYPES.INVALID);
        gui_log(message);
    }, DFU_DETECTION_TIMEOUT_MS);
}

const firmwareFlashing = useFirmwareFlashing({
    flashingMessage,
    flashProgress,
    FLASH_MESSAGE_TYPES,
    $t: t,
    logHead: "[SERVICE_TOOLS]",
});

function registerFirmwareTabAdapter() {
    previousFirmwareTabAdapter = TABS.firmware_flasher ?? null;
    TABS.firmware_flasher = {
        resetFlashingState: resetFcFlashingState,
        preservePreFlashingState: () => {},
        flashingMessage,
        flashProgress,
        cleanup: () => {},
        refresh: () => {},
        requestDfuPermission: async () => {
            const confirmed = await dialog.showYesNo(t("stm32UsbDfuNotFound"), t("stm32DfuPermissionRequired"), {
                yesText: t("portsSelectPermissionDFU"),
                noText: t("close"),
            });
            if (!confirmed) {
                resetFcFlashingState();
                return;
            }

            try {
                await PortHandler.dfuProtocol.requestPermission();
            } catch (error) {
                console.error("DFU permission request failed:", error);
                resetFcFlashingState();
            }
        },
        FLASH_MESSAGE_TYPES,
        get parsed_hex() {
            return firmwareFlashing.getParsedHex();
        },
    };
}

function restoreFirmwareTabAdapter() {
    if (previousFirmwareTabAdapter) {
        TABS.firmware_flasher = previousFirmwareTabAdapter;
    } else if (TABS.firmware_flasher) {
        delete TABS.firmware_flasher;
    }
}

async function loadFcHexFile() {
    if (!isAnyDeviceConnected.value || fcFlashInProgress.value) {
        return;
    }

    try {
        const file = await FileSystem.pickOpenFile(t("fileSystemPickerFirmwareFiles"), [".hex"]);
        if (!file) {
            return;
        }

        const contents = await FileSystem.readFile(file);
        const result = await firmwareFlashing.processFirmware(contents, "hex", {
            enableFlashButton: () => {},
            enableLoadRemoteFileButton: () => {},
            showLoadedFirmware: (filename) => {
                fcHexFilename.value = filename;
                fcHexLoaded.value = true;
                setFcFlashMessage(
                    t("firmwareFlasherFirmwareLocalLoaded", { filename, bytes: "-" }),
                    FLASH_MESSAGE_TYPES.NEUTRAL,
                );
            },
            key: file.name,
            isLocalFile: true,
        });

        if (!result) {
            fcHexLoaded.value = false;
            return;
        }

        fcHexFilename.value = file.name;
        fcHexLoaded.value = true;
        setFcFlashMessage(
            t("firmwareFlasherFirmwareLocalLoaded", { filename: file.name, bytes: result.parsedHex?.bytes_total || 0 }),
            FLASH_MESSAGE_TYPES.NEUTRAL,
        );
    } catch (error) {
        console.error("Failed to load HEX file:", error);
        setFcFlashMessage(t("firmwareFlasherFailedToLoadOnlineFirmware"), FLASH_MESSAGE_TYPES.INVALID);
        fcHexLoaded.value = false;
    }
}

async function flashFcHexFile() {
    if (!canFlashFcHex.value) {
        return;
    }

    fcFlashInProgress.value = true;
    fcFlashProgress.value = 0;
    GUI.flashingInProgress = true;
    startDfuDetectionWatchdog();

    try {
        await firmwareFlashing.startFlashing({
            config: null,
            clearBoardConfig: () => {},
            eraseChip: false,
            noRebootSequence: false,
            flashManualBaud: false,
            flashManualBaudRate: "256000",
            filename: fcHexFilename.value || "firmware.hex",
            resetFlashingState: resetFcFlashingState,
            setFlashOnConnect: () => {},
            selectedBoard: FC.CONFIG?.boardName || "NONE",
            localFirmwareLoaded: true,
            showDialogVerifyBoard: null,
        });
    } catch (error) {
        console.error("FC flash failed:", error);
        setFcFlashMessage(String(error?.message || error), FLASH_MESSAGE_TYPES.INVALID);
        resetFcFlashingState();
    }
}

async function ensureMspCliSupport() {
    if (isMspCliSupported()) {
        return true;
    }

    await dialog.showInfo(
        t("warningTitle"),
        t("mspCliFirmwareTooOld", {
            required: MIN_FC_VERSION_FOR_MSP_CLI,
            current: FC.CONFIG?.flightControllerVersion || "?",
        }),
        {
            confirmText: t("close"),
        },
    );
    return false;
}

async function loadDumpFile() {
    if (!isFcConnected.value || dumpRestoreBusy.value) {
        return;
    }

    try {
        const file = await FileSystem.pickOpenFile(t("fileSystemPickerFiles", { typeof: "TXT" }), [
            ".txt",
            ".diff",
            ".dump",
            ".config",
        ]);
        if (!file) {
            return;
        }

        const contents = await FileSystem.readFile(file);
        dumpContents.value = contents;
        dumpFilename.value = file.name;
        dumpRestoreErrors.value = [];
    } catch (error) {
        console.error("Failed to load dump file:", error);
    }
}

async function restoreDumpFile() {
    if (!canRestoreDump.value) {
        return;
    }

    if (!(await ensureMspCliSupport())) {
        return;
    }

    const confirmed = await dialog.showYesNo(t("titleRestoreBackup"), t("serviceToolsRestoreConfirm"), {
        yesText: t("actionRestore"),
        noText: t("cancel"),
    });
    if (!confirmed) {
        return;
    }

    const fileLines = dumpContents.value.split(/\r?\n/);
    const hasDefaultsPrefix = fileLines.some((line) => line.trim().toLowerCase() === "defaults nosave");
    const commands = hasDefaultsPrefix ? fileLines : ["defaults nosave", "", ...fileLines];

    dumpRestoreBusy.value = true;
    dumpRestoreProgress.value = 0;
    dumpRestoreErrors.value = [];

    try {
        const result = await cliSession.runBatch(commands, {
            onProgress: ({ index, total }) => {
                dumpRestoreProgress.value = total > 0 ? Math.round((index / total) * 100) : 100;
            },
            commandTimeoutMs: 5000,
        });

        if (result.cancelled) {
            return;
        }

        if (result.errors.length > 0) {
            dumpRestoreErrors.value = result.errors;
            return;
        }

        gui_log(t("userBackupRestoreSuccess"));
        await saveAndReconnect();
    } catch (error) {
        console.error("Dump restore failed:", error);
        dumpRestoreErrors.value = [{ command: "restore", response: [String(error)] }];
    } finally {
        dumpRestoreBusy.value = false;
    }
}

async function abortDumpRestore() {
    try {
        await cliSession.send("exit");
    } catch (error) {
        console.error("Failed to exit CLI restore session:", error);
    } finally {
        dumpRestoreErrors.value = [];
        scheduleReconnect();
    }
}

async function saveDumpRestore() {
    dumpRestoreErrors.value = [];
    await saveAndReconnect();
}

async function loadRxFirmwareFile() {
    if (!isFcConnected.value || !isTauriRuntime || rxFlashBusy.value) {
        return;
    }

    try {
        const file = await FileSystem.pickOpenFile(t("fileSystemPickerFiles", { typeof: "BIN" }), [
            ".bin",
            ".elrs",
            ".hex",
        ]);
        if (!file) {
            return;
        }
        rxFirmwareFilename.value = file.name;
        const blob = await FileSystem.readFileAsBlob(file);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        rxFirmwareBytes.value = Array.from(bytes);
        rxFlashOutput.value = "";
    } catch (error) {
        console.error("Failed to load RX firmware:", error);
    }
}

function getConnectedPortForElrs() {
    const port = PortHandler.portPicker.selectedPort;
    if (!port || port === "noselection" || port.startsWith("usb") || port.startsWith("bluetooth")) {
        return null;
    }
    return port;
}

async function flashRxFirmware() {
    if (!canFlashRx.value) {
        return;
    }

    const port = getConnectedPortForElrs();
    if (!port) {
        rxFlashOutput.value = t("serviceToolsRxPortInvalid");
        return;
    }

    rxFlashBusy.value = true;
    rxFlashOutput.value = t("serviceToolsRxFlashingStarted");

    try {
        const result = await invoke("run_elrs_flash", {
            request: {
                firmwareName: rxFirmwareFilename.value || "firmware.bin",
                firmwareBytes: rxFirmwareBytes.value,
                port,
                platform: rxPlatform.value,
                baud: Number(rxBaud.value),
                erase: rxErase.value,
                force: rxForce.value,
                deviceType: "rx",
            },
        });

        rxFlashOutput.value = [result.command, "", result.stdout, result.stderr].filter(Boolean).join("\n");
    } catch (error) {
        rxFlashOutput.value = String(error?.message || error);
    } finally {
        rxFlashBusy.value = false;
    }
}

onMounted(() => {
    registerFirmwareTabAdapter();
    flashStateWatchIntervalId = setInterval(() => {
        if (!fcFlashInProgress.value) {
            return;
        }

        const dfuDevicePresent = Boolean(PortHandler.dfuProtocol?.transport?.usbDevice);
        if (!GUI.connect_lock && !dfuDevicePresent) {
            fcFlashInProgress.value = false;
            GUI.flashingInProgress = false;
        }
    }, 300);
});

onUnmounted(() => {
    clearDfuDetectionTimer();
    if (flashStateWatchIntervalId) {
        clearInterval(flashStateWatchIntervalId);
        flashStateWatchIntervalId = null;
    }
    cancelScheduledReconnect();
    cliSession.cancel();
    restoreFirmwareTabAdapter();
});
</script>

<style scoped>
.service-tools-message {
    border: 1px solid var(--ui-border);
    background-color: var(--surface-200);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
}

.service-tools-message.valid {
    border-color: var(--success);
}

.service-tools-message.invalid {
    border-color: var(--error);
}

.service-tools-console {
    border: 1px solid var(--ui-border);
    background-color: rgba(64, 64, 64, 1);
    color: #ffffff;
    border-radius: 0.5rem;
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
    font-family: monospace;
    white-space: pre-wrap;
    user-select: text;
    max-height: 320px;
    overflow-y: auto;
    padding: 0.5rem;
}

.service-tools-error {
    color: #ff6b6b;
    font-weight: bold;
}
</style>
