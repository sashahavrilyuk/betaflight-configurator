<template>
    <BaseTab tab-name="checking">
        <div class="content_wrapper grid-box col1 gap-4">
            <div class="tab_title">{{ $t("tabChecking") }}</div>
            <div class="cf_doc_version_bt">
                <WikiButton docUrl="checking" />
            </div>

            <div class="grid-box col2 gap-4">
                <!-- BACKUPS SECTION -->
                <UiBox :title="$t('tabBackups')">
                    <div v-if="isLoadingBackups" class="flex items-center justify-center py-16">
                        <UIcon
                            name="i-lucide-loader-circle"
                            class="size-5 animate-spin text-[var(--color-primary-500)]"
                        />
                        <span class="ml-2 text-dimmed">{{ $t("dataWaitingForData") }}</span>
                    </div>

                    <template v-else>
                        <UiBox v-if="backupMessage" type="neutral">
                            <p>{{ backupMessage }}</p>
                        </UiBox>

                        <div v-if="backups.length === 0" class="text-dimmed text-sm py-4">
                            {{ $t("backupNoBackupsAvailable") }}
                        </div>

                        <template v-for="(groupBackups, craft) in groupedBackups" :key="craft">
                            <div class="mb-4">
                                <div class="text-sm font-bold text-[var(--color-primary-500)] mb-1">{{ craft }}</div>
                                <UTable :data="groupBackups" :columns="columns" class="text-sm">
                                    <template #created-cell="{ row }">
                                        {{ formatDate(row.original.created) }}
                                    </template>
                                    <template #description-cell="{ row }">
                                        <span class="text-dimmed">{{ row.original.description || "" }}</span>
                                    </template>
                                    <template #actions-cell="{ row }">
                                        <div class="flex flex-wrap gap-2">
                                            <UButton
                                                size="xs"
                                                variant="soft"
                                                icon="i-lucide-download"
                                                @click="downloadBackup(row.original)"
                                            >
                                                {{ $t("actionDownload") }}
                                            </UButton>
                                            <UButton
                                                v-if="isConnected"
                                                size="xs"
                                                variant="soft"
                                                color="success"
                                                icon="i-lucide-upload"
                                                :disabled="isRestoreBusy"
                                                @click="restoreBackup(row.original)"
                                            >
                                                {{ $t("actionRestore") }}
                                            </UButton>
                                            <UButton
                                                size="xs"
                                                variant="soft"
                                                icon="i-lucide-pencil"
                                                @click="startEdit(row.original)"
                                            >
                                                {{ $t("actionEdit") }}
                                            </UButton>
                                            <UButton
                                                size="xs"
                                                variant="soft"
                                                color="error"
                                                icon="i-lucide-trash-2"
                                                @click="deleteBackup(row.original.id)"
                                            >
                                                {{ $t("actionDelete") }}
                                            </UButton>
                                        </div>
                                    </template>
                                </UTable>
                            </div>
                        </template>
                    </template>
                </UiBox>

                <!-- INFO SECTION -->
                <UiBox :title="$t('initialSetupInfoHead')" :help="$t('initialSetupInfoHeadHelp')">
                    <InfoGrid
                        :items="[
                            {
                                id: 'arming-disable-flag',
                                i18n: 'initialSetupArmingDisableFlags',
                                slotName: 'arming-disable-flag',
                            },
                            {
                                i18n: 'initialSetupBattery',
                                value: state.batVoltage,
                                class: 'bat-voltage',
                            },
                            {
                                i18n: 'initialSetupDrawn',
                                value: state.batMahDrawn,
                                class: 'bat-mah-drawn',
                            },
                            {
                                i18n: 'initialSetupDrawing',
                                value: state.batMahDrawing,
                                class: 'bat-mah-drawing',
                            },
                            { i18n: 'initialSetupRSSI', value: state.rssi, class: 'rssi' },
                            {
                                id: 'mcu',
                                i18n: 'initialSetupMCU',
                                value: state.mcu,
                                class: 'mcu',
                            },
                            {
                                id: 'cpu-temp',
                                i18n: 'initialSetupCpuTemp',
                                value: state.cpuTemp,
                                class: 'cpu-temp',
                            },
                        ]"
                        gridClass="system_info"
                    >
                        <template #arming-disable-flag>
                            <template v-for="flag in fcStore.armingFlags" :key="flag.id">
                                <UTooltip v-if="flag.visible" :text="flag.tooltip">
                                    <span class="disarm-flag">{{ flag.name }}</span>
                                </UTooltip>
                            </template>
                            <span v-show="fcStore.isReadyToArm" id="initialSetupArmingAllowed">{{
                                $t("initialSetupArmingAllowed")
                            }}</span>
                        </template>
                    </InfoGrid>
                </UiBox>
            </div>

            <!-- ACCEL CALIBRATION -->
            <UiBox :title="$t('initialSetupButtonCalibrateAccel')">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <UButton
                        :label="
                            state.calibratingAccel
                                ? $t('initialSetupButtonCalibratingText')
                                : $t('initialSetupButtonCalibrateAccel')
                        "
                        :disabled="state.disabledAccel"
                        :loading="state.calibratingAccel"
                        class="w-full sm:w-auto justify-center"
                        @click="onCalibrateAccel"
                    >
                        <template #trailing>
                            <HelpIcon :text="$t('initialSetupCalibrateAccelText')" />
                        </template>
                    </UButton>
                    <p class="text-sm text-dimmed max-w-2xl" v-html="$t('initialSetupCalibrateAccelText')"></p>
                </div>
            </UiBox>

            <!-- MIXER + MOTOR TESTS ROW -->
            <div class="grid-row grid-box col2 max-[1055px]:!grid-cols-1 gap-4">
                <div class="col-span-1">
                    <UiBox :title="$t('configurationMixer')">
                        <USelect v-model="fcStore.mixerConfig.mixer" :items="sortedMixerListItems" />
                        <SettingRow
                            :label="$t('configurationReverseMotorSwitch')"
                            :help="$t('configurationReverseMotorSwitchHelp')"
                            full-width
                        >
                            <USwitch v-model="reverseMotorDir" size="sm" />
                        </SettingRow>
                        <div
                            class="flex justify-center p-2.5 [&_svg]:w-[150px] [&_svg]:h-[150px] [&_svg]:ml-[15px]"
                            v-html="mixerPreviewSvg"
                        ></div>
                        <div class="flex gap-2">
                            <UButton
                                v-if="isMotorReorderingAvailable"
                                :label="$t('motorOutputReorderDialogOpen')"
                                :disabled="buttonStates.toolsDisabled"
                                @click="openMotorOutputReorderDialog()"
                            />
                            <UButton
                                v-if="isMotorDirectionAvailable"
                                :label="$t('escDshotDirectionDialog-Open')"
                                :disabled="buttonStates.toolsDisabled"
                                @click="openEscDshotDirectionDialog()"
                            />
                        </div>
                    </UiBox>
                </div>

                <div class="col-span-1">
                    <UiBox :title="$t('tabMotorTesting')">
                        <div class="motors">
                            <ul :class="`grid-box col${numberOfValidOutputs + 1} h-5`">
                                <li
                                    v-for="i in numberOfValidOutputs"
                                    :key="i"
                                    class="text-center"
                                    :title="$t('motorNumber' + i)"
                                >
                                    {{ i }}
                                </li>
                                <li></li>
                            </ul>
                            <ul :class="`grid-box col${numberOfValidOutputs + 1}`">
                                <li
                                    v-for="i in numberOfValidOutputs"
                                    :key="i"
                                    class="relative h-[100px]"
                                    :style="{ '--bar-opacity': (getMotorBarHeight(i - 1) * 0.009 + 0.1).toFixed(2) }"
                                >
                                    <div
                                        class="absolute inset-x-0 bottom-[45px] z-10 text-center text-[10px] font-bold"
                                    >
                                        {{ getMotorValue(i - 1) }}
                                    </div>
                                    <UProgress
                                        orientation="vertical"
                                        inverted
                                        :model-value="getMotorBarHeight(i - 1)"
                                        :max="100"
                                        color="warning"
                                        size="2xl"
                                        :ui="{
                                            root: '!w-full',
                                            base: '!w-full !rounded-md border border-(--ui-border)',
                                            indicator: '!rounded-none !transition-none opacity-(--bar-opacity)',
                                        }"
                                        class="h-full"
                                    />
                                </li>
                                <li></li>
                            </ul>
                        </div>

                        <div class="m-0 p-0 border-0 list-none outline-none">
                            <ul :class="`grid-box col${numberOfValidOutputs + 1} mb-2`">
                                <li
                                    v-for="i in numberOfValidOutputs"
                                    :key="i"
                                    class="text-center text-[10px] whitespace-nowrap overflow-hidden"
                                >
                                    <span
                                        :class="`motor-${i - 1}`"
                                        :title="$t('motorsTelemetryHelp')"
                                        v-html="getTelemetryHtml(i - 1)"
                                    ></span>
                                </li>
                                <li class="text-center text-[10px] whitespace-nowrap overflow-hidden">
                                    <span class="motor-master" :title="$t('motorsTelemetryHelp')">&nbsp;</span>
                                </li>
                            </ul>

                            <div class="mb-2">
                                <ul :class="`grid-box col${numberOfValidOutputs + 1}`">
                                    <li
                                        v-for="i in numberOfValidOutputs"
                                        :key="i"
                                        class="flex items-end justify-center"
                                        @wheel.prevent="onSliderWheel(i - 1, $event)"
                                    >
                                        <USlider
                                            orientation="vertical"
                                            :min="minSliderValue"
                                            :max="maxSliderValue"
                                            :model-value="motorValues[i - 1]"
                                            :disabled="slidersDisabled"
                                            tooltip
                                            class="h-24"
                                            @update:model-value="onMotorValueUpdate(i - 1, $event)"
                                        />
                                    </li>
                                    <li
                                        class="flex items-end justify-center"
                                        @wheel.prevent="onSliderWheel(-1, $event)"
                                    >
                                        <USlider
                                            orientation="vertical"
                                            :min="minSliderValue"
                                            :max="maxSliderValue"
                                            :model-value="masterValue"
                                            :disabled="slidersDisabled"
                                            color="warning"
                                            tooltip
                                            class="h-24"
                                            @update:model-value="onMasterValueUpdate($event)"
                                        />
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <ul :class="`grid-box col${numberOfValidOutputs + 1}`">
                                    <li v-for="i in numberOfValidOutputs" :key="i" class="text-center text-[10px]">
                                        {{ motorValues[i - 1] }}
                                    </li>
                                    <li class="text-center text-[10px] font-bold" v-html="$t('motorsMaster')"></li>
                                </ul>
                            </div>
                        </div>

                        <div class="p-3 border border-red-500/30 rounded-md bg-red-500/5">
                            <SettingRow :label="$t('motorsEnableControl')" full-width>
                                <USwitch v-model="motorsTestingEnabled" size="xl" />
                            </SettingRow>
                        </div>
                    </UiBox>
                </div>
            </div>

            <div class="grid-row grid-box col1 gap-4">
                <div class="col-span-1">
                    <UiBox :title="$t('tabPorts')">
                        <div class="require-support">
                            <div v-if="!tabReady || isLoadingPorts" class="flex items-center justify-center py-16">
                                <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
                                <span class="ml-2 text-dimmed">{{ $t("dataWaitingForData") }}</span>
                            </div>

                            <div v-else-if="isDesktop" class="mt-4">
                                <div class="grid grid-cols-[auto_auto_auto_auto_auto_auto] justify-between text-xs">
                                    <div class="p-2 font-semibold" v-html="$t('portsIdentifier')"></div>
                                    <div class="p-2 font-semibold" v-html="$t('portsConfiguration')"></div>
                                    <div class="p-2 font-semibold flex items-center gap-1">
                                        <span v-html="$t('portsSerialRx')"></span>
                                        <HelpIcon :text="$t('portsSerialRxHelp')" />
                                    </div>
                                    <div class="p-2 font-semibold" v-html="$t('portsTelemetryOut')"></div>
                                    <div class="p-2 font-semibold" v-html="$t('portsSensorIn')"></div>
                                    <div class="p-2 font-semibold" v-html="$t('portsPeripherals')"></div>

                                    <template v-for="(port, index) in ports" :key="port.identifier">
                                        <div class="flex items-center pl-3 font-semibold p-1.5">
                                            {{ getPortName(port.identifier) }}
                                        </div>
                                        <div class="flex items-center gap-2 p-1.5">
                                            <USwitch v-model="port.msp" :disabled="port.identifier === 20" />
                                            <USelect v-model="port.msp_baudrate" :items="mspBaudItems" size="xs" />
                                        </div>
                                        <div class="flex items-center justify-center p-1.5">
                                            <USwitch
                                                v-model="port.rxSerial"
                                                :disabled="isSerialRxDisabled(port)"
                                                size="xs"
                                            />
                                        </div>
                                        <div class="flex items-center gap-2 p-1.5">
                                            <USelect
                                                :model-value="portFieldGet(port, 'telemetry')"
                                                :items="telemetryItems"
                                                size="xs"
                                                class="min-w-22"
                                                @update:model-value="
                                                    portFieldSet(port, 'telemetry', $event);
                                                    onTelemetryChange(port);
                                                "
                                            />
                                            <USelect
                                                v-model="port.telemetry_baudrate"
                                                :items="telemetryBaudItems"
                                                size="xs"
                                            />
                                        </div>
                                        <div class="flex items-center gap-2 p-1.5">
                                            <USelect
                                                :model-value="portFieldGet(port, 'sensor')"
                                                :items="sensorItems"
                                                size="xs"
                                                class="min-w-22"
                                                @update:model-value="portFieldSet(port, 'sensor', $event)"
                                            />
                                            <USelect v-model="port.gps_baudrate" :items="gpsBaudItems" size="xs" />
                                        </div>
                                        <div class="flex items-center gap-2 p-1.5">
                                            <USelect
                                                :model-value="portFieldGet(port, 'peripheral')"
                                                :items="peripheralItems"
                                                size="xs"
                                                class="min-w-48"
                                                @update:model-value="
                                                    portFieldSet(port, 'peripheral', $event);
                                                    onPeripheralChange(port);
                                                "
                                            />
                                            <USelect
                                                v-model="port.blackbox_baudrate"
                                                :items="blackboxBaudItems"
                                                size="xs"
                                            />
                                        </div>
                                    </template>
                                </div>
                            </div>

                            <div v-else class="flex flex-col gap-3">
                                <UiBox
                                    v-for="port in ports"
                                    :key="port.identifier"
                                    :title="getPortName(port.identifier)"
                                >
                                    <div class="flex items-center gap-2">
                                        <USwitch v-model="port.msp" :disabled="port.identifier === 20" size="sm" />
                                        <span class="text-xs flex-1">MSP</span>
                                        <USelect v-model="port.msp_baudrate" :items="mspBaudItems" size="xs" />
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <USwitch
                                            v-model="port.rxSerial"
                                            :disabled="isSerialRxDisabled(port)"
                                            size="sm"
                                        />
                                        <span class="text-xs flex-1" v-html="$t('portsSerialRx')"></span>
                                        <HelpIcon :text="$t('portsSerialRxHelp')" />
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-xs text-dimmed" v-html="$t('portsTelemetryOut')"></span>
                                        <div class="flex items-center gap-2">
                                            <USelect
                                                :model-value="portFieldGet(port, 'telemetry')"
                                                :items="telemetryItems"
                                                size="xs"
                                                @update:model-value="
                                                    portFieldSet(port, 'telemetry', $event);
                                                    onTelemetryChange(port);
                                                "
                                            />
                                            <USelect
                                                v-model="port.telemetry_baudrate"
                                                :items="telemetryBaudItems"
                                                size="xs"
                                            />
                                        </div>
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-xs text-dimmed" v-html="$t('portsSensorIn')"></span>
                                        <div class="flex items-center gap-2">
                                            <USelect
                                                :model-value="portFieldGet(port, 'sensor')"
                                                :items="sensorItems"
                                                size="xs"
                                                @update:model-value="portFieldSet(port, 'sensor', $event)"
                                            />
                                            <USelect v-model="port.gps_baudrate" :items="gpsBaudItems" size="xs" />
                                        </div>
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-xs text-dimmed" v-html="$t('portsPeripherals')"></span>
                                        <div class="flex items-center gap-2">
                                            <USelect
                                                :model-value="portFieldGet(port, 'peripheral')"
                                                :items="peripheralItems"
                                                size="xs"
                                                class="min-w-44"
                                                @update:model-value="
                                                    portFieldSet(port, 'peripheral', $event);
                                                    onPeripheralChange(port);
                                                "
                                            />
                                            <USelect
                                                v-model="port.blackbox_baudrate"
                                                :items="blackboxBaudItems"
                                                size="xs"
                                            />
                                        </div>
                                    </div>
                                </UiBox>
                            </div>
                        </div>
                    </UiBox>
                </div>
            </div>

            <div class="grid-row grid-box col1 gap-4">
                <div class="col-span-1">
                    <UiBox :title="$t('receiverModelPreview')" :padding="false" class="bg-muted">
                        <div class="background_paper h-48 w-full" ref="modelPreviewContainer">
                            <canvas ref="modelCanvas"></canvas>
                        </div>
                    </UiBox>
                    <div class="bars">
                        <ul v-for="(channel, index) in receiverChannelBars" :key="index">
                            <li class="name">{{ channel.name }}</li>
                            <div class="w-full relative">
                                <UProgress
                                    :model-value="receiverActiveChannels === 0 ? 0 : channel.width"
                                    :max="100"
                                    :ui="{
                                        base: 'w-full bg-elevated',
                                        indicator: 'duration-50',
                                    }"
                                    :disabled="receiverActiveChannels === 0"
                                    size="xl"
                                />
                                <div
                                    v-if="receiverActiveChannels > 0"
                                    class="text-center text-xs font-bold absolute inset-0"
                                >
                                    {{ channel.value }}
                                </div>
                            </div>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit Dialog -->
        <Dialog v-model="isEditing" :title="$t('titleEditBackup')">
            <div class="flex flex-col gap-3">
                <div>
                    <label class="text-sm font-semibold block mb-1">{{ $t("labelName") }}</label>
                    <UInput v-model="editForm.name" size="sm" class="w-full" />
                </div>
                <div>
                    <label class="text-sm font-semibold block mb-1">{{ $t("labelDescription") }}</label>
                    <UTextarea v-model="editForm.description" size="sm" class="w-full" :rows="4" />
                </div>
                <div class="text-sm">
                    <span class="font-semibold">{{ $t("labelCreated") }}</span>
                    {{ formatDate(editForm.created) }}
                </div>
            </div>
            <template #footer>
                <UButton @click="saveBackupChanges" size="sm">{{ $t("actionSave") }}</UButton>
            </template>
        </Dialog>

        <dialog ref="restoreProgressDialogRef" class="w-[320px] h-fit p-6" @cancel.prevent>
            <div class="text-lg mb-2" v-html="$t('userBackupRestoreInProgress')"></div>
            <div class="text-sm text-dimmed" v-html="$t('presetsPleaseWait')"></div>
            <UProgress :model-value="restoreProgress" :max="100" class="mt-3" />
        </dialog>

        <dialog
            ref="restoreErrorsDialogRef"
            class="w-[600px] max-w-[calc(100vw-2rem)] h-fit p-6"
            @close="handleRestoreErrorsClose"
            @cancel.prevent
        >
            <div class="text-lg mb-2" v-html="$t('userBackupRestoreErrors')"></div>
            <div class="backups_cli_background">
                <div class="backups_cli_window">
                    <template v-for="(failure, idx) in restoreErrors" :key="idx">
                        <div>{{ failure.command }}</div>
                        <div
                            v-for="(line, lineIdx) in failure.response"
                            :key="lineIdx"
                            :class="{ error_message: line.startsWith('###ERROR') }"
                        >
                            {{ line }}
                        </div>
                    </template>
                </div>
            </div>
            <div class="flex gap-2 justify-end mt-3">
                <UButton :label="$t('presetsButtonCancel')" variant="outline" @click="closeRestoreErrors(false)" />
                <UButton :label="$t('presetsSaveAnyway')" @click="closeRestoreErrors(true)" />
            </div>
        </dialog>

        <!-- Fixed Bottom Toolbar -->
        <div class="content_toolbar toolbar_fixed_bottom flex items-center gap-2">
            <UButton
                :label="$t('actionBackup')"
                :disabled="!isLoggedIn || isCreatingBackup"
                size="sm"
                icon="i-lucide-save"
                @click="createBackup"
            />
            <UButton :label="$t('configurationButtonSave')" :disabled="!dirty" @click="saveConfig" />
            <UButton
                :label="$t('escDshotDirectionDialog-StopWizard')"
                :disabled="!motorsTestingEnabled"
                color="error"
                @click="stopMotors"
            />
        </div>
    </BaseTab>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch, watchEffect, reactive } from "vue";
