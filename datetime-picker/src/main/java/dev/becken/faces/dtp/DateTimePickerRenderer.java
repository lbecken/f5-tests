package dev.becken.faces.dtp;

import java.io.IOException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Month;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.time.temporal.WeekFields;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.faces.application.ResourceDependency;
import jakarta.faces.component.UIComponent;
import jakarta.faces.component.behavior.ClientBehavior;
import jakarta.faces.component.behavior.ClientBehaviorContext;
import jakarta.faces.context.FacesContext;
import jakarta.faces.context.ResponseWriter;
import jakarta.faces.convert.Converter;
import jakarta.faces.convert.ConverterException;
import jakarta.faces.render.FacesRenderer;
import jakarta.faces.render.Renderer;

/**
 * Renders the picker as: hidden input (canonical ISO value, decoded server-side)
 * + visible text input (human-readable, typeable) + popover widget built by dtp.js.
 *
 * <p>The hidden input carries the component's clientId as its name, so standard
 * UIInput decoding applies. Client behaviors attached for the {@code change} /
 * {@code valueChange} events (e.g. {@code <f:ajax/>}) are rendered onto the hidden
 * input's onchange handler; the JS widget dispatches a native change event when the
 * user commits a value, which triggers the Faces ajax request.</p>
 */
@FacesRenderer(componentFamily = DateTimePicker.COMPONENT_FAMILY,
               rendererType = DateTimePicker.RENDERER_TYPE)
@ResourceDependency(library = "becken", name = "dtp.css", target = "head")
@ResourceDependency(library = "becken", name = "dtp.js", target = "head")
public class DateTimePickerRenderer extends Renderer {

    @Override
    public void decode(FacesContext context, UIComponent uiComponent) {
        DateTimePicker component = (DateTimePicker) uiComponent;
        if (component.isDisabled()) {
            return;
        }
        String clientId = component.getClientId(context);
        Map<String, String> params = context.getExternalContext().getRequestParameterMap();
        String submitted = params.get(clientId);
        if (submitted != null) {
            component.setSubmittedValue(submitted);
        }
        decodeBehaviors(context, component, clientId, params);
    }

    private void decodeBehaviors(FacesContext context, DateTimePicker component,
                                 String clientId, Map<String, String> params) {
        Map<String, List<ClientBehavior>> behaviors = component.getClientBehaviors();
        if (behaviors.isEmpty()) {
            return;
        }
        String behaviorEvent = params.get(ClientBehaviorContext.BEHAVIOR_EVENT_PARAM_NAME);
        String behaviorSource = params.get(ClientBehaviorContext.BEHAVIOR_SOURCE_PARAM_NAME);
        if (behaviorEvent == null || !clientId.equals(behaviorSource)) {
            return;
        }
        List<ClientBehavior> eventBehaviors = behaviors.get(behaviorEvent);
        if (eventBehaviors != null) {
            for (ClientBehavior behavior : eventBehaviors) {
                behavior.decode(context, component);
            }
        }
    }

    @Override
    public Object getConvertedValue(FacesContext context, UIComponent uiComponent,
                                    Object submittedValue) throws ConverterException {
        DateTimePicker component = (DateTimePicker) uiComponent;
        String raw = (String) submittedValue;
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Converter<?> converter = component.getConverter();
        if (converter != null) {
            return converter.getAsObject(context, component, raw);
        }
        try {
            return switch (component.getMode()) {
                case "date" -> LocalDate.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE);
                case "time" -> LocalTime.parse(raw, DateTimeFormatter.ISO_LOCAL_TIME);
                default -> LocalDateTime.parse(raw, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            };
        } catch (DateTimeParseException e) {
            throw new ConverterException(new jakarta.faces.application.FacesMessage(
                    jakarta.faces.application.FacesMessage.SEVERITY_ERROR,
                    invalidMessage(component, raw), null), e);
        }
    }

