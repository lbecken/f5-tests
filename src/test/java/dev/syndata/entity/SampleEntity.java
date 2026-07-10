package dev.syndata.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;

/** Fixture for {@link EntityScannerTest}; mirrors table sample_entity. */
@Entity
@Table(name = "sample_entity")
public class SampleEntity {

    public enum Mood {HAPPY, GRUMPY}

    @Id
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "mood")
    private Mood mood;

    @Email
    private String contactEmail;
}
