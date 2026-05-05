import FC from "./fc";

/**
 * Encapsulates the AutoComplete cache-building logic.
 *
 * The dropdown UI is handled by the Vue CliAutocompleteDropdown component
 * and the useCliAutocomplete composable.
 */
const DisableWarningAcc = {
    configEnabled: false,
    builder: { state: "reset", numFails: 0 },
};

DisableWarningAcc.setEnabled = function (value) {
    this.configEnabled = !!value;
};

DisableWarningAcc.isEnabled = function () {
    return (
        this.isBuilding() ||
        (this.configEnabled && FC.CONFIG.flightControllerIdentifier === "BTFL" && this.builder.state !== "fail")
    );
};

export default DisableWarningAcc;