import { useMediaQuery } from "@vueuse/core";
import BaseTab from "./BaseTab.vue";
import { useTranslation } from "i18next-vue";
import UiBox from "../elements/UiBox.vue";
import SettingRow from "../elements/SettingRow.vue";
import Dialog from "../elements/Dialog.vue";
import WikiButton from "../elements/WikiButton.vue";
import HelpIcon from "../elements/HelpIcon.vue";
import InfoGrid from "@/components/InfoGrid.vue";
import loginManager from "@/js/LoginManager";
import { gui_log } from "@/js/gui_log";
import { useConnectionStore } from "@/stores/connection";
import { usePortsRules } from "@/composables/ports/usePortsRules";
import { usePortsState } from "@/composables/ports/usePortsState";
import { usePortsConfiguration } from "@/composables/ports/usePortsConfiguration";
import { useFlightControllerStore } from "@/stores/fc";
import { useMotorTesting } from "@/composables/motors/useMotorTesting";
import { useMotorsState } from "@/composables/motors/useMotorsState";
import { useMotorConfiguration } from "@/composables/motors/useMotorConfiguration";
import { useMotorDataPolling } from "@/composables/motors/useMotorDataPolling";
import { mixerList } from "@/js/model";
import { getMixerImageSrc } from "@/js/utils/common";
import { useDialog } from "@/composables/useDialog";
import { useMspCliSession } from "@/composables/useMspCliSession";
import {
    cancelScheduledReconnect,
    isMspCliSupported,
    saveAndReconnect,
    scheduleReconnect,
} from "@/composables/useMspCliSession";
import FC from "@/js/fc";
import GUI from "@/js/gui";
import MSP from "@/js/msp";
import MSPCodes from "@/js/msp/MSPCodes";
import { i18n } from "@/js/localization";
import { useTimeout } from "@/composables/useTimeout";
import { useInterval } from "@/composables/useInterval";
import * as THREE from "three";
import Model from "@/js/model";
import RateCurve from "@/js/RateCurve";
import EscProtocols from "@/js/utils/EscProtocols";
import { degToRad } from "@/js/utils/common";
import { addArrayElementsAfter, replaceArrayElement } from "../../js/utils/array";
import { have_sensor } from "@/js/sensor_helpers";
import semver from "semver";
import { API_VERSION_1_46, API_VERSION_1_47 } from "@/js/data_storage";

