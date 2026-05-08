<template>
    <BaseTab tab-name="checking">
        <div class="content_wrapper checking-tab">
            <div class="tab_title">{{ $t("tabChecking") }}</div>
            <div class="cf_doc_version_bt">
                <a
                    id="button-documentation"
                    href="https://betaflight.com/docs/wiki/app/setup-tab"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="$t('betaflightSupportButton')"
                >
                    {{ $t("betaflightSupportButton") }}
                </a>
            </div>

            <div class="grid-row grid-box col2 gap-2">
                <div class="col-span-1">
                    <div class="gui_box grey">
                        <div class="gui_box_titlebar">
                            <div class="spacer_box_title" v-html="$t('initialSetupInfoHead')"></div>
                        </div>
                        <div class="spacer_box">
                            <table class="cf_table system_info" role="presentation">
                                <tbody>
                                    <tr>
                                        <td v-html="$t('initialSetupArmingDisableFlags')"></td>
                                        <td>
                                            <span v-if="isReadyToArm" id="initialSetupArmingAllowed">{{
                                                $t("initialSetupArmingAllowed")
                                            }}</span>
                                            <span
                                                v-for="flag in visibleArmingFlags"
                                                :key="flag.id"
                                                class="disarm-flag"
                                                :title="flag.tooltip"
                                                >{{ flag.name }}</span
                                            >
                                        </td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupBattery')"></td>
                                        <td>{{ batteryVoltage }}</td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupDrawn')"></td>
                                        <td>{{ batteryDrawn }}</td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupDrawing')"></td>
                                        <td>{{ batteryCurrent }}</td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupRSSI')"></td>
                                        <td>{{ rssiPercent }}</td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupMCU')"></td>
                                        <td>{{ mcuName }}</td>
                                    </tr>
                                    <tr>
                                        <td v-html="$t('initialSetupCpuTemp')"></td>
                                        <td>{{ cpuTemp }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="col-span-1">
                    <div class="gui_box grey">
                        <div class="gui_box_titlebar">
                            <div class="spacer_box_title" v-html="$t('initialSetupButtonCalibrateAccel')"></div>
                        </div>
                        <div class="spacer_box">
                            <div class="default_btn">
                                <a
                                    href="#"
                                    class="calibrateAccel"
                                    :class="{ disabled: !accAvailable || calibratingAccel }"
                                    @click.prevent="onCalibrateAccel"
                                >
                                    {{
                                        calibratingAccel
                                            ? $t("initialSetupButtonCalibratingText")
                                            : $t("initialSetupButtonCalibrateAccel")
                                    }}
                                </a>
                            </div>
                            <div class="cell_setup">
                                <span v-html="$t('initialSetupCalibrateAccelText')"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid-row grid-box col2 gap-2 margin-top">
                <div class="col-span-1">
                    <div class="tab-motors gui_box grey">
                        <div class="gui_box_titlebar">
                            <div class="spacer_box_title" v-html="$t('configurationMixer')"></div>
                        </div>
                        <div class="spacer_box mixer_settings">
                            <select class="mixerList" v-model.number="mixerConfig.mixer" @change="updateMixerPreview">
                                <option v-for="item in sortedMixerListItems" :key="item.value" :value="item.value">
                                    {{ item.label }}
                                </option>
                            </select>
                            <div class="motor_direction_reversed">
                                <div style="float: left; height: 20px; margin-right: 15px; margin-left: 3px">
                                    <input
                                        type="checkbox"
                                        class="toggle"
                                        id="checkingReverseMotorSwitch"
                                        v-model="reverseMotorDir"
                                        @change="updateMixerPreview"
                                    />
                                </div>
                                <span class="freelabel" v-html="$t('configurationReverseMotorSwitch')"></span>
                                <div class="helpicon cf_tip" :title="$t('configurationReverseMotorSwitchHelp')"></div>
                            </div>
                        </div>
                        <div class="grid-row">
                            <div class="grid-col col6">
                                <div class="mixerPreview" v-html="mixerPreviewSvg"></div>
                            </div>
                        </div>
                        <div class="btn motor_tool_buttons">
                            <a
                                v-if="isMotorOutputReorderAvailable"
                                href="#"
                                id="motorOutputReorderDialogOpen"
                                class="tool regular-button"
                                @click.prevent="openMotorOutputReorderDialog"
                            >
                                {{ $t("motorOutputReorderDialogOpen") }}
                            </a>
                            <a
                                href="#"
                                id="escDshotDirectionDialog-Open"
                                class="tool regular-button"
                                @click.prevent="openEscDshotDirectionDialog"
                            >
                                {{ $t("escDshotDirectionDialog-Open") }}
                            </a>
                        </div>
                    </div>
                </div>

                <div class="col-span-1">
                    <div class="tab-motors gui_box grey motorblock">
                        <div class="gui_box_titlebar">
                            <div class="spacer_box_title" v-html="$t('tabMotorTesting')"></div>
                        </div>
                        <div class="spacer_box">
                            <div class="motors">
                                <ul class="grid-box col9 titles">
                                    <li v-for="i in 8" :key="`h-${i}`">{{ i }}</li>
                                </ul>
                                <div class="bar-wrapper grid-box col9">
                                    <div v-for="i in 8" :key="`b-${i}`" class="m-block" :class="`motor-${i - 1}`">
                                        <div class="meter-bar">
                                            <div class="label">{{ displayMotorValue(i - 1) }}</div>
                                            <div
                                                class="indicator"
                                                :style="{
                                                    marginTop: `${getMotorIndicatorMargin(i - 1)}px`,
                                                    height: `${getMotorIndicatorHeight(i - 1)}px`,
                                                    backgroundColor: `rgba(255,187,0,1.${Math.floor((displayMotorValue(i - 1) - minMotorValue) * 0.009)})`,
                                                }"
                                            >
                                                <div class="label">{{ displayMotorValue(i - 1) }}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="motor_testing">
                                <ul class="grid-box col9 telemetry">
                                    <li v-for="i in 8" :key="`t-${i}`">
                                        <span :class="`motor-${i - 1} cf_tip`" :title="$t('motorsTelemetryHelp')"
                                            >&nbsp;</span
                                        >
                                    </li>
                                    <li>
                                        <span class="motor-master cf_tip" :title="$t('motorsTelemetryHelp')"
                                            >&nbsp;</span
                                        >
                                    </li>
                                </ul>
                                <div class="sliders">
                                    <ul class="grid-box col9">
                                        <input
                                            v-for="i in 8"
                                            :key="`s-${i}`"
                                            type="range"
                                            :min="minMotorValue"
                                            :max="maxMotorValue"
                                            :disabled="!motorTestingEnabled || i > numberOfValidOutputs"
                                            v-model.number="motorValues[i - 1]"
                                            @input="onMotorSliderInput"
                                        />
                                        <input
                                            class="master"
                                            type="range"
                                            :min="minMotorValue"
                                            :max="maxMotorValue"
                                            :disabled="!motorTestingEnabled"
                                            v-model.number="masterValue"
                                            @input="onMasterSliderInput"
                                        />
                                    </ul>
                                </div>
                                <div class="values">
                                    <ul class="grid-box col9">
                                        <li v-for="i in 8" :key="`v-${i}`">{{ motorValues[i - 1] }}</li>
                                        <li style="font-weight: bold" v-html="$t('motorsMaster')"></li>
                                    </ul>
                                </div>
                            </div>
                            <div class="danger">
                                <p v-html="$t('motorsNotice')"></p>
                                <input
                                    id="checkingMotorsEnable"
                                    type="checkbox"
                                    class="togglesmall"
                                    v-model="motorTestingEnabled"
                                />
                                <span class="motorsEnableTestMode" v-html="$t('motorsEnableControl')"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="tab-ports margin-top">
                <div class="gui_box grey">
                    <div class="gui_box_titlebar">
                        <div class="spacer_box_title" v-html="$t('tabPorts')"></div>
                    </div>
                    <div class="spacer_box require-support">
                        <div class="note">
                            <p v-html="$t('portsHelp')"></p>
                            <p v-html="$t('portsMSPHelp')"></p>
                        </div>

                        <div class="note vtxTableNotSet" v-if="vtxTableNotConfigured">
                            <p v-html="$t('portsVtxTableNotSet')"></p>
                        </div>

                        <table class="ports">
                            <thead>
                                <tr>
                                    <th class="sm-min" v-html="$t('portsIdentifier')"></th>
                                    <th class="config" v-html="$t('portsConfiguration')"></th>
                                    <th>
                                        <span v-html="$t('portsSerialRx')"></span>
                                        <span class="helpicon cf_tip" :title="$t('portsSerialRxHelp')"></span>
                                    </th>
                                    <th v-html="$t('portsTelemetryOut')"></th>
                                    <th v-html="$t('portsSensorIn')"></th>
                                    <th v-html="$t('portsPeripherals')"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(port, index) in ports" :key="port.identifier" class="portConfiguration">
                                    <td class="identifierCell sm-min">
                                        <p class="identifier">{{ getPortName(port.identifier) }}</p>
                                    </td>

                                    <td class="functionsCell-configuration">
                                        <span class="function">
                                            <input
                                                type="checkbox"
                                                class="togglemedium"
                                                :id="`checking-msp-${index}`"
                                                v-model="port.msp"
                                                :disabled="port.identifier === 20"
                                            />
                                            <label :for="`checking-msp-${index}`">
                                                <span class="visually-hidden">MSP</span>
                                            </label>
                                        </span>
                                        <select class="msp_baudrate" v-model="port.msp_baudrate">
                                            <option v-for="rate in mspBaudRates" :key="rate" :value="rate">
                                                {{ rate }}
                                            </option>
                                        </select>
                                    </td>

                                    <td class="functionsCell-rx">
                                        <span class="function">
                                            <input
                                                type="checkbox"
                                                class="togglemedium"
                                                :id="`checking-rx-${index}`"
                                                v-model="port.rxSerial"
                                            />
                                            <label :for="`checking-rx-${index}`">
                                                <span class="visually-hidden">{{ $t("portsSerialRx") }}</span>
                                            </label>
                                        </span>
                                    </td>

                                    <td class="functionsCell-telemetry">
                                        <select v-model="port.telemetry" @change="onTelemetryChange(port)">
                                            <option value="">{{ $t("portsTelemetryDisabled") }}</option>
                                            <option
                                                v-for="rule in getRules('telemetry')"
                                                :key="rule.name"
                                                :value="rule.name"
                                                :disabled="isRuleDisabled(rule)"
                                            >
                                                {{ rule.displayName }}
                                            </option>
                                        </select>
                                        <select class="telemetry_baudrate" v-model="port.telemetry_baudrate">
                                            <option v-for="rate in telemetryBaudRates" :key="rate" :value="rate">
                                                {{ rate }}
                                            </option>
                                        </select>
                                    </td>

                                    <td class="functionsCell-sensors">
                                        <select v-model="port.sensor">
                                            <option value="">{{ $t("portsTelemetryDisabled") }}</option>
                                            <option
                                                v-for="rule in getRules('sensors')"
                                                :key="rule.name"
                                                :value="rule.name"
                                                :disabled="isRuleDisabled(rule)"
                                            >
                                                {{ rule.displayName }}
                                            </option>
                                        </select>
                                        <select class="gps_baudrate" v-model="port.gps_baudrate">
                                            <option v-for="rate in gpsBaudRates" :key="rate" :value="rate">
                                                {{ rate }}
                                            </option>
                                        </select>
                                    </td>

                                    <td class="functionsCell-peripherals">
                                        <select v-model="port.peripheral" @change="onPeripheralChange(port)">
                                            <option value="">{{ $t("portsTelemetryDisabled") }}</option>
                                            <option
                                                v-for="rule in getRules('peripherals')"
                                                :key="rule.name"
                                                :value="rule.name"
                                                :disabled="isRuleDisabled(rule)"
                                            >
                                                {{ rule.displayName }}
                                            </option>
                                        </select>
                                        <select class="blackbox_baudrate" v-model="port.blackbox_baudrate">
                                            <option v-for="rate in blackboxBaudRates" :key="rate" :value="rate">
                                                {{ rate }}
                                            </option>
                                        </select>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="clear-both"></div>
                    </div>
                </div>
            </div>

            <div class="grid-row grid-box col2 gap-2 margin-top">
                <div class="col-span-1">
                    <div class="tab-receiver">
                        <div ref="receiverBarsContainer" class="bars"></div>
                    </div>
                </div>

                <div class="col-span-1">
                    <div class="tab-receiver">
                        <div class="gui_box grey tunings topspacer">
                            <div class="gui_box_titlebar">
                                <div class="spacer_box_title" v-html="$t('receiverModelPreview')"></div>
                            </div>
                            <div class="model_preview_cell spacer_box">
                                <div ref="modelWrapper" class="model_preview background_paper">
                                    <canvas ref="modelCanvas"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="tab-motors">
            <dialog id="dialogMotorOutputReorder">
                <div id="dialogMotorOutputReorderContentWrapper">
                    <div id="dialogMotorOutputReorderContent"></div>
                    <div>
                        <a
                            href="#"
                            id="dialogMotorOutputReorder-closebtn"
                            class="regular-button right"
                            @click.prevent="closeMotorOutputReorderDialog"
                        >
                            {{ $t("motorOutputReorderDialogClose") }}
                        </a>
                    </div>
                </div>
            </dialog>

            <dialog id="escDshotDirectionDialog">
                <div id="escDshotDirectionDialog-ContentWrapper">
                    <div id="escDshotDirectionDialog-Content"></div>
                    <a
                        href="#"
                        id="escDshotDirectionDialog-closebtn"
                        class="regular-button right"
                        @click.prevent="closeEscDshotDirectionDialog"
                    >
                        {{ $t("close") }}
                    </a>
                </div>
            </dialog>
        </div>

        <div
            v-if="hasPendingChanges || motorTestingEnabled"
            class="content_toolbar toolbar_fixed_bottom"
            style="position: fixed"
        >
            <div class="btn save_btn">
                <a class="save" href="#" @click.prevent="saveAllChanges">{{ $t("configurationButtonSave") }}</a>
            </div>
            <div class="btn">
                <a class="stop" :class="{ disabled: !motorTestingEnabled }" href="#" @click.prevent="stopMotorsTesting">
                    {{ $t("escDshotDirectionDialog-StopWizard") }}
                </a>
            </div>
        </div>
    </BaseTab>