    private String invalidMessage(DateTimePicker component, String raw) {
        Object label = component.getAttributes().get("label");
        String name = label != null ? label.toString() : component.getClientId();
        return name + ": '" + raw + "' is not a valid " + component.getMode() + " value.";
    }

    @Override
    public void encodeEnd(FacesContext context, UIComponent uiComponent) throws IOException {
        DateTimePicker component = (DateTimePicker) uiComponent;
        ResponseWriter w = context.getResponseWriter();
        String clientId = component.getClientId(context);
        Locale locale = context.getViewRoot().getLocale();
        if (locale == null) {
            locale = Locale.getDefault();
        }

        String isoValue = isoValue(component);
        String displayValue = isoValue.isEmpty() ? "" : formatDisplay(component, isoValue);

        w.startElement("div", component);
        w.writeAttribute("id", clientId, "id");
        w.writeAttribute("class", cssClass(component), null);
        w.writeAttribute("data-bdtp", "root", null);

        // Canonical value, ISO formatted. Named after the clientId → standard decode.
        w.startElement("input", component);
        w.writeAttribute("type", "hidden", null);
        w.writeAttribute("name", clientId, null);
        w.writeAttribute("id", clientId + ":iso", null);
        w.writeAttribute("value", isoValue, "value");
        String behaviorScript = changeBehaviorScript(context, component, clientId);
        if (behaviorScript != null) {
            w.writeAttribute("onchange", behaviorScript, null);
        }
        w.endElement("input");

        // Human-facing input: typeable, formatted with the display pattern.
        w.startElement("input", component);
        w.writeAttribute("type", "text", null);
        w.writeAttribute("id", clientId + ":display", null);
        w.writeAttribute("class", "bdtp-input", null);
        w.writeAttribute("value", displayValue, null);
        w.writeAttribute("autocomplete", "off", null);
        w.writeAttribute("spellcheck", "false", null);
        String placeholder = component.getPlaceholder();
        w.writeAttribute("placeholder", placeholder != null ? placeholder : component.getPattern(), null);
        if (component.isDisabled()) {
            w.writeAttribute("disabled", "disabled", null);
        }
        w.endElement("input");

        w.startElement("button", component);
        w.writeAttribute("type", "button", null);
        w.writeAttribute("class", "bdtp-trigger", null);
        w.writeAttribute("aria-label", "Open " + component.getMode() + " picker", null);
        if (component.isDisabled()) {
            w.writeAttribute("disabled", "disabled", null);
        }
        w.write(triggerIcon(component.getMode()));
        w.endElement("button");

        w.endElement("div");

        w.startElement("script", component);
        w.write("BeckenDTP.init(" + jsString(clientId) + "," + configJson(component, locale) + ");");
        w.endElement("script");
    }

    private String cssClass(DateTimePicker component) {
        String css = "bdtp";
        if (component.isDisabled()) {
            css += " bdtp-disabled";
        }
        if (!component.isValid()) {
            css += " bdtp-invalid";
        }
        Object styleClass = component.getAttributes().get("styleClass");
        if (styleClass != null) {
            css += " " + styleClass;
        }
        return css;
    }