const { t } = useTranslation();

const connectionStore = useConnectionStore();
const cliSession = useMspCliSession();
const dialog = useDialog();
const fcStore = useFlightControllerStore();

const isDesktop = useMediaQuery("(min-width: 1010px)");

const modelPreviewContainer = ref(null);
const modelCanvas = ref(null);
const rc = computed(() => fcStore.rc);
const isFeatureEnabled = (featureName) => fcStore.features.features.isEnabled(featureName);
let model = null;
let rateCurve = null;
let currentRates = null;
let clock = null;
let keepRendering = true;
let animationFrameId = null;

const { functionRules, mspBaudRates, gpsBaudRates, telemetryBaudRates, blackboxBaudRates, getRules, isRuleDisabled } =
    usePortsRules();

const availableEscProtocols = computed(() => EscProtocols.GetAvailableProtocols(fcStore.config.apiVersion));
const currentFastPwmProtocol = ref(fcStore.pidAdvancedConfig.fast_pwm_protocol);
watch(
    () => fcStore.pidAdvancedConfig.fast_pwm_protocol,
    (val) => {
        currentFastPwmProtocol.value = val;
    },
    { immediate: true },
);
const protocolName = computed(() => {
    const protocol = availableEscProtocols.value[currentFastPwmProtocol.value];
    return protocol || "DISABLED";
});
const protocolConfigured = computed(() => protocolName.value !== "DISABLED");
const digitalProtocolConfigured = computed(() => {
    if (!protocolConfigured.value) {
        return false;
    }
    const name = protocolName.value;
    return ["DSHOT150", "DSHOT300", "DSHOT600", "PROSHOT1000"].includes(name);
});
const minSliderValue = computed(() => {
    if (digitalProtocolConfigured.value) {
        return 1000;
    }
    return fcStore.motorConfig.mincommand;
});
const zeroThrottleValue = computed(() => {
    if (isFeatureEnabled("3D")) {
        let neutral = fcStore.motor3dConfig.neutral;
        return neutral > 1575 || neutral < 1425 ? 1500 : neutral;
    }
    return minSliderValue.value;
});