</template>

<script>
import {
    defineComponent,
    computed,
    onMounted,
    onUnmounted,
    reactive,
    ref,
    nextTick,
    watch,
    shallowRef,
    markRaw,
} from "vue";
import BaseTab from "./BaseTab.vue";
import GUI from "../../js/gui";
import FC from "../../js/fc";
import MSP from "../../js/msp";
import MSPCodes from "../../js/msp/MSPCodes";
import { i18n } from "../../js/localization";
import { gui_log } from "../../js/gui_log";
import { have_sensor } from "../../js/sensor_helpers";
import { mspHelper } from "../../js/msp/MSPHelper";
import MotorOutputReorderConfig from "../../components/MotorOutputReordering/MotorOutputReorderingConfig";
import MotorOutputReorderComponent from "../../components/MotorOutputReordering/MotorOutputReorderingComponent";
import EscDshotDirectionComponent from "../../components/EscDshotDirection/EscDshotDirectionComponent";
import { mixerList } from "../../js/model";
import { getMixerImageSrc, degToRad } from "../../js/utils/common";
import EscProtocols from "../../js/utils/EscProtocols";
import Model from "../../js/model";
import RateCurve from "../../js/RateCurve";
import semver from "semver";
import { API_VERSION_1_45, API_VERSION_1_47 } from "../../js/data_storage";
import * as THREE from "three";
import $ from "jquery";
import { tracking } from "../../js/Analytics";