    /** The ISO string for the hidden input: submitted value during re-render, else the model value. */
    private String isoValue(DateTimePicker component) {
        Object submitted = component.getSubmittedValue();
        if (submitted != null) {
            return submitted.toString();
        }
        Object value = component.getValue();
        if (value == null) {
            return "";
        }
        if (value instanceof LocalDateTime dt) {
            return dt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        if (value instanceof LocalDate d) {
            return d.format(DateTimeFormatter.ISO_LOCAL_DATE);
        }
        if (value instanceof LocalTime t) {
            return t.format(DateTimeFormatter.ISO_LOCAL_TIME);
        }
        return value.toString();
    }

    private String formatDisplay(DateTimePicker component, String iso) {
        try {
            DateTimeFormatter out = DateTimeFormatter.ofPattern(component.getPattern());
            return switch (component.getMode()) {
                case "date" -> LocalDate.parse(iso).format(out);
                case "time" -> LocalTime.parse(iso).format(out);
                default -> LocalDateTime.parse(iso).format(out);
            };
        } catch (DateTimeParseException | IllegalArgumentException e) {
            return iso;
        }
    }

    /** Renders attached change/valueChange client behaviors (e.g. f:ajax) into one onchange script. */
    private String changeBehaviorScript(FacesContext context, DateTimePicker component, String clientId) {
        Map<String, List<ClientBehavior>> behaviors = component.getClientBehaviors();
        List<ClientBehavior> list = behaviors.get("valueChange");
        if (list == null) {
            list = behaviors.get("change");
        }
        if (list == null || list.isEmpty()) {
            return null;
        }
        ClientBehaviorContext ctx = ClientBehaviorContext.createClientBehaviorContext(
                context, component, "valueChange", clientId, null);
        StringBuilder script = new StringBuilder();
        for (ClientBehavior behavior : list) {
            String s = behavior.getScript(ctx);
            if (s != null) {
                if (script.length() > 0) {
                    script.append(';');
                }
                script.append(s);
            }
        }
        return script.length() > 0 ? script.toString() : null;
    }

    private String configJson(DateTimePicker component, Locale locale) {
        StringBuilder json = new StringBuilder("{");
        json.append("\"mode\":").append(jsString(component.getMode()));
        json.append(",\"pattern\":").append(jsString(component.getPattern()));
        json.append(",\"minuteStep\":").append(component.getMinuteStep());
        if (component.getMin() != null) {
            json.append(",\"min\":").append(jsString(component.getMin()));
        }
        if (component.getMax() != null) {
            json.append(",\"max\":").append(jsString(component.getMax()));
        }
        // Locale data resolved server-side so the widget honors the view locale.
        WeekFields week = WeekFields.of(locale);
        json.append(",\"firstDay\":").append(week.getFirstDayOfWeek().getValue() % 7); // 0 = Sunday
        json.append(",\"months\":[");
        for (Month m : Month.values()) {
            if (m.ordinal() > 0) json.append(',');
            json.append(jsString(m.getDisplayName(TextStyle.FULL_STANDALONE, locale)));
        }
        json.append("],\"monthsShort\":[");
        for (Month m : Month.values()) {
            if (m.ordinal() > 0) json.append(',');
            json.append(jsString(m.getDisplayName(TextStyle.SHORT_STANDALONE, locale)));
        }
        json.append("],\"weekdays\":[");
        // Indexed 0..6 starting at Sunday to match JS Date.getDay().
        for (int i = 0; i < 7; i++) {
            if (i > 0) json.append(',');
            DayOfWeek dow = DayOfWeek.of(i == 0 ? 7 : i);
            json.append(jsString(dow.getDisplayName(TextStyle.NARROW_STANDALONE, locale)));
        }
        json.append("]}");
        return json.toString();
    }

    private static String jsString(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> b.append("\\\"");
                case '\\' -> b.append("\\\\");
                case '<' -> b.append("\\u003c");
                case '>' -> b.append("\\u003e");
                case '\n' -> b.append("\\n");
                case '\r' -> b.append("\\r");
                default -> b.append(c);
            }
        }
        return b.append('"').toString();
    }

    private String triggerIcon(String mode) {
        if ("time".equals(mode)) {
            return "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor'"
                 + " stroke-width='1.8' stroke-linecap='round' aria-hidden='true'>"
                 + "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3.2 1.8'/></svg>";
        }
        return "<svg viewBox='0 0 24 24' width='18' height='18' fill='none' stroke='currentColor'"
             + " stroke-width='1.8' stroke-linecap='round' aria-hidden='true'>"
             + "<rect x='3.5' y='5' width='17' height='15.5' rx='2.5'/>"
             + "<path d='M3.5 9.5h17M8 3v4M16 3v4'/></svg>";
    }
}