const { ports, analyticsChanges, getPortName, dirty, isLoading: isLoadingPorts, loadConfig } = usePortsState(getRules);
const { saveConfig, onTelemetryChange, onPeripheralChange } = usePortsConfiguration(
    ports,
    analyticsChanges,
    functionRules,
);

const meterScale = { min: 800, max: 2200 };
const receiverActiveChannels = computed(() => fcStore.rc?.active_channels ?? 0);
const receiverChannelBars = computed(() => {
    const bars = [];
    const barNames = [
        i18n.getMessage("controlAxisRoll"),
        i18n.getMessage("controlAxisPitch"),
        i18n.getMessage("controlAxisYaw"),
        i18n.getMessage("controlAxisThrottle"),
    ];
    const channels = fcStore.rc?.channels || [];
    const activeChannels = receiverActiveChannels.value || 8;
    const numBars = activeChannels > 0 ? activeChannels : 8;
    let auxIndex = 1;

    for (let i = 0; i < numBars; i += 1) {
        const name = i < barNames.length ? barNames[i] : i18n.getMessage(`controlAxisAux${auxIndex++}`);
        const value = channels[i] || 1500;
        const width = Math.max(0, Math.min(100, ((value - meterScale.min) / (meterScale.max - meterScale.min)) * 100));
        bars.push({ name, value, width });
    }
    return bars;
});

function initModelPreview() {
    if (!modelPreviewContainer.value || !modelCanvas.value) return;
    model = new Model(modelPreviewContainer.value, modelCanvas.value);
    rateCurve = new RateCurve(false);
    currentRates = rateCurve.getCurrentRates();
    window.addEventListener("resize", handleModelResize);
}

function handleModelResize() {
    if (model?.resize) {
        model.resize();
    }
}

function renderModel() {
    if (!keepRendering) return;
    animationFrameId = requestAnimationFrame(renderModel);

    if (!clock) {
        clock = new THREE.Clock();
    }

    const channels = rc.value?.channels;
    if (channels?.[0] && channels?.[1] && channels?.[2] && model && rateCurve && currentRates) {
        const delta = clock.getDelta();

        const roll =
            delta *
            rateCurve.rcCommandRawToDegreesPerSecond(
                channels[0],
                currentRates.roll_rate,
                currentRates.rc_rate,
                currentRates.rc_expo,
                currentRates.superexpo,
                currentRates.deadband,
                currentRates.roll_rate_limit,
            );
        const pitch =
            delta *
            rateCurve.rcCommandRawToDegreesPerSecond(
                channels[1],
                currentRates.pitch_rate,
                currentRates.rc_rate_pitch,
                currentRates.rc_pitch_expo,
                currentRates.superexpo,
                currentRates.deadband,
                currentRates.pitch_rate_limit,
            );
        const yaw =
            delta *
            rateCurve.rcCommandRawToDegreesPerSecond(
                channels[2],
                currentRates.yaw_rate,
                currentRates.rc_rate_yaw,
                currentRates.rc_yaw_expo,
                currentRates.superexpo,
                currentRates.yawDeadband,
                currentRates.yaw_rate_limit,
            );

        model.rotateBy(-degToRad(pitch), -degToRad(yaw), -degToRad(roll));
    }
}

const { addInterval } = useInterval();
const { addTimeout } = useTimeout();

const isLoadingBackups = ref(true);
const backups = ref([]);
const backupMessage = ref(null);
const isLoggedIn = ref(false);
const isCreatingBackup = ref(false);
const isEditing = ref(false);
const editForm = ref({ id: null, name: "", description: "", created: null });
const restoreProgress = ref(0);
const restoreProgressOpen = ref(false);
const restoreErrors = ref([]);
const restoreErrorsOpen = ref(false);
const restoreSavePressed = ref(false);
const restoreProgressDialogRef = ref(null);
const restoreErrorsDialogRef = ref(null);
let userApi = null;
let unsubscribeLogin = null;
let unsubscribeLogout = null;