const DISARM_FLAGS = [
    "NO_GYRO",
    "FAILSAFE",
    "RX_FAILSAFE",
    "NOT_DISARMED",
    "BOXFAILSAFE",
    "RUNAWAY_TAKEOFF",
    "CRASH_DETECTED",
    "THROTTLE",
    "ANGLE",
    "BOOT_GRACE_TIME",
    "NOPREARM",
    "LOAD",
    "CALIBRATING",
    "CLI",
    "CMS_MENU",
    "BST",
    "MSP",
    "PARALYZE",
    "GPS",
    "RESC",
    "RPMFILTER",
    "REBOOT_REQUIRED",
    "DSHOT_BITBANG",
    "ACC_CALIBRATION",
    "MOTOR_PROTOCOL",
];

export default defineComponent({
    name: "CheckingTab",
    components: {
        BaseTab,
    },
    setup() {
        const calibratingAccel = ref(false);
        const receiverChannelsState = reactive({ activeChannels: 8, channels: [] });
        const receiverBarsContainer = ref(null);
        const meterFillArray = [];
        const meterLabelArray = [];
        let receiverResizeHandler = null;

        const ports = reactive([]);
        const analyticsChanges = reactive({});
        const mixerConfig = reactive({ mixer: 1, reverseMotorDir: 0 });
        const mixerPreviewSvg = ref("");

        const motorTestingEnabled = ref(false);
        const motorValues = ref(Array(8).fill(1000));
        const masterValue = ref(1000);
        const localIntervals = [];

        const modelWrapper = ref(null);
        const modelCanvas = ref(null);
        const keepRendering = ref(false);
        const modelRef = shallowRef(null);
        const rateCurveRef = shallowRef(null);
        const ratesRef = ref(null);
        let renderClock = null;
        let motorBufferTimer = null;
        let motorBuffer = [];
        const motorOutputReorderComponentRef = ref(null);
        const escDshotDirectionComponentRef = ref(null);
        const initialPortsSnapshot = ref("");
        const initialMixerSnapshot = ref("");

        const addInterval = (name, cb, ms, first = false) => {
            GUI.interval_add(name, cb, ms, first);
            localIntervals.push(name);
        };

        const batteryVoltage = computed(() => i18n.getMessage("initialSetupBatteryValue", [FC.ANALOG.voltage]));
        const batteryDrawn = computed(() => i18n.getMessage("initialSetupBatteryMahValue", [FC.ANALOG.mAhdrawn]));
        const batteryCurrent = computed(() =>
            i18n.getMessage("initialSetupBatteryAValue", [FC.ANALOG.amperage.toFixed(2)]),
        );
        const rssiPercent = computed(() =>
            i18n.getMessage("initialSetupRSSIValue", [((FC.ANALOG.rssi / 1023) * 100).toFixed(0)]),
        );

        const cpuTemp = computed(() => {
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_47) && FC.CONFIG.cpuTemp) {
                return `${FC.CONFIG.cpuTemp.toFixed(0)} C`;
            }
            return i18n.getMessage("initialSetupCpuTempNotSupported");
        });

        const mcuName = computed(() => {
            if (semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_47)) {
                return FC.MCU_INFO?.name || "-";
            }
            return "-";
        });

        const accAvailable = computed(() => have_sensor(FC.CONFIG.activeSensors, "acc"));
        const isReadyToArm = computed(() => FC.CONFIG.armingDisableFlags === 0);

        const visibleArmingFlags = computed(() => {
            const flags = [...DISARM_FLAGS];

            if (semver.gte(FC.CONFIG.apiVersion, "1.46.0")) {
                const idx = flags.indexOf("RPMFILTER");
                if (idx >= 0) {
                    flags[idx] = "DSHOT_TELEM";
                }
            }

            if (semver.gte(FC.CONFIG.apiVersion, "1.47.0")) {
                const idx = flags.indexOf("MOTOR_PROTOCOL");
                if (idx >= 0) {
                    flags.splice(idx + 1, 0, "CRASHFLIP", "ALTHOLD", "POSHOLD");
                }
            }

            const output = [];
            for (let i = 0; i < FC.CONFIG.armingDisableCount; i++) {
                const known =
                    i < flags.length - 1
                        ? flags[i]
                        : i === FC.CONFIG.armingDisableCount - 1
                            ? "ARM_SWITCH"
                            : `${i + 1}`;
                const messageKey = /^\d+$/.test(known)
                    ? "initialSetupArmingDisableFlagsTooltip"
                    : `initialSetupArmingDisableFlagsTooltip${known}`;
                const visible = (FC.CONFIG.armingDisableFlags & (1 << i)) !== 0;
                if (visible) {
                    output.push({
                        id: `flag-${i}`,
                        name: known === "RX_FAILSAFE" ? "RXLOSS" : known === "NOT_DISARMED" ? "BAD_RX_RECOVERY" : known,
                        tooltip: i18n.getMessage(messageKey),
                    });
                }
            }
            return output;
        });

        const sortedMixerListItems = computed(() =>
            [...mixerList]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((mixer) => ({ label: mixer.name.toUpperCase(), value: mixer.pos + 1 })),
        );

        const reverseMotorDir = computed({
            get: () => mixerConfig.reverseMotorDir === 1,
            set: (value) => {
                mixerConfig.reverseMotorDir = value ? 1 : 0;
            },
        });

        const numberOfValidOutputs = computed(() => {
            const mixer = mixerConfig.mixer;
            const defaultMotorCount = 4;
            if (!mixer || mixer < 1 || mixer > mixerList.length) {
                return defaultMotorCount;
            }
            const expected = mixerList[mixer - 1].motors;
            const firmwareCount = FC.MOTOR_CONFIG.motor_count || expected;
            return Math.max(1, Math.min(8, firmwareCount));
        });

        const escProtocolIsDshot = computed(() =>
            EscProtocols.IsProtocolDshot(FC.CONFIG.apiVersion, FC.PID_ADVANCED_CONFIG.fast_pwm_protocol),
        );
        const vtxTableNotConfigured = computed(
            () =>
                FC.VTX_CONFIG?.vtx_table_available &&
                (FC.VTX_CONFIG.vtx_table_bands === 0 ||
                    FC.VTX_CONFIG.vtx_table_channels === 0 ||
                    FC.VTX_CONFIG.vtx_table_powerlevels === 0),
        );
        const selectedMixerName = computed(() => mixerList[mixerConfig.mixer - 1]?.name || "");
        const motorOutputReorderConfig = new MotorOutputReorderConfig(100);
        const isMotorOutputReorderAvailable = computed(
            () =>
                Boolean(selectedMixerName.value) &&
                selectedMixerName.value in motorOutputReorderConfig &&
                Array.isArray(FC.MOTOR_OUTPUT_ORDER) &&
                FC.MOTOR_OUTPUT_ORDER.length > 0,
        );

        const serializePorts = () =>
            JSON.stringify(
                ports.map((p) => ({
                    identifier: p.identifier,
                    msp_baudrate: p.msp_baudrate,
                    telemetry_baudrate: p.telemetry_baudrate,
                    gps_baudrate: p.gps_baudrate,
                    blackbox_baudrate: p.blackbox_baudrate,
                    msp: p.msp,
                    rxSerial: p.rxSerial,
                    telemetry: p.telemetry,
                    sensor: p.sensor,
                    peripheral: p.peripheral,
                })),
            );

        const serializeMixer = () =>
            JSON.stringify({
                mixer: mixerConfig.mixer,
                reverseMotorDir: mixerConfig.reverseMotorDir,
            });

        const portsChanged = computed(
            () => initialPortsSnapshot.value !== "" && initialPortsSnapshot.value !== serializePorts(),
        );
        const mixerChanged = computed(
            () => initialMixerSnapshot.value !== "" && initialMixerSnapshot.value !== serializeMixer(),
        );
        const hasPendingChanges = computed(() => portsChanged.value || mixerChanged.value);

        const minMotorValue = computed(() => (escProtocolIsDshot.value ? 1000 : FC.MOTOR_CONFIG.mincommand || 1000));
        const maxMotorValue = computed(() => (escProtocolIsDshot.value ? 2000 : FC.MOTOR_CONFIG.maxthrottle || 2000));

        const displayMotorValue = (index) => {
            if (!motorTestingEnabled.value) {
                return minMotorValue.value;
            }
            return FC.MOTOR_DATA[index] || minMotorValue.value;
        };

        const functionRules = [
            { name: "MSP", groups: ["configuration", "msp"], maxPorts: 2 },
            { name: "GPS", groups: ["sensors"], maxPorts: 1, dependsOn: "USE_GPS" },
            {
                name: "TELEMETRY_FRSKY",
                groups: ["telemetry"],
                sharableWith: ["msp"],
                notSharableWith: ["peripherals"],
                maxPorts: 1,
                dependsOn: "USE_TELEMETRY_FRSKY_HUB",
            },
            {
                name: "TELEMETRY_HOTT",
                groups: ["telemetry"],
                sharableWith: ["msp"],
                notSharableWith: ["peripherals"],
                maxPorts: 1,
                dependsOn: "USE_TELEMETRY_HOTT",
            },
            { name: "TELEMETRY_SMARTPORT", groups: ["telemetry"], maxPorts: 1, dependsOn: "USE_TELEMETRY_SMARTPORT" },
            { name: "RX_SERIAL", groups: ["rx"], maxPorts: 1 },
            {
                name: "BLACKBOX",
                groups: ["peripherals"],
                sharableWith: ["msp"],
                notSharableWith: ["telemetry"],
                maxPorts: 1,
            },
            {
                name: "TELEMETRY_LTM",
                groups: ["telemetry"],
                sharableWith: ["msp"],
                notSharableWith: ["peripherals"],
                maxPorts: 1,
                dependsOn: "USE_TELEMETRY_LTM",
            },
            {
                name: "TELEMETRY_MAVLINK",
                groups: ["telemetry"],
                sharableWith: ["msp"],
                notSharableWith: ["peripherals"],
                maxPorts: 1,
                dependsOn: "USE_TELEMETRY_MAVLINK",
            },
            { name: "IRC_TRAMP", groups: ["peripherals"], maxPorts: 1, dependsOn: "USE_VTX" },
            { name: "ESC_SENSOR", groups: ["sensors"], maxPorts: 1 },
            { name: "TBS_SMARTAUDIO", groups: ["peripherals"], maxPorts: 1, dependsOn: "USE_VTX" },
            { name: "TELEMETRY_IBUS", groups: ["telemetry"], maxPorts: 1, dependsOn: "USE_TELEMETRY_IBUS_EXTENDED" },
            { name: "RUNCAM_DEVICE_CONTROL", groups: ["peripherals"], maxPorts: 1, dependsOn: "USE_CAMERA_CONTROL" },
            { name: "LIDAR_TF", groups: ["peripherals"], maxPorts: 1 },
            { name: "FRSKY_OSD", groups: ["peripherals"], maxPorts: 1, dependsOn: "USE_FRSKYOSD" },
        ];

        if (FC.CONFIG && semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_45)) {
            functionRules.push({ name: "VTX_MSP", groups: ["peripherals"], sharableWith: ["msp"], maxPorts: 1 });
        }

        for (const rule of functionRules) {
            rule.displayName = i18n.getMessage(`portsFunction_${rule.name}`);
        }

        const mspBaudRates = ["9600", "19200", "38400", "57600", "115200", "230400", "250000", "500000", "1000000"];
        const gpsBaudRates = ["AUTO", "9600", "19200", "38400", "57600", "115200"];
        const telemetryBaudRates = ["AUTO", "9600", "19200", "38400", "57600", "115200"];
        const blackboxBaudRates = [
            "AUTO",
            "19200",
            "38400",
            "57600",
            "115200",
            "230400",
            "250000",
            "1500000",
            "2000000",
            "2470000",
        ];

        if (FC.CONFIG && semver.gte(FC.CONFIG.apiVersion, API_VERSION_1_47)) {
            gpsBaudRates.push("230400");
            telemetryBaudRates.push("230400", "460800");
        }

        const portIdentifierToNameMapping = {
            0: "UART1",
            1: "UART2",
            2: "UART3",
            3: "UART4",
            4: "UART5",
            5: "UART6",
            6: "UART7",
            7: "UART8",
            8: "UART9",
            9: "UART10",
            20: "USB VCP",
            30: "SOFTSERIAL1",
            31: "SOFTSERIAL2",
            40: "LPUART1",
            50: "UART0",
            51: "UART1",
            52: "UART2",
            53: "UART3",
            54: "UART4",
            55: "UART5",
            56: "UART6",
            57: "UART7",
            58: "UART8",
            59: "UART9",
            60: "UART10",
            70: "PIOUART0",
            71: "PIOUART1",
            72: "PIOUART2",
            73: "PIOUART3",
            74: "PIOUART4",
            75: "PIOUART5",
            76: "PIOUART6",
            77: "PIOUART7",
            78: "PIOUART8",
            79: "PIOUART9",
        };

        const getPortName = (id) => portIdentifierToNameMapping[id] || `UART (${id})`;
        const getRules = (group) =>
            functionRules
                .filter((rule) => rule.groups.includes(group))
                .sort((a, b) => a.displayName.localeCompare(b.displayName));
        const isRuleDisabled = (rule) =>
            FC.CONFIG.buildOptions.length &&
            rule.dependsOn !== undefined &&
            !FC.CONFIG.buildOptions.includes(rule.dependsOn);

        const transformPortData = (fcPort) => ({
            identifier: fcPort.identifier,
            msp_baudrate: fcPort.msp_baudrate,
            telemetry_baudrate: fcPort.telemetry_baudrate,
            gps_baudrate: fcPort.gps_baudrate === "AUTO" ? "AUTO" : fcPort.gps_baudrate || "AUTO",
            blackbox_baudrate: fcPort.blackbox_baudrate === "AUTO" ? "AUTO" : fcPort.blackbox_baudrate || "AUTO",
            msp: fcPort.functions.includes("MSP"),
            rxSerial: fcPort.functions.includes("RX_SERIAL"),
            telemetry: fcPort.functions.find((f) => getRules("telemetry").some((r) => r.name === f)) || "",
            sensor: fcPort.functions.find((f) => getRules("sensors").some((r) => r.name === f)) || "",
            peripheral: fcPort.functions.find((f) => getRules("peripherals").some((r) => r.name === f)) || "",
        });

        const refreshPorts = () =>
            MSP.promise(MSPCodes.MSP_VTX_CONFIG).then(() =>
                mspHelper.loadSerialConfig(() => {
                    ports.length = 0;
                    FC.SERIAL_CONFIG.ports.forEach((p) => ports.push(transformPortData(p)));
                    nextTick(() => GUI.switchery());
                }),
            );

        const updateMixerPreview = async () => {
            try {
                const imgSrc = getMixerImageSrc(mixerConfig.mixer, mixerConfig.reverseMotorDir);
                const response = await fetch(imgSrc);
                const text = await response.text();
                const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
                const svg = parsed.querySelector("svg");
                mixerPreviewSvg.value = svg ? svg.outerHTML : "";
            } catch (error) {
                console.error("Unable to load mixer preview", error);
                mixerPreviewSvg.value = "";
            }
        };

        const getEnabledFeaturesFromPorts = (portsList) => {
            const flags = { rxSerial: false, telemetry: false, blackbox: false, esc: false, gps: false };
            for (const port of portsList) {
                const func = port.functions;
                if (func.includes("RX_SERIAL")) flags.rxSerial = true;
                if (func.some((e) => e.startsWith("TELEMETRY"))) flags.telemetry = true;
                if (func.includes("BLACKBOX")) flags.blackbox = true;
                if (func.includes("ESC_SENSOR")) flags.esc = true;
                if (func.includes("GPS")) flags.gps = true;
            }
            return flags;
        };

        const updateFeaturesFromPorts = () => {
            const { rxSerial, telemetry, blackbox, esc, gps } = getEnabledFeaturesFromPorts(FC.SERIAL_CONFIG.ports);
            const featureConfig = FC.FEATURE_CONFIG.features;
            rxSerial ? featureConfig.enable("RX_SERIAL") : featureConfig.disable("RX_SERIAL");
            if (telemetry) featureConfig.enable("TELEMETRY");
            blackbox ? featureConfig.enable("BLACKBOX") : featureConfig.disable("BLACKBOX");
            esc ? featureConfig.enable("ESC_SENSOR") : featureConfig.disable("ESC_SENSOR");
            gps ? featureConfig.enable("GPS") : featureConfig.disable("GPS");
        };

        const buildFcPortsConfig = () =>
            ports.map((p) => {
                const functions = [];
                if (p.msp) functions.push("MSP");
                if (p.rxSerial) functions.push("RX_SERIAL");
                if (p.telemetry) functions.push(p.telemetry);
                if (p.sensor) functions.push(p.sensor);
                if (p.peripheral) functions.push(p.peripheral);
                return {
                    identifier: p.identifier,
                    msp_baudrate: p.msp_baudrate,
                    telemetry_baudrate: p.telemetry_baudrate,
                    gps_baudrate: p.gps_baudrate === "AUTO" ? "57600" : p.gps_baudrate,
                    blackbox_baudrate: p.blackbox_baudrate === "AUTO" ? "115200" : p.blackbox_baudrate,
                    functions,
                };
            });

        const writeConfigurationAndReboot = () =>
            new Promise((resolve) => {
                mspHelper.writeConfiguration(true, resolve);
            });

        const closeMotorOutputReorderDialog = () => {
            const dialog = $("#dialogMotorOutputReorder")[0];
            if (dialog && dialog.open) {
                dialog.close();
            }
            if (motorOutputReorderComponentRef.value) {
                motorOutputReorderComponentRef.value.close();
                motorOutputReorderComponentRef.value = null;
            }
            $(document).off("keydown", onMotorOutputReorderEscKey);
        };

        const onMotorOutputReorderEscKey = (event) => {
            if (event.which === 27) {
                closeMotorOutputReorderDialog();
            }
        };

        const openMotorOutputReorderDialog = () => {
            if (!isMotorOutputReorderAvailable.value || !selectedMixerName.value) {
                return;
            }

            closeMotorOutputReorderDialog();

            const idleThrottleValue = minMotorValue.value + (FC.PID_ADVANCED_CONFIG.motorIdle * 1000) / 100;
            motorOutputReorderComponentRef.value = new MotorOutputReorderComponent(
                $("#dialogMotorOutputReorderContent"),
                () => {
                    GUI.switchery();
                },
                selectedMixerName.value,
                minMotorValue.value,
                idleThrottleValue,
            );

            $(document).on("keydown", onMotorOutputReorderEscKey);
            const dialog = $("#dialogMotorOutputReorder")[0];
            dialog?.showModal();
        };

        const closeEscDshotDirectionDialog = () => {
            const dialog = $("#escDshotDirectionDialog")[0];
            if (dialog && dialog.open) {
                dialog.close();
            }
            if (escDshotDirectionComponentRef.value) {
                escDshotDirectionComponentRef.value.close();
                escDshotDirectionComponentRef.value = null;
            }
            $(document).off("keydown", onEscDshotDirectionEscKey);
        };

        const onEscDshotDirectionEscKey = (event) => {
            if (event.which === 27) {
                closeEscDshotDirectionDialog();
            }
        };

        const openEscDshotDirectionDialog = () => {
            closeEscDshotDirectionDialog();

            const idleThrottleValue = minMotorValue.value + (FC.PID_ADVANCED_CONFIG.motorIdle * 1000) / 100;
            const motorConfig = {
                numberOfMotors: numberOfValidOutputs.value,
                motorStopValue: minMotorValue.value,
                motorSpinValue: idleThrottleValue,
                escProtocolIsDshot: escProtocolIsDshot.value,
            };

            escDshotDirectionComponentRef.value = new EscDshotDirectionComponent(
                $("#escDshotDirectionDialog-Content"),
                () => {
                    GUI.switchery();
                },
                motorConfig,
            );

            $(document).on("keydown", onEscDshotDirectionEscKey);
            const dialog = $("#escDshotDirectionDialog")[0];
            dialog?.showModal();
        };

        const saveAllChanges = async () => {
            if (!hasPendingChanges.value) {
                return;
            }

            try {
                if (portsChanged.value) {
                    tracking.sendSaveAndChangeEvents(
                        tracking.EVENT_CATEGORIES.FLIGHT_CONTROLLER,
                        { ...analyticsChanges },
                        "ports",
                    );
                    Object.keys(analyticsChanges).forEach((key) => delete analyticsChanges[key]);

                    FC.SERIAL_CONFIG.ports = buildFcPortsConfig();
                    updateFeaturesFromPorts();

                    await new Promise((resolve) => mspHelper.sendSerialConfig(resolve));
                    await new Promise((resolve) =>
                        MSP.send_message(
                            MSPCodes.MSP_SET_FEATURE_CONFIG,
                            mspHelper.crunch(MSPCodes.MSP_SET_FEATURE_CONFIG),
                            false,
                            resolve,
                        ),
                    );
                }

                if (mixerChanged.value) {
                    FC.MIXER_CONFIG.mixer = mixerConfig.mixer;
                    FC.MIXER_CONFIG.reverseMotorDir = mixerConfig.reverseMotorDir;
                    await MSP.promise(MSPCodes.MSP_SET_MIXER_CONFIG, mspHelper.crunch(MSPCodes.MSP_SET_MIXER_CONFIG));
                }

                await writeConfigurationAndReboot();
                initialPortsSnapshot.value = serializePorts();
                initialMixerSnapshot.value = serializeMixer();
            } catch (error) {
                console.error("Failed to save checking tab changes", error);
                gui_log(i18n.getMessage("configurationSaveFailed"));
            }
        };

        const onTelemetryChange = (port) => {
            if (!port.telemetry) return;
            const rule = functionRules.find((r) => r.name === port.telemetry);
            if (rule) analyticsChanges.Telemetry = rule.displayName;
            port.peripheral = "";
            delete analyticsChanges.VtxControl;
            delete analyticsChanges.MspControl;
        };

        const onPeripheralChange = (port) => {
            if (port.peripheral === "TBS_SMARTAUDIO" || port.peripheral === "IRC_TRAMP") {
                port.msp = false;
                analyticsChanges.VtxControl = port.peripheral;
            }
            if (port.peripheral && port.peripheral.includes("MSP")) {
                port.msp = true;
                analyticsChanges.MspControl = port.peripheral;
            }
            if (port.peripheral) {
                port.telemetry = "";
                delete analyticsChanges.Telemetry;
            }
        };

        const pushMotorValues = (values) => {
            const payload = [];
            for (let i = 0; i < numberOfValidOutputs.value; i++) {
                payload.push16(values[i]);
            }

            motorBuffer.push(payload);
            if (motorBufferTimer) {
                return;
            }

            motorBufferTimer = setTimeout(() => {
                const latest = motorBuffer.pop();
                if (latest) {
                    MSP.send_message(MSPCodes.MSP_SET_MOTOR, latest);
                }
                motorBuffer = [];
                motorBufferTimer = null;
            }, 10);
        };

        const onMotorSliderInput = () => {
            if (!motorTestingEnabled.value) {
                return;
            }
            pushMotorValues(motorValues.value);
        };

        const onMasterSliderInput = () => {
            if (!motorTestingEnabled.value) {
                return;
            }
            for (let i = 0; i < numberOfValidOutputs.value; i++) {
                motorValues.value[i] = masterValue.value;
            }
            pushMotorValues(motorValues.value);
        };

        const stopMotorsTesting = async () => {
            if (!motorTestingEnabled.value) {
                return;
            }

            motorTestingEnabled.value = false;
            await nextTick();

            const motorToggle = document.getElementById("checkingMotorsEnable");
            if (motorToggle) {
                motorToggle.dispatchEvent(new Event("change", { bubbles: true }));
            }
        };

        const onCalibrateAccel = () => {
            if (!accAvailable.value || calibratingAccel.value) {
                return;
            }

            calibratingAccel.value = true;
            localIntervals.forEach((name) => GUI.interval_pause(name));

            MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, () => {
                gui_log(i18n.getMessage("initialSetupAccelCalibStarted"));
            });

            GUI.timeout_add(
                "checking_accel_reset",
                () => {
                    localIntervals.forEach((name) => GUI.interval_resume(name));
                    calibratingAccel.value = false;
                    gui_log(i18n.getMessage("initialSetupAccelCalibEnded"));
                },
                2000,
            );
        };

        const buildReceiverBars = () => {
            if (!receiverBarsContainer.value) return;

            const barNames = [
                i18n.getMessage("controlAxisRoll"),
                i18n.getMessage("controlAxisPitch"),
                i18n.getMessage("controlAxisYaw"),
                i18n.getMessage("controlAxisThrottle"),
            ];
            const barContainer = $(receiverBarsContainer.value);
            barContainer.empty();
            meterFillArray.length = 0;
            meterLabelArray.length = 0;

            let auxIndex = 1;
            const numBars = FC.RC.active_channels > 0 ? FC.RC.active_channels : 8;
            for (let i = 0; i < numBars; i++) {
                const name = i < barNames.length ? barNames[i] : i18n.getMessage(`controlAxisAux${auxIndex++}`);
                barContainer.append(`
                    <ul>
                        <li class="name">${name}</li>
                        <li class="meter">
                            <div class="meter-bar">
                                <div class="label"></div>
                                <div class="fill${FC.RC.active_channels === 0 ? "disabled" : ""}">
                                    <div class="label"></div>
                                </div>
                            </div>
                        </li>
                    </ul>
                `);
            }

            $(".meter .fill", barContainer).each(function () {
                meterFillArray.push($(this));
            });
            $(".meter", barContainer).each(function () {
                meterLabelArray.push($(".label", this));
            });

            receiverResizeHandler = () => {
                const containerWidth = $(".meter:first", barContainer).width();
                const labelWidth = $(".meter .label:first", barContainer).width();
                const margin = containerWidth / 2 - labelWidth / 2;
                meterLabelArray.forEach((label) => label.css("margin-left", margin));
            };
            $(window).on("resize", receiverResizeHandler);
            receiverResizeHandler();
        };

        const pollReceiver = () => {
            MSP.send_message(MSPCodes.MSP_RC, false, false, () => {
                receiverChannelsState.activeChannels = FC.RC.active_channels || 8;
                receiverChannelsState.channels = [...(FC.RC.channels || [])];
                const meterScale = { min: 800, max: 2200 };
                for (let i = 0; i < FC.RC.active_channels; i++) {
                    const percent = (
                        ((FC.RC.channels[i] - meterScale.min) / (meterScale.max - meterScale.min)) *
                        100
                    ).clamp(0, 100);
                    meterFillArray[i]?.css("width", `${percent}%`);
                    meterLabelArray[i]?.text(FC.RC.channels[i]);
                }
            });
        };

        const pollMotors = () => {
            MSP.send_message(MSPCodes.MSP_MOTOR, false, false);
        };

        const pollStatus = () => {
            MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false);
        };

        const getMotorIndicatorHeight = (index) => {
            const value = displayMotorValue(index);
            const fullRange = maxMotorValue.value - minMotorValue.value;
            const blockHeight = 100;
            if (fullRange <= 0) return 0;
            return Math.max(0, Math.min(blockHeight, (value - minMotorValue.value) * (blockHeight / fullRange)));
        };

        const getMotorIndicatorMargin = (index) => {
            return 100 - getMotorIndicatorHeight(index);
        };

        const initReceiverModel = async () => {
            await nextTick();
            if (!modelWrapper.value || !modelCanvas.value) {
                return;
            }

            keepRendering.value = true;
            modelRef.value = markRaw(new Model($(modelWrapper.value), $(modelCanvas.value)));
            rateCurveRef.value = markRaw(new RateCurve(false));
            ratesRef.value = rateCurveRef.value.getCurrentRates();
            renderClock = new THREE.Clock();

            const render = () => {
                if (!keepRendering.value || !modelRef.value || !rateCurveRef.value || !ratesRef.value) {
                    return;
                }

                requestAnimationFrame(render);

                if (FC.RC.channels[0] && FC.RC.channels[1] && FC.RC.channels[2]) {
                    const delta = renderClock.getDelta();
                    const roll =
                        delta *
                        rateCurveRef.value.rcCommandRawToDegreesPerSecond(
                            FC.RC.channels[0],
                            ratesRef.value.roll_rate,
                            ratesRef.value.rc_rate,
                            ratesRef.value.rc_expo,
                            ratesRef.value.superexpo,
                            ratesRef.value.deadband,
                            ratesRef.value.roll_rate_limit,
                        );
                    const pitch =
                        delta *
                        rateCurveRef.value.rcCommandRawToDegreesPerSecond(
                            FC.RC.channels[1],
                            ratesRef.value.pitch_rate,
                            ratesRef.value.rc_rate_pitch,
                            ratesRef.value.rc_pitch_expo,
                            ratesRef.value.superexpo,
                            ratesRef.value.deadband,
                            ratesRef.value.pitch_rate_limit,
                        );
                    const yaw =
                        delta *
                        rateCurveRef.value.rcCommandRawToDegreesPerSecond(
                            FC.RC.channels[2],
                            ratesRef.value.yaw_rate,
                            ratesRef.value.rc_rate_yaw,
                            ratesRef.value.rc_yaw_expo,
                            ratesRef.value.superexpo,
                            ratesRef.value.yawDeadband,
                            ratesRef.value.yaw_rate_limit,
                        );

                    modelRef.value.rotateBy(-degToRad(pitch), -degToRad(yaw), -degToRad(roll));
                }
            };

            render();
        };

        watch(motorTestingEnabled, (enabled) => {
            if (enabled) {
                mspHelper.setArmingEnabled(true, true);
                motorValues.value = Array(8).fill(minMotorValue.value);
                masterValue.value = minMotorValue.value;
            } else {
                mspHelper.setArmingEnabled(false, false);
                motorValues.value = Array(8).fill(minMotorValue.value);
                masterValue.value = minMotorValue.value;
                pushMotorValues(motorValues.value);
            }
        });

        onMounted(async () => {
            GUI.active_tab = "checking";

            await MSP.promise(MSPCodes.MSP_MIXER_CONFIG);
            await MSP.promise(MSPCodes.MSP_MOTOR_CONFIG);
            await MSP.promise(MSPCodes.MSP_PID_ADVANCED);
            await MSP.promise(MSPCodes.MSP_RC);
            try {
                await MSP.promise(MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING);
            } catch {
                FC.MOTOR_OUTPUT_ORDER = [];
            }

            mixerConfig.mixer = FC.MIXER_CONFIG.mixer || 1;
            mixerConfig.reverseMotorDir = FC.MIXER_CONFIG.reverseMotorDir || 0;
            motorValues.value = Array(8).fill(minMotorValue.value);
            masterValue.value = minMotorValue.value;

            await Promise.all([updateMixerPreview(), refreshPorts()]);
            initialPortsSnapshot.value = serializePorts();
            initialMixerSnapshot.value = serializeMixer();
            buildReceiverBars();
            await initReceiverModel();

            addInterval("checking_status_pull", pollStatus, 250, true);
            addInterval("checking_receiver_pull", pollReceiver, 50, true);
            addInterval("checking_motor_pull", pollMotors, 50, true);

            await nextTick();
            GUI.switchery();
            GUI.content_ready();
        });

        onUnmounted(() => {
            keepRendering.value = false;

            if (motorBufferTimer) {
                clearTimeout(motorBufferTimer);
                motorBufferTimer = null;
            }

            localIntervals.forEach((name) => GUI.interval_remove(name));
            localIntervals.length = 0;

            if (modelRef.value) {
                modelRef.value.dispose();
                modelRef.value = null;
            }

            if (receiverResizeHandler) {
                $(window).off("resize", receiverResizeHandler);
                receiverResizeHandler = null;
            }

            if (motorTestingEnabled.value) {
                mspHelper.setArmingEnabled(false, false);
            }

            closeMotorOutputReorderDialog();
            closeEscDshotDirectionDialog();
        });

        return {
            calibratingAccel,
            accAvailable,
            isReadyToArm,
            visibleArmingFlags,
            batteryVoltage,
            batteryDrawn,
            batteryCurrent,
            rssiPercent,
            cpuTemp,
            mcuName,
            ports,
            mspBaudRates,
            gpsBaudRates,
            telemetryBaudRates,
            blackboxBaudRates,
            getRules,
            isRuleDisabled,
            onTelemetryChange,
            onPeripheralChange,
            vtxTableNotConfigured,
            getPortName,
            mixerConfig,
            reverseMotorDir,
            sortedMixerListItems,
            mixerPreviewSvg,
            updateMixerPreview,
            isMotorOutputReorderAvailable,
            openMotorOutputReorderDialog,
            closeMotorOutputReorderDialog,
            openEscDshotDirectionDialog,
            closeEscDshotDirectionDialog,
            numberOfValidOutputs,
            minMotorValue,
            maxMotorValue,
            motorTestingEnabled,
            motorValues,
            masterValue,
            displayMotorValue,
            getMotorIndicatorHeight,
            getMotorIndicatorMargin,
            onMotorSliderInput,
            onMasterSliderInput,
            stopMotorsTesting,
            onCalibrateAccel,
            hasPendingChanges,
            saveAllChanges,
            modelWrapper,
            modelCanvas,
            receiverBarsContainer,
        };
    },
});
</script>

<style scoped>
.checking-tab .gap-2 {
    column-gap: 12px;
    row-gap: 12px;
}

.margin-top {
    margin-top: 12px;
}

.disarm-flag {
    margin-right: 6px;
}

.motor_tool_buttons {
    margin-top: 10px;
}
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
}

@media only screen and (max-width: 1055px) {
    .checking-tab .grid-box.col2 {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
