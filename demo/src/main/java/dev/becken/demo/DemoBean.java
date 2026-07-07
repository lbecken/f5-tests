package dev.becken.demo;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

import jakarta.faces.event.AjaxBehaviorEvent;
import jakarta.faces.view.ViewScoped;
import jakarta.inject.Named;

@Named
@ViewScoped
public class DemoBean implements Serializable {

    private LocalDateTime appointment =
            LocalDateTime.now().plusDays(1).withHour(10).withMinute(30).withSecond(0).withNano(0);
    private LocalDate birthday;
    private LocalTime reminder;
    private LocalDateTime meeting;

    private String ajaxMessage = "Pick a value above — this text updates via <f:ajax> without a page reload.";
    private int ajaxCalls;

    public void onAppointmentChange(AjaxBehaviorEvent event) {
        ajaxCalls++;
        if (appointment == null) {
            ajaxMessage = "Cleared. (ajax call #" + ajaxCalls + ")";
        } else {
            ajaxMessage = "Server received "
                    + appointment.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy 'at' HH:mm"))
                    + " (ajax call #" + ajaxCalls + ")";
        }
    }

    public String submit() {
        return null; // stay on page; values shown in the summary panel
    }

    public LocalDateTime getAppointment() { return appointment; }
    public void setAppointment(LocalDateTime appointment) { this.appointment = appointment; }

    public LocalDate getBirthday() { return birthday; }
    public void setBirthday(LocalDate birthday) { this.birthday = birthday; }

    public LocalTime getReminder() { return reminder; }
    public void setReminder(LocalTime reminder) { this.reminder = reminder; }

    public LocalDateTime getMeeting() { return meeting; }
    public void setMeeting(LocalDateTime meeting) { this.meeting = meeting; }

    public String getAjaxMessage() { return ajaxMessage; }

    public LocalDate getMinMeetingDate() { return LocalDate.now(); }
    public LocalDate getMaxMeetingDate() { return LocalDate.now().plusMonths(3); }
}