const state = ref({
    batVoltage: "0 V",
    batMahDrawn: "0 mAh",
    batMahDrawing: "0 A",
    rssi: "0 %",
    cpuTemp: "0 °C",
    mcu: "",
    calibratingAccel: false,
    disabledAccel: false,
});

watchEffect(() => {
    const voltage = fcStore.analogData?.voltage ?? 0;
    const mAhdrawn = fcStore.analogData?.mAhdrawn ?? 0;
    const amperage = fcStore.analogData?.amperage ?? 0;
    const rssiValue = fcStore.analogData?.rssi ?? 0;

    state.value.batVoltage = i18n.getMessage("initialSetupBatteryValue", { 1: voltage });
    state.value.batMahDrawn = i18n.getMessage("initialSetupBatteryMahValue", { 1: mAhdrawn });
    state.value.batMahDrawing = i18n.getMessage("initialSetupBatteryAValue", { 1: amperage.toFixed(2) });
    state.value.rssi = i18n.getMessage("initialSetupRSSIValue", {
        1: ((rssiValue / 1023) * 100).toFixed(0),
    });

    state.value.cpuTemp = fcStore.config?.cpuTemp
        ? `${fcStore.config.cpuTemp.toFixed(0)} °C`
        : i18n.getMessage("initialSetupCpuTempNotSupported");
    state.value.mcu = fcStore.mcuInfo?.name || "";
});

const dialogSettingsChanged = ref(null);

const motorsState = useMotorsState();
const { configHasChanged } = motorsState;
const { motorsTestingEnabled, motorValues, masterValue, slidersDisabled, sendMotorCommand } = useMotorTesting(
    configHasChanged,
    showWarningDialog,
    digitalProtocolConfigured,
    zeroThrottleValue,
);

const { setupConfigWatchers } = useMotorConfiguration(motorsState, motorsTestingEnabled, () => {
    motorsTestingEnabled.value = false;
});

useMotorDataPolling(motorsTestingEnabled);

watch(
    zeroThrottleValue,
    (value) => {
        if (!motorsTestingEnabled.value) {
            motorValues.value = new Array(8).fill(value);
            masterValue.value = value;
        }
    },
    { immediate: true },
);

const buttonStates = computed(() => ({
    toolsDisabled: configHasChanged.value || motorsTestingEnabled.value,
    saveDisabled: !configHasChanged.value,
    stopDisabled: !motorsTestingEnabled.value,
}));

const isMotorReorderingAvailable = computed(() => {
    const mixer = fcStore.mixerConfig.mixer;
    if (!mixer || mixer < 1 || mixer > mixerList.length) {
        return false;
    }

    const mixerName = mixerList[mixer - 1]?.name;
    if (!mixerName) {
        return false;
    }

    const supportedMixers = [
        "Quad X",
        "Quad X 1234",
        "Quad +",
        "Tricopter",
        "Hex +",
        "Hex X",
        "Octo Flat +",
        "Octo Flat X",
        "Octo X8",
        "Bicopter",
        "V-tail Quad",
        "A-tail Quad",
        "Y4",
        "Y6",
    ];

    return supportedMixers.includes(mixerName) && fcStore.motorOutputOrder?.length > 0;
});

const isMotorDirectionAvailable = computed(() => digitalProtocolConfigured.value);

const openMotorOutputReorderDialog = () => {
    const mixer = fcStore.mixerConfig.mixer;
    if (!mixer || mixer < 1 || mixer > mixerList.length) {
        console.error("Invalid mixer configuration");
        return;
    }

    const mixerName = mixerList[mixer - 1]?.name;
    if (!mixerName) {
        console.error("Mixer name not found");
        return;
    }

    dialog.open(
        "MotorOutputReorderingDialog",
        {
            droneConfiguration: mixerName,
            motorStopValue: minSliderValue.value,
            motorSpinValue: zeroThrottleValue.value,
        },
        {
            close: () => {
                dialog.close();
            },
        },
    );
};

const openEscDshotDirectionDialog = () => {
    const mixer = fcStore.mixerConfig.mixer;
    const numberOfMotors = mixer > 0 && mixer <= mixerList.length ? mixerList[mixer - 1].motors : 0;

    const motorConfig = {
        escProtocolIsDshot: digitalProtocolConfigured.value,
        numberOfMotors: numberOfMotors,
        motorStopValue: minSliderValue.value,
        motorSpinValue: zeroThrottleValue.value,
    };

    dialog.open(
        "EscDshotDirectionDialog",
        { motorConfig },
        {
            close: () => {
                dialog.close();
            },
        },
    );
};

const columns = computed(() => [
    { accessorKey: "created", header: i18n.getMessage("labelDate") },
    { accessorKey: "name", header: i18n.getMessage("labelName") },
    { accessorKey: "description", header: i18n.getMessage("labelDescription") },
    { id: "actions", header: i18n.getMessage("labelActions") },
]);

const groupedBackups = computed(() => {
    const grouped = {};
    for (const backup of backups.value) {
        const key = backup.key || "Unknown";
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(backup);
    }
    return grouped;
});

const isConnected = computed(() => connectionStore.connectionValid);

watch(
    () => connectionStore.connectionValid,
    (isValid) => {
        if (isValid) {
            loadConfig();
        }
    },
);

const isRestoreBusy = computed(
    () => restoreProgressOpen.value || restoreErrorsOpen.value || cliSession.isBatchRunning.value,
);

const mspBaudItems = mspBaudRates.map((r) => ({ value: r, label: r }));
const gpsBaudItems = gpsBaudRates.map((r) => ({ value: r, label: r }));
const telemetryBaudItems = telemetryBaudRates.map((r) => ({ value: r, label: r }));
const blackboxBaudItems = blackboxBaudRates.map((r) => ({ value: r, label: r }));

const NONE = "_NONE_";
const disabledLabel = computed(() => i18n.getMessage("portsTelemetryDisabled"));

const telemetryItems = computed(() => [
    { value: NONE, label: disabledLabel.value },
    ...getRules("telemetry").map((r) => ({ value: r.name, label: r.displayName, disabled: isRuleDisabled(r) })),
]);

const sensorItems = computed(() => [
    { value: NONE, label: disabledLabel.value },
    ...getRules("sensors").map((r) => ({ value: r.name, label: r.displayName, disabled: isRuleDisabled(r) })),
]);

const peripheralItems = computed(() => [
    { value: NONE, label: disabledLabel.value },
    ...getRules("peripherals").map((r) => ({ value: r.name, label: r.displayName, disabled: isRuleDisabled(r) })),
]);

const tabReady = ref(false);

