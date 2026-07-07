package dev.becken.faces.dtp;

import java.util.Collection;
import java.util.List;

import jakarta.faces.component.FacesComponent;
import jakarta.faces.component.UIInput;
import jakarta.faces.component.behavior.ClientBehaviorHolder;

/**
 * A hybrid Jakarta Faces datetime picker.
 *
 * <p>"JSF at heart": this is a real {@link UIInput} — it participates in the full
 * server-side lifecycle (decode, validation, conversion, model update) and works with
 * {@code <f:ajax>} out of the box. The visual widget itself is rendered and driven by a
 * dependency-free JavaScript/CSS pair shipped as Faces resources.</p>
 *
 * <p>Supported attributes:</p>
 * <ul>
 *   <li>{@code value}    — LocalDateTime / LocalDate / LocalTime depending on {@code mode}</li>
 *   <li>{@code mode}     — {@code datetime} (default), {@code date} or {@code time}</li>
 *   <li>{@code pattern}  — display pattern (subset: yyyy MM dd HH mm ss); defaults per mode</li>
 *   <li>{@code minuteStep} — granularity of the minute grid (default 5; typing is always exact)</li>
 *   <li>{@code min}/{@code max} — ISO strings limiting the selectable range</li>
 *   <li>{@code placeholder}, {@code disabled}, {@code required}, {@code label}</li>
 * </ul>
 */
@FacesComponent(value = DateTimePicker.COMPONENT_TYPE, createTag = false)
public class DateTimePicker extends UIInput implements ClientBehaviorHolder {

    public static final String COMPONENT_TYPE = "dev.becken.faces.DateTimePicker";
    public static final String COMPONENT_FAMILY = "dev.becken.faces";
    public static final String RENDERER_TYPE = "dev.becken.faces.DateTimePickerRenderer";

    private static final Collection<String> EVENT_NAMES = List.of("valueChange", "change");

    @Override
    public Collection<String> getEventNames() {
        return EVENT_NAMES;
    }

    @Override
    public String getDefaultEventName() {
        return "valueChange";
    }

    public DateTimePicker() {
        setRendererType(RENDERER_TYPE);
    }

    @Override
    public String getFamily() {
        return COMPONENT_FAMILY;
    }

    public String getMode() {
        String mode = (String) getStateHelper().eval("mode", "datetime");
        return switch (mode) {
            case "date", "time" -> mode;
            default -> "datetime";
        };
    }

    public void setMode(String mode) {
        getStateHelper().put("mode", mode);
    }

    /** Display pattern; falls back to a sensible default for the current mode. */
    public String getPattern() {
        String pattern = (String) getStateHelper().eval("pattern");
        if (pattern != null && !pattern.isBlank()) {
            return pattern;
        }
        return switch (getMode()) {
            case "date" -> "yyyy-MM-dd";
            case "time" -> "HH:mm";
            default -> "yyyy-MM-dd HH:mm";
        };
    }

    public void setPattern(String pattern) {
        getStateHelper().put("pattern", pattern);
    }

    public int getMinuteStep() {
        Object v = getStateHelper().eval("minuteStep", 5);
        int step = (v instanceof Number n) ? n.intValue() : Integer.parseInt(v.toString());
        return (step >= 1 && step <= 30) ? step : 5;
    }

    public void setMinuteStep(int minuteStep) {
        getStateHelper().put("minuteStep", minuteStep);
    }

    public String getMin() {
        Object v = getStateHelper().eval("min");
        return v == null ? null : v.toString(); // LocalDate/LocalDateTime toString() is ISO
    }

    public void setMin(String min) {
        getStateHelper().put("min", min);
    }

    public String getMax() {
        Object v = getStateHelper().eval("max");
        return v == null ? null : v.toString();
    }

    public void setMax(String max) {
        getStateHelper().put("max", max);
    }

    public String getPlaceholder() {
        return (String) getStateHelper().eval("placeholder");
    }

    public void setPlaceholder(String placeholder) {
        getStateHelper().put("placeholder", placeholder);
    }

    public boolean isDisabled() {
        return Boolean.parseBoolean(String.valueOf(getStateHelper().eval("disabled", false)));
    }

    public void setDisabled(boolean disabled) {
        getStateHelper().put("disabled", disabled);
    }
}