onMounted(async () => {
    tabReady.value = true;

    loadBackups();
    unsubscribeLogin = loginManager.onLogin(() => loadBackups());
    unsubscribeLogout = loginManager.onLogout(() => loadBackups());

    updateMixerPreview();
    state.value.disabledAccel = !have_sensor(fcStore.config.activeSensors, "acc");

    initModelPreview();
    renderModel();
    addInterval(
        "checking_receiver_pull_for_model_preview",
        () => {
            MSP.send_message(MSPCodes.MSP_RC, false, false);
        },
        33,
        false,
    );

    await MSP.promise(MSPCodes.MSP_PID_ADVANCED);
    await MSP.promise(MSPCodes.MSP_FEATURE_CONFIG);
    await MSP.promise(MSPCodes.MSP_MIXER_CONFIG);
    await MSP.promise(MSPCodes.MSP_MOTOR_CONFIG);
    if (fcStore.motorConfig.use_dshot_telemetry || fcStore.motorConfig.use_esc_sensor) {
        await MSP.promise(MSPCodes.MSP_MOTOR_TELEMETRY);
    }
    await MSP.promise(MSPCodes.MSP_MOTOR_3D_CONFIG);
    await MSP.promise(MSPCodes.MSP2_MOTOR_OUTPUT_REORDERING);
    await MSP.promise(MSPCodes.MSP_ADVANCED_CONFIG);

    motorsState.initializeDefaults();
    setupConfigWatchers();

    updateMixerPreview();

    // Force reactivity update after MSP data loads
    nextTick(() => {
        // Trigger computed property updates
        const _ = isMotorReorderingAvailable.value;
        const __ = isMotorDirectionAvailable.value;
    });
});

onUnmounted(() => {
    cancelScheduledReconnect();
    cliSession.cancel();
    unsubscribeLogin?.();
    unsubscribeLogout?.();

    keepRendering = false;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    window.removeEventListener("resize", handleModelResize);
    if (model?.dispose) {
        model.dispose();
    }
});

async function ensureMspCliSupported() {
    if (isMspCliSupported()) {
        return true;
    }

    await dialog.showInfo(
        i18n.getMessage("warningTitle"),
        i18n.getMessage("mspCliFirmwareTooOld", {
            required: "1.47.0",
            current: FC.CONFIG?.flightControllerVersion || "?",
        }),
        {
            confirmText: i18n.getMessage("close"),
        },
    );
    return false;
}

async function loadBackups() {
    isLoadingBackups.value = true;

    try {
        const loggedIn = await loginManager.isUserLoggedIn();
        isLoggedIn.value = loggedIn;

        if (!loggedIn) {
            userApi = null;
            backups.value = [];
            backupMessage.value = i18n.getMessage("userBackupLoginRequired");
            return;
        }

        userApi = loginManager.getUserApi();
        const response = await userApi.getBackups();
        backups.value = response.backups ?? [];
        backupMessage.value = response.message ?? null;
    } catch (error) {
        gui_log(`${i18n.getMessage("userBackupsLoadFailed")}: ${error}`);
    } finally {
        isLoadingBackups.value = false;
    }
}

async function createBackup() {
    if (!(await ensureMspCliSupported())) {
        return;
    }

    const loggedIn = await loginManager.isUserLoggedIn();
    if (!loggedIn) {
        await dialog.showInfo(i18n.getMessage("warningTitle"), i18n.getMessage("userBackupLoginRequired"), {
            confirmText: i18n.getMessage("close"),
        });
        return;
    }

    isCreatingBackup.value = true;
    const waitingDialog = dialog.showWait(i18n.getMessage("actionBackup"), null);

    try {
        userApi = userApi || loginManager.getUserApi();
        if (!userApi) {
            throw new Error(i18n.getMessage("notLoggedIn"));
        }

        const output = await cliSession.readDumpAll();
        if (!output.length) {
            throw new Error(i18n.getMessage("profileBackupEmptyResult") || "Empty backup result");
        }

        gui_log(i18n.getMessage("profileBackupSuccess"));
        await userApi.uploadBackup(output.join("\n"));
        gui_log(i18n.getMessage("profileBackupApiSuccess"));
        await loadBackups();
    } catch (error) {
        const message = `${i18n.getMessage("profileBackupApiFail")} : ${error.message || error}`;
        gui_log(message);
        console.error("Backup creation failed:", error);
        await dialog.showInfo(i18n.getMessage("warningTitle"), message, { confirmText: i18n.getMessage("close") });
    } finally {
        waitingDialog.close();
        isCreatingBackup.value = false;
    }
}

async function downloadBackup(backup) {
    try {
        if (!userApi) {
            throw new Error(i18n.getMessage("notLoggedIn"));
        }

        const response = await userApi.downloadBackupFile(backup.id);
        const fileContent = response.file;
        if (!fileContent?.length) {
            throw new Error(i18n.getMessage("userBackupFileEmpty"));
        }

        const filename = response.name || backup.name || "backup.txt";
        const blob = new Blob([fileContent], { type: "text/plain" });
        const url = globalThis.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        globalThis.URL.revokeObjectURL(url);
    } catch (error) {
        gui_log(`${i18n.getMessage("userBackupDownloadFailed")}: ${error}`);
    }
}

function startEdit(backup) {
    editForm.value = {
        id: backup.id,
        name: backup.name,
        description: backup.description || "",
        created: backup.created,
    };
    isEditing.value = true;
}

async function saveBackupChanges() {
    if (!userApi) {
        return;
    }

    try {
        await userApi.updateBackup({
            Id: editForm.value.id,
            name: editForm.value.name,
            description: editForm.value.description,
        });
        gui_log(i18n.getMessage("userBackupUpdateSuccess"));
        await loadBackups();
        isEditing.value = false;
    } catch (error) {
        gui_log(`${i18n.getMessage("userBackupUpdateFailed")}: ${error}`);
    }
}

async function restoreBackup(backup) {
    if (!userApi) {
        gui_log(i18n.getMessage("notLoggedIn"));
        return;
    }

    if (!connectionStore.connectionValid) {
        return;
    }

    if (!(await ensureMspCliSupported())) {
        return;
    }

    const confirmed = await dialog.showYesNo(
        i18n.getMessage("titleRestoreBackup"),
        i18n.getMessage("userBackupRestoreConfirm", { name: backup.name || i18n.getMessage("itemBackup") }),
        {
            yesText: i18n.getMessage("actionRestore"),
            noText: i18n.getMessage("presetsButtonCancel"),
        },
    );

    if (!confirmed) {
        return;
    }

    let text;
    try {
        const response = await userApi.downloadBackupFile(backup.id);
        text = response.file;
        if (!text?.length) {
            throw new Error(i18n.getMessage("userBackupFileEmpty"));
        }
    } catch (error) {
        gui_log(`${i18n.getMessage("userBackupRestoreFailed")}: ${error.message || error}`);
        return;
    }

    const fileLines = text.split(/\r?\n/);
    const hasDefaultsPrefix = fileLines.some((line) => line.trim().toLowerCase() === "defaults nosave");
    const commands = hasDefaultsPrefix ? fileLines : ["defaults nosave", "", ...fileLines];

    restoreProgress.value = 0;
    restoreProgressOpen.value = true;

    const result = await cliSession.runBatch(commands, {
        onProgress: ({ index, total }) => {
            restoreProgress.value = total > 0 ? Math.round((index / total) * 100) : 100;
        },
        commandTimeoutMs: 5000,
    });

    restoreProgressOpen.value = false;

    if (result.cancelled) {
        return;
    }

    if (result.errors.length > 0) {
        restoreErrors.value = result.errors;
        restoreErrorsOpen.value = true;
        return;
    }

    gui_log(i18n.getMessage("userBackupRestoreSuccess"));
    await saveAndReconnect();
}

function closeRestoreErrors(saveAnyway) {
    restoreSavePressed.value = saveAnyway;
    restoreErrorsOpen.value = false;
}

async function handleRestoreErrorsClose() {
    const savePressed = restoreSavePressed.value;
    restoreSavePressed.value = false;

    if (savePressed) {
        await saveAndReconnect();
        return;
    }

    try {
        await cliSession.send("exit");
    } catch (error) {
        console.error("Failed to send exit:", error);
    } finally {
        scheduleReconnect();
    }
}

watch(restoreProgressOpen, async (isOpen) => {
    await nextTick();
    if (!restoreProgressDialogRef.value) {
        return;
    }
    if (isOpen && !restoreProgressDialogRef.value.open) {
        restoreProgressDialogRef.value.showModal();
    } else if (!isOpen && restoreProgressDialogRef.value.open) {
        restoreProgressDialogRef.value.close();
    }
});

watch(restoreErrorsOpen, async (isOpen) => {
    await nextTick();
    if (!restoreErrorsDialogRef.value) {
        return;
    }
    if (isOpen && !restoreErrorsDialogRef.value.open) {
        restoreErrorsDialogRef.value.showModal();
    } else if (!isOpen && restoreErrorsDialogRef.value.open) {
        restoreErrorsDialogRef.value.close();
    }
});

async function deleteBackup(backupId) {
    const confirmed = globalThis.confirm(i18n.getMessage("confirmDelete", { item: i18n.getMessage("itemBackup") }));
    if (!confirmed) {
        return;
    }

    if (!userApi) {
        gui_log(i18n.getMessage("notLoggedIn"));
        return;
    }

    try {
        await userApi.deleteBackup(backupId);
        gui_log(i18n.getMessage("userBackupDeleteSuccess"));
        await loadBackups();
    } catch (error) {
        gui_log(`${i18n.getMessage("userBackupDeleteFailed")}: ${error}`);
    }
}

function formatDate(dateString) {
    if (!dateString) {
        return "";
    }
    return new Date(dateString).toLocaleString();
}

function showWarningDialog(message) {
    warningMessage.value = message;
    dialogSettingsChanged.value?.showModal();
}

const warningMessage = ref("");
const reverseMotorDir = computed({
    get: () => fcStore.mixerConfig.reverseMotorDir === 1,
    set: (val) => {
        fcStore.mixerConfig.reverseMotorDir = val ? 1 : 0;
    },
});

const sortedMixerListItems = computed(() =>
    [...mixerList]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({ label: m.name.toUpperCase(), value: m.pos + 1, disabled: m.disabled })),
);

const mixerPreviewSvg = ref("");

const updateMixerPreview = async () => {
    const imgSrc = getMixerImageSrc(fcStore.mixerConfig.mixer, fcStore.mixerConfig.reverseMotorDir);
    try {
        const response = await fetch(imgSrc);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "image/svg+xml");
        const svg = doc.querySelector("svg");
        if (svg) {
            mixerPreviewSvg.value = svg.outerHTML;
        }
    } catch (e) {
        console.error("Failed to load mixer preview", e);
    }
};

watch(
    [() => fcStore.mixerConfig.mixer, () => fcStore.motorOutputOrder?.length],
    () => {
        // Force reactivity update for motor reordering availability
    },
    { immediate: true },
);

watch(
    () => digitalProtocolConfigured.value,
    () => {
        // Force reactivity update for motor direction availability
    },
    { immediate: true },
);

const numberOfValidOutputs = computed(() => {
    const mixer = fcStore.mixerConfig.mixer;
    const defaultMotorCount = 4;
    if (mixer <= 0 || mixer > mixerList.length) {
        return defaultMotorCount;
    }

    const expectedMotorCount = mixerList[mixer - 1].motors;
    const firmwareCount = fcStore.motorConfig.motor_count || expectedMotorCount;
    return Math.min(firmwareCount, getActualMotorCount(expectedMotorCount));
});

const maxSliderValue = computed(() => {
    if (digitalProtocolConfigured.value) {
        return 2000;
    }
    return fcStore.motorConfig.maxthrottle;
});

const getActualMotorCount = (expectedMotorCount) => {
    if (!fcStore.motorData || fcStore.motorData.length === 0) {
        return expectedMotorCount;
    }
    const firstZeroIndex = fcStore.motorData.indexOf(0);
    if (firstZeroIndex === -1) {
        return expectedMotorCount;
    }
    return firstZeroIndex > 0 ? firstZeroIndex : expectedMotorCount;
};

const onMotorSliderChange = () => {
    bufferingSetMotor.push([...motorValues.value]);
    if (!bufferDelay) {
        bufferDelay = setTimeout(sendBufferedMotorCommand, 10);
    }
};

const onMasterSliderChange = () => {
    for (let i = 0; i < numberOfValidOutputs.value; i++) {
        motorValues.value[i] = masterValue.value;
    }
    bufferingSetMotor.push([...motorValues.value]);
    if (!bufferDelay) {
        bufferDelay = setTimeout(sendBufferedMotorCommand, 10);
    }
};

const onMotorValueUpdate = (index, val) => {
    motorValues.value[index] = val;
    onMotorSliderChange();
};

const onMasterValueUpdate = (val) => {
    masterValue.value = val;
    onMasterSliderChange();
};

const onSliderWheel = (index, event) => {
    if (!motorsTestingEnabled.value) {
        return;
    }

    const step = 25;
    const delta = event.deltaY > 0 ? -step : step;
    let newVal;
    if (index === -1) {
        newVal = masterValue.value + delta;
    } else {
        newVal = motorValues.value[index] + delta;
    }

    newVal = Math.max(minSliderValue.value, Math.min(maxSliderValue.value, newVal));
    newVal = Math.round(newVal / step) * step;

    if (index === -1) {
        masterValue.value = newVal;
        onMasterSliderChange();
    } else {
        motorValues.value[index] = newVal;
        onMotorSliderChange();
    }
};

watch(motorsTestingEnabled, (enabled) => {
    if (!enabled) {
        if (bufferDelay) {
            clearTimeout(bufferDelay);
            bufferDelay = null;
            bufferingSetMotor = [];
        }
    }
});

const getMotorValue = (index) => {
    if (motorsTestingEnabled.value) {
        return fcStore.motorData[index] ?? minSliderValue.value;
    }
    return minSliderValue.value;
};

const getMotorBarHeight = (index) => {
    const val = getMotorValue(index);
    const min = minSliderValue.value;
    const max = maxSliderValue.value;
    const range = max - min;
    if (range === 0) {
        return 0;
    }
    return Math.max(0, Math.min(100, ((val - min) / range) * 100));
};

const getTelemetryHtml = (index) => {
    if (!fcStore.motorConfig.use_dshot_telemetry && !fcStore.features.features.isEnabled("ESC_SENSOR")) {
        return "&nbsp;";
    }
    if (!fcStore.motorTelemetryData || !fcStore.motorTelemetryData.rpm) {
        return "&nbsp;";
    }

    const rpm = fcStore.motorTelemetryData.rpm[index];
    let rpmText = rpm;
    if (rpm > 999999) {
        rpmText = `${(rpm / 1000000).toFixed(2)}M`;
    }

    let html = `RPM: ${rpmText}`;
    if (fcStore.motorConfig.use_dshot_telemetry) {
        const invalid = fcStore.motorTelemetryData.invalidPercent[index];
        const errorClass = invalid > 100 ? "warning" : "";
        html += `<br><span class="${errorClass}">Err: ${(invalid / 100).toFixed(2)}%</span>`;
    }
    if (fcStore.motorTelemetryData.temperature) {
        html += `<br>Temp: ${fcStore.motorTelemetryData.temperature[index]}&deg;C`;
    }
    return html;
};

const stopMotors = () => {
    motorsTestingEnabled.value = false;
};

const disarmFlagElements = [
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

const prepareDisarmFlags = function () {
    const cfg = fcStore.config;
    const elements = [...disarmFlagElements];

    if (semver.gte(cfg.apiVersion, API_VERSION_1_46)) {
        replaceArrayElement(elements, "RPMFILTER", "DSHOT_TELEM");
    }

    if (semver.gte(cfg.apiVersion, API_VERSION_1_47)) {
        addArrayElementsAfter(elements, "MOTOR_PROTOCOL", ["CRASHFLIP", "ALTHOLD", "POSHOLD"]);
    }

    // Build arming flags state instead of manipulating DOM
    const flags = Array.from({ length: cfg.armingDisableCount }, (_, i) => {
        const isLastBit = i === cfg.armingDisableCount - 1;
        const knownName = elements[i];

        // 1. Determine the raw name and whether it is a fallback numeric ID
        // We prioritize the "ARM_SWITCH" for the last bit, then known elements, then numeric fallback.
        let rawName;
        let isFallback = false;

        if (isLastBit) {
            rawName = "ARM_SWITCH";
        } else if (knownName) {
            rawName = knownName;
        } else {
            rawName = `${i + 1}`;
            isFallback = true;
        }

        // 2. Handle display name overrides (e.g., RX_FAILSAFE -> RXLOSS)
        const nameMap = { RX_FAILSAFE: "RXLOSS", NOT_DISARMED: "BAD_RX_RECOVERY" };
        const displayName = nameMap[rawName] || rawName;

        // 3. Construct tooltip, if it's a fallback, we use the base key; otherwise, we append the rawName.
        const messageKey = isFallback
            ? "initialSetupArmingDisableFlagsTooltip"
            : `initialSetupArmingDisableFlagsTooltip${rawName}`;

        return reactive({
            id: `initialSetupArmingDisableFlags${i}`,
            name: displayName,
            tooltip: t(messageKey),
            visible: false,
        });
    });

    fcStore.setArmingFlags(flags);

    // Initial update
    fcStore.updateArmingFlags(cfg.armingDisableFlags);
};

// Watch for armingDisableCount changes to rebuild the arming flags array
const stopArmingCount = watch(
    () => fcStore.config.armingDisableCount,
    (newCount) => {
        if (newCount > 0) {
            prepareDisarmFlags();
        }
    },
);

const stopArmingFlags = watch(
    () => fcStore.config.armingDisableFlags,
    (newVal) => {
        fcStore.updateArmingFlags(newVal);
    },
);

if (fcStore.config.armingDisableCount > 0) {
    prepareDisarmFlags();
}

let bufferingSetMotor = [];
let bufferDelay = null;

const sendBufferedMotorCommand = () => {
    if (bufferingSetMotor.length > 0) {
        const values = bufferingSetMotor.pop();
        sendMotorCommand(values);
        bufferingSetMotor = [];
    }
    bufferDelay = null;
};

onUnmounted(() => {
    if (bufferDelay) {
        clearTimeout(bufferDelay);
        bufferDelay = null;
    }
    if (motorsTestingEnabled.value) {
        sendMotorCommand(new Array(8).fill(minSliderValue.value));
    }
});

function portFieldGet(port, field) {
    return port[field] || NONE;
}

function portFieldSet(port, field, value) {
    port[field] = value === NONE ? "" : value;
}

function isSerialRxDisabled(port) {
    return !port.rxSerial && ports.some((p) => p !== port && p.rxSerial);
}

function onCalibrateAccel() {
    if (state.value.calibratingAccel || state.value.disabledAccel) {
        return;
    }
    state.value.calibratingAccel = true;
    GUI.interval_pause("setup_data_pull_fast");
    GUI.interval_pause("setup_data_pull_slow");
    MSP.send_message(MSPCodes.MSP_ACC_CALIBRATION, false, false, function () {
        gui_log(i18n.getMessage("initialSetupAccelCalibStarted"));
        state.value.calibratingAccel = true;
    });

    addTimeout(
        "button_reset",
        function () {
            GUI.interval_resume("setup_data_pull_fast");
            GUI.interval_resume("setup_data_pull_slow");
            gui_log(i18n.getMessage("initialSetupAccelCalibEnded"));
            state.value.calibratingAccel = false;
        },
        2000,
    );
}
</script>

<style scoped>
.content_wrapper {
    padding-bottom: 60px;
}

.bars {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-weight: bold;
    ul {
        display: flex;
        gap: 0.5rem;
        &:nth-of-type(1) {
            :deep([data-slot="indicator"]) {
                background-color: #f1453d;
            }
        }
        &:nth-of-type(2) {
            :deep([data-slot="indicator"]) {
                background-color: #673fb4;
            }
        }
        &:nth-of-type(3) {
            :deep([data-slot="indicator"]) {
                background-color: #2b98f0;
            }
        }
        &:nth-of-type(4) {
            :deep([data-slot="indicator"]) {
                background-color: #1fbcd2;
            }
        }
        &:nth-of-type(5) {
            :deep([data-slot="indicator"]) {
                background-color: #159588;
            }
        }
        &:nth-of-type(6) {
            :deep([data-slot="indicator"]) {
                background-color: #50ae55;
            }
        }
        &:nth-of-type(7) {
            :deep([data-slot="indicator"]) {
                background-color: #cdda49;
            }
        }
        &:nth-of-type(8) {
            :deep([data-slot="indicator"]) {
                background-color: #fdc02f;
            }
        }
        &:nth-of-type(9) {
            :deep([data-slot="indicator"]) {
                background-color: #fc5830;
            }
        }
        &:nth-of-type(10) {
            :deep([data-slot="indicator"]) {
                background-color: #785549;
            }
        }
        &:nth-of-type(11) {
            :deep([data-slot="indicator"]) {
                background-color: #9e9e9e;
            }
        }
        &:nth-of-type(12) {
            :deep([data-slot="indicator"]) {
                background-color: #617d8a;
            }
        }
        &:nth-of-type(13) {
            :deep([data-slot="indicator"]) {
                background-color: #cf267d;
            }
        }
        &:nth-of-type(14) {
            :deep([data-slot="indicator"]) {
                background-color: #7a1464;
            }
        }
        &:nth-of-type(15) {
            :deep([data-slot="indicator"]) {
                background-color: #3a7a14;
            }
        }
        &:nth-of-type(16) {
            :deep([data-slot="indicator"]) {
                background-color: #14407a;
            }
        }
    }
    .name {
        width: 5rem;
        text-align: right;
    }
    .meter {
        width: 100%;
    }
    .meter-bar {
        position: relative;
        container-type: inline-size;
        width: 100%;
        height: 1rem;
        border: 1px solid var(--surface-500);
        background-color: var(--surface-200);
        border-radius: 0.3rem;
        .label {
            position: absolute;
            width: 50px;
            text-align: center;
            left: calc(50cqi - 25px);
            color: var(--text);
        }
        .fill {
            position: relative;
            overflow: hidden;
            border-radius: 0.3rem;
            width: 50%;
            height: 1rem;
            background-color: var(--primary-500);
            .label {
                color: white;
            }
        }
    }
}

.backups_cli_background {
    border: 1px solid var(--ui-border);
    background-color: rgba(64, 64, 64, 1);
    height: 300px;
    border-radius: 5px;
    box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
    overflow-y: auto;
}
</style>
